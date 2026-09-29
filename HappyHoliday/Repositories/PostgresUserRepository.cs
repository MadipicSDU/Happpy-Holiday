using HappyHoliday.Data;
using HappyHoliday.Models;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace HappyHoliday.Repositories;

public sealed class PostgresUserRepository(AppDbContext database) : IUserRepository
{
    public Task<AppUser?> FindByEmailAsync(
        string email,
        CancellationToken cancellationToken = default) =>
        database.Users.SingleOrDefaultAsync(
            user => user.NormalizedEmail == NormalizeEmail(email),
            cancellationToken);

    public async Task<bool> TryAddAsync(
        AppUser user,
        CancellationToken cancellationToken = default)
    {
        database.Users.Add(user);

        try
        {
            await database.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateException exception)
            when (exception.InnerException is PostgresException
                  { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            database.Entry(user).State = EntityState.Detached;
            return false;
        }
    }

    public async Task SaveChangesAsync(CancellationToken cancellationToken = default) =>
        await database.SaveChangesAsync(cancellationToken);

    public async Task<AppUser?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default) =>
        await database.Users.FindAsync([id], cancellationToken);

    public async Task DeleteAsync(AppUser user, CancellationToken cancellationToken = default)
    {
        database.Users.Remove(user);
        await database.SaveChangesAsync(cancellationToken);
    }

    public static string NormalizeEmail(string email) => email.Trim().ToUpperInvariant();
}
