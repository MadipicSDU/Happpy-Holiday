namespace HappyHoliday.Models;

public sealed class OrderChange
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string OrderId { get; set; } = "";
    public Order Order { get; set; } = null!;
    public int OriginalRevision { get; set; }
    public string Status { get; set; } = "pending";
    public string Reason { get; set; } = "";
    public int Guests { get; set; }
    public string ProposalJson { get; set; } = "";
    public string PreviousPricingJson { get; set; } = "";
    public decimal PriceDelta { get; set; }
    public DateTime RequestedAt { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public Guid? ReviewedById { get; set; }
    public string? ReviewedByName { get; set; }
    public string? ReviewNote { get; set; }
}

public sealed class ExecutionPlan
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string OrderId { get; set; } = "";
    public Order Order { get; set; } = null!;
    public int OrderRevision { get; set; }
    public int Version { get; set; } = 1;
    public string State { get; set; } = "draft";
    public string Notes { get; set; } = "";
    public DateTime UpdatedAt { get; set; }
    public DateTime? FinalizedAt { get; set; }
    public DateTime? DispatchedAt { get; set; }
    public ICollection<ExecutionTask> Tasks { get; set; } = new List<ExecutionTask>();
}

public sealed class ExecutionTask
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PlanId { get; set; }
    public ExecutionPlan Plan { get; set; } = null!;
    public Guid? ServiceId { get; set; }
    public string ServiceName { get; set; } = "Venue preparation";
    public string Activity { get; set; } = "";
    public Guid? StaffId { get; set; }
    public string? StaffName { get; set; }
    public DateTime StartsAt { get; set; }
    public DateTime EndsAt { get; set; }
    public string Instructions { get; set; } = "";
}

public sealed class ExecutionBrief
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid PlanId { get; set; }
    public ExecutionPlan Plan { get; set; } = null!;
    public int PlanVersion { get; set; }
    public Guid TaskId { get; set; }
    public Guid StaffId { get; set; }
    public string SnapshotJson { get; set; } = "";
    public string Status { get; set; } = "sent";
    public DateTime SentAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    public DateTime? SupersededAt { get; set; }
}
