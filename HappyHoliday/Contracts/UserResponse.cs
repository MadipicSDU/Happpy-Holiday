namespace HappyHoliday.Contracts;

public sealed record UserResponse(
    Guid Id,
    string DisplayName,
    string Email,
    string Role,
    DateTimeOffset CreatedAt);
