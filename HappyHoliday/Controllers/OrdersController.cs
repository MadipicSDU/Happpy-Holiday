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
public sealed class OrdersController(AppDbContext db, OrderingService ordering, TimeProvider clock, CancellationWorkflow cancellation) : ControllerBase
{
    private sealed record OrderSnapshot(Order Order, ChangeOutcome? LatestChange);

    private Guid UserId => Guid.Parse(User.FindFirstValue("sub")!);
    private IQueryable<Order> VisibleOrders()
    {
        var query = db.Orders.AsNoTracking().Include(o => o.Client).Include(o => o.OrderServices).AsQueryable();
        if (User.IsInRole(UserRoles.Client)) query = query.Where(o => o.ClientId == UserId);
        else if (User.IsInRole(UserRoles.Manager)) query = query.Where(o => o.ManagerId == UserId);
        return query;
    }
    private IQueryable<OrderSnapshot> Snapshots(IQueryable<Order> orders) => orders.Select(order => new OrderSnapshot(order,
        db.OrderChanges.Where(change => change.OrderId == order.Id && change.ReviewedAt != null)
            .OrderByDescending(change => change.ReviewedAt).ThenByDescending(change => change.Id)
            .Select(change => new ChangeOutcome(change.Id, change.Status)).FirstOrDefault()));

    [HttpGet]
    public async Task<IActionResult> GetOrders(CancellationToken ct)
    {
        var orders = await Snapshots(VisibleOrders().OrderByDescending(order => order.EventDate)).ToListAsync(ct);
        var staff = await OrderingService.StaffProgressAsync(db, orders.Select(entry => entry.Order.Id).ToArray(), ct);
        return Ok(orders.Select(entry => OrderingService.ToResponse(entry.Order) with
        {
            Staff = staff.GetValueOrDefault(entry.Order.Id), LatestChange = entry.LatestChange
        }));
    }
    [HttpGet("{id}")]
    public async Task<IActionResult> GetOrder(string id, CancellationToken ct)
    {
        var entry = await Snapshots(VisibleOrders().Where(order => order.Id == id)).SingleOrDefaultAsync(ct);
        if (entry is null) return NotFound();
        var staff = await OrderingService.StaffProgressAsync(db, [id], ct);
        return Ok(OrderingService.ToResponse(entry.Order) with { Staff = staff.GetValueOrDefault(id), LatestChange = entry.LatestChange });
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
                ("confirmed", "completed") => order.EndDate <= clock.GetUtcNow().UtcDateTime
                    && order.PaymentConfirmedAt.HasValue && order.PaidAmount >= order.TotalAmount,
                (_, "cancelled") => order.Status is "pending" or "awaiting-payment",
                _ => false
            };
            if (!allowed) return BadRequest(new ProblemDetails { Detail = "Invalid order status transition." });
        }
        if (dto.Status == "cancelled")
        {
            if (order.PaidAmount > 0) return BadRequest(new ProblemDetails { Detail = "A paid booking requires the cancellation and refund workflow." });
            var quote = cancellation.Quote(order);
            if (quote.PenaltyAmount > 0) return Conflict(new ProblemDetails { Detail = "Review the cancellation quote and penalty before confirming cancellation." });
            var actor = await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == UserId, ct);
            if (actor is null) return Unauthorized();
            await cancellation.Cancel(order, new CancelOrderDto(order.Revision, 0, 0, 0), actor, ct);
        }
        else
        {
            order.Status = dto.Status; order.CompletedAt = BookingRules.UtcNow(clock); order.ArchivedAt = order.CompletedAt;
            order.ExecutionState = "completed"; order.PendingChangeId = null;
            foreach (var change in await db.OrderChanges.Where(c => c.OrderId == id && c.Status == "pending").ToListAsync(ct))
            { change.Status = "expired"; change.ReviewedAt = order.CompletedAt; change.ReviewNote = "The paid rental period ended."; }
            db.AuditEntries.Add(new AuditEntry { Action = "order-completed", TargetId = id, ActorId = UserId,
                At = order.CompletedAt.Value, Details = "Ended paid booking completed and archived by staff." });
        }
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Ok(OrderingService.ToResponse(order));
    }
}
