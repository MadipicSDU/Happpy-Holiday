using HappyHoliday.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace HappyHoliday.Services;

public static class BookingTransaction
{
    // Shared across API instances. Hold through commit so booking, quota and status checks are atomic.
    // ReadCommitted lets a waiter see the preceding commit after acquiring the advisory lock.
    public static async Task<IDbContextTransaction> BeginAsync(AppDbContext db, CancellationToken ct)
    {
        var transaction = await db.Database.BeginTransactionAsync(System.Data.IsolationLevel.ReadCommitted, ct);
        try
        {
            if (db.Database.IsNpgsql())
                await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(7242060922)", ct);
            return transaction;
        }
        catch
        {
            await transaction.DisposeAsync();
            throw;
        }
    }
}
