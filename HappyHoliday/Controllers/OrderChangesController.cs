using System.Text.Json;
using HappyHoliday.Contracts;
using HappyHoliday.Data;
using HappyHoliday.Models;
using HappyHoliday.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HappyHoliday.Controllers;

[ApiController, Route("api/orders/{orderId}/changes"), Authorize(Roles = "client,manager,admin")]
public sealed class OrderChangesController(AppDbContext db, OrderingService ordering, BillingService billing,
    TimeProvider clock, IHostEnvironment environment, IConfiguration config) : ControllerBase
{
    private DateTime Now => BookingRules.UtcNow(clock);
    private void CheckDeadline(Order order, DateTime? proposedStart = null)
    {
        if (order.Status is not ("pending" or "awaiting-payment" or "confirmed")) throw new BookingException(409, "This booking cannot be changed in its current state.");
        var start = proposedStart is { } proposed && proposed < order.EventDate ? proposed : order.EventDate;
        if (Now >= start.AddHours(-order.ChangeCutoffHours)) throw new BookingException(409, "The change deadline has passed for the current or proposed rental period.");
    }
    private object View(OrderChange change) => new { change.Id, change.OrderId, change.OriginalRevision, change.Status, change.Reason,
        change.Guests, change.PriceDelta, change.RequestedAt, change.ReviewedAt, change.ReviewedByName, change.ReviewNote,
        pricing = JsonSerializer.Deserialize<OrderQuote>(change.ProposalJson, BillingService.Json),
        previousPricing = JsonSerializer.Deserialize<OrderQuote>(change.PreviousPricingJson, BillingService.Json) };
    [HttpGet]
    public async Task<IActionResult> List(string orderId, CancellationToken ct)
    {
        if (!await OrderAccess.Visible(db, User).AnyAsync(o => o.Id == orderId, ct)) return NotFound();
        return Ok((await db.OrderChanges.Where(c => c.OrderId == orderId).OrderByDescending(c => c.RequestedAt).ToListAsync(ct)).Select(View));
    }
    [HttpPost("quote"), Authorize(Roles = "client")]
    public async Task<IActionResult> Quote(string orderId, RequestChangeDto dto, CancellationToken ct)
    {
        var order = await OrderAccess.Visible(db, User).SingleOrDefaultAsync(o => o.Id == orderId, ct);
        if (order is null) return NotFound();
        if (dto.ExpectedRevision != order.Revision) return Conflict(new ProblemDetails { Detail = "This booking changed. Refresh before requesting another quote." });
        CheckDeadline(order);
        var quote = await ordering.QuoteAsync(order.ClientId, dto.Booking, ct, order.Id);
        CheckDeadline(order, quote.StartsAt);
        return Ok(new { pricing = quote, currentAmount = order.TotalAmount, priceDelta = quote.TotalAmount - order.TotalAmount,
            amountDue = Math.Max(0, quote.TotalAmount - order.PaidAmount), demoCredit = Math.Max(0, order.PaidAmount - quote.TotalAmount),
            changeDeadline = order.EventDate.AddHours(-order.ChangeCutoffHours), order.Revision });
    }
    [HttpPost, Authorize(Roles = "client")]
    public async Task<IActionResult> RequestChange(string orderId, RequestChangeDto dto, CancellationToken ct)
    {
        await using var transaction = await BookingTransaction.BeginAsync(db, ct);
        var order = await OrderAccess.Visible(db, User).SingleOrDefaultAsync(o => o.Id == orderId, ct);
        if (order is null) return NotFound();
        CheckDeadline(order);
        if (order.Revision != dto.ExpectedRevision || order.PendingChangeId.HasValue) return Conflict(new ProblemDetails { Detail = "Refresh the booking or withdraw its pending change request first." });
        var quote = await ordering.QuoteAsync(order.ClientId, dto.Booking, ct, order.Id);
        CheckDeadline(order, quote.StartsAt);
        if (dto.ExpectedTotal != quote.TotalAmount) throw new BookingException(409, "The price changed. Review a fresh quote before sending the change request.");
        var change = new OrderChange { OrderId = order.Id, OriginalRevision = order.Revision, Guests = dto.Booking.Guests,
            Reason = dto.Reason?.Trim() ?? "", RequestedAt = Now, PriceDelta = quote.TotalAmount - order.TotalAmount,
            PreviousPricingJson = JsonSerializer.Serialize(OrderingService.ToResponse(order).Pricing, BillingService.Json),
            ProposalJson = JsonSerializer.Serialize(quote, BillingService.Json) };
        order.PendingChangeId = change.Id; db.OrderChanges.Add(change);
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
        return Ok(View(change));
    }
    [HttpPost("{changeId:guid}/withdraw"), Authorize(Roles = "client")]
    public async Task<IActionResult> Withdraw(string orderId, Guid changeId, CancellationToken ct)
    {
        await using var transaction = await BookingTransaction.BeginAsync(db, ct);
        var order = await OrderAccess.Visible(db, User).SingleOrDefaultAsync(o => o.Id == orderId, ct);
        if (order is null) return NotFound();
        var change = await db.OrderChanges.SingleOrDefaultAsync(c => c.Id == changeId && c.OrderId == orderId, ct);
        if (change is null) return NotFound();
        if (change.Status == "withdrawn") return Ok(View(change));
        if (change.Status != "pending") return Conflict(new ProblemDetails { Detail = "This request has already been reviewed." });
        change.Status = "withdrawn"; change.ReviewedAt = Now; order.PendingChangeId = null;
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct); return Ok(View(change));
    }
    [HttpPost("{changeId:guid}/review"), Authorize(Roles = "manager,admin")]
    public async Task<IActionResult> Review(string orderId, Guid changeId, ReviewChangeDto dto, CancellationToken ct)
    {
        await using var transaction = await BookingTransaction.BeginAsync(db, ct);
        var order = await OrderAccess.Visible(db, User).SingleOrDefaultAsync(o => o.Id == orderId, ct);
        if (order is null) return NotFound();
        var change = await db.OrderChanges.SingleOrDefaultAsync(c => c.Id == changeId && c.OrderId == orderId, ct);
        if (change is null) return NotFound();
        if (change.Status != "pending") return change.Status == (dto.Approve ? "approved" : "rejected") ? Ok(View(change)) : Conflict(new ProblemDetails { Detail = "This request has already been resolved." });
        if (dto.Approve)
        {
            var quote = JsonSerializer.Deserialize<OrderQuote>(change.ProposalJson, BillingService.Json)!;
            CheckDeadline(order, quote.StartsAt);
            if (change.OriginalRevision != order.Revision) throw new BookingException(409, "The original booking revision changed. Request a new quote.");
            await ordering.QuoteAsync(order.ClientId, new CreateOrderDto { PremiseId = quote.PremiseId,
                StartsAt = new DateTimeOffset(quote.StartsAt), EndsAt = new DateTimeOffset(quote.EndsAt), Guests = change.Guests,
                Services = quote.Services.Select(s => new ServiceSelection(s.Id, (int)s.Quantity)).ToList() }, ct, order.Id);
            if (order.PaidAmount > quote.TotalAmount && !(environment.IsDevelopment() && config.GetValue("Payments:AllowDemo", true)))
                throw new BookingException(503, "Credit settlement requires a payment provider. Demo credits are available only in development.");
            var now = Now;
            foreach (var invoice in await db.Invoices.Where(i => i.OrderId == orderId && i.VoidedAt == null && i.SettledAt == null
                && !db.Payments.Any(p => p.InvoiceId == i.Id)).ToListAsync(ct)) invoice.VoidedAt = now;
            await ExecutionWorkflow.Invalidate(db, order, now, "needs-rescheduling", ct);
            db.OrderServices.RemoveRange(order.OrderServices); order.OrderServices.Clear();
            order.PremiseId = quote.PremiseId; order.PremiseName = quote.PremiseName; order.PremiseAddress = quote.Address;
            order.EventDate = quote.StartsAt; order.EndDate = quote.EndsAt; order.ExpectedGuests = change.Guests;
            order.RentalRate = quote.Rental.UnitPrice; order.RentalAmount = quote.Rental.Amount;
            order.RentalDiscount = quote.RentalDiscount; order.PromotionPercent = quote.PromotionPercent;
            order.TotalAmount = quote.TotalAmount; order.LegacyEstimate = false; order.Revision++;
            foreach (var line in quote.Services) order.OrderServices.Add(new OrderService { EventServiceId = line.Id, Name = line.Name,
                Category = line.Category, Quantity = (int)line.Quantity, UnitPrice = line.UnitPrice, Amount = line.Amount });
            billing.Create(order, now, delivered: true);
            order.Status = order.PaymentConfirmedAt.HasValue && order.PaidAmount >= order.TotalAmount ? "confirmed" : "awaiting-payment";
        }
        change.Status = dto.Approve ? "approved" : "rejected"; change.ReviewedAt = Now; change.ReviewedById = OrderAccess.UserId(User);
        change.ReviewedByName = await db.Users.Where(u => u.Id == change.ReviewedById).Select(u => u.DisplayName).SingleAsync(ct);
        change.ReviewNote = dto.Note?.Trim(); order.PendingChangeId = null;
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct); return Ok(View(change));
    }
}
