using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HappyHoliday.Models;
using HappyHoliday.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace HappyHoliday.Tests;

public sealed partial class BackendTests
{
    private static object ConfirmCancellation(JsonElement quote, string reason = "Test cancellation") => new {
        expectedRevision = quote.GetProperty("revision").GetInt32(), expectedPenalty = quote.GetProperty("penaltyAmount").GetDecimal(),
        expectedRefund = quote.GetProperty("refundAmount").GetDecimal(), expectedAmountDue = quote.GetProperty("amountDue").GetDecimal(), reason };

    [TestMethod]
    public async Task BookingRequiresFreshReviewWhenPriceLinesChangeWithoutChangingTotal()
    {
        using var client = Http(_clients[0]);
        object RequestWithVersion(string version) => new
        {
            premiseId = _premises[0].Id, startsAt = _start, endsAt = _start.AddHours(1.5), guests = 50,
            services = new[] { new { serviceId = _service.Id, quantity = 3 } }, expectedQuoteVersion = version
        };
        var original = await Body(await client.PostAsJsonAsync("/api/orders/quote", Request()));
        var originalVersion = original.GetProperty("quoteVersion").GetString()!;
        await using (var db = Database())
        {
            (await db.Premises.FindAsync(_premises[0].Id))!.PricePerHour += 2;
            (await db.EventServices.FindAsync(_service.Id))!.Price -= 1;
            await db.SaveChangesAsync();
        }
        var rejected = await client.PostAsJsonAsync("/api/orders", RequestWithVersion(originalVersion));
        await Check(rejected, HttpStatusCode.Conflict);
        Assert.AreEqual("quote-changed", (await Body(rejected)).GetProperty("code").GetString());
        var updated = await Body(await client.PostAsJsonAsync("/api/orders/quote", Request()));
        Assert.AreEqual(original.GetProperty("totalAmount").GetDecimal(), updated.GetProperty("totalAmount").GetDecimal());
        var updatedVersion = updated.GetProperty("quoteVersion").GetString()!;
        Assert.AreNotEqual(originalVersion, updatedVersion);
        await Check(await client.PostAsJsonAsync("/api/orders", RequestWithVersion(updatedVersion)), HttpStatusCode.Created);
        await using var verify = Database();
        Assert.AreEqual(1, await verify.Orders.CountAsync());
    }

    [TestMethod]
    public async Task CancellationPoliciesSnapshotTermsAndRejectStaleWrites()
    {
        using var admin = Http(_admin); using var client = Http(_clients[0]);
        await Check(await client.PutAsJsonAsync("/api/admin/cancellation-policy", new { expectedVersion = 0, cutoffHours = 24, earlyPercent = 0, latePercent = 20 }), HttpStatusCode.Forbidden);
        await Check(await admin.PutAsJsonAsync("/api/admin/cancellation-policy", new { expectedVersion = 0, cutoffHours = 24, earlyPercent = 5.125, latePercent = 20 }), HttpStatusCode.BadRequest);
        await Check(await admin.PutAsJsonAsync("/api/admin/cancellation-policy", new { expectedVersion = 0, cutoffHours = 24, earlyPercent = 5, latePercent = 20 }), HttpStatusCode.OK);
        var quote = await Body(await client.PostAsJsonAsync("/api/orders/quote", Request()));
        Assert.AreEqual(20m, quote.GetProperty("cancellationTerms").GetProperty("latePercent").GetDecimal());
        var created = await client.PostAsJsonAsync("/api/orders", Request()); await Check(created, HttpStatusCode.Created);
        var id = (await Body(created)).GetProperty("id").GetString();
        await Check(await admin.PutAsJsonAsync("/api/admin/cancellation-policy", new { expectedVersion = 0, cutoffHours = 24, earlyPercent = 10, latePercent = 80 }), HttpStatusCode.Conflict);
        await Check(await admin.PutAsJsonAsync("/api/admin/cancellation-policy", new { expectedVersion = 1, cutoffHours = 48, earlyPercent = 10, latePercent = 80 }), HttpStatusCode.OK);
        await using var db = Database(); var stored = await db.Orders.SingleAsync(o => o.Id == id);
        Assert.AreEqual(1, stored.PenaltyPolicyVersion); Assert.AreEqual(24, stored.ChangeCutoffHours);
        Assert.AreEqual(5m, stored.EarlyCancellationPercent); Assert.AreEqual(20m, stored.LateCancellationPercent);
        Assert.AreEqual(2, await db.CancellationPolicies.CountAsync());
        await Check(await client.PostAsJsonAsync("/api/orders", new { premiseId = _premises[1].Id, startsAt = _start, endsAt = _start.AddHours(2), guests = 1, expectedPolicyVersion = 1 }), HttpStatusCode.Conflict);
    }

