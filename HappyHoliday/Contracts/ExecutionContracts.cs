using System.ComponentModel.DataAnnotations;

namespace HappyHoliday.Contracts;

public sealed class OrderChangeOptions
{
    [Range(1, 8760)] public int CutoffHours { get; set; } = 168;
}
public sealed class RequestChangeDto
{
    public required CreateOrderDto Booking { get; init; }
    public int ExpectedRevision { get; init; }
    public decimal? ExpectedTotal { get; init; }
    [StringLength(1000)] public string Reason { get; init; } = "";
}
public sealed record ReviewChangeDto(bool Approve, [StringLength(1000)] string Note = "");
public sealed record PlanVersionDto(int ExpectedVersion);
public sealed class SaveExecutionDto
{
    public int? ExpectedVersion { get; init; }
    [StringLength(4000)] public string Notes { get; init; } = "";
    [MaxLength(100)] public List<ExecutionTaskDto> Tasks { get; init; } = [];
}
public sealed class ExecutionTaskDto
{
    public Guid? ServiceId { get; init; }
    [Required, StringLength(200, MinimumLength = 2)] public string Activity { get; init; } = "";
    public Guid? StaffId { get; init; }
    public DateTimeOffset StartsAt { get; init; }
    public DateTimeOffset EndsAt { get; init; }
    [StringLength(2000)] public string Instructions { get; init; } = "";
}
public sealed record BriefStatusDto([Required] string Status);
public sealed record ExecutionBriefSnapshot(string OrderId, int OrderRevision, string Venue, string Address, int Guests,
    DateTime StartsAt, DateTime EndsAt, string Activity, string ServiceName, int ServiceQuantity, string StaffName,
    string ManagerName, DateTime TaskStartsAt, DateTime TaskEndsAt, string Instructions, string PlanNotes);
