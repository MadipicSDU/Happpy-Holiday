using HappyHoliday.Data;
using HappyHoliday.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HappyHoliday.Controllers;

[ApiController, Route("api/management"), Authorize(Roles = "manager,admin")]
public sealed class ManagementController(AppDbContext db, TimeProvider clock) : ControllerBase
{
    [HttpGet("operators")]
    public async Task<IActionResult> Operators(CancellationToken ct) => Ok(await db.Users.AsNoTracking().Where(u => u.Role == "staff")
        .OrderBy(u => u.DisplayName).Select(u => new { u.Id, name = u.DisplayName }).ToListAsync(ct));

    [HttpGet("dashboard")]
    public async Task<IActionResult> Dashboard([FromQuery] DateTimeOffset? from, [FromQuery] DateTimeOffset? to, CancellationToken ct)
    {
        var now = BookingRules.UtcNow(clock); var start = from?.UtcDateTime ?? now.Date; var end = to?.UtcDateTime ?? start.AddDays(1);
        if (end <= start || end - start > TimeSpan.FromDays(31)) return BadRequest(new ProblemDetails { Detail = "Choose a monitoring period of up to 31 days." });
        var orders = await OrderAccess.Visible(db, User).AsNoTracking().Where(o => o.Status != "cancelled" && o.Status != "completed").OrderBy(o => o.EventDate).ToListAsync(ct);
        var orderIds = orders.Select(o => o.Id).ToList();
        var allReservations = await db.Orders.AsNoTracking().Where(o => o.Status != "cancelled" && o.Status != "completed" && o.EventDate < end && o.EndDate > start)
            .Select(o => new { o.Id, o.PremiseId, o.EventDate, o.EndDate }).ToListAsync(ct);
        var venues = await db.Premises.AsNoTracking().OrderBy(p => p.Name).ToListAsync(ct);
        var services = await db.EventServices.AsNoTracking().OrderBy(s => s.Category).ThenBy(s => s.Name).ToListAsync(ct);
        var reserved = await db.OrderServices.Where(s => s.Order!.Status != "cancelled" && s.Order.Status != "completed" && s.Order.EventDate < end && s.Order.EndDate > start)
            .Select(s => new { s.EventServiceId, s.Quantity, s.Order!.EventDate, s.Order.EndDate }).ToListAsync(ct);
        var tasks = await db.ExecutionTasks.AsNoTracking().Where(t => (t.Plan.State == "finalized" || t.Plan.State == "dispatched")
            && t.Plan.Order.Status == "confirmed" && t.Plan.OrderRevision == t.Plan.Order.Revision && t.StartsAt < end && t.EndsAt > start)
            .Select(t => new { t.Id, t.StaffId, t.Activity, t.StartsAt, t.EndsAt, t.Plan.OrderId }).ToListAsync(ct);
        var staff = await db.Users.AsNoTracking().Where(u => u.Role == "staff").OrderBy(u => u.DisplayName).ToListAsync(ct);
        var briefs = await db.ExecutionBriefs.AsNoTracking().Where(b => orderIds.Contains(b.Plan.OrderId) && b.SupersededAt == null
            && b.Plan.State == "dispatched" && b.Plan.OrderRevision == b.Plan.Order.Revision)
            .Select(b => new { b.Id, b.Status, b.UpdatedAt, b.Plan.OrderId }).ToListAsync(ct);
        return Ok(new { checkedAt = now, startsAt = start, endsAt = end,
            counts = new { activeOrders = orders.Count, assignedClients = orders.Select(o => o.ClientId).Distinct().Count(),
                pendingChanges = orders.Count(o => o.PendingChangeId.HasValue), awaitingPayment = orders.Count(o => o.Status == "awaiting-payment"),
                needsExecution = orders.Count(o => o.Status == "confirmed" && o.PaymentConfirmedAt.HasValue && o.EndDate > now && o.ExecutionState is not ("finalized" or "dispatched")),
                activeServices = briefs.Count(b => b.Status == "in-progress") },
            worklist = orders.Select(OrderingService.ToResponse),
            occupancy = venues.Select(v => new { v.Id, v.Name, v.Address, occupied = allReservations.Any(o => o.PremiseId == v.Id),
                bookings = allReservations.Where(o => o.PremiseId == v.Id).Select(o => new { o.Id, startsAt = o.EventDate, endsAt = o.EndDate }) }).OrderByDescending(v => v.occupied).ThenBy(v => v.Name),
            services = services.Select(s => { var peak = BookingRules.PeakUnits(reserved.Where(r => r.EventServiceId == s.Id)
                .Select(r => (r.EventDate, r.EndDate, r.Quantity)), start, end);
                return new { s.Id, s.Name, s.Category, s.ConcurrentCapacity, reservedUnits = peak,
                    availableUnits = s.ConcurrentCapacity.HasValue ? Math.Max(0, s.ConcurrentCapacity.Value - peak) : (long?)null }; }),
            staff = staff.Select(s => new { s.Id, name = s.DisplayName, available = !tasks.Any(t => t.StaffId == s.Id), assignments = tasks.Where(t => t.StaffId == s.Id) }), briefs });
    }
}
