namespace HappyHoliday.Options;

public sealed class ManagerSeedOptions
{
    public const string SectionName = "ManagerSeed";

    public string DisplayName { get; init; } = string.Empty;
    public string Email { get; init; } = string.Empty;
    public string Password { get; init; } = string.Empty;

    public static bool IsCompleteOrEmpty(ManagerSeedOptions options)
    {
        var configuredValues = new[] { options.DisplayName, options.Email, options.Password }
            .Count(value => !string.IsNullOrWhiteSpace(value));

        return configuredValues is 0 or 3;
    }
}
