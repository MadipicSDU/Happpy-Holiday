namespace HappyHoliday.Models;

// Policies are append-only. A booking keeps its agreed rates when later policies change.
public sealed class CancellationPolicy
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public int Version { get; set; }
    public int CutoffHours { get; set; } = 168;
    public decimal EarlyPercent { get; set; }
    public decimal LatePercent { get; set; }
    public DateTime CreatedAt { get; set; }
    public Guid CreatedById { get; set; }
}

public sealed class CancellationStatement
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Number { get; set; } = "CAN-" + Guid.NewGuid().ToString("N").ToUpperInvariant();
    public string OrderId { get; set; } = "";
    public Order Order { get; set; } = null!;
    public int OrderRevision { get; set; }
    public int PolicyVersion { get; set; }
    public bool IsLate { get; set; }
    public decimal RatePercent { get; set; }
    public decimal OrderAmount { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal PenaltyAmount { get; set; }
    public decimal RefundAmount { get; set; }
    public decimal AmountDue { get; set; }
    public string Reason { get; set; } = "";
    public DateTime CreatedAt { get; set; }
    public DateTime? SettledAt { get; set; }
    public string? SettlementReference { get; set; }
    public bool IsDemo { get; set; }
}

public sealed class EventReview
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string OrderId { get; set; } = "";
    public Order Order { get; set; } = null!;
    public int Rating { get; set; }
    public string Comment { get; set; } = "";
    public DateTime SubmittedAt { get; set; }
    public ICollection<ServiceReview> Services { get; set; } = new List<ServiceReview>();
}

public sealed class ServiceReview
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ReviewId { get; set; }
    public EventReview Review { get; set; } = null!;
    public Guid ServiceId { get; set; }
    public string ServiceName { get; set; } = "";
    public int Rating { get; set; }
}

public sealed class AuditEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Action { get; set; } = "";
    public string TargetId { get; set; } = "";
    public Guid? ActorId { get; set; }
    public DateTime At { get; set; }
    public string Details { get; set; } = "";
}
