using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace HappyHoliday.Models;

public class Order
{
    [Key]
    public string Id { get; set; } = $"ORD-{Guid.NewGuid():N}";

    [Required]
    public Guid ClientId { get; set; }
    [ForeignKey(nameof(ClientId))]
    public AppUser? Client { get; set; }

    [Required]
    public Guid PremiseId { get; set; }
    [ForeignKey(nameof(PremiseId))]
    public Premise? Premise { get; set; }

    public Guid? ManagerId { get; set; }
    [ForeignKey(nameof(ManagerId))]
    public AppUser? Manager { get; set; }

    public DateTime EventDate { get; set; }
    public DateTime EndDate { get; set; }
    public string PremiseName { get; set; } = string.Empty;
    public string PremiseAddress { get; set; } = string.Empty;
    public decimal RentalRate { get; set; }
    public decimal RentalAmount { get; set; }
    public bool LegacyEstimate { get; set; }
    public int ExpectedGuests { get; set; }

    public string Status { get; set; } = "pending";

    public decimal TotalAmount { get; set; }

    public ICollection<OrderService> OrderServices { get; set; } = new List<OrderService>();
}

public class OrderService
{
    [Key]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [Required]
    public string OrderId { get; set; } = string.Empty;
    [ForeignKey(nameof(OrderId))]
    public Order? Order { get; set; }

    [Required]
    public Guid EventServiceId { get; set; }
    [ForeignKey(nameof(EventServiceId))]
    public EventService? EventService { get; set; }
    
    public int Quantity { get; set; } = 1;
    public string Name { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public decimal UnitPrice { get; set; }
    public decimal Amount { get; set; }
}
