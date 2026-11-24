using HappyHoliday.Contracts;
using HappyHoliday.Data;
using HappyHoliday.Models;
using Microsoft.EntityFrameworkCore;

namespace HappyHoliday.Services;

public sealed class CancellationWorkflow(AppDbContext db, TimeProvider clock)
{
    public static CancellationQuote Calculate(Order order, DateTime now)
    {
        var deadline = order.EventDate.AddHours(-order.ChangeCutoffHours);
        var late = now >= deadline;
        var rate = order.PaidAmount > 0
            ? (late ? order.LateCancellationPercent : order.EarlyCancellationPercent)
            : 0m;
        var penalty = BookingRules.Money(order.TotalAmount * rate / 100m);
        return new(order.Id, order.Revision, order.PenaltyPolicyVersion, deadline, late, rate,
            order.TotalAmount, order.PaidAmount, penalty, Math.Max(0, order.PaidAmount - penalty),
            Math.Max(0, penalty - order.PaidAmount), now);
    }

    public CancellationQuote Quote(Order order)
    {
        if (!BookingRules.IsActive(order.Status)) throw new BookingException(409, "This booking is already closed.");
        if (order.EventDate <= clock.GetUtcNow().UtcDateTime)
            throw new BookingException(409, "The event has started. Contact your manager rather than cancelling its reservation.");
        return Calculate(order, BookingRules.UtcNow(clock));
    }

    // Caller holds the shared booking transaction through SaveChanges and commit.
    public async Task<CancellationStatement> Cancel(Order order, CancelOrderDto dto, AppUser actor, CancellationToken ct)
    {
        var previous = await db.CancellationStatements.SingleOrDefaultAsync(c => c.OrderId == order.Id, ct);
        if (previous is not null) return previous;
        var quote = Quote(order);
        if (dto.ExpectedRevision != quote.Revision || dto.ExpectedPenalty != quote.PenaltyAmount
            || dto.ExpectedRefund != quote.RefundAmount || dto.ExpectedAmountDue != quote.AmountDue)
            throw new BookingException(409, "This booking or its cancellation amounts changed. Review a new cancellation quote.");
        var now = quote.CheckedAt;
        var statement = new CancellationStatement { OrderId = order.Id, OrderRevision = order.Revision,
            PolicyVersion = quote.PolicyVersion, IsLate = quote.IsLate, RatePercent = quote.RatePercent,
            OrderAmount = quote.OrderAmount, PaidAmount = quote.PaidAmount, PenaltyAmount = quote.PenaltyAmount,
            RefundAmount = quote.RefundAmount, AmountDue = quote.AmountDue, Reason = dto.Reason?.Trim() ?? "", CreatedAt = now,
            SettledAt = quote.RefundAmount == 0 && quote.AmountDue == 0 ? now : null };
        db.CancellationStatements.Add(statement);
        order.Status = "cancelled"; order.CancelledAt = now; order.CancelledByUserId = actor.Id;
        order.CancelledByName = actor.DisplayName; order.CancelledByRole = actor.Role;
        foreach (var invoice in await db.Invoices.Where(i => i.OrderId == order.Id && i.SettledAt == null
            && !db.Payments.Any(p => p.InvoiceId == i.Id)).ToListAsync(ct)) invoice.VoidedAt = now;
        foreach (var change in await db.OrderChanges.Where(c => c.OrderId == order.Id && c.Status == "pending").ToListAsync(ct))
        { change.Status = "cancelled"; change.ReviewedAt = now; change.ReviewNote = "Booking cancelled."; }
        order.PendingChangeId = null;
        await ExecutionWorkflow.Invalidate(db, order, now, "cancelled", ct);
        db.AuditEntries.Add(new AuditEntry { Action = "order-cancelled", TargetId = order.Id, ActorId = actor.Id, At = now,
            Details = $"Statement {statement.Number}; penalty {statement.PenaltyAmount}; refund {statement.RefundAmount}; due {statement.AmountDue} KZT." });
        return statement;
    }

    public static object View(CancellationStatement statement, bool demoEnabled) => new {
        statement.Id, statement.Number, statement.OrderId, statement.OrderRevision, statement.PolicyVersion,
        statement.IsLate, statement.RatePercent, statement.OrderAmount, statement.PaidAmount,
        statement.PenaltyAmount, statement.RefundAmount, statement.AmountDue, statement.Reason,
        statement.CreatedAt, statement.SettledAt, statement.SettlementReference, statement.IsDemo,
        status = statement.SettledAt.HasValue ? "settled" : statement.RefundAmount > 0 ? "refund-pending" : "payment-due",
        demoSettlementEnabled = demoEnabled, currency = "KZT" };
}
