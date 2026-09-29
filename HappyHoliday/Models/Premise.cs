namespace HappyHoliday.Models;

public sealed class Premise
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public required string Name { get; set; }
    public string? Description { get; set; }
    public required string Address { get; set; }
    public int Capacity { get; set; }
    public decimal PricePerHour { get; set; }
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
}
