using HappyHoliday.Contracts;
using HappyHoliday.Data;
using HappyHoliday.Models;
using HappyHoliday.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HappyHoliday.Controllers;

[ApiController, Route("api/orders/{orderId}/cancellation"), Authorize(Roles = "client,manager,admin")]
public sealed class CancellationsController(AppDbContext db, CancellationWorkflow workflow, TimeProvider clock,
    IHostEnvironment environment, IConfiguration config) : ControllerBase
{
    private bool DemoEnabled => environment.IsDevelopment() && config.GetValue("Payments:AllowDemo", true);
    [HttpGet("quote")]
    public async Task<IActionResult> Quote(string orderId, CancellationToken ct)
    {
        var order = await OrderAccess.Visible(db, User).AsNoTracking().SingleOrDefaultAsync(o => o.Id == orderId, ct);
        return order is null ? NotFound() : Ok(workflow.Quote(order));
    }
    [HttpGet]
    public async Task<IActionResult> Get(string orderId, CancellationToken ct)
    {
        if (!await OrderAccess.Visible(db, User).AnyAsync(o => o.Id == orderId, ct)) return NotFound();
        var statement = await db.CancellationStatements.AsNoTracking().SingleOrDefaultAsync(c => c.OrderId == orderId, ct);
        return statement is null ? NotFound() : Ok(CancellationWorkflow.View(statement, DemoEnabled));
    }
    [HttpPost]
    public async Task<IActionResult> Cancel(string orderId, CancelOrderDto dto, CancellationToken ct)
    {
        await using var transaction = await BookingTransaction.BeginAsync(db, ct);
        var order = await OrderAccess.Visible(db, User).SingleOrDefaultAsync(o => o.Id == orderId, ct);
        if (order is null) return NotFound();
        var actor = await db.Users.SingleAsync(u => u.Id == OrderAccess.UserId(User), ct);
        var statement = await workflow.Cancel(order, dto, actor, ct);
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
        return Ok(new { order = OrderingService.ToResponse(order), statement = CancellationWorkflow.View(statement, DemoEnabled) });
    }
    [HttpPost("settle")]
    public async Task<IActionResult> Settle(string orderId, CancellationToken ct)
    {
        if (!DemoEnabled) throw new BookingException(503, "Real refunds and penalty payments require a configured payment provider. This statement remains outstanding.");
        await using var transaction = await BookingTransaction.BeginAsync(db, ct);
        if (!await OrderAccess.Visible(db, User).AnyAsync(o => o.Id == orderId, ct)) return NotFound();
        var statement = await db.CancellationStatements.SingleOrDefaultAsync(c => c.OrderId == orderId, ct);
        if (statement is null) return NotFound();
        if (statement.SettledAt.HasValue) return Ok(CancellationWorkflow.View(statement, DemoEnabled));
        if (statement.RefundAmount > 0 && User.IsInRole("client")) return Forbid();
        // One immutable statement per order and the booking lock make retries idempotent.
        statement.SettledAt = BookingRules.UtcNow(clock); statement.IsDemo = true;
        statement.SettlementReference = "DEMO-CAN-" + Guid.NewGuid().ToString("N").ToUpperInvariant();
        db.AuditEntries.Add(new AuditEntry { Action = "cancellation-settled", TargetId = orderId,
            ActorId = OrderAccess.UserId(User), At = statement.SettledAt.Value, Details = statement.SettlementReference });
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
        return Ok(CancellationWorkflow.View(statement, DemoEnabled));
    }
}
