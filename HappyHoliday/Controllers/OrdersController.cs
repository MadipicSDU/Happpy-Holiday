using HappyHoliday.Authentication;
using HappyHoliday.Contracts;
using HappyHoliday.Data;
using HappyHoliday.Models;
using HappyHoliday.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HappyHoliday.Controllers;

[ApiController]
[Route("api/orders")]
[Authorize(Roles = "client,manager,admin")]
public sealed class OrdersController(AppDbContext db, OrderingService ordering, TimeProvider clock) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue("sub")!);
    private IQueryable<Order> VisibleOrders()
    {
        var query = db.Orders.AsNoTracking().Include(o => o.Client).Include(o => o.OrderServices).AsQueryable();
        if (User.IsInRole(UserRoles.Client)) query = query.Where(o => o.ClientId == UserId);
        else if (User.IsInRole(UserRoles.Manager)) query = query.Where(o => o.ManagerId == UserId);
        return query;
    }
    [HttpGet]
    public async Task<IActionResult> GetOrders(CancellationToken ct) =>
        Ok((await VisibleOrders().OrderByDescending(o => o.EventDate).ToListAsync(ct)).Select(OrderingService.ToResponse));
    [HttpGet("{id}")]
    public async Task<IActionResult> GetOrder(string id, CancellationToken ct)
    {
        var order = await VisibleOrders().SingleOrDefaultAsync(o => o.Id == id, ct);
        return order is null ? NotFound() : Ok(OrderingService.ToResponse(order));
    }
    [HttpPost("quote")]
    [Authorize(Roles = UserRoles.Client)]
    public async Task<IActionResult> Quote(CreateOrderDto dto, CancellationToken ct) =>
        Ok(await ordering.QuoteAsync(UserId, dto, ct));
    [HttpPost]
    [Authorize(Roles = UserRoles.Client)]
    public async Task<IActionResult> CreateOrder(CreateOrderDto dto, CancellationToken ct)
    {
        var order = await ordering.CreateAsync(UserId, dto, ct);
        return CreatedAtAction(nameof(GetOrder), new { id = order.Id }, OrderingService.ToResponse(order));
    }
    [HttpPatch("{id}/status")]
    public async Task<IActionResult> UpdateStatus(string id, UpdateStatusDto dto, CancellationToken ct)
    {
        await using var transaction = await BookingTransaction.BeginAsync(db, ct);
        var order = await db.Orders.SingleOrDefaultAsync(o => o.Id == id, ct);
        if (order is null || (User.IsInRole(UserRoles.Client) && order.ClientId != UserId)
            || (User.IsInRole(UserRoles.Manager) && order.ManagerId != UserId)) return NotFound();
        if (order.Status == dto.Status) return Ok(new { order.Id, order.Status, statusLabel = OrderingService.StatusLabel(order.Status) });
        if (!BookingRules.IsActive(order.Status)) return Conflict(new ProblemDetails { Detail = "Terminal orders cannot change status." });
        if (User.IsInRole(UserRoles.Client))
        {
            if (dto.Status != "cancelled" || order.Status is not ("pending" or "awaiting-payment"))
                return BadRequest(new ProblemDetails { Detail = "Clients may cancel pending or unpaid orders." });
        }
        else
        {
            var allowed = (order.Status, dto.Status) switch
            {
                ("pending", "awaiting-payment") => true,
                ("awaiting-payment", "confirmed") => true,
                ("confirmed", "completed") => order.EndDate <= clock.GetUtcNow().UtcDateTime,
                (_, "cancelled") => order.Status is "pending" or "awaiting-payment",
                _ => false
            };
            if (!allowed) return BadRequest(new ProblemDetails { Detail = "Invalid order status transition." });
        }
        order.Status = dto.Status;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Ok(new { order.Id, order.Status, statusLabel = OrderingService.StatusLabel(order.Status) });
    }
}
