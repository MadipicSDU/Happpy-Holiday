namespace HappyHoliday.Models;

public sealed class Invoice
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Number { get; set; } = "INV-" + Guid.NewGuid().ToString("N").ToUpperInvariant();
    public string OrderId { get; set; } = string.Empty;
    public Order Order { get; set; } = null!;
    public string ClientName { get; set; } = string.Empty;
    public string ClientEmail { get; set; } = string.Empty;
    public string PricingJson { get; set; } = string.Empty;
    public decimal TotalAmount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public DateTime? VoidedAt { get; set; }
    public int Revision { get; set; } = 1;
    public string DocumentType { get; set; } = "invoice";
    public decimal PreviousPaidAmount { get; set; }
    public DateTime? SettledAt { get; set; }
    public bool IsDemo { get; set; }
}

public sealed class Payment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid InvoiceId { get; set; }
    public Invoice Invoice { get; set; } = null!;
    public Guid IdempotencyKey { get; set; }
    public decimal Amount { get; set; }
    public DateTime PaidAt { get; set; }
    public string Reference { get; set; } = "DEMO-" + Guid.NewGuid().ToString("N").ToUpperInvariant();
    public bool IsDemo { get; set; } = true;
}
