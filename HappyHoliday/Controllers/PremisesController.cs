using HappyHoliday.Authentication;
using HappyHoliday.Data;
using HappyHoliday.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HappyHoliday.Controllers;

[ApiController]
[Route("api/premises")]
public sealed class PremisesController(AppDbContext database) : ControllerBase
{
    [HttpGet("occupancy")]
    [Authorize(Roles = "manager,admin")]
    public async Task<IActionResult> GetOccupancy([FromQuery] DateTimeOffset from, [FromQuery] DateTimeOffset to,
        CancellationToken ct)
    {
        if (from == default || to <= from || to - from > TimeSpan.FromDays(366))
            return BadRequest(new ProblemDetails { Detail = "Supply from and to for a period of at most 366 days." });
        var start = from.UtcDateTime;
        var end = to.UtcDateTime;
        var premises = await database.Premises.AsNoTracking().OrderBy(p => p.Name).ToListAsync(ct);
        var bookings = await database.Orders.AsNoTracking()
            .Where(o => o.Status != "cancelled" && o.Status != "completed" && o.EventDate < end && o.EndDate > start)
            .Select(o => new { o.Id, o.PremiseId, StartsAt = o.EventDate, EndsAt = o.EndDate, o.Status }).ToListAsync(ct);
        return Ok(premises.Select(p => new
        {
            p.Id, p.Name, p.Address, p.Capacity,
            available = !bookings.Any(o => o.PremiseId == p.Id),
            bookings = bookings.Where(o => o.PremiseId == p.Id)
        }));
    }
    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<IEnumerable<Premise>>> GetPremises(CancellationToken cancellationToken)
    {
        return await database.Premises.OrderBy(p => p.Name).ToListAsync(cancellationToken);
    }

    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    public async Task<ActionResult<Premise>> GetPremise(Guid id, CancellationToken cancellationToken)
    {
        var premise = await database.Premises.FindAsync(new object[] { id }, cancellationToken);
        if (premise is null)
        {
            return NotFound();
        }

        return premise;
    }

    [HttpPost]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<ActionResult<Premise>> CreatePremise(Premise premise, CancellationToken cancellationToken)
    {
        database.Premises.Add(premise);
        await database.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetPremise), new { id = premise.Id }, premise);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> UpdatePremise(Guid id, Premise updatedPremise, CancellationToken cancellationToken)
    {
        if (id != updatedPremise.Id)
        {
            return BadRequest();
        }

        var premise = await database.Premises.FindAsync(new object[] { id }, cancellationToken);
        if (premise is null)
        {
            return NotFound();
        }

        premise.Name = updatedPremise.Name;
        premise.Description = updatedPremise.Description;
        premise.Address = updatedPremise.Address;
        premise.Capacity = updatedPremise.Capacity;
        premise.PricePerHour = updatedPremise.PricePerHour;
        premise.ImageUrl = updatedPremise.ImageUrl;

        await database.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> DeletePremise(Guid id, CancellationToken cancellationToken)
    {
        var premise = await database.Premises.FindAsync(new object[] { id }, cancellationToken);
        if (premise is null)
        {
            return NotFound();
        }

        if (await database.Orders.AnyAsync(o => o.PremiseId == id, cancellationToken))
            return Conflict(new ProblemDetails { Detail = "Premises with booking history cannot be deleted." });
        database.Premises.Remove(premise);
        await database.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}
