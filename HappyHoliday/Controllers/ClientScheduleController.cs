using HappyHoliday.Data;
using HappyHoliday.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HappyHoliday.Controllers;

[ApiController, Route("api/orders/{orderId}/schedule"), Authorize(Roles = "client,manager,admin")]
public sealed class ClientScheduleController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(string orderId, CancellationToken ct)
    {
        var order = await OrderAccess.Visible(db, User).AsNoTracking().SingleOrDefaultAsync(o => o.Id == orderId, ct);
        if (order is null) return NotFound();
        if (order.Status is not ("confirmed" or "completed")) return NotFound();
        var plan = await db.ExecutionPlans.AsNoTracking().Include(p => p.Tasks)
            .SingleOrDefaultAsync(p => p.OrderId == orderId && p.OrderRevision == order.Revision
                && (p.State == "finalized" || p.State == "dispatched"), ct);
        // Internal manager notes, staff identity and private brief instructions stay private.
        return plan is null ? NotFound() : Ok(new { order.Id, order.Revision, venue = order.PremiseName, address = order.PremiseAddress,
            startsAt = order.EventDate, endsAt = order.EndDate, plan.FinalizedAt, plan.State,
            activities = plan.Tasks.OrderBy(t => t.StartsAt).Select(t => new { t.Id, t.Activity, t.ServiceName, t.StartsAt, t.EndsAt }) });
    }
}
