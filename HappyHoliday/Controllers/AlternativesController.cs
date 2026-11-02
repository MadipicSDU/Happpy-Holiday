using System.Security.Claims;
using HappyHoliday.Contracts;
using HappyHoliday.Data;
using HappyHoliday.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HappyHoliday.Controllers;

[ApiController, Route("api/premises/alternatives"), Authorize(Roles = "client,manager,admin")]
public sealed class AlternativesController(AppDbContext db, TimeProvider clock) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Check(AvailabilityDto dto, CancellationToken ct)
    {
        var start = dto.StartsAt.UtcDateTime; var end = dto.EndsAt.UtcDateTime;
        if (start <= clock.GetUtcNow().UtcDateTime || end <= start || end - start > TimeSpan.FromDays(365))
            return BadRequest(new ProblemDetails { Detail = "Choose a future rental period of at most 365 days." });
        var requested = await db.Premises.AsNoTracking().SingleOrDefaultAsync(p => p.Id == dto.PremiseId, ct);
        if (requested is null) return NotFound();
        if (dto.OrderId is not null)
        {
            var userId = Guid.Parse(User.FindFirstValue("sub")!);
            var order = await db.Orders.AsNoTracking().SingleOrDefaultAsync(o => o.Id == dto.OrderId, ct);
            if (order is null || (!User.IsInRole("admin") && order.ClientId != userId && !(User.IsInRole("manager") && order.ManagerId == userId))) return NotFound();
            if (order.PremiseId != dto.PremiseId || order.EventDate != start || order.EndDate != end || order.ExpectedGuests != dto.Guests)
                return BadRequest(new ProblemDetails { Detail = "Check availability with the stored order details." });
        }
        var occupied = await db.Orders.Where(o => o.Id != dto.OrderId && o.Status != "cancelled" && o.Status != "completed"
            && o.EventDate < end && o.EndDate > start).Select(o => o.PremiseId).Distinct().ToListAsync(ct);
        var hours = BookingRules.Hours(start, end);
        var candidates = await db.Premises.AsNoTracking().Where(p => p.Id != dto.PremiseId && p.Capacity >= dto.Guests && !occupied.Contains(p.Id)).ToListAsync(ct);
        var alternatives = candidates.Select(p => {
            var rental = BookingRules.Money(p.PricePerHour * hours); var discount = BookingRules.Money(rental * p.PromotionPercent / 100m);
            return new { p.Id, p.Name, p.Address, p.Capacity, p.PricePerHour, p.ImageUrl, p.PromotionPercent, rentalDiscount = discount, rentalAmount = rental - discount };
        }).OrderBy(p => p.rentalAmount).ThenBy(p => p.Name).ToList();
        return Ok(new { requestedAvailable = !occupied.Contains(dto.PremiseId) && requested.Capacity >= dto.Guests,
            checkedAt = clock.GetUtcNow(), startsAt = start, endsAt = end, dto.Guests, alternatives,
            note = "Availability is a snapshot; service costs are excluded. Booking validates conflicts and the three-venue policy again." });
    }
}
