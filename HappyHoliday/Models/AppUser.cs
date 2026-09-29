namespace HappyHoliday.Models;

public sealed class AppUser
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string DisplayName { get; init; }
    public required string Email { get; init; }
    public required string NormalizedEmail { get; init; }
    public required string PasswordHash { get; set; }
    public required string Role { get; init; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
}