    [TestMethod]
    public async Task PaidCancellationRequiresReviewedAmountsAndSettlesRefundExactlyOnce()
    {
        using var admin = Http(_admin); using var client = Http(_clients[0]); using var other = Http(_clients[1]);
        await Check(await admin.PutAsJsonAsync("/api/admin/cancellation-policy", new { expectedVersion = 0, cutoffHours = 168, earlyPercent = 0, latePercent = 25 }), HttpStatusCode.OK);
        var start = DateTimeOffset.UtcNow.AddDays(2);
        var order = await PaidOrder(client, Request(start: start, end: start.AddHours(2)));
        var id = order.GetProperty("id").GetString(); var url = $"/api/orders/{id}/cancellation";
        await Check(await other.GetAsync(url + "/quote"), HttpStatusCode.NotFound);
        await Check(await client.PostAsJsonAsync($"/api/orders/{id}/changes/quote", new { booking = Request(venue: 1), expectedRevision = 1 }), HttpStatusCode.Conflict);
        var quote = await Body(await client.GetAsync(url + "/quote"));
        var penalty = BookingRules.Money(order.GetProperty("totalAmount").GetDecimal() * .25m);
        Assert.IsTrue(quote.GetProperty("isLate").GetBoolean()); Assert.AreEqual(penalty, quote.GetProperty("penaltyAmount").GetDecimal());
        await Check(await client.PostAsJsonAsync(url, new { expectedRevision = 1, expectedPenalty = 0, expectedRefund = 0, expectedAmountDue = 0 }), HttpStatusCode.Conflict);
        Assert.AreEqual("confirmed", (await Body(await client.GetAsync("/api/orders/" + id))).GetProperty("status").GetString());
        var results = await Task.WhenAll(client.PostAsJsonAsync(url, ConfirmCancellation(quote)), client.PostAsJsonAsync(url, ConfirmCancellation(quote)));
        foreach (var result in results) await Check(result, HttpStatusCode.OK);
        Assert.AreEqual("cancelled", (await Body(results[0])).GetProperty("order").GetProperty("status").GetString());
        await Check(await client.PostAsync(url + "/settle", null), HttpStatusCode.Forbidden);
        var settled = await admin.PostAsync(url + "/settle", null); await Check(settled, HttpStatusCode.OK);
        var first = await Body(settled); Assert.IsTrue(first.GetProperty("isDemo").GetBoolean());
        var retry = await Body(await admin.PostAsync(url + "/settle", null));
        Assert.AreEqual(first.GetProperty("settlementReference").GetString(), retry.GetProperty("settlementReference").GetString());
        await using var db = Database(); Assert.AreEqual(1, await db.CancellationStatements.CountAsync());
        Assert.AreEqual(1, await db.Payments.CountAsync()); Assert.IsNull((await db.Invoices.SingleAsync()).VoidedAt);
        Assert.AreEqual(1, await db.AuditEntries.CountAsync(a => a.Action == "cancellation-settled"));
        var report = await Body(await admin.GetAsync("/api/reports/analytics?from=" + Uri.EscapeDataString(DateTimeOffset.UtcNow.AddDays(-1).ToString("O"))
            + "&to=" + Uri.EscapeDataString(start.AddDays(1).ToString("O"))));
        Assert.AreEqual(penalty, report.GetProperty("totals").GetProperty("netRecorded").GetDecimal());
        Assert.AreEqual(0m, report.GetProperty("totals").GetProperty("pendingRefunds").GetDecimal());
        var released = await client.PostAsJsonAsync("/api/orders", Request(start: start, end: start.AddHours(2))); await Check(released, HttpStatusCode.Created);
    }

