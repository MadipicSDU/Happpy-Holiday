using System.ComponentModel.DataAnnotations;

namespace HappyHoliday.Contracts;

public sealed record PolicyDto(
    [Range(0, int.MaxValue)] int ExpectedVersion,
    [Range(1, 8760)] int CutoffHours,
    [Range(0, 100)] decimal EarlyPercent,
    [Range(0, 100)] decimal LatePercent);
public sealed record CancelOrderDto(int ExpectedRevision, decimal ExpectedPenalty, decimal ExpectedRefund,
    decimal ExpectedAmountDue, [StringLength(1000)] string Reason = "");
public sealed record CancellationQuote(string OrderId, int Revision, int PolicyVersion, DateTime ChangeDeadline,
    bool IsLate, decimal RatePercent, decimal OrderAmount, decimal PaidAmount, decimal PenaltyAmount,
    decimal RefundAmount, decimal AmountDue, DateTime CheckedAt, string Currency = "KZT");
public sealed record ServiceRatingDto(Guid ServiceId, [Range(1, 5)] int Rating);
public sealed class ReviewDto
{
    [Range(1, 5)] public int Rating { get; init; }
    [StringLength(2000)] public string Comment { get; init; } = "";
    [MaxLength(100)] public List<ServiceRatingDto> Services { get; init; } = [];
}
public sealed class LifecycleOptions
{
    public bool Enabled { get; set; } = true;
    [Range(10, 3600)] public int IntervalSeconds { get; set; } = 60;
    [Range(1, 5000)] public int BatchSize { get; set; } = 500;
}
