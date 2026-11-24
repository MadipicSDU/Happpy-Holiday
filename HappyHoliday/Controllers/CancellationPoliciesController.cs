using HappyHoliday.Contracts;
using HappyHoliday.Data;
using HappyHoliday.Models;
using HappyHoliday.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace HappyHoliday.Controllers;

[ApiController, Route("api/admin/cancellation-policy"), Authorize(Roles = "client,manager,admin")]
public sealed class CancellationPoliciesController(AppDbContext db, TimeProvider clock, IOptions<OrderChangeOptions> options) : ControllerBase
{
    [HttpGet]
    [HttpGet("/api/booking-policy")]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var policy = await db.CancellationPolicies.AsNoTracking().OrderByDescending(p => p.Version).FirstOrDefaultAsync(ct);
        return Ok(new { version = policy?.Version ?? 0, cutoffHours = policy?.CutoffHours ?? options.Value.CutoffHours,
            earlyPercent = policy?.EarlyPercent ?? 0, latePercent = policy?.LatePercent ?? 0, createdAt = policy?.CreatedAt,
            appliesTo = "New bookings only. Existing bookings retain their stored cutoff and cancellation rates." });
    }
    [HttpPut, Authorize(Roles = "admin")]
    public async Task<IActionResult> Save(PolicyDto dto, CancellationToken ct)
    {
        if (dto.EarlyPercent != BookingRules.Money(dto.EarlyPercent) || dto.LatePercent != BookingRules.Money(dto.LatePercent))
            return BadRequest(new ProblemDetails { Detail = "Use at most two decimal places for percentage rates." });
        await using var transaction = await BookingTransaction.BeginAsync(db, ct);
        var latest = await db.CancellationPolicies.OrderByDescending(p => p.Version).FirstOrDefaultAsync(ct);
        if ((latest?.Version ?? 0) != dto.ExpectedVersion) throw new BookingException(409, "This policy changed. Refresh before saving.");
        var policy = new CancellationPolicy { Version = dto.ExpectedVersion + 1, CutoffHours = dto.CutoffHours,
            EarlyPercent = dto.EarlyPercent, LatePercent = dto.LatePercent, CreatedAt = BookingRules.UtcNow(clock), CreatedById = OrderAccess.UserId(User) };
        db.CancellationPolicies.Add(policy);
        db.AuditEntries.Add(new AuditEntry { Action = "cancellation-policy-created", TargetId = policy.Version.ToString(),
            ActorId = policy.CreatedById, At = policy.CreatedAt, Details = "Applies to new bookings only." });
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
        return await Get(ct);
    }
}
