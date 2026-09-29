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
        CancellationToken cancellationToken)
    {
        var query = database.EventServices.AsQueryable();
        
        if (!string.IsNullOrWhiteSpace(category))
        {
            query = query.Where(s => s.Category == category);
        }
        
        return await query.OrderBy(s => s.Name).ToListAsync(cancellationToken);
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
    [Authorize(Roles = UserRoles.Admin + "," + UserRoles.Manager)]
    public async Task<ActionResult<EventService>> CreateService(EventService service, CancellationToken cancellationToken)
    {
        database.EventServices.Add(service);
        await database.SaveChangesAsync(cancellationToken);
        return CreatedAtAction(nameof(GetService), new { id = service.Id }, service);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = UserRoles.Admin + "," + UserRoles.Manager)]
    public async Task<IActionResult> UpdateService(Guid id, EventService updatedService, CancellationToken cancellationToken)
    {
        if (id != updatedService.Id)
        {
            return BadRequest();
        }

        var service = await database.EventServices.FindAsync(new object[] { id }, cancellationToken);
        if (service is null)
        {
            return NotFound();
        }

        service.Name = updatedService.Name;
        service.Description = updatedService.Description;
        service.Category = updatedService.Category;
        service.Price = updatedService.Price;

        await database.SaveChangesAsync(cancellationToken);
        return NoContent();
    }
}