    [TestMethod]
    public async Task UnpaidLateCancellationCannotBypassPenaltyAndCanPayDemoBalance()
    {
        using var admin = Http(_admin); using var client = Http(_clients[0]);
        await Check(await admin.PutAsJsonAsync("/api/admin/cancellation-policy", new { expectedVersion = 0, cutoffHours = 168, earlyPercent = 0, latePercent = 50 }), HttpStatusCode.OK);
        var start = DateTimeOffset.UtcNow.AddDays(1); var created = await client.PostAsJsonAsync("/api/orders", Request(start: start, end: start.AddHours(1)));
        await Check(created, HttpStatusCode.Created); var id = (await Body(created)).GetProperty("id").GetString(); var url = $"/api/orders/{id}/cancellation";
        await Check(await client.PatchAsJsonAsync($"/api/orders/{id}/status", new { status = "cancelled" }), HttpStatusCode.Conflict);
        var quote = await Body(await client.GetAsync(url + "/quote")); Assert.IsGreaterThan(0m, quote.GetProperty("amountDue").GetDecimal());
        await Check(await client.PostAsJsonAsync(url, ConfirmCancellation(quote)), HttpStatusCode.OK);
        var result = await client.PostAsync(url + "/settle", null); await Check(result, HttpStatusCode.OK);
        Assert.AreEqual("settled", (await Body(result)).GetProperty("status").GetString());
    }

    [TestMethod]
    public async Task LifecycleCompletesPaidOrdersExpiresUnpaidOrdersAndPreservesHistory()
    {
        using var admin = Http(_admin); using var client = Http(_clients[0]);
        var paid = await PaidOrder(client, Request()); var id = paid.GetProperty("id").GetString();
        var created = await client.PostAsJsonAsync("/api/orders", Request(venue: 1));
        await Check(created, HttpStatusCode.Created);
        var unpaid = await Body(created);
        var unpaidId = unpaid.GetProperty("id").GetString();
        await Check(await admin.PostAsync($"/api/orders/{unpaidId}/invoice", null), HttpStatusCode.OK);
        var issued = await admin.PostAsync($"/api/orders/{unpaidId}/invoice/deliver", null);
        await Check(issued, HttpStatusCode.OK);
        var invoiceId = (await Body(issued)).GetProperty("id").GetGuid();
        var change = await Change(client, unpaid, Request(venue: 1, end: _start.AddHours(2)));
        await using (var db = Database())
        {
            var orders = await db.Orders.ToListAsync();
            foreach (var order in orders) { order.EventDate = DateTime.UtcNow.AddHours(-3); order.EndDate = DateTime.UtcNow.AddHours(-1); }
            db.Orders.Add(new Order { ClientId = _clients[0].Id, PremiseId = _premises[2].Id, Status = "confirmed", EventDate = DateTime.UtcNow.AddHours(-3), EndDate = DateTime.UtcNow.AddHours(-1) });
            db.Orders.Add(new Order { ClientId = _clients[0].Id, PremiseId = _premises[2].Id, Status = "awaiting-payment",
                EventDate = DateTime.UtcNow.AddHours(-3), EndDate = DateTime.UtcNow.AddHours(-1), TotalAmount = 500, PaidAmount = 250,
                PaymentConfirmedAt = DateTime.UtcNow.AddDays(-1) });
            await db.SaveChangesAsync();
        }
        using var stranger = Http(_clients[1]); await Check(await stranger.PostAsync("/api/admin/maintenance/complete-expired", null), HttpStatusCode.Forbidden);
        var response = await admin.PostAsync("/api/admin/maintenance/complete-expired", null); await Check(response, HttpStatusCode.OK);
        var count = await Body(response);
        Assert.AreEqual(1, count.GetProperty("completed").GetInt32());
        Assert.AreEqual(1, count.GetProperty("expired").GetInt32());
        var retry = await Body(await admin.PostAsync("/api/admin/maintenance/complete-expired", null));
        Assert.AreEqual(0, retry.GetProperty("completed").GetInt32());
        Assert.AreEqual(0, retry.GetProperty("expired").GetInt32());
        var closed = await Body(await client.GetAsync($"/api/orders/{unpaidId}"));
        Assert.AreEqual("expired", closed.GetProperty("status").GetString());
        Assert.AreEqual(change.GetProperty("id").GetGuid(), closed.GetProperty("latestChange").GetProperty("id").GetGuid());
        Assert.AreEqual("expired", closed.GetProperty("latestChange").GetProperty("status").GetString());
        await Check(await client.PostAsJsonAsync($"/api/orders/{unpaidId}/invoice/pay", new { idempotencyKey = Guid.NewGuid(), invoiceId }), HttpStatusCode.Conflict);
        await using var verify = Database(); var completed = await verify.Orders.SingleAsync(o => o.Id == id);
        Assert.AreEqual("completed", completed.Status); Assert.IsNotNull(completed.CompletedAt); Assert.IsNotNull(completed.ArchivedAt);
        Assert.AreEqual(1, await verify.Orders.CountAsync(o => o.Status == "awaiting-payment"));
        Assert.AreEqual(1, await verify.Orders.CountAsync(o => o.Status == "confirmed"));
        Assert.AreEqual(1, await verify.Payments.CountAsync());
        Assert.IsNotNull((await verify.Invoices.SingleAsync(i => i.Id == invoiceId)).VoidedAt);
    }

