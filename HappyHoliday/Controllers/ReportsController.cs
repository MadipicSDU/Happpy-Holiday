using HappyHoliday.Data;
using HappyHoliday.Models;
using HappyHoliday.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HappyHoliday.Controllers;

[ApiController, Route("api/reports"), Authorize(Roles = "manager,admin")]
public sealed class ReportsController(AppDbContext db, TimeProvider clock) : ControllerBase
{
    [HttpGet("analytics")]
    public async Task<IActionResult> Analytics([FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to, CancellationToken ct)
    {
        var now = BookingRules.UtcNow(clock);
        var start = from?.UtcDateTime ?? new DateTime(now.Year, now.Month <= 6 ? 1 : 7, 1, 0, 0, 0, DateTimeKind.Utc);
        var end = to?.UtcDateTime ?? start.AddMonths(6);
        if (end <= start || end - start > TimeSpan.FromDays(366)) return BadRequest(new ProblemDetails { Detail = "Choose a reporting period of at most 366 days." });
        var visible = OrderAccess.Visible(db, User).AsNoTracking();
        var visibleIds = visible.Select(o => o.Id);
        var orders = await visible.Where(o => o.EventDate < end && o.EndDate > start).ToListAsync(ct);
        var venues = await db.Premises.AsNoTracking().OrderBy(p => p.Name).ToListAsync(ct);
        var payments = await db.Payments.AsNoTracking().Where(p => visibleIds.Contains(p.Invoice.OrderId) && p.PaidAt >= start && p.PaidAt < end)
            .Select(p => new { p.PaidAt, p.Amount }).ToListAsync(ct);
        var credits = await db.Invoices.AsNoTracking().Where(i => visibleIds.Contains(i.OrderId) && i.DocumentType == "credit-note"
            && i.SettledAt >= start && i.SettledAt < end).Select(i => new { at = i.SettledAt!.Value, i.TotalAmount }).ToListAsync(ct);
        var settlements = await db.CancellationStatements.AsNoTracking().Where(c => visibleIds.Contains(c.OrderId)
            && c.SettledAt >= start && c.SettledAt < end).ToListAsync(ct);
        var outstanding = await db.CancellationStatements.AsNoTracking().Where(c => visibleIds.Contains(c.OrderId)
            && c.SettledAt == null && c.CreatedAt >= start && c.CreatedAt < end).ToListAsync(ct);
        var venueRows = venues.Select(v => {
            var bookings = orders.Where(o => o.PremiseId == v.Id).ToList();
            var reserved = bookings.Where(o => o.Status is not ("cancelled" or "expired")).ToList();
            var occupied = ReportMath.OccupiedHours(reserved.Select(o => (o.EventDate, o.EndDate)), start, end);
            var paid = ReportMath.OccupiedHours(bookings.Where(o => (o.Status == "confirmed" || o.Status == "completed")
                && o.PaymentConfirmedAt.HasValue && o.PaidAmount >= o.TotalAmount).Select(o => (o.EventDate, o.EndDate)), start, end);
            return new { v.Id, v.Name, v.Address, bookings = bookings.Count, cancelled = bookings.Count(o => o.Status == "cancelled"),
                occupiedHours = occupied, paidHours = paid, availableHours = BookingRules.Hours(start, end),
                utilization = occupied / BookingRules.Hours(start, end),
                orderValue = reserved.Where(o => o.EventDate >= start && o.EventDate < end).Sum(o => o.TotalAmount) };
        }).ToList();
        var months = new List<object>();
        for (var month = new DateTime(start.Year, start.Month, 1, 0, 0, 0, DateTimeKind.Utc); month < end; month = month.AddMonths(1))
        {
            var a = month < start ? start : month; var b = month.AddMonths(1) > end ? end : month.AddMonths(1);
            var gross = payments.Where(p => p.PaidAt >= a && p.PaidAt < b).Sum(p => p.Amount);
            var credit = credits.Where(c => c.at >= a && c.at < b).Sum(c => c.TotalAmount);
            var cancelled = settlements.Where(c => c.SettledAt >= a && c.SettledAt < b).ToList();
            months.Add(new { month = month.ToString("yyyy-MM"), bookings = orders.Count(o => o.EventDate >= a && o.EventDate < b),
                occupiedHours = venues.Sum(v => ReportMath.OccupiedHours(orders.Where(o => o.PremiseId == v.Id && o.Status is not ("cancelled" or "expired"))
                    .Select(o => (o.EventDate, o.EndDate)), a, b)),
                grossPayments = gross, credits = credit, refunds = cancelled.Sum(c => c.RefundAmount),
                penaltyCollections = cancelled.Sum(c => c.AmountDue), netRecorded = gross - credit - cancelled.Sum(c => c.RefundAmount) + cancelled.Sum(c => c.AmountDue) });
        }
        return Ok(new { checkedAt = now, startsAt = start, endsAt = end, timeZone = "UTC", currency = "KZT",
            scope = User.IsInRole("admin") ? "All orders" : "Assigned orders only",
            definitions = "Occupancy merges overlapping reservations and clips them to the period. Available hours use the full period for each listed venue. Booking counts include cancellations and expiries. Occupancy and order value exclude them. Order value counts bookings starting in the period. Cash uses settlement timestamps. Demo amounts do not represent bank transactions.",
            totals = new { bookings = orders.Count, cancelled = orders.Count(o => o.Status == "cancelled"),
                occupiedHours = venueRows.Sum(v => v.occupiedHours), availableHours = venueRows.Sum(v => v.availableHours),
                grossPayments = payments.Sum(p => p.Amount), changeCredits = credits.Sum(c => c.TotalAmount),
                cancellationRefunds = settlements.Sum(c => c.RefundAmount), penaltyCollections = settlements.Sum(c => c.AmountDue),
                netRecorded = payments.Sum(p => p.Amount) - credits.Sum(c => c.TotalAmount) - settlements.Sum(c => c.RefundAmount) + settlements.Sum(c => c.AmountDue),
                pendingRefunds = outstanding.Sum(c => c.RefundAmount), outstandingPenalties = outstanding.Sum(c => c.AmountDue) },
            venues = venueRows, months,
            locations = venueRows.GroupBy(v => v.Address).Select(g => new { address = g.Key, venues = g.Count(), bookings = g.Sum(v => v.bookings),
                occupiedHours = g.Sum(v => v.occupiedHours), utilization = g.Sum(v => v.occupiedHours) / g.Sum(v => v.availableHours) }),
            services = orders.Where(o => o.Status is not ("cancelled" or "expired") && o.EventDate >= start && o.EventDate < end).SelectMany(o => o.OrderServices)
                .GroupBy(s => new { s.EventServiceId, s.Name }).Select(g => new { serviceId = g.Key.EventServiceId, name = g.Key.Name,
                    bookings = g.Count(), units = g.Sum(s => (long)s.Quantity), orderValue = g.Sum(s => s.Amount) }) });
    }
}
