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
        var order = await db.Orders.Include(o => o.Client).Include(o => o.OrderServices).SingleOrDefaultAsync(o => o.Id == id, ct);
        if (order is null || (User.IsInRole(UserRoles.Client) && order.ClientId != UserId)
            || (User.IsInRole(UserRoles.Manager) && order.ManagerId != UserId)) return NotFound();
        if (order.Status == dto.Status) return Ok(OrderingService.ToResponse(order));
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
                // Invoice delivery and recorded payment own these financial transitions.
                ("confirmed", "completed") => order.EndDate <= clock.GetUtcNow().UtcDateTime,
                (_, "cancelled") => order.Status is "pending" or "awaiting-payment",
                _ => false
            };
            if (!allowed) return BadRequest(new ProblemDetails { Detail = "Invalid order status transition." });
        }
        order.Status = dto.Status;
        if (dto.Status == "cancelled")
        {
            if (order.PaidAmount > 0) return BadRequest(new ProblemDetails { Detail = "A paid booking requires the cancellation and refund workflow." });
            var actor = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == UserId, ct);
            if (actor is null) return Unauthorized();
            var cancelledAt = clock.GetUtcNow().UtcDateTime;
            // Match PostgreSQL microsecond precision on the initial response and later reads.
            order.CancelledAt = cancelledAt.AddTicks(-(cancelledAt.Ticks % 10));
            order.CancelledByUserId = actor.Id;
            order.CancelledByName = actor.DisplayName;
            order.CancelledByRole = actor.Role;
            foreach (var invoice in await db.Invoices.Where(i => i.OrderId == id && i.SettledAt == null
                && !db.Payments.Any(p => p.InvoiceId == i.Id)).ToListAsync(ct)) invoice.VoidedAt = order.CancelledAt;
            foreach (var change in await db.OrderChanges.Where(c => c.OrderId == id && c.Status == "pending").ToListAsync(ct)) change.Status = "cancelled";
            order.PendingChangeId = null;
            await ExecutionWorkflow.Invalidate(db, order, order.CancelledAt.Value, "cancelled", ct);
        }
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Ok(OrderingService.ToResponse(order));
    }
}
