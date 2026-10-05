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
        _admin = User("admin", "Administrator");
        _premises = Enumerable.Range(0, 6).Select(i => new Premise { Name = "Venue " + i, Address = "Street " + i,
            Capacity = 100, PricePerHour = 100.01m }).ToArray();
        _service = new EventService { Name = "Equipment", Category = "EquipmentRental", Price = 10.25m };
        db.Users.AddRange(_clients.Concat(_managers).Append(_admin));
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
        await Check(await manager.PatchAsJsonAsync($"/api/orders/{id}/status", new { status = "awaiting-payment" }), HttpStatusCode.OK);
        await Check(await manager.PatchAsJsonAsync($"/api/orders/{id}/status", new { status = "confirmed" }), HttpStatusCode.OK);
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
