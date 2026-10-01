using System.ComponentModel.DataAnnotations;

namespace HappyHoliday.Models;

public sealed class Premise
{
    public Guid Id { get; init; } = Guid.NewGuid();

    [Required, StringLength(200, MinimumLength = 2)]
    public required string Name { get; set; }

    [StringLength(1000)]
    public string? Description { get; set; }

    [Required, StringLength(500, MinimumLength = 5)]
    public required string Address { get; set; }

    [Range(1, 100000)]
    public int Capacity { get; set; }

    [Range(0, 1000000)]
    public decimal PricePerHour { get; set; }

    [StringLength(2000)]
    public string? ImageUrl { get; set; }

    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
}
