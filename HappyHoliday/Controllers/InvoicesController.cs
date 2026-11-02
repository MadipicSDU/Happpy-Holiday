using System.Security.Claims;
using System.Text.Json;
using HappyHoliday.Authentication;
using HappyHoliday.Contracts;
using HappyHoliday.Data;
using HappyHoliday.Models;
using HappyHoliday.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HappyHoliday.Controllers;

[ApiController, Route("api/orders/{orderId}/invoice"), Authorize(Roles = "client,manager,admin")]
public sealed class InvoicesController(AppDbContext db, TimeProvider clock, IHostEnvironment environment, IConfiguration config) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue("sub")!);
    private bool DemoEnabled => environment.IsDevelopment() && config.GetValue("Payments:AllowDemo", true);
    private async Task<Order?> VisibleOrder(string id, CancellationToken ct) => await db.Orders.Include(o => o.Client).Include(o => o.OrderServices)
        .SingleOrDefaultAsync(o => o.Id == id && (User.IsInRole(UserRoles.Admin)
            || (User.IsInRole(UserRoles.Client) && o.ClientId == UserId)
            || (User.IsInRole(UserRoles.Manager) && o.ManagerId == UserId)), ct);
    private async Task<object> View(Invoice invoice, CancellationToken ct)
    {
        var receipt = await db.Payments.AsNoTracking().SingleOrDefaultAsync(p => p.InvoiceId == invoice.Id, ct);
        return new { invoice.Id, invoice.Number, invoice.OrderId, invoice.ClientName, invoice.ClientEmail,
            invoice.CreatedAt, invoice.DeliveredAt, invoice.VoidedAt, invoice.TotalAmount, currency = "KZT",
            pricing = JsonSerializer.Deserialize<OrderQuote>(invoice.PricingJson, new JsonSerializerOptions(JsonSerializerDefaults.Web)),
            status = receipt is not null ? "paid" : invoice.VoidedAt.HasValue ? "void" : invoice.DeliveredAt.HasValue ? "issued" : "draft",
            demoPaymentsEnabled = DemoEnabled,
            receipt = receipt is null ? null : new { receipt.Id, receipt.Reference, receipt.Amount, receipt.PaidAt, receipt.IsDemo, currency = "KZT" } };
    }
    private async Task CheckAvailable(Order order, CancellationToken ct)
    {
        if (order.EventDate <= clock.GetUtcNow().UtcDateTime) throw new BookingException(409, "The rental period has already started. Contact your manager.");
        if (await db.Orders.AnyAsync(o => o.Id != order.Id && o.PremiseId == order.PremiseId && o.Status != "cancelled" && o.Status != "completed"
            && o.EventDate < order.EndDate && o.EndDate > order.EventDate, ct))
            throw new BookingException(409, "This venue has a conflicting reservation. Check alternatives before issuing or paying the invoice.");
    }
    [HttpGet]
    public async Task<IActionResult> Get(string orderId, CancellationToken ct)
    {
        if (await VisibleOrder(orderId, ct) is null) return NotFound();
        var invoice = await db.Invoices.SingleOrDefaultAsync(i => i.OrderId == orderId, ct);
        if (invoice is null || (User.IsInRole(UserRoles.Client) && invoice.DeliveredAt is null)) return NotFound();
        return Ok(await View(invoice, ct));
    }
    [HttpPost, Authorize(Roles = "manager,admin")]
    public async Task<IActionResult> Generate(string orderId, CancellationToken ct)
    {
        await using var transaction = await BookingTransaction.BeginAsync(db, ct);
        var order = await VisibleOrder(orderId, ct);
        if (order is null) return NotFound();
        var existing = await db.Invoices.SingleOrDefaultAsync(i => i.OrderId == orderId, ct);
        if (existing is not null) return Ok(await View(existing, ct));
        if (order.Status is not ("pending" or "awaiting-payment")) throw new BookingException(409, "Only pending or unpaid orders can be invoiced.");
        await CheckAvailable(order, ct);
        var invoice = new Invoice { OrderId = order.Id, ClientName = order.Client!.DisplayName, ClientEmail = order.Client.Email,
            CreatedAt = clock.GetUtcNow().UtcDateTime, TotalAmount = order.TotalAmount,
            PricingJson = JsonSerializer.Serialize(OrderingService.ToResponse(order).Pricing, new JsonSerializerOptions(JsonSerializerDefaults.Web)) };
        db.Invoices.Add(invoice);
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
        return Ok(await View(invoice, ct));
    }
    [HttpPost("deliver"), Authorize(Roles = "manager,admin")]
    public async Task<IActionResult> Deliver(string orderId, CancellationToken ct)
    {
        await using var transaction = await BookingTransaction.BeginAsync(db, ct);
        var order = await VisibleOrder(orderId, ct);
        if (order is null) return NotFound();
        var invoice = await db.Invoices.SingleOrDefaultAsync(i => i.OrderId == orderId, ct);
        if (invoice is null) return NotFound();
        if (invoice.VoidedAt.HasValue) throw new BookingException(409, "This invoice was voided.");
        if (invoice.DeliveredAt.HasValue) return Ok(await View(invoice, ct));
        if (order.Status is not ("pending" or "awaiting-payment")) throw new BookingException(409, "Only pending or unpaid orders can receive an invoice.");
        await CheckAvailable(order, ct);
        invoice.DeliveredAt = clock.GetUtcNow().UtcDateTime; order.Status = "awaiting-payment";
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
        return Ok(await View(invoice, ct));
    }
    [HttpPost("pay"), Authorize(Roles = UserRoles.Client)]
    public async Task<IActionResult> Pay(string orderId, PayInvoiceDto dto, CancellationToken ct)
    {
        if (!DemoEnabled) throw new BookingException(503, "Demo payments are disabled. A real payment provider has not been configured.");
        if (dto.IdempotencyKey == Guid.Empty || dto.Outcome is not ("success" or "declined")) return BadRequest(new ProblemDetails { Detail = "Provide a unique payment key and a valid demo outcome." });
        await using var transaction = await BookingTransaction.BeginAsync(db, ct);
        var order = await VisibleOrder(orderId, ct);
        if (order is null) return NotFound();
        var invoice = await db.Invoices.SingleOrDefaultAsync(i => i.OrderId == orderId && i.DeliveredAt != null, ct);
        if (invoice is null) return NotFound();
        var paid = await db.Payments.SingleOrDefaultAsync(p => p.InvoiceId == invoice.Id, ct);
        if (paid is not null) return Ok(await View(invoice, ct));
        if (invoice.VoidedAt.HasValue || order.Status != "awaiting-payment") throw new BookingException(409, "This invoice cannot be paid in the current order state.");
        if (await db.Payments.AnyAsync(p => p.IdempotencyKey == dto.IdempotencyKey, ct)) throw new BookingException(409, "That payment key was already used for another invoice.");
        await CheckAvailable(order, ct);
        if (dto.Outcome == "declined") throw new BookingException(402, "Demo payment declined. Nothing was paid; you can try again.");
        db.Payments.Add(new Payment { InvoiceId = invoice.Id, IdempotencyKey = dto.IdempotencyKey, Amount = invoice.TotalAmount,
            PaidAt = clock.GetUtcNow().UtcDateTime });
        order.Status = "confirmed";
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
        return Ok(await View(invoice, ct));
    }
}
