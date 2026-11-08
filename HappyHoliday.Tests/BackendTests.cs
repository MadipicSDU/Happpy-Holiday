using System.Diagnostics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Text.Json;
using HappyHoliday.Contracts;
using HappyHoliday.Data;
using HappyHoliday.Models;
using HappyHoliday.Options;
using HappyHoliday.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using Npgsql;

namespace HappyHoliday.Tests;

[TestClass, DoNotParallelize]
public sealed class BackendTests
{
    private const string Key = "sprint2-integration-test-key-with-32-characters";
    private static Process? _server;
    private static string _connection = "";
    private static string _adminConnection = "";
    private static string _databaseName = "";
    private static string _baseUrl = "";
    private static readonly List<string> Logs = [];
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private AppUser[] _clients = [];
    private AppUser[] _managers = [];
    private AppUser[] _staff = [];
    private AppUser _admin = null!;
    private Premise[] _premises = [];
    private EventService _service = null!;
    private readonly DateTimeOffset _start = DateTimeOffset.UtcNow.AddDays(30);

    private static AppDbContext Database() => new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(_connection).Options);

    [ClassInitialize]
    public static async Task Start(TestContext context)
    {
        var configured = Environment.GetEnvironmentVariable("HAPPYHOLIDAY_TEST_POSTGRES");
        if (string.IsNullOrWhiteSpace(configured))
            Assert.Inconclusive("Set HAPPYHOLIDAY_TEST_POSTGRES to an isolated PostgreSQL server with CREATE DATABASE permission.");
        _adminConnection = configured;
        _databaseName = "hh_test_" + Guid.NewGuid().ToString("N");
        await using var admin = new NpgsqlConnection(_adminConnection);
        await admin.OpenAsync();
        await using var create = new NpgsqlCommand($"CREATE DATABASE \"{_databaseName}\"", admin);
        await create.ExecuteNonQueryAsync();
        _connection = new NpgsqlConnectionStringBuilder(_adminConnection) { Database = _databaseName }.ConnectionString;

        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root is not null && !File.Exists(Path.Combine(root.FullName, "HappyHoliday.slnx"))) root = root.Parent;
        Assert.IsNotNull(root);
        var configuration = new DirectoryInfo(AppContext.BaseDirectory).Parent!.Name;
        var dll = Path.Combine(root.FullName, "HappyHoliday", "bin", configuration, "net10.0", "HappyHoliday.dll");
        var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        var port = ((IPEndPoint)listener.LocalEndpoint).Port;
        listener.Stop();
        _baseUrl = $"http://127.0.0.1:{port}";
        var launch = new ProcessStartInfo("dotnet") { WorkingDirectory = root.FullName, UseShellExecute = false,
            CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
        launch.ArgumentList.Add(dll);
        launch.ArgumentList.Add("--urls");
        launch.ArgumentList.Add(_baseUrl);
        launch.Environment["ASPNETCORE_ENVIRONMENT"] = "Development";
        launch.Environment["ConnectionStrings__DefaultConnection"] = _connection;
        launch.Environment["Jwt__Key"] = Key;
        launch.Environment["Jwt__Issuer"] = "HappyHoliday.Api";
        launch.Environment["Jwt__Audience"] = "HappyHoliday.Client";
        launch.Environment["SeedDemoData"] = "false";
        foreach (var seed in new[] { "ManagerSeed", "AdminSeed" })
            foreach (var field in new[] { "Email", "Password", "DisplayName" }) launch.Environment[$"{seed}__{field}"] = "";
        _server = new Process { StartInfo = launch };
        _server.OutputDataReceived += (_, e) => { if (e.Data is not null) lock (Logs) Logs.Add(e.Data); };
        _server.ErrorDataReceived += (_, e) => { if (e.Data is not null) lock (Logs) Logs.Add(e.Data); };
        _server.Start();
        _server.BeginOutputReadLine();
        _server.BeginErrorReadLine();
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
        for (var i = 0; i < 100; i++)
        {
            if (_server.HasExited) Assert.Fail(string.Join('\n', Logs));
            try { if ((await http.GetAsync(_baseUrl + "/api/premises")).IsSuccessStatusCode) return; }
            catch (HttpRequestException) { }
            catch (TaskCanceledException) { }
            await Task.Delay(200);
        }
        Assert.Fail("API did not start:\n" + string.Join('\n', Logs));
    }

    [ClassCleanup]
    public static async Task Stop()
    {
        if (_server is not null)
        {
            if (!_server.HasExited) { _server.Kill(entireProcessTree: true); await _server.WaitForExitAsync(); }
            _server.Dispose();
        }
        if (_databaseName.StartsWith("hh_test_", StringComparison.Ordinal))
        {
            NpgsqlConnection.ClearAllPools();
            await using var admin = new NpgsqlConnection(_adminConnection);
            await admin.OpenAsync();
            await using var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{_databaseName}\" WITH (FORCE)", admin);
            await drop.ExecuteNonQueryAsync();
        }
    }

    [TestInitialize]
    public async Task Seed()
    {
        await using var db = Database();
        await db.Database.ExecuteSqlRawAsync("TRUNCATE order_services, orders, users, premises, event_services CASCADE");
        AppUser User(string role, string name)
        {
            var user = new AppUser { DisplayName = name, Email = name + "@test.local", NormalizedEmail = (name + "@test.local").ToUpperInvariant(),
                Role = role, PasswordHash = "", ClientLimit = 1 };
            user.PasswordHash = new PasswordHasher<AppUser>().HashPassword(user, "Password1!");
            return user;
        }
        _clients = Enumerable.Range(0, 5).Select(i => User("client", "Client" + i)).ToArray();
        _managers = Enumerable.Range(0, 2).Select(i => User("manager", "Manager" + i)).ToArray();
        _staff = Enumerable.Range(0, 3).Select(i => User("staff", "Operator" + i)).ToArray();
        _admin = User("admin", "Administrator");
        _premises = Enumerable.Range(0, 6).Select(i => new Premise { Name = "Venue " + i, Address = "Street " + i,
            Capacity = 100, PricePerHour = 100.01m }).ToArray();
        _service = new EventService { Name = "Equipment", Category = "EquipmentRental", Price = 10.25m };
        db.Users.AddRange(_clients.Concat(_managers).Concat(_staff).Append(_admin));
        db.Premises.AddRange(_premises);
        db.EventServices.Add(_service);
        await db.SaveChangesAsync();
    }

    private HttpClient Http(AppUser? user = null)
    {
        var http = new HttpClient { BaseAddress = new Uri(_baseUrl) };
        if (user is not null)
        {
            var tokens = new TokenService(Microsoft.Extensions.Options.Options.Create(new JwtOptions { Key = Key, Issuer = "HappyHoliday.Api", Audience = "HappyHoliday.Client" }));
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokens.CreateToken(user).AccessToken);
        }
        return http;
    }
    private object Request(int venue = 0, DateTimeOffset? start = null, DateTimeOffset? end = null) => new
    { premiseId = _premises[venue].Id, startsAt = start ?? _start, endsAt = end ?? _start.AddHours(1.5), guests = 50,
        services = new[] { new { serviceId = _service.Id, quantity = 3 } } };
    private static async Task<JsonElement> Body(HttpResponseMessage response) => JsonSerializer.Deserialize<JsonElement>(await response.Content.ReadAsStringAsync(), JsonOptions);
    private static async Task Check(HttpResponseMessage response, HttpStatusCode status)
    {
        var message = await response.Content.ReadAsStringAsync();
        if (status != response.StatusCode) lock (Logs) message += "\n" + string.Join('\n', Logs.TakeLast(70));
        Assert.AreEqual(status, response.StatusCode, message);
    }

    private async Task<JsonElement> PaidOrder(HttpClient client, object request)
    {
        var created = await client.PostAsJsonAsync("/api/orders", request); await Check(created, HttpStatusCode.Created);
        var id = (await Body(created)).GetProperty("id").GetString(); using var admin = Http(_admin);
        await Check(await admin.PostAsync($"/api/orders/{id}/invoice", null), HttpStatusCode.OK);
        var issued = await admin.PostAsync($"/api/orders/{id}/invoice/deliver", null); await Check(issued, HttpStatusCode.OK);
        var invoice = await Body(issued);
        await Check(await client.PostAsJsonAsync($"/api/orders/{id}/invoice/pay", new { idempotencyKey = Guid.NewGuid(), invoiceId = invoice.GetProperty("id").GetGuid() }), HttpStatusCode.OK);
        return await Body(await client.GetAsync("/api/orders/" + id));
    }
    private async Task<JsonElement> Change(HttpClient client, JsonElement order, object booking)
    {
        var path = "/api/orders/" + order.GetProperty("id").GetString() + "/changes";
        var preview = await client.PostAsJsonAsync(path + "/quote", new { expectedRevision = order.GetProperty("revision").GetInt32(), booking }); await Check(preview, HttpStatusCode.OK);
        var total = (await Body(preview)).GetProperty("pricing").GetProperty("totalAmount").GetDecimal();
        var request = await client.PostAsJsonAsync(path, new { expectedRevision = order.GetProperty("revision").GetInt32(), expectedTotal = total, booking, reason = "Updated event details" });
        await Check(request, HttpStatusCode.OK); return await Body(request);
    }
    private object PlanBody(int? expectedVersion, Guid staff, DateTimeOffset? start = null, DateTimeOffset? end = null, string notes = "Test brief") => new {
        expectedVersion, notes, tasks = new[] { new { activity = "Equipment setup", serviceId = _service.Id, staffId = staff,
            startsAt = start ?? _start, endsAt = end ?? _start.AddHours(1.5), instructions = "Prepare the booked equipment." } }
    };

    [TestMethod]
    public async Task Sprint4ChangesPreserveHistoryAndSettleOnlyTheDelta()
    {
        using var client = Http(_clients[0]); using var admin = Http(_admin);
        var order = await PaidOrder(client, Request()); var id = order.GetProperty("id").GetString(); var path = $"/api/orders/{id}";
        Assert.AreEqual(168, (int)(order.GetProperty("startsAt").GetDateTime() - order.GetProperty("changeDeadline").GetDateTime()).TotalHours);
        var original = await Body(await client.GetAsync(path + "/invoice"));
        var request = await Change(client, order, Request(1, end: _start.AddHours(2)));
        Assert.AreEqual(1, (await Body(await client.GetAsync(path))).GetProperty("revision").GetInt32());
        using var other = Http(_clients[1]); await Check(await other.GetAsync(path + "/changes"), HttpStatusCode.NotFound);
        using var unassigned = Http(_managers.Single(m => m.Id != order.GetProperty("managerId").GetGuid()));
        await Check(await unassigned.PostAsJsonAsync(path + $"/changes/{request.GetProperty("id").GetGuid()}/review", new { approve = true }), HttpStatusCode.NotFound);
        var reviewPath = path + $"/changes/{request.GetProperty("id").GetGuid()}/review";
        await Check(await admin.PostAsJsonAsync(reviewPath, new { approve = true }), HttpStatusCode.OK);
        await Check(await admin.PostAsJsonAsync(reviewPath, new { approve = true }), HttpStatusCode.OK);
        var changed = await Body(await client.GetAsync(path));
        Assert.AreEqual(2, changed.GetProperty("revision").GetInt32()); Assert.AreEqual("awaiting-payment", changed.GetProperty("status").GetString());
        Assert.AreEqual(180.77m, changed.GetProperty("paidAmount").GetDecimal());
        var extra = await Body(await client.GetAsync(path + "/invoice")); Assert.AreEqual(50m, extra.GetProperty("totalAmount").GetDecimal());
        await Check(await client.PostAsJsonAsync(path + "/invoice/pay", new { idempotencyKey = Guid.NewGuid(), invoiceId = original.GetProperty("id").GetGuid() }), HttpStatusCode.Conflict);
        await Check(await client.PatchAsJsonAsync(path + "/status", new { status = "cancelled" }), HttpStatusCode.BadRequest);
        await Check(await client.PostAsJsonAsync(path + "/invoice/pay", new { idempotencyKey = Guid.NewGuid(), invoiceId = extra.GetProperty("id").GetGuid() }), HttpStatusCode.OK);
        changed = await Body(await client.GetAsync(path)); Assert.AreEqual("confirmed", changed.GetProperty("status").GetString());
        Assert.AreEqual(230.77m, changed.GetProperty("paidAmount").GetDecimal());
        var cheaper = await Change(client, changed, Request(1, end: _start.AddHours(1)));
        await Check(await admin.PostAsJsonAsync(path + $"/changes/{cheaper.GetProperty("id").GetGuid()}/review", new { approve = true }), HttpStatusCode.OK);
        var credit = await Body(await client.GetAsync(path + "/invoice"));
        Assert.AreEqual("credit-note", credit.GetProperty("documentType").GetString()); Assert.AreEqual("credited", credit.GetProperty("status").GetString());
        Assert.AreEqual(100.01m, credit.GetProperty("totalAmount").GetDecimal());
        var history = await Body(await client.GetAsync(path + "/invoice/history")); Assert.AreEqual(3, history.GetArrayLength());
        var savedOriginal = history.EnumerateArray().Single(document => document.GetProperty("revision").GetInt32() == 1);
        Assert.AreEqual(original.GetProperty("pricing").GetRawText(), savedOriginal.GetProperty("pricing").GetRawText());
        await using var db = Database(); Assert.AreEqual(2, await db.Payments.CountAsync());
        Assert.AreEqual(130.76m, (await db.Orders.SingleAsync()).PaidAmount);
    }

    [TestMethod]
    public async Task Sprint4ChangeDeadlineConflictWithdrawalAndQuotedPrices()
    {
        using var client = Http(_clients[0]); using var admin = Http(_admin); using var other = Http(_clients[1]);
        var created = await client.PostAsJsonAsync("/api/orders", Request()); await Check(created, HttpStatusCode.Created);
        var order = await Body(created); var id = order.GetProperty("id").GetString(); var path = $"/api/orders/{id}/changes";
        await Check(await client.PostAsJsonAsync(path + "/quote", new { expectedRevision = 1, booking = Request(1, start: DateTimeOffset.UtcNow.AddDays(6), end: DateTimeOffset.UtcNow.AddDays(6).AddHours(2)) }), HttpStatusCode.Conflict);
        await Check(await client.PostAsJsonAsync(path, new { expectedRevision = 1, expectedTotal = 0, booking = Request(1) }), HttpStatusCode.Conflict);
        var request = await Change(client, order, Request(1));
        await Check(await client.PostAsJsonAsync(path, new { expectedRevision = 1, expectedTotal = 180.77m, booking = Request(1) }), HttpStatusCode.Conflict);
        var blocker = await other.PostAsJsonAsync("/api/orders", Request(1)); await Check(blocker, HttpStatusCode.Created);
        var reviewPath = path + $"/{request.GetProperty("id").GetGuid()}/review";
        await Check(await admin.PostAsJsonAsync(reviewPath, new { approve = true }), HttpStatusCode.Conflict);
        Assert.AreEqual(1, (await Body(await client.GetAsync($"/api/orders/{id}"))).GetProperty("revision").GetInt32());
        var blockedId = (await Body(blocker)).GetProperty("id").GetString();
        await Check(await other.PatchAsJsonAsync($"/api/orders/{blockedId}/status", new { status = "cancelled" }), HttpStatusCode.OK);
        await using (var db = Database()) { (await db.Premises.FindAsync(_premises[1].Id))!.PricePerHour = 999; await db.SaveChangesAsync(); }
        await Check(await admin.PostAsJsonAsync(reviewPath, new { approve = true }), HttpStatusCode.OK);
        var changed = await Body(await client.GetAsync($"/api/orders/{id}")); Assert.AreEqual(180.77m, changed.GetProperty("totalAmount").GetDecimal());
        var pending = await Change(client, changed, Request(2));
        await Check(await client.PostAsync(path + $"/{pending.GetProperty("id").GetGuid()}/withdraw", null), HttpStatusCode.OK);
        await using (var db = Database()) { var record = await db.Orders.SingleAsync(o => o.Id == id); record.EventDate = DateTime.UtcNow.AddDays(6); record.EndDate = record.EventDate.AddHours(2); await db.SaveChangesAsync(); }
        await Check(await client.PostAsJsonAsync(path + "/quote", new { expectedRevision = 2, booking = Request(2) }), HttpStatusCode.Conflict);
    }

    [TestMethod]
    public async Task Sprint4ServiceCapacityUsesPeakOverlapAndScopesTheWorklist()
    {
        await using (var db = Database()) { (await db.EventServices.FindAsync(_service.Id))!.ConcurrentCapacity = 3; await db.SaveChangesAsync(); }
        using var client = Http(_clients[0]); using var other = Http(_clients[1]); using var admin = Http(_admin);
        var booked = await client.PostAsJsonAsync("/api/orders", Request()); await Check(booked, HttpStatusCode.Created);
        var order = await Body(booked);
        await Check(await other.PostAsJsonAsync("/api/orders", Request(1)), HttpStatusCode.Conflict);
        await Check(await other.PostAsJsonAsync("/api/orders", Request(1, start: _start.AddHours(1.5), end: _start.AddHours(3))), HttpStatusCode.Created);
        using var manager = Http(_managers.Single(m => m.Id == order.GetProperty("managerId").GetGuid()));
        var query = "/api/management/dashboard?from=" + Uri.EscapeDataString(_start.ToString("O")) + "&to=" + Uri.EscapeDataString(_start.AddHours(4).ToString("O"));
        var response = await manager.GetAsync(query); await Check(response, HttpStatusCode.OK);
        var dashboard = await Body(response); Assert.AreEqual(1, dashboard.GetProperty("worklist").GetArrayLength());
        Assert.AreEqual(3L, dashboard.GetProperty("services")[0].GetProperty("reservedUnits").GetInt64());
        Assert.AreEqual(0L, dashboard.GetProperty("services")[0].GetProperty("availableUnits").GetInt64());
        Assert.AreEqual(2, dashboard.GetProperty("occupancy").EnumerateArray().Count(venue => venue.GetProperty("occupied").GetBoolean()));
        await Check(await admin.PutAsJsonAsync("/api/services/" + _service.Id, new { id = _service.Id, name = _service.Name, category = _service.Category, price = _service.Price, concurrentCapacity = 2 }), HttpStatusCode.Conflict);
        await Check(await client.GetAsync(query), HttpStatusCode.Forbidden);
    }

    [TestMethod]
    public async Task Sprint4PaidExecutionDispatchesPrivateIdempotentStaffBriefs()
    {
        using var client = Http(_clients[0]); var order = await PaidOrder(client, Request()); var id = order.GetProperty("id").GetString();
        var path = $"/api/orders/{id}/execution";
        using var manager = Http(_managers.Single(m => m.Id == order.GetProperty("managerId").GetGuid()));
        using var unassigned = Http(_managers.Single(m => m.Id != order.GetProperty("managerId").GetGuid()));
        using var worker = Http(_staff[0]); using var otherWorker = Http(_staff[1]);
        await Check(await client.PutAsJsonAsync(path, PlanBody(null, _staff[0].Id)), HttpStatusCode.Forbidden);
        await Check(await unassigned.GetAsync(path), HttpStatusCode.NotFound);
        await Check(await worker.GetAsync("/api/orders"), HttpStatusCode.Forbidden);
        // Use persisted UTC precision for the rental boundaries.
        var start = new DateTimeOffset(order.GetProperty("startsAt").GetDateTime()); var end = new DateTimeOffset(order.GetProperty("endsAt").GetDateTime());
        var draftResponse = await manager.PutAsJsonAsync(path, PlanBody(null, _staff[0].Id, start, end)); await Check(draftResponse, HttpStatusCode.OK);
        var draft = await Body(draftResponse);
        await Check(await manager.PostAsJsonAsync(path + "/dispatch", new { expectedVersion = 1 }), HttpStatusCode.Conflict);
        var finalizedResponse = await manager.PostAsJsonAsync(path + "/finalize", new { expectedVersion = draft.GetProperty("version").GetInt32() }); await Check(finalizedResponse, HttpStatusCode.OK);
        var finalized = await Body(finalizedResponse);
        var dispatchedResponse = await manager.PostAsJsonAsync(path + "/dispatch", new { expectedVersion = finalized.GetProperty("version").GetInt32() }); await Check(dispatchedResponse, HttpStatusCode.OK);
        await Check(await manager.PostAsJsonAsync(path + "/dispatch", new { expectedVersion = finalized.GetProperty("version").GetInt32() }), HttpStatusCode.OK);
        var briefs = await Body(await worker.GetAsync("/api/staff/briefs")); Assert.AreEqual(1, briefs.GetArrayLength());
        Assert.AreEqual(0, (await Body(await otherWorker.GetAsync("/api/staff/briefs"))).GetArrayLength());
        Assert.DoesNotContain("totalAmount", briefs.GetRawText()); Assert.DoesNotContain("email", briefs.GetRawText());
        var briefId = briefs[0].GetProperty("id").GetGuid();
        await Check(await otherWorker.PatchAsJsonAsync("/api/staff/briefs/" + briefId, new { status = "acknowledged" }), HttpStatusCode.NotFound);
        await Check(await worker.PatchAsJsonAsync("/api/staff/briefs/" + briefId, new { status = "acknowledged" }), HttpStatusCode.OK);
        await Check(await worker.PatchAsJsonAsync("/api/staff/briefs/" + briefId, new { status = "in-progress" }), HttpStatusCode.Conflict);
        await Check(await worker.PatchAsJsonAsync("/api/staff/briefs/" + briefId, new { status = "completed" }), HttpStatusCode.BadRequest);
        var progress = await Body(await manager.GetAsync(path)); Assert.AreEqual("acknowledged", progress.GetProperty("briefs")[0].GetProperty("status").GetString());
        await using var db = Database(); Assert.AreEqual(1, await db.ExecutionBriefs.CountAsync());
    }

    [TestMethod]
    public async Task Sprint4StaffConflictsAndChangedBookingsWithdrawEarlierBriefs()
    {
        using var client = Http(_clients[0]); using var admin = Http(_admin); using var worker = Http(_staff[0]);
        var first = await PaidOrder(client, Request()); var second = await PaidOrder(client, Request(1));
        var firstId = first.GetProperty("id").GetString(); var secondId = second.GetProperty("id").GetString();
        var start = new DateTimeOffset(first.GetProperty("startsAt").GetDateTime()); var end = new DateTimeOffset(first.GetProperty("endsAt").GetDateTime()); var middle = start.AddMinutes(45);
        var p1 = $"/api/orders/{firstId}/execution"; var p2 = $"/api/orders/{secondId}/execution";
        var draft = await admin.PutAsJsonAsync(p1, PlanBody(null, _staff[0].Id, start, middle)); await Check(draft, HttpStatusCode.OK);
        await Check(await admin.PostAsJsonAsync(p1 + "/finalize", new { expectedVersion = 1 }), HttpStatusCode.OK);
        await Check(await admin.PutAsJsonAsync(p2, PlanBody(null, _staff[0].Id, start, end)), HttpStatusCode.OK);
        await Check(await admin.PostAsJsonAsync(p2 + "/finalize", new { expectedVersion = 1 }), HttpStatusCode.Conflict);
        await Check(await admin.PutAsJsonAsync(p2, PlanBody(1, _staff[0].Id, middle, end)), HttpStatusCode.OK);
        await Check(await admin.PostAsJsonAsync(p2 + "/finalize", new { expectedVersion = 2 }), HttpStatusCode.OK);
        await Check(await admin.PutAsJsonAsync(p2, PlanBody(1, _staff[1].Id, start, end)), HttpStatusCode.Conflict);
        await Check(await admin.PostAsJsonAsync(p1 + "/dispatch", new { expectedVersion = 2 }), HttpStatusCode.OK);
        var brief = (await Body(await worker.GetAsync("/api/staff/briefs")))[0]; var briefId = brief.GetProperty("id").GetGuid();
        var snapshot = brief.GetProperty("details").GetRawText();
        await Check(await admin.PutAsJsonAsync(p1, PlanBody(3, _staff[1].Id, start, middle, "Revised instructions")), HttpStatusCode.OK);
        await Check(await worker.PatchAsJsonAsync("/api/staff/briefs/" + briefId, new { status = "acknowledged" }), HttpStatusCode.Conflict);
        var withdrawn = (await Body(await worker.GetAsync("/api/staff/briefs")))[0];
        Assert.AreEqual(snapshot, withdrawn.GetProperty("details").GetRawText()); Assert.AreNotEqual(JsonValueKind.Null, withdrawn.GetProperty("supersededAt").ValueKind);
        await Check(await admin.PostAsJsonAsync(p1 + "/finalize", new { expectedVersion = 4 }), HttpStatusCode.OK);
        await Check(await admin.PostAsJsonAsync(p1 + "/dispatch", new { expectedVersion = 5 }), HttpStatusCode.OK);
        var change = await Change(client, first, Request(start: _start.AddDays(1), end: _start.AddDays(1).AddHours(1.5)));
        await Check(await admin.PostAsJsonAsync($"/api/orders/{firstId}/changes/{change.GetProperty("id").GetGuid()}/review", new { approve = true }), HttpStatusCode.OK);
        await Check(await admin.GetAsync(p1), HttpStatusCode.NotFound);
        var changed = await Body(await client.GetAsync("/api/orders/" + firstId));
        Assert.AreEqual("needs-rescheduling", changed.GetProperty("executionState").GetString()); Assert.AreEqual("confirmed", changed.GetProperty("status").GetString());
        await using var db = Database(); Assert.AreEqual(2, await db.ExecutionBriefs.CountAsync()); Assert.AreEqual(0, await db.ExecutionBriefs.CountAsync(b => b.SupersededAt == null));
    }

    [TestMethod]
    public async Task Sprint4StaffProgressFeedsLiveMonitoringAndHistoryGuards()
    {
        using var admin = Http(_admin); using var worker = Http(_staff[0]);
        var now = BookingRules.UtcNow(TimeProvider.System); var orderId = "ORD-LIVE-EXECUTION";
        Guid briefId;
        await using (var db = Database())
        {
            var order = new Order { Id = orderId, ClientId = _clients[0].Id, ManagerId = _managers[0].Id, PremiseId = _premises[0].Id,
                PremiseName = _premises[0].Name, PremiseAddress = _premises[0].Address, EventDate = now.AddHours(-2), EndDate = now.AddHours(2),
                Status = "confirmed", TotalAmount = 100, PaidAmount = 100, PaymentConfirmedAt = now.AddHours(-3), ExecutionState = "dispatched" };
            var plan = new ExecutionPlan { Order = order, OrderRevision = 1, Version = 3, State = "dispatched", UpdatedAt = now, FinalizedAt = now, DispatchedAt = now };
            var task = new ExecutionTask { Plan = plan, StaffId = _staff[0].Id, StaffName = _staff[0].DisplayName, Activity = "Event support", StartsAt = now.AddHours(-1), EndsAt = now.AddHours(1) };
            plan.Tasks.Add(task);
            var detail = new ExecutionBriefSnapshot(orderId, 1, order.PremiseName, order.PremiseAddress, 50, order.EventDate, order.EndDate,
                task.Activity, "Venue preparation", 1, _staff[0].DisplayName, _managers[0].DisplayName, task.StartsAt, task.EndsAt, "Support guests", "Live event");
            var brief = new ExecutionBrief { Plan = plan, PlanVersion = 3, TaskId = task.Id, StaffId = _staff[0].Id,
                SnapshotJson = JsonSerializer.Serialize(detail, BillingService.Json), SentAt = now, UpdatedAt = now };
            briefId = brief.Id; db.Orders.Add(order); db.ExecutionPlans.Add(plan); db.ExecutionBriefs.Add(brief); await db.SaveChangesAsync();
        }
        foreach (var status in new[] { "acknowledged", "in-progress" }) await Check(await worker.PatchAsJsonAsync("/api/staff/briefs/" + briefId, new { status }), HttpStatusCode.OK);
        var query = "/api/management/dashboard?from=" + Uri.EscapeDataString(new DateTimeOffset(now.AddHours(-1)).ToString("O")) + "&to=" + Uri.EscapeDataString(new DateTimeOffset(now.AddHours(1)).ToString("O"));
        var liveResponse = await admin.GetAsync(query); await Check(liveResponse, HttpStatusCode.OK);
        Assert.AreEqual(1, (await Body(liveResponse)).GetProperty("counts").GetProperty("activeServices").GetInt32());
        await Check(await worker.PatchAsJsonAsync("/api/staff/briefs/" + briefId, new { status = "completed" }), HttpStatusCode.OK);
        Assert.AreEqual(0, (await Body(await admin.GetAsync(query))).GetProperty("counts").GetProperty("activeServices").GetInt32());
        await Check(await admin.DeleteAsync("/api/users/" + _staff[0].Id), HttpStatusCode.Conflict);
        await Check(await admin.PutAsJsonAsync("/api/users/" + _staff[0].Id, new { name = _staff[0].DisplayName, email = _staff[0].Email, role = "client" }), HttpStatusCode.Conflict);
        await Check(await admin.PutAsJsonAsync($"/api/orders/{orderId}/execution", PlanBody(3, _staff[1].Id)), HttpStatusCode.Conflict);
        var created = await admin.PostAsJsonAsync("/api/auth/staff", new { displayName = "New performer", email = "performer@test.local", password = "Password1!", role = "staff" });
        await Check(created, HttpStatusCode.Created);
        using var anonymous = Http(); await Check(await anonymous.PostAsJsonAsync("/api/auth/login", new { email = "performer@test.local", password = "Password1!" }), HttpStatusCode.OK);
    }

    [TestMethod]
    public async Task Sprint4ConcurrentServiceReservationsCannotExceedCapacity()
    {
        await using (var db = Database()) { (await db.EventServices.FindAsync(_service.Id))!.ConcurrentCapacity = 3; await db.SaveChangesAsync(); }
        using var first = Http(_clients[0]); using var second = Http(_clients[1]);
        var responses = await Task.WhenAll(first.PostAsJsonAsync("/api/orders", Request()), second.PostAsJsonAsync("/api/orders", Request(1)));
        Assert.AreEqual(1, responses.Count(response => response.StatusCode == HttpStatusCode.Created));
        Assert.AreEqual(1, responses.Count(response => response.StatusCode == HttpStatusCode.Conflict));
        await using var check = Database(); Assert.AreEqual(1, await check.Orders.CountAsync());
    }

    [TestMethod]
    public async Task DemoSeedingSupportsVenuesWithFewerThanFiftyGuests()
    {
        await using (var db = Database())
        {
            await db.Users.Where(u => u.Role == "client").ExecuteDeleteAsync();
            var capacities = new[] { 1, 20, 30, 40, 45, 50 };
            for (var i = 0; i < _premises.Length; i++)
                (await db.Premises.FindAsync(_premises[i].Id))!.Capacity = capacities[i];
            await db.SaveChangesAsync();
        }
        await using var provider = new ServiceCollection()
            .AddDbContext<AppDbContext>(options => options.UseNpgsql(_connection))
            .BuildServiceProvider();
        var seeder = new DbSeeder(provider.GetRequiredService<IServiceScopeFactory>(), new PasswordHasher<AppUser>());
        await seeder.StartAsync(CancellationToken.None);
        await using var seeded = Database();
        var orders = await seeded.Orders.Include(o => o.Premise).ToListAsync();
        Assert.HasCount(6, orders);
        Assert.IsTrue(orders.All(o => o.ExpectedGuests >= 1 && o.ExpectedGuests <= o.Premise!.Capacity));
    }

    [TestMethod]
    public async Task QuoteCreateSnapshotAndPrivacy()
    {
        using var http = Http(_clients[0]);
        var quote = await http.PostAsJsonAsync("/api/orders/quote", Request());
        await Check(quote, HttpStatusCode.OK);
        var quoted = await Body(quote);
        Assert.AreEqual(180.77m, quoted.GetProperty("totalAmount").GetDecimal());
        Assert.AreEqual(150.02m, quoted.GetProperty("rental").GetProperty("amount").GetDecimal());
        var created = await http.PostAsJsonAsync("/api/orders", Request());
        await Check(created, HttpStatusCode.Created);
        var order = await Body(created);
        Assert.AreEqual("pending", order.GetProperty("status").GetString());
        Assert.AreEqual(180.77m, order.GetProperty("totalAmount").GetDecimal());
        Assert.IsNotNull(order.GetProperty("managerId").GetString());
        Assert.IsNotNull(created.Headers.Location);
        var id = order.GetProperty("id").GetString();
        var detail = await http.GetStringAsync("/api/orders/" + id);
        Assert.IsFalse(detail.Contains("passwordHash", StringComparison.OrdinalIgnoreCase));
        Assert.IsFalse(detail.Contains("normalizedEmail", StringComparison.OrdinalIgnoreCase));
        await using (var db = Database())
        {
            var venue = await db.Premises.FindAsync(_premises[0].Id);
            venue!.PricePerHour = 999;
            venue.Name = "Changed venue";
            var service = await db.EventServices.FindAsync(_service.Id);
            service!.Price = 999;
            await db.SaveChangesAsync();
        }
        var stored = await Body(await http.GetAsync("/api/orders/" + id));
        Assert.AreEqual(180.77m, stored.GetProperty("pricing").GetProperty("totalAmount").GetDecimal());
        Assert.AreEqual("Venue 0", stored.GetProperty("venue").GetString());
        using var other = Http(_clients[1]);
        await Check(await other.GetAsync("/api/orders/" + id), HttpStatusCode.NotFound);
        Assert.AreEqual(0, (await Body(await other.GetAsync("/api/orders"))).GetArrayLength());
        var assigned = order.GetProperty("managerId").GetGuid();
        using var unassigned = Http(_managers.Single(m => m.Id != assigned));
        await Check(await unassigned.GetAsync("/api/orders/" + id), HttpStatusCode.NotFound);
    }

    [TestMethod]
    public async Task ConcurrentBookingsAndAdjacentPeriods()
    {
        using var first = Http(_clients[0]);
        using var second = Http(_clients[1]);
        var replies = await Task.WhenAll(first.PostAsJsonAsync("/api/orders", Request()), second.PostAsJsonAsync("/api/orders", Request()));
        Assert.AreEqual(1, replies.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.AreEqual(1, replies.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        await Check(await first.PostAsJsonAsync("/api/orders", Request(start: _start.AddHours(1.5), end: _start.AddHours(3))), HttpStatusCode.Created);
    }

    [TestMethod]
    public async Task ThreePremiseLimitAndCancellationRelease()
    {
        using var http = Http(_clients[0]);
        string? firstId = null;
        for (var i = 0; i < 3; i++)
        {
            var reply = await http.PostAsJsonAsync("/api/orders", Request(i));
            await Check(reply, HttpStatusCode.Created);
            firstId ??= (await Body(reply)).GetProperty("id").GetString();
        }
        await Check(await http.PostAsJsonAsync("/api/orders", Request(3)), HttpStatusCode.Conflict);
        await Check(await http.PatchAsJsonAsync($"/api/orders/{firstId}/status", new { status = "cancelled" }), HttpStatusCode.OK);
        await Check(await http.PostAsJsonAsync("/api/orders", Request(3)), HttpStatusCode.Created);
        await Check(await http.PatchAsJsonAsync($"/api/orders/{firstId}/status", new { status = "confirmed" }), HttpStatusCode.Conflict);
    }

    [TestMethod]
    public async Task CancellationRecordsAuthenticatedActorAndRetainsBookingDetails()
    {
        using var client = Http(_clients[0]);
        using var admin = Http(_admin);
        for (var i = 0; i < 3; i++)
        {
            var created = await client.PostAsJsonAsync("/api/orders", Request(i));
            await Check(created, HttpStatusCode.Created);
            var original = await Body(created);
            Assert.AreEqual(JsonValueKind.Null, original.GetProperty("cancellation").ValueKind);
            var id = original.GetProperty("id").GetString();
            original = await Body(await client.GetAsync("/api/orders/" + id));
            var assigned = _managers.Single(m => m.Id == original.GetProperty("managerId").GetGuid());
            var actor = i switch { 0 => _clients[0], 1 => assigned, _ => _admin };
            using var actorHttp = Http(actor);
            using var otherClient = Http(_clients[1]);
            using var unassigned = Http(_managers.Single(m => m.Id != assigned.Id));
            await Check(await otherClient.PatchAsJsonAsync($"/api/orders/{id}/status", new { status = "cancelled" }), HttpStatusCode.NotFound);
            await Check(await unassigned.PatchAsJsonAsync($"/api/orders/{id}/status", new { status = "cancelled" }), HttpStatusCode.NotFound);
            var before = DateTime.UtcNow;
            var response = await actorHttp.PatchAsJsonAsync($"/api/orders/{id}/status", new {
                status = "cancelled", cancelledByUserId = _clients[1].Id, cancelledByName = "Spoofed actor", cancelledAt = "2020-01-01T00:00:00Z"
            });
            await Check(response, HttpStatusCode.OK);
            var cancelled = await Body(response);
            var audit = cancelled.GetProperty("cancellation");
            Assert.AreEqual(actor.Id, audit.GetProperty("userId").GetGuid());
            Assert.AreEqual(actor.DisplayName, audit.GetProperty("name").GetString());
            Assert.AreEqual(actor.Role, audit.GetProperty("role").GetString());
            Assert.IsTrue(audit.GetProperty("at").GetDateTime() >= before);
            Assert.IsTrue(audit.GetProperty("at").GetDateTime() <= DateTime.UtcNow);
            Assert.AreEqual("cancelled", cancelled.GetProperty("status").GetString());
            Assert.AreEqual(original.GetProperty("pricing").GetRawText(), cancelled.GetProperty("pricing").GetRawText());
            Assert.AreEqual(original.GetProperty("guests").GetInt32(), cancelled.GetProperty("guests").GetInt32());
            Assert.AreEqual(original.GetProperty("client").GetString(), cancelled.GetProperty("client").GetString());
            var retry = await Body(await admin.PatchAsJsonAsync($"/api/orders/{id}/status", new { status = "cancelled" }));
            Assert.AreEqual(audit.GetRawText(), retry.GetProperty("cancellation").GetRawText());
            await using (var db = Database())
            {
                (await db.Users.FindAsync(actor.Id))!.DisplayName = "Renamed after cancellation";
                (await db.Premises.FindAsync(_premises[i].Id))!.Name = "Changed after cancellation";
                await db.SaveChangesAsync();
            }
            var detail = await Body(await client.GetAsync("/api/orders/" + id));
            Assert.AreEqual(audit.GetRawText(), detail.GetProperty("cancellation").GetRawText());
            Assert.AreEqual(original.GetProperty("pricing").GetRawText(), detail.GetProperty("pricing").GetRawText());
            using var managerHttp = Http(assigned);
            Assert.AreEqual(audit.GetRawText(), (await Body(await managerHttp.GetAsync("/api/orders/" + id))).GetProperty("cancellation").GetRawText());
            await Check(await otherClient.GetAsync("/api/orders/" + id), HttpStatusCode.NotFound);
            var listed = (await Body(await admin.GetAsync("/api/orders"))).EnumerateArray().Single(o => o.GetProperty("id").GetString() == id);
            Assert.AreEqual(audit.GetRawText(), listed.GetProperty("cancellation").GetRawText());
        }
    }

    [TestMethod]
    public async Task LegacyCancellationRemainsUnattributedOnRetry()
    {
        using var client = Http(_clients[0]);
        var original = await Body(await client.PostAsJsonAsync("/api/orders", Request()));
        var id = original.GetProperty("id").GetString();
        original = await Body(await client.GetAsync("/api/orders/" + id));
        await using (var db = Database())
        {
            (await db.Orders.SingleAsync(o => o.Id == id))!.Status = "cancelled";
            await db.SaveChangesAsync();
        }
        var response = await client.PatchAsJsonAsync($"/api/orders/{id}/status", new { status = "cancelled" });
        await Check(response, HttpStatusCode.OK);
        var order = await Body(response);
        Assert.AreEqual(JsonValueKind.Null, order.GetProperty("cancellation").ValueKind);
        Assert.AreEqual(original.GetProperty("pricing").GetRawText(), order.GetProperty("pricing").GetRawText());
    }

    [TestMethod]
    public async Task ConcurrentManagerQuotaAndExistingClientReuse()
    {
        var requests = _clients.Take(3).Select((client, i) => Http(client).PostAsJsonAsync("/api/orders", Request(i))).ToArray();
        var replies = await Task.WhenAll(requests);
        Assert.AreEqual(2, replies.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.AreEqual(1, replies.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        await using var db = Database();
        var orders = await db.Orders.ToListAsync();
        Assert.AreEqual(2, orders.Select(o => o.ManagerId).Distinct().Count());
        using var existing = Http(_clients.Single(c => c.Id == orders[0].ClientId));
        var reused = await existing.PostAsJsonAsync("/api/orders", Request(5));
        await Check(reused, HttpStatusCode.Created);
        Assert.AreEqual(orders[0].ManagerId, (await Body(reused)).GetProperty("managerId").GetGuid());
    }

    [TestMethod]
    public async Task InvalidOrdersDoNotPersist()
    {
        using var http = Http(_clients[0]);
        foreach (var invalid in new object[]
        {
            Request(start: _start, end: _start), Request(start: _start, end: _start.AddHours(-1)),
            Request(start: DateTimeOffset.UtcNow.AddDays(-2), end: DateTimeOffset.UtcNow.AddDays(-1)),
            new { premiseId = _premises[0].Id, eventDate = _start, durationHours = -1, guests = 50 },
            new { premiseId = _premises[0].Id, eventDate = _start, durationHours = 4, guests = 101 },
            new { premiseId = _premises[0].Id, eventDate = _start, guests = 50, serviceIds = new[] { Guid.NewGuid() } },
            new { premiseId = _premises[0].Id, eventDate = _start, guests = 50, serviceIds = new[] { _service.Id, _service.Id } },
            new { premiseId = _premises[0].Id, eventDate = "2027-01-01T12:00:00", guests = 50 },
            new { premiseId = _premises[0].Id, eventDate = _start, guests = 50, services = new[] { new { serviceId = _service.Id, quantity = 0 } } }
        }) await Check(await http.PostAsJsonAsync("/api/orders", invalid), HttpStatusCode.BadRequest);
        await using var db = Database();
        Assert.AreEqual(0, await db.Orders.CountAsync());
    }

    [TestMethod]
    public async Task OccupancyAndHistoryDeletionGuards()
    {
        using var client = Http(_clients[0]);
        await Check(await client.PostAsJsonAsync("/api/orders", Request()), HttpStatusCode.Created);
        var occupancyUrl = "/api/premises/occupancy?from=" + Uri.EscapeDataString(_start.ToString("O"))
            + "&to=" + Uri.EscapeDataString(_start.AddHours(2).ToString("O"));
        await Check(await client.GetAsync(occupancyUrl), HttpStatusCode.Forbidden);
        using var manager = Http(_managers[0]);
        var occupancy = await manager.GetAsync(occupancyUrl);
        await Check(occupancy, HttpStatusCode.OK);
        var venues = (await Body(occupancy)).EnumerateArray().ToList();
        Assert.IsFalse(venues.Single(p => p.GetProperty("id").GetGuid() == _premises[0].Id).GetProperty("available").GetBoolean());
        Assert.IsTrue(venues.Single(p => p.GetProperty("id").GetGuid() == _premises[1].Id).GetProperty("available").GetBoolean());
        using var admin = Http(_admin);
        await Check(await admin.DeleteAsync("/api/premises/" + _premises[0].Id), HttpStatusCode.Conflict);
        await Check(await admin.DeleteAsync("/api/services/" + _service.Id), HttpStatusCode.Conflict);
        await Check(await admin.DeleteAsync("/api/users/" + _clients[0].Id), HttpStatusCode.Conflict);
        await using var db = Database();
        Assert.AreEqual(1, await db.Orders.CountAsync());
    }

    [TestMethod]
    public async Task ProfileContactAndDuplicateEmail()
    {
        using var http = Http(_clients[0]);
        var updated = await http.PutAsJsonAsync("/api/users/me", new { displayName = "Updated Client", email = "changed@test.local", phone = "+77001234567" });
        await Check(updated, HttpStatusCode.OK);
        Assert.AreEqual("+77001234567", (await Body(await http.GetAsync("/api/users/me"))).GetProperty("phone").GetString());
        await Check(await http.PutAsJsonAsync("/api/users/me", new { displayName = "Updated Client", email = _clients[1].Email }), HttpStatusCode.Conflict);
        using var publicHttp = Http();
        await Check(await publicHttp.PostAsJsonAsync("/api/auth/login", new { email = "changed@test.local", password = "Password1!" }), HttpStatusCode.OK);
    }

    [TestMethod]
    public async Task RolesInvalidTokensAndStatusGuards()
    {
        using var client = Http(_clients[0]);
        var created = await client.PostAsJsonAsync("/api/orders", Request());
        await Check(created, HttpStatusCode.Created);
        var order = await Body(created);
        var id = order.GetProperty("id").GetString();
        await Check(await client.PatchAsJsonAsync($"/api/orders/{id}/status", new { status = "confirmed" }), HttpStatusCode.BadRequest);
        using var manager = Http(_managers.Single(m => m.Id == order.GetProperty("managerId").GetGuid()));
        await Check(await manager.PatchAsJsonAsync($"/api/orders/{id}/status", new { status = "garbage" }), HttpStatusCode.BadRequest);
        await Check(await manager.PatchAsJsonAsync($"/api/orders/{id}/status", new { status = "awaiting-payment" }), HttpStatusCode.BadRequest);
        await Check(await manager.PostAsync($"/api/orders/{id}/invoice", null), HttpStatusCode.OK);
        await Check(await manager.PostAsync($"/api/orders/{id}/invoice/deliver", null), HttpStatusCode.OK);
        await Check(await manager.PatchAsJsonAsync($"/api/orders/{id}/status", new { status = "confirmed" }), HttpStatusCode.BadRequest);
        var issuedInvoice = await Body(await client.GetAsync($"/api/orders/{id}/invoice"));
        await Check(await client.PostAsJsonAsync($"/api/orders/{id}/invoice/pay", new { idempotencyKey = Guid.NewGuid(), invoiceId = issuedInvoice.GetProperty("id").GetGuid() }), HttpStatusCode.OK);
        await Check(await manager.PatchAsJsonAsync($"/api/orders/{id}/status", new { status = "completed" }), HttpStatusCode.BadRequest);
        await Check(await manager.DeleteAsync("/api/users/" + _admin.Id), HttpStatusCode.Forbidden);
        using var admin = Http(_admin);
        await Check(await admin.PostAsJsonAsync("/api/auth/staff", new { displayName = "Invalid", email = "invalid@test.local", password = "Password1!", role = "owner" }), HttpStatusCode.BadRequest);
        await Check(await admin.DeleteAsync("/api/users/" + _admin.Id), HttpStatusCode.Conflict);
        await Check(await admin.PutAsJsonAsync("/api/users/" + _clients[4].Id, new { name = "Client4", email = _clients[4].Email, role = "manager" }), HttpStatusCode.OK);
        using var stale = Http(_clients[4]);
        await Check(await stale.GetAsync("/api/orders"), HttpStatusCode.Unauthorized);
        using var missing = Http(new AppUser { DisplayName = "Missing", Email = "missing@test.local", NormalizedEmail = "MISSING@TEST.LOCAL", Role = "client", PasswordHash = "" });
        await Check(await missing.GetAsync("/api/orders"), HttpStatusCode.Unauthorized);
    }

    [TestMethod]
    public async Task ExplicitTimezoneLegacyPayloadAndSwagger()
    {
        using var http = Http(_clients[0]);
        var quote = await http.PostAsJsonAsync("/api/orders/quote", Request(start: _start.ToOffset(TimeSpan.FromHours(5)),
            end: _start.AddHours(1.5).ToOffset(TimeSpan.FromHours(5))));
        await Check(quote, HttpStatusCode.OK);
        Assert.AreEqual(_start.UtcDateTime, (await Body(quote)).GetProperty("startsAt").GetDateTime());
        var legacy = await http.PostAsJsonAsync("/api/orders", new { premiseId = _premises[0].Id, eventDate = _start,
            durationHours = 4, guests = 50, services = Array.Empty<object>(), serviceIds = new[] { _service.Id } });
        await Check(legacy, HttpStatusCode.Created);
        Assert.AreEqual(410.29m, (await Body(legacy)).GetProperty("totalAmount").GetDecimal());
        using var anonymous = Http();
        await Check(await anonymous.GetAsync("/api/orders"), HttpStatusCode.Unauthorized);
        await Check(await anonymous.GetAsync("/swagger/v1/swagger.json"), HttpStatusCode.OK);
    }

    [TestMethod]
    public async Task ServiceCategoriesSearchSortAndSnapshots()
    {
        using var admin = Http(_admin);
        using var client = Http(_clients[0]);
        var selections = new List<object>();
        var categories = new[] { "Decoration", "Entertainment", "Photography", "EventPlanning", "Staffing", "Transport", "Security", "Cleaning", "Accessibility support" };
        foreach (var category in categories)
        {
            var created = await admin.PostAsJsonAsync("/api/services", new { name = "  Demo " + category + "  ", category = " " + category + " ", price = 20m, description = " Coverage per unit. " });
            await Check(created, HttpStatusCode.Created);
            var service = await Body(created);
            Assert.AreEqual(category, service.GetProperty("category").GetString());
            Assert.AreEqual("Demo " + category, service.GetProperty("name").GetString());
            selections.Add(new { serviceId = service.GetProperty("id").GetGuid(), quantity = 2 });
        }
        using var anonymous = Http();
        Assert.AreEqual(1, (await Body(await anonymous.GetAsync("/api/services?category=Entertainment&search=coverage&sort=price-desc"))).GetArrayLength());
        var sorted = await Body(await anonymous.GetAsync("/api/services?sort=price-asc"));
        var prices = sorted.EnumerateArray().Select(s => s.GetProperty("price").GetDecimal()).ToArray();
        CollectionAssert.AreEqual(prices.Order().ToArray(), prices);
        await Check(await anonymous.GetAsync("/api/services?sort=invalid"), HttpStatusCode.BadRequest);
        await Check(await client.PostAsJsonAsync("/api/services", new { name = "Denied", category = "Custom", price = 5 }), HttpStatusCode.Forbidden);
        await Check(await admin.PostAsJsonAsync("/api/services", new { name = " a ", category = "Custom", price = 5 }), HttpStatusCode.BadRequest);
        var booked = await client.PostAsJsonAsync("/api/orders", new { premiseId = _premises[0].Id, startsAt = _start, endsAt = _start.AddHours(1), guests = 50, services = selections });
        await Check(booked, HttpStatusCode.Created);
        var lines = (await Body(booked)).GetProperty("pricing").GetProperty("services");
        Assert.AreEqual(categories.Length, lines.GetArrayLength());
        foreach (var line in lines.EnumerateArray()) Assert.AreEqual(40m, line.GetProperty("amount").GetDecimal());
    }

    [TestMethod]
    public async Task InvoiceDeliveryPaymentPrivacyAndIdempotency()
    {
        using var client = Http(_clients[0]);
        var order = await Body(await client.PostAsJsonAsync("/api/orders", Request()));
        var id = order.GetProperty("id").GetString();
        using var manager = Http(_managers.Single(m => m.Id == order.GetProperty("managerId").GetGuid()));
        using var otherManager = Http(_managers.Single(m => m.Id != order.GetProperty("managerId").GetGuid()));
        using var otherClient = Http(_clients[1]);
        var path = $"/api/orders/{id}/invoice";
        await Check(await client.PostAsync(path, null), HttpStatusCode.Forbidden);
        await Check(await otherManager.PostAsync(path, null), HttpStatusCode.NotFound);
        var draft = await manager.PostAsync(path, null); await Check(draft, HttpStatusCode.OK);
        var invoice = await Body(draft);
        Assert.AreEqual("draft", invoice.GetProperty("status").GetString());
        Assert.AreEqual(180.77m, invoice.GetProperty("totalAmount").GetDecimal());
        Assert.AreEqual(invoice.GetProperty("id").GetGuid(), (await Body(await manager.PostAsync(path, null))).GetProperty("id").GetGuid());
        await Check(await client.GetAsync(path), HttpStatusCode.NotFound);
        await Check(await client.PostAsJsonAsync(path + "/pay", new { idempotencyKey = Guid.NewGuid() }), HttpStatusCode.NotFound);
        await Check(await manager.PostAsync(path + "/deliver", null), HttpStatusCode.OK);
        await Check(await otherClient.GetAsync(path), HttpStatusCode.NotFound);
        await Check(await otherManager.GetAsync(path), HttpStatusCode.NotFound);
        await Check(await client.PostAsJsonAsync(path + "/pay", new { idempotencyKey = Guid.NewGuid(), outcome = "declined", invoiceId = invoice.GetProperty("id").GetGuid() }), HttpStatusCode.PaymentRequired);
        Assert.AreEqual("awaiting-payment", (await Body(await client.GetAsync("/api/orders/" + id))).GetProperty("status").GetString());
        var key = Guid.NewGuid();
        var replies = await Task.WhenAll(client.PostAsJsonAsync(path + "/pay", new { idempotencyKey = key, amount = 0, invoiceId = invoice.GetProperty("id").GetGuid() }),
            client.PostAsJsonAsync(path + "/pay", new { idempotencyKey = key, amount = 0, invoiceId = invoice.GetProperty("id").GetGuid() }));
        foreach (var response in replies) await Check(response, HttpStatusCode.OK);
        var paid = await Body(replies[0]);
        Assert.AreEqual("paid", paid.GetProperty("status").GetString());
        Assert.AreEqual(180.77m, paid.GetProperty("receipt").GetProperty("amount").GetDecimal());
        Assert.IsTrue(paid.GetProperty("receipt").GetProperty("isDemo").GetBoolean());
        Assert.AreEqual("confirmed", (await Body(await client.GetAsync("/api/orders/" + id))).GetProperty("status").GetString());
        await Check(await client.PatchAsJsonAsync("/api/orders/" + id + "/status", new { status = "cancelled" }), HttpStatusCode.BadRequest);
        await using var db = Database();
        Assert.AreEqual(1, await db.Payments.CountAsync());
        Assert.AreEqual(1, await db.Invoices.CountAsync());
    }

    [TestMethod]
    public async Task CancelledInvoicesCannotBePaidAndConflictsBlockIssuing()
    {
        using var client = Http(_clients[0]); using var admin = Http(_admin);
        var order = await Body(await client.PostAsJsonAsync("/api/orders", Request()));
        var id = order.GetProperty("id").GetString(); var path = $"/api/orders/{id}/invoice";
        await Check(await admin.PostAsync(path, null), HttpStatusCode.OK);
        await Check(await admin.PostAsync(path + "/deliver", null), HttpStatusCode.OK);
        await Check(await client.PatchAsJsonAsync("/api/orders/" + id + "/status", new { status = "cancelled" }), HttpStatusCode.OK);
        Assert.AreEqual("void", (await Body(await client.GetAsync(path))).GetProperty("status").GetString());
        await Check(await client.PostAsJsonAsync(path + "/pay", new { idempotencyKey = Guid.NewGuid() }), HttpStatusCode.Conflict);
        var second = await Body(await client.PostAsJsonAsync("/api/orders", Request()));
        var secondId = second.GetProperty("id").GetString();
        await using var db = Database();
        db.Orders.Add(new Order { ClientId = _clients[1].Id, PremiseId = _premises[0].Id,
            EventDate = _start.UtcDateTime, EndDate = _start.AddHours(1).UtcDateTime, ExpectedGuests = 1 });
        await db.SaveChangesAsync();
        await Check(await admin.PostAsync($"/api/orders/{secondId}/invoice", null), HttpStatusCode.Conflict);
    }

    [TestMethod]
    public async Task AlternativesPromotionsAndFrozenInvoiceRates()
    {
        using var client = Http(_clients[0]); using var admin = Http(_admin);
        await using (var db = Database()) { var venue = await db.Premises.FindAsync(_premises[1].Id); venue!.PromotionPercent = 10; await db.SaveChangesAsync(); }
        await Check(await client.PostAsJsonAsync("/api/orders", Request()), HttpStatusCode.Created);
        var suggestions = await Body(await admin.PostAsJsonAsync("/api/premises/alternatives", new { premiseId = _premises[0].Id, startsAt = _start, endsAt = _start.AddHours(1), guests = 50 }));
        Assert.IsFalse(suggestions.GetProperty("requestedAvailable").GetBoolean());
        var alternatives = suggestions.GetProperty("alternatives");
        Assert.AreEqual(5, alternatives.GetArrayLength());
        Assert.AreEqual(_premises[1].Id, alternatives[0].GetProperty("id").GetGuid());
        Assert.AreEqual(90.01m, alternatives[0].GetProperty("rentalAmount").GetDecimal());
        var quote = await Body(await client.PostAsJsonAsync("/api/orders/quote", Request(1)));
        Assert.AreEqual(15m, quote.GetProperty("rentalDiscount").GetDecimal());
        Assert.AreEqual(165.77m, quote.GetProperty("totalAmount").GetDecimal());
        var booked = await Body(await client.PostAsJsonAsync("/api/orders", Request(1)));
        var id = booked.GetProperty("id").GetString(); var path = $"/api/orders/{id}/invoice";
        var snapshot = await Body(await admin.PostAsync(path, null));
        await using (var db = Database()) { var venue = await db.Premises.FindAsync(_premises[1].Id); venue!.PricePerHour = 999; venue.PromotionPercent = 0; await db.SaveChangesAsync(); }
        Assert.AreEqual(165.77m, (await Body(await admin.GetAsync(path))).GetProperty("totalAmount").GetDecimal());
        Assert.AreEqual(snapshot.GetProperty("number").GetString(), (await Body(await admin.GetAsync(path))).GetProperty("number").GetString());
    }

    [TestMethod]
    public async Task QuotaReductionAndAccountRoleHistoryAreGuarded()
    {
        using var admin = Http(_admin);
        await Check(await admin.PutAsJsonAsync("/api/users/" + _managers[1].Id,
            new { name = _managers[1].DisplayName, email = _managers[1].Email, role = "client" }), HttpStatusCode.OK);
        await Check(await admin.PutAsJsonAsync("/api/users/" + _managers[0].Id,
            new { name = _managers[0].DisplayName, email = _managers[0].Email, role = "manager", clientLimit = 2 }), HttpStatusCode.OK);
        for (var i = 0; i < 2; i++)
        {
            using var client = Http(_clients[i]);
            await Check(await client.PostAsJsonAsync("/api/orders", Request(i)), HttpStatusCode.Created);
        }
        await Check(await admin.PutAsJsonAsync("/api/users/" + _managers[0].Id,
            new { name = _managers[0].DisplayName, email = _managers[0].Email, role = "manager", clientLimit = 1 }), HttpStatusCode.Conflict);
        await Check(await admin.PutAsJsonAsync("/api/users/" + _managers[0].Id,
            new { name = _managers[0].DisplayName, email = _managers[0].Email, role = "client" }), HttpStatusCode.Conflict);
    }
}
