using System.Text.Json;
using HappyHoliday.Data;
using HappyHoliday.Models;

namespace HappyHoliday.Services;

public sealed class BillingService(AppDbContext db)
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public Invoice Create(Order order, DateTime now, bool delivered = false)
    {
        var balance = order.TotalAmount - order.PaidAmount;
        var invoice = new Invoice { OrderId = order.Id, Revision = order.Revision, ClientName = order.Client!.DisplayName,
            ClientEmail = order.Client.Email, CreatedAt = now, DeliveredAt = delivered ? now : null,
            DocumentType = balance < 0 ? "credit-note" : "invoice", IsDemo = balance < 0, TotalAmount = Math.Abs(balance),
            PreviousPaidAmount = order.PaidAmount,
            SettledAt = balance <= 0 && order.PaymentConfirmedAt.HasValue ? now : null,
            PricingJson = JsonSerializer.Serialize(OrderingService.ToResponse(order).Pricing, Json) };
        if (balance < 0) order.PaidAmount = order.TotalAmount;
        db.Invoices.Add(invoice);
        return invoice;
    }
}
