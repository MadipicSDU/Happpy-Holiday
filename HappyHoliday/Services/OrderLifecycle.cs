using HappyHoliday.Contracts;
using HappyHoliday.Data;
using HappyHoliday.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace HappyHoliday.Services;

public sealed class OrderLifecycle(AppDbContext db, TimeProvider clock, IOptions<LifecycleOptions> options)
{
    public async Task<(int Completed, int Expired)> CloseEnded(CancellationToken ct)
    {
        await using var transaction = await BookingTransaction.BeginAsync(db, ct);
        var now = BookingRules.UtcNow(clock);
        var orders = await db.Orders.Where(o => o.EndDate <= now &&
            ((o.Status == "confirmed" && o.PaymentConfirmedAt != null && o.PaidAmount >= o.TotalAmount)
            || ((o.Status == "pending" || o.Status == "awaiting-payment") && o.PaymentConfirmedAt == null && o.PaidAmount == 0)))
            .OrderBy(o => o.EndDate).ThenBy(o => o.Id).Take(options.Value.BatchSize).ToListAsync(ct);
        if (orders.Count == 0) return (0, 0);

        var orderIds = orders.Select(o => o.Id).ToArray();
        var unpaidIds = orders.Where(o => o.Status != "confirmed").Select(o => o.Id).ToHashSet();
        var changes = await db.OrderChanges.Where(c => orderIds.Contains(c.OrderId) && c.Status == "pending").ToListAsync(ct);
        var unpaidInvoices = await db.Invoices.Where(i => unpaidIds.Contains(i.OrderId)
            && i.VoidedAt == null && i.SettledAt == null && !db.Payments.Any(p => p.InvoiceId == i.Id)).ToListAsync(ct);
        foreach (var invoice in unpaidInvoices) invoice.VoidedAt = now;
        foreach (var change in changes)
        {
            change.Status = "expired"; change.ReviewedAt = now; change.ReviewNote = "The rental period ended.";
        }
        foreach (var order in orders)
        {
            var unpaid = unpaidIds.Contains(order.Id);
            order.Status = unpaid ? "expired" : "completed";
            if (!unpaid) { order.CompletedAt = now; order.ExecutionState = "completed"; }
            order.ArchivedAt = now;
            order.PendingChangeId = null;
            db.AuditEntries.Add(new AuditEntry
            {
                Action = unpaid ? "order-expired" : "order-auto-completed", TargetId = order.Id, At = now,
                Details = unpaid ? "Unpaid rental period ended. Archived and voided open invoices."
                    : "Paid rental period ended. Archived without deleting invoices, schedules or receipts."
            });
        }
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
        return (orders.Count - unpaidIds.Count, unpaidIds.Count);
    }
}

public sealed class OrderCompletionWorker(IServiceScopeFactory scopes, IOptions<LifecycleOptions> options,
    ILogger<OrderCompletionWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.Enabled) return;
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(options.Value.IntervalSeconds));
        try
        {
            while (await timer.WaitForNextTickAsync(stoppingToken))
            {
                try
                {
                    await using var scope = scopes.CreateAsyncScope();
                    await scope.ServiceProvider.GetRequiredService<OrderLifecycle>().CloseEnded(stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
                catch (Exception error) { logger.LogError(error, "Could not close ended orders. The next interval will retry."); }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
    }
}