    [TestMethod]
    public async Task ReviewsRequireOwnedCompletedPaidEventsAndAggregateSeparateServiceRatings()
    {
        using var admin = Http(_admin); using var client = Http(_clients[0]); using var stranger = Http(_clients[1]);
        var paid = await PaidOrder(client, Request()); var id = paid.GetProperty("id").GetString(); var url = $"/api/orders/{id}/review";
        var review = new { rating = 4, comment = "Great venue", services = new[] { new { serviceId = _service.Id, rating = 2 } } };
        await Check(await client.PostAsJsonAsync(url, review), HttpStatusCode.Conflict);
        await using (var db = Database()) { var order = await db.Orders.SingleAsync(); order.EventDate = DateTime.UtcNow.AddHours(-3); order.EndDate = DateTime.UtcNow.AddHours(-1); await db.SaveChangesAsync(); }
        await Check(await admin.PostAsync("/api/admin/maintenance/complete-expired", null), HttpStatusCode.OK);
        await Check(await stranger.PostAsJsonAsync(url, review), HttpStatusCode.NotFound);
        await Check(await client.PostAsJsonAsync(url, new { rating = 6 }), HttpStatusCode.BadRequest);
        await Check(await client.PostAsJsonAsync(url, new { rating = 4, services = new[] { new { serviceId = Guid.NewGuid(), rating = 2 } } }), HttpStatusCode.BadRequest);
        await Check(await client.PostAsJsonAsync(url, review), HttpStatusCode.OK);
        await Check(await client.PostAsJsonAsync(url, review), HttpStatusCode.OK);
        await Check(await client.PostAsJsonAsync(url, new { rating = 1 }), HttpStatusCode.Conflict);
        var summary = await Body(await client.GetAsync("/api/reviews/summary"));
        Assert.AreEqual(4m, summary.GetProperty("venues")[0].GetProperty("average").GetDecimal());
        Assert.AreEqual(2m, summary.GetProperty("services")[0].GetProperty("average").GetDecimal());
        await using var verify = Database(); Assert.AreEqual(1, await verify.Reviews.CountAsync()); Assert.AreEqual(1, await verify.ServiceReviews.CountAsync());
    }

