using HappyHoliday.Authentication;
using HappyHoliday.Data;
using HappyHoliday.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HappyHoliday.Controllers;

[ApiController]
[Route("api/services")]
public sealed class EventServicesController(AppDbContext database) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult<IEnumerable<EventService>>> GetServices(
        [FromQuery] string? category, 
        CancellationToken cancellationToken,
        [FromQuery] string? search = null,
        [FromQuery] string? sort = null)
    {
        var query = database.EventServices.AsQueryable();
        
        if (!string.IsNullOrWhiteSpace(category))
        {
            query = query.Where(s => s.Category == category.Trim());
        }
        
        if (!string.IsNullOrWhiteSpace(search))
        {
            var text = search.Trim().ToLower();
            query = query.Where(s => s.Name.ToLower().Contains(text)
                || s.Category.ToLower().Contains(text)
                || (s.Description != null && s.Description.ToLower().Contains(text)));
        }
        var ordered = sort switch
        {
            null or "" or "name" => query.OrderBy(s => s.Name),
            "price-asc" => query.OrderBy(s => s.Price).ThenBy(s => s.Name),
            "price-desc" => query.OrderByDescending(s => s.Price).ThenBy(s => s.Name),
            "category" => query.OrderBy(s => s.Category).ThenBy(s => s.Name),
            _ => null
        };
        if (ordered is null) return BadRequest(new ProblemDetails { Detail = "Choose name, price-asc, price-desc, or category sorting." });
        return await ordered.ThenBy(s => s.Id).ToListAsync(cancellationToken);
    }

    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    public async Task<ActionResult<EventService>> GetService(Guid id, CancellationToken cancellationToken)
    {
        var service = await database.EventServices.FindAsync(new object[] { id }, cancellationToken);
        if (service is null)
        {
            return NotFound();
        }

        return service;
    }

    [HttpPost]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<ActionResult<EventService>> CreateService(EventService service, CancellationToken cancellationToken)
    {
        Normalize(service);
        ModelState.ClearValidationState(string.Empty);
        if (!TryValidateModel(service)) return ValidationProblem(ModelState);
        database.EventServices.Add(service);
        await database.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetService), new { id = service.Id }, service);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> UpdateService(Guid id, EventService updatedService, CancellationToken cancellationToken)
    {
        if (id != updatedService.Id)
        {
            return BadRequest();
        }

        Normalize(updatedService);
        ModelState.ClearValidationState(string.Empty);
        if (!TryValidateModel(updatedService)) return ValidationProblem(ModelState);

        await using var transaction = await HappyHoliday.Services.BookingTransaction.BeginAsync(database, cancellationToken);
        var service = await database.EventServices.FindAsync(new object[] { id }, cancellationToken);
        if (service is null)
        {
            return NotFound();
        }

        service.Name = updatedService.Name;
        service.Description = updatedService.Description;
        service.Category = updatedService.Category;
        service.Price = updatedService.Price;
        if (updatedService.ConcurrentCapacity is { } capacity)
        {
            var now = DateTime.UtcNow;
            var reservations = await database.OrderServices.Where(s => s.EventServiceId == id && s.Order!.Status != "cancelled"
                && s.Order.Status != "completed" && s.Order.EndDate > now)
                .Select(s => new { s.Quantity, s.Order!.EventDate, s.Order.EndDate }).ToListAsync(cancellationToken);
            if (HappyHoliday.Services.BookingRules.PeakUnits(reservations.Select(r => (r.EventDate, r.EndDate, r.Quantity)), now, DateTime.MaxValue) > capacity)
                return Conflict(new ProblemDetails { Detail = "Capacity cannot be lower than the units already reserved at the same time." });
        }
        service.ConcurrentCapacity = updatedService.ConcurrentCapacity;

        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> DeleteService(Guid id, CancellationToken cancellationToken)
    {
        var service = await database.EventServices.FindAsync(new object[] { id }, cancellationToken);
        if (service is null)
        {
            return NotFound();
        }

        if (await database.OrderServices.AnyAsync(s => s.EventServiceId == id, cancellationToken))
            return Conflict(new ProblemDetails { Detail = "Services with booking history cannot be deleted." });
        database.EventServices.Remove(service);
        await database.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static void Normalize(EventService service)
    {
        service.Name = service.Name.Trim();
        service.Category = service.Category.Trim();
        service.Description = string.IsNullOrWhiteSpace(service.Description) ? null : service.Description.Trim();
    }
}
