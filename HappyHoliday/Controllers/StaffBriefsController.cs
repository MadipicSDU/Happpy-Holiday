using System.Text.Json;
using HappyHoliday.Contracts;
using HappyHoliday.Data;
using HappyHoliday.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HappyHoliday.Controllers;

[ApiController, Route("api/staff/briefs"), Authorize(Roles = "staff")]
public sealed class StaffBriefsController(AppDbContext db, TimeProvider clock) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct)
    {
        var userId = OrderAccess.UserId(User);
        var briefs = await db.ExecutionBriefs.AsNoTracking().Where(b => b.StaffId == userId).OrderByDescending(b => b.SentAt).ToListAsync(ct);
        return Ok(briefs.Select(b => new { b.Id, b.Status, b.SentAt, b.UpdatedAt, b.SupersededAt,
            details = JsonSerializer.Deserialize<ExecutionBriefSnapshot>(b.SnapshotJson, BillingService.Json) }));
    }
    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, BriefStatusDto dto, CancellationToken ct)
    {
        await using var transaction = await BookingTransaction.BeginAsync(db, ct);
        var userId = OrderAccess.UserId(User);
        var brief = await db.ExecutionBriefs.Include(b => b.Plan).ThenInclude(p => p.Order).SingleOrDefaultAsync(b => b.Id == id && b.StaffId == userId, ct);
        if (brief is null) return NotFound();
        if (brief.SupersededAt.HasValue || brief.Plan.State != "dispatched" || brief.Plan.OrderRevision != brief.Plan.Order.Revision || brief.Plan.Order.Status != "confirmed")
            throw new BookingException(409, "This brief has been withdrawn or the booking is no longer ready for execution.");
        if (brief.Status == dto.Status) return Ok(new { brief.Id, brief.Status });
        if ((brief.Status, dto.Status) is not (("sent", "acknowledged") or ("acknowledged", "in-progress") or ("in-progress", "completed")))
            throw new BookingException(400, "Acknowledge, start, and complete the brief in that order.");
        var details = JsonSerializer.Deserialize<ExecutionBriefSnapshot>(brief.SnapshotJson, BillingService.Json)!;
        if (dto.Status == "in-progress" && clock.GetUtcNow().UtcDateTime < details.TaskStartsAt)
            throw new BookingException(409, "This activity has not started yet. You can acknowledge the brief now.");
        brief.Status = dto.Status; brief.UpdatedAt = BookingRules.UtcNow(clock);
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct); return Ok(new { brief.Id, brief.Status, brief.UpdatedAt });
    }
}
