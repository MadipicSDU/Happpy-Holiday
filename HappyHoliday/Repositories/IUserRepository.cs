using HappyHoliday.Models;

namespace HappyHoliday.Repositories;

public interface IUserRepository
{
    Task<AppUser?> FindByEmailAsync(string email, CancellationToken cancellationToken = default);
    Task<AppUser?> FindByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<bool> TryAddAsync(AppUser user, CancellationToken cancellationToken = default);
    Task DeleteAsync(AppUser user, CancellationToken cancellationToken = default);
    Task SaveChangesAsync(CancellationToken cancellationToken = default);
}
