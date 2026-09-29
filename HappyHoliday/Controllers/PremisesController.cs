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
    [Authorize(Roles = UserRoles.Admin + "," + UserRoles.Manager)]
    public async Task<ActionResult<Premise>> CreatePremise(Premise premise, CancellationToken cancellationToken)
    {
        database.Premises.Add(premise);
        await database.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetPremise), new { id = premise.Id }, premise);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = UserRoles.Admin + "," + UserRoles.Manager)]
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

        await database.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}