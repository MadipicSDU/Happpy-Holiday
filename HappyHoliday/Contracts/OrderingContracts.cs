using System.ComponentModel.DataAnnotations;

namespace HappyHoliday.Contracts;

public sealed class CreateOrderDto
{
    public Guid PremiseId { get; init; }
    public DateTimeOffset? StartsAt { get; init; }
    public DateTimeOffset? EndsAt { get; init; }
    // Compatibility with the existing client. Explicit periods allow fractional hours.
    public DateTimeOffset? EventDate { get; init; }
    [Range(1, 8760)] public int DurationHours { get; init; } = 4;
    [Range(1, 100000)] public int Guests { get; init; }
    [MaxLength(100)] public List<Guid>? ServiceIds { get; init; }
    [MaxLength(100)] public List<ServiceSelection>? Services { get; init; }
}

public sealed record ServiceSelection(Guid ServiceId, [Range(1, 100000)] int Quantity);
public sealed record PriceLine(Guid Id, string Name, string Category, decimal UnitPrice, decimal Quantity, decimal Amount);
public sealed record OrderQuote(Guid PremiseId, string PremiseName, string Address, DateTime StartsAt,
    DateTime EndsAt, decimal DurationHours, PriceLine Rental, IReadOnlyList<PriceLine> Services, decimal TotalAmount,
    string Currency = "KZT", bool LegacyEstimate = false);
public sealed record OrderResponse(string Id, Guid ClientId, string? Client, Guid? ManagerId, Guid PremiseId,
    string Venue, string Address, string EventDate, DateTime StartsAt, DateTime EndsAt, string Status,
    string StatusLabel, string Amount, decimal TotalAmount, int Guests, OrderQuote Pricing);
public sealed record UpdateStatusDto([Required] string Status);

public sealed class UpdateProfileDto
{
    [Required, StringLength(100, MinimumLength = 2)] public string DisplayName { get; init; } = string.Empty;
    [Required, EmailAddress, StringLength(254)] public string Email { get; init; } = string.Empty;
    [Phone, StringLength(20)] public string? Phone { get; init; }
}

public sealed class UpdateUserDto
{
    [Required, StringLength(100, MinimumLength = 2)] public string Name { get; init; } = string.Empty;
    [Required, EmailAddress, StringLength(254)] public string Email { get; init; } = string.Empty;
    [Required] public string Role { get; init; } = string.Empty;
    [Range(1, 1000)] public int? ClientLimit { get; init; }
}
