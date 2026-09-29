using HappyHoliday.Authentication;
using HappyHoliday.Models;
using HappyHoliday.Options;
using HappyHoliday.Repositories;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace HappyHoliday.Services;

public sealed class ManagerAccountSeeder(
    IServiceScopeFactory scopeFactory,
    IPasswordHasher<AppUser> passwordHasher,
    IOptions<ManagerSeedOptions> options,
    ILogger<ManagerAccountSeeder> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await using var scope = scopeFactory.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<IUserRepository>();
        var seed = options.Value;
        if (string.IsNullOrWhiteSpace(seed.Email))
        {
            return;
        }

        var email = seed.Email.Trim();
        if (await users.FindByEmailAsync(email, cancellationToken) is not null)
        {
            return;
        }

        var manager = new AppUser
        {
            DisplayName = seed.DisplayName.Trim(),
            Email = email,
            NormalizedEmail = PostgresUserRepository.NormalizeEmail(email),
            PasswordHash = string.Empty,
            Role = UserRoles.Manager
        };
        manager.PasswordHash = passwordHasher.HashPassword(manager, seed.Password);

        if (await users.TryAddAsync(manager, cancellationToken))
        {
            logger.LogInformation("Seeded the initial manager account {Email}.", manager.Email);
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