    [TestMethod]
    public async Task ClientScheduleHidesInternalNotesAndUsesCurrentPublishedRevision()
    {
        using var client = Http(_clients[0]); using var stranger = Http(_clients[1]);
        var paid = await PaidOrder(client, Request()); var id = paid.GetProperty("id").GetString(); var url = $"/api/orders/{id}/schedule";
        await Check(await client.GetAsync(url), HttpStatusCode.NotFound);
        await using (var db = Database())
        {
            db.ExecutionPlans.Add(new ExecutionPlan { OrderId = id!, OrderRevision = 1, State = "finalized", UpdatedAt = DateTime.UtcNow, FinalizedAt = DateTime.UtcNow,
                Notes = "PRIVATE MANAGER NOTE", Tasks = [new ExecutionTask { Activity = "Welcome", ServiceName = "Host", Instructions = "PRIVATE INSTRUCTIONS", StaffName = "PRIVATE STAFF", StartsAt = _start.UtcDateTime, EndsAt = _start.AddHours(1).UtcDateTime }] });
            await db.SaveChangesAsync();
        }
        await Check(await stranger.GetAsync(url), HttpStatusCode.NotFound);
        var response = await client.GetAsync(url); await Check(response, HttpStatusCode.OK);
        var json = await response.Content.ReadAsStringAsync(); StringAssert.Contains(json, "Welcome"); Assert.AreEqual(-1, json.IndexOf("PRIVATE", StringComparison.Ordinal));
        await using (var db = Database()) { (await db.Orders.SingleAsync()).Revision = 2; await db.SaveChangesAsync(); }
        await Check(await client.GetAsync(url), HttpStatusCode.NotFound);
    }

    [TestMethod]
    public async Task ReportsScopeBookingsCashAndBiannualMaintenanceExports()
    {
        using var client = Http(_clients[0]); using var other = Http(_clients[1]); using var admin = Http(_admin);
        var order = await PaidOrder(client, Request()); await Check(await other.PostAsJsonAsync("/api/orders", Request(venue: 1)), HttpStatusCode.Created);
        using var manager = Http(_managers.Single(m => m.Id == order.GetProperty("managerId").GetGuid()));
        var from = DateTimeOffset.UtcNow.AddDays(-1).ToString("O"); var to = _start.AddDays(1).ToString("O");
        var url = "/api/reports/analytics?from=" + Uri.EscapeDataString(from) + "&to=" + Uri.EscapeDataString(to);
        await Check(await client.GetAsync(url), HttpStatusCode.Forbidden);
        var response = await manager.GetAsync(url); await Check(response, HttpStatusCode.OK); var report = await Body(response);
        Assert.AreEqual(1, report.GetProperty("totals").GetProperty("bookings").GetInt32());
        Assert.AreEqual(order.GetProperty("totalAmount").GetDecimal(), report.GetProperty("totals").GetProperty("grossPayments").GetDecimal());
        Assert.AreEqual(2, (await Body(await admin.GetAsync(url))).GetProperty("totals").GetProperty("bookings").GetInt32());
        await using (var db = Database()) { var stored = await db.Orders.SingleAsync(o => o.Id == order.GetProperty("id").GetString()); stored.PremiseName = "=1+1"; await db.SaveChangesAsync(); }
        var export = $"/api/admin/maintenance/export?year={_start.Year}&half={(_start.Month <= 6 ? 1 : 2)}";
        await Check(await manager.GetAsync(export), HttpStatusCode.Forbidden);
        var csv = await admin.GetAsync(export); await Check(csv, HttpStatusCode.OK); StringAssert.Contains(await csv.Content.ReadAsStringAsync(), "\"'=1+1\"");
        await Check(await admin.GetAsync("/api/admin/maintenance/audit?year=2026&half=3"), HttpStatusCode.BadRequest);
        await Check(await admin.PostAsync("/api/admin/maintenance/archive", null), HttpStatusCode.OK);
    }
}
