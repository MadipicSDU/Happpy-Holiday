using System.ComponentModel.DataAnnotations;

namespace HappyHoliday.Models;

public sealed class EventService
{
    public Guid Id { get; init; } = Guid.NewGuid();

    [Required, StringLength(100, MinimumLength = 2)]
    public required string Name { get; set; }

    [StringLength(1000)]
    public string? Description { get; set; }

    [Required, StringLength(100)]
    public required string Category { get; set; }

    [Range(0, 1000000)]
    public decimal Price { get; set; }

    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
}
