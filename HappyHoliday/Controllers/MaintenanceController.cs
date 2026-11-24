using System.Text;
using HappyHoliday.Data;
using HappyHoliday.Models;
using HappyHoliday.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HappyHoliday.Controllers;

[ApiController, Route("api/admin/maintenance"), Authorize(Roles = "admin")]
public sealed class MaintenanceController(AppDbContext db, OrderLifecycle lifecycle, TimeProvider clock) : ControllerBase
{
    private (DateTime Start, DateTime End) Period(int year, int half)
    {
        if (year is < 2000 or > 2100 || half is not (1 or 2)) throw new BookingException(400, "Choose a year from 2000 to 2100 and half 1 or 2.");
        var start = new DateTime(year, half == 1 ? 1 : 7, 1, 0, 0, 0, DateTimeKind.Utc); return (start, start.AddMonths(6));
    }
    [HttpGet("audit")]
    public async Task<IActionResult> Audit([FromQuery] int year, [FromQuery] int half, CancellationToken ct)
    {
        var (start, end) = Period(year, half); var now = BookingRules.UtcNow(clock);
        return Ok(new { checkedAt = now, startsAt = start, endsAt = end,
            ordersInPeriod = await db.Orders.CountAsync(o => o.EventDate >= start && o.EventDate < end, ct),
            completed = await db.Orders.CountAsync(o => o.EventDate >= start && o.EventDate < end && o.Status == "completed", ct),
            cancelled = await db.Orders.CountAsync(o => o.EventDate >= start && o.EventDate < end && o.Status == "cancelled", ct),
            paidOrdersReadyToComplete = await db.Orders.CountAsync(o => o.Status == "confirmed" && o.EndDate <= now && o.PaymentConfirmedAt != null && o.PaidAmount >= o.TotalAmount, ct),
            terminalOrdersToArchive = await db.Orders.CountAsync(o => !BookingRules.ActiveStatuses.Contains(o.Status) && o.EndDate <= now && o.ArchivedAt == null, ct),
            expiredUnpaidOrders = await db.Orders.CountAsync(o => o.Status == "expired", ct),
            endedUnpaidOrders = await db.Orders.CountAsync(o => (o.Status == "pending" || o.Status == "awaiting-payment")
                && o.EndDate <= now && o.PaymentConfirmedAt == null && o.PaidAmount == 0, ct),
            endedPartiallyPaidOrders = await db.Orders.CountAsync(o => o.Status == "awaiting-payment"
                && o.EndDate <= now && (o.PaymentConfirmedAt != null || o.PaidAmount > 0), ct),
            invalidPeriods = await db.Orders.CountAsync(o => o.EndDate <= o.EventDate, ct),
            legacyConfirmedWithoutReceipt = await db.Orders.CountAsync(o => o.Status == "confirmed" && o.PaymentConfirmedAt == null, ct),
            pendingRefunds = await db.CancellationStatements.Where(c => c.SettledAt == null).SumAsync(c => c.RefundAmount, ct),
            outstandingPenalties = await db.CancellationStatements.Where(c => c.SettledAt == null).SumAsync(c => c.AmountDue, ct),
            recentRuns = await db.AuditEntries.AsNoTracking().Where(a => a.Action == "maintenance-archive")
                .OrderByDescending(a => a.At).Take(10).Select(a => new { a.At, a.Details }).ToListAsync(ct),
            note = "Period counts use event start dates in UTC. Maintenance findings cover the entire database. Cleanup archives closed history and expires stale proposals; financial records are retained." });
    }
    [HttpPost("complete-expired")]
    public async Task<IActionResult> Complete(CancellationToken ct)
    {
        var (completed, expired) = await lifecycle.CloseEnded(ct);
        return Ok(new { completed, expired });
    }

    [HttpPost("archive")]
    public async Task<IActionResult> Archive(CancellationToken ct)
    {
        await using var transaction = await BookingTransaction.BeginAsync(db, ct); var now = BookingRules.UtcNow(clock);
        var orders = await db.Orders.Where(o => !BookingRules.ActiveStatuses.Contains(o.Status) && o.EndDate <= now && o.ArchivedAt == null)
            .OrderBy(o => o.EndDate).Take(500).ToListAsync(ct);
        foreach (var order in orders) order.ArchivedAt = now;
        var changes = await db.OrderChanges.Include(c => c.Order).Where(c => c.Status == "pending"
            && c.Order.EventDate.AddHours(-c.Order.ChangeCutoffHours) <= now).OrderBy(c => c.RequestedAt).Take(500).ToListAsync(ct);
        foreach (var change in changes)
        {
            change.Status = "expired"; change.ReviewedAt = now; change.ReviewNote = "Change deadline passed.";
            if (change.Order.PendingChangeId == change.Id) change.Order.PendingChangeId = null;
        }
        db.AuditEntries.Add(new AuditEntry { Action = "maintenance-archive", TargetId = "database", ActorId = OrderAccess.UserId(User),
            At = now, Details = $"Archived {orders.Count} terminal bookings; expired {changes.Count} stale proposals. No records deleted." });
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct); return Ok(new { archived = orders.Count, expiredChanges = changes.Count });
    }
    [HttpGet("export")]
    public async Task<IActionResult> Export([FromQuery] int year, [FromQuery] int half, CancellationToken ct)
    {
        var (start, end) = Period(year, half);
        var orders = await db.Orders.AsNoTracking().Where(o => o.EventDate >= start && o.EventDate < end).OrderBy(o => o.EventDate).ToListAsync(ct);
        var csv = new StringBuilder("Order,Venue,Address,Start UTC,End UTC,Status,Quoted KZT,Applied payment KZT,Completed UTC,Archived UTC\r\n");
        foreach (var o in orders) csv.AppendLine(string.Join(',', new object?[] { o.Id, o.PremiseName, o.PremiseAddress, o.EventDate.ToString("O"),
            o.EndDate.ToString("O"), o.Status, o.TotalAmount, o.PaidAmount, o.CompletedAt?.ToString("O"), o.ArchivedAt?.ToString("O") }.Select(ReportMath.Csv)));
        return File(Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(csv.ToString())).ToArray(), "text/csv; charset=utf-8", $"happy-holiday-{year}-H{half}.csv");
    }
}
