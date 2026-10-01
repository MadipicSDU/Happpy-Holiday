using HappyHoliday.Authentication;
using HappyHoliday.Contracts;
using HappyHoliday.Data;
using HappyHoliday.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HappyHoliday.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrdersController(AppDbContext db) : ControllerBase
{
    // GET /api/orders  — clients see their own, managers see all
    [HttpGet]
    public async Task<IActionResult> GetOrders()
    {
        var role   = User.FindFirstValue(ClaimTypes.Role);
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);

        var query = db.Orders
            .Include(o => o.Client)
            .Include(o => o.Premise)
            .AsQueryable();

        if (role == UserRoles.Client && Guid.TryParse(userId, out var id))
            query = query.Where(o => o.ClientId == id);

        var list = await query.OrderByDescending(o => o.EventDate).ToListAsync();

        return Ok(list.Select(o => new
        {
            o.Id,
            client      = o.Client?.DisplayName,
            venue       = o.Premise?.Name,
            eventDate   = o.EventDate.ToString("MMM dd, yyyy"),
            o.Status,
            statusLabel = StatusLabel(o.Status),
            amount      = $"${o.TotalAmount:F2}",
            guests      = o.ExpectedGuests
        }));
    }

    // GET /api/orders/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> GetOrder(string id)
    {
        var order = await db.Orders.Include(o => o.Client).Include(o => o.Premise)
                                   .FirstOrDefaultAsync(o => o.Id == id);
        if (order == null) return NotFound();
        return Ok(order);
    }

    // POST /api/orders — client creates booking
    [HttpPost]
    [Authorize(Roles = UserRoles.Client)]
    public async Task<IActionResult> CreateOrder([FromBody] CreateOrderDto dto)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);
        if (!Guid.TryParse(userIdStr, out var userId)) return Unauthorized();

        var premise = await db.Premises.FindAsync(dto.PremiseId);
        if (premise == null) return NotFound("Premise not found");

        var order = new Order
        {
            ClientId       = userId,
            PremiseId      = dto.PremiseId,
            EventDate      = dto.EventDate,
            ExpectedGuests = dto.Guests,
            Status         = "awaiting-payment",
            TotalAmount    = premise.PricePerHour * dto.DurationHours
        };

        if (dto.ServiceIds != null && dto.ServiceIds.Any())
        {
            var services = await db.EventServices.Where(s => dto.ServiceIds.Contains(s.Id)).ToListAsync();
            foreach (var service in services)
            {
                order.OrderServices.Add(new OrderService
                {
                    EventServiceId = service.Id,
                    Quantity = 1
                });
                order.TotalAmount += service.Price;
            }
        }

        db.Orders.Add(order);
        await db.SaveChangesAsync();
        return Ok(new
        {
            order.Id,
            venue       = premise.Name,
            eventDate   = order.EventDate.ToString("MMM dd, yyyy"),
            order.Status,
            statusLabel = StatusLabel(order.Status),
            amount      = $"${order.TotalAmount:F2}",
            guests      = order.ExpectedGuests
        });
    }

    // PATCH /api/orders/{id}/status — manager updates status
    [HttpPatch("{id}/status")]
    [Authorize(Roles = $"{UserRoles.Manager},{UserRoles.Admin}")]
    public async Task<IActionResult> UpdateStatus(string id, [FromBody] UpdateStatusDto dto)
    {
        var order = await db.Orders.FindAsync(id);
        if (order == null) return NotFound();
        order.Status = dto.Status;
        await db.SaveChangesAsync();
        return Ok(new { order.Id, order.Status, statusLabel = StatusLabel(order.Status) });
    }

    private static string StatusLabel(string status) => status switch
    {
        "awaiting-payment"  => "Awaiting Payment",
        "confirmed"         => "Confirmed",
        "change-requested"  => "Change Requested",
        "completed"         => "Completed",
        _                   => status
    };
}

public record CreateOrderDto(Guid PremiseId, DateTime EventDate, int Guests, int DurationHours = 4, List<Guid>? ServiceIds = null);
public record UpdateStatusDto(string Status);
