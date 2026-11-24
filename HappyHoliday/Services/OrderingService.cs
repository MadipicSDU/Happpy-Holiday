using System.Security.Cryptography;
using System.Text.Json;
using HappyHoliday.Authentication;
using HappyHoliday.Contracts;
using HappyHoliday.Data;
using HappyHoliday.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace HappyHoliday.Services;

public sealed class BookingException(int status, string message, string? code = null) : Exception(message)
{
    public int Status { get; } = status;
    public string? Code { get; } = code;
}

public sealed class OrderingService(AppDbContext db, TimeProvider clock, IOptions<OrderChangeOptions> changeOptions)
{
    public async Task<OrderQuote> QuoteAsync(Guid clientId, CreateOrderDto dto, CancellationToken ct, string? excludeOrderId = null)
    {
        DateTime start, end;
        if (dto.StartsAt.HasValue && dto.EndsAt.HasValue && !dto.EventDate.HasValue)
        {
            start = dto.StartsAt.Value.UtcDateTime;
            end = dto.EndsAt.Value.UtcDateTime;
        }
        else if (dto.EventDate.HasValue && !dto.StartsAt.HasValue && !dto.EndsAt.HasValue
                 && dto.DurationHours is >= 1 and <= 8760)
        {
            start = dto.EventDate.Value.UtcDateTime;
            if (start > DateTime.MaxValue.AddHours(-dto.DurationHours))
                throw new BookingException(400, "Rental end is outside the supported date range.");
            end = start.AddHours(dto.DurationHours);
        }
        else throw new BookingException(400, "Supply startsAt and endsAt, or eventDate and durationHours.");
        if (start <= clock.GetUtcNow().UtcDateTime || end <= start || end - start > TimeSpan.FromDays(365))
            throw new BookingException(400, "Choose a future start and a later end, at most 365 days apart.");
        var premise = await db.Premises.AsNoTracking().SingleOrDefaultAsync(p => p.Id == dto.PremiseId, ct)
            ?? throw new BookingException(404, "Premise not found.");
        if (dto.Guests < 1 || dto.Guests > premise.Capacity)
            throw new BookingException(400, "Guest count must be positive and within the premise capacity.");
        var active = db.Orders.Where(o => o.Id != excludeOrderId && BookingRules.ActiveStatuses.Contains(o.Status)
                                         && o.EventDate < end && o.EndDate > start);
        if (await active.AnyAsync(o => o.PremiseId == premise.Id, ct))
            throw new BookingException(409, "This venue is occupied during the requested period. Try different dates or choose an alternative.", "venue-occupied");
        if (BookingRules.ExceedsPremiseLimit(await active.Where(o => o.ClientId == clientId).ToListAsync(ct), start, end))
            throw new BookingException(409, "You can reserve at most three venues at the same time. Try a different period or manage an existing booking.", "premise-limit");
        if (dto.ServiceIds is { Count: > 0 } && dto.Services is { Count: > 0 })
            throw new BookingException(400, "Supply services or serviceIds, not both.");
        var selections = dto.Services is { Count: > 0 } ? dto.Services
            : dto.ServiceIds?.Select(id => new ServiceSelection(id, 1)).ToList() ?? [];
        if (selections.Count > 100 || selections.Any(s => s is null || s.ServiceId == Guid.Empty || s.Quantity is < 1 or > 100000)
            || selections.Select(s => s.ServiceId).Distinct().Count() != selections.Count)
            throw new BookingException(400, "Services must be unique, with quantities from 1 to 100000.");
        var ids = selections.Select(s => s.ServiceId).ToList();
        var services = await db.EventServices.AsNoTracking().Where(s => ids.Contains(s.Id)).ToListAsync(ct);
        if (services.Count != ids.Count) throw new BookingException(400, "One or more selected services do not exist.");
        var reserved = await db.OrderServices.Where(s => ids.Contains(s.EventServiceId) && s.OrderId != excludeOrderId
            && BookingRules.ActiveStatuses.Contains(s.Order!.Status) && s.Order.EventDate < end && s.Order.EndDate > start)
            .Select(s => new { s.EventServiceId, s.Quantity, Start = s.Order!.EventDate, End = s.Order.EndDate }).ToListAsync(ct);
        foreach (var selection in selections)
        {
            var service = services.Single(s => s.Id == selection.ServiceId);
            if (service.ConcurrentCapacity is { } capacity && BookingRules.PeakUnits(reserved.Where(r => r.EventServiceId == service.Id)
                .Select(r => (r.Start, r.End, r.Quantity)), start, end) + selection.Quantity > capacity)
                throw new BookingException(409, $"Not enough units of {service.Name} are available during this period. Change the quantity or choose a different time.", "service-unavailable");
        }
        var lines = selections.Select(s =>
        {
            var service = services.Single(item => item.Id == s.ServiceId);
            var rate = BookingRules.Money(service.Price);
            return new PriceLine(service.Id, service.Name, service.Category, rate, s.Quantity, rate * s.Quantity);
        }).ToList();
        var hours = BookingRules.Hours(start, end);
        var rentalRate = BookingRules.Money(premise.PricePerHour);
        var rental = new PriceLine(premise.Id, premise.Name, "PremiseRental", rentalRate, hours,
            BookingRules.Money(rentalRate * hours));
        var discount = BookingRules.Money(rental.Amount * premise.PromotionPercent / 100m);
        var terms = await db.CancellationPolicies.AsNoTracking().OrderByDescending(p => p.Version).FirstOrDefaultAsync(ct);
        var quote = new OrderQuote(premise.Id, premise.Name, premise.Address, start, end, hours, rental, lines,
            rental.Amount - discount + lines.Sum(s => s.Amount), RentalDiscount: discount, PromotionPercent: premise.PromotionPercent,
            CancellationTerms: new(terms?.Version ?? 0, terms?.CutoffHours ?? changeOptions.Value.CutoffHours, terms?.EarlyPercent ?? 0, terms?.LatePercent ?? 0));
        // Include each line and the policy so offsetting changes cannot hide behind an unchanged total.
        var canonical = quote with { Services = lines.OrderBy(line => line.Id).ToArray() };
        return quote with { QuoteVersion = Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(new { Quote = canonical, dto.Guests }))) };
    }

    public async Task<Order> CreateAsync(Guid clientId, CreateOrderDto dto, CancellationToken ct)
    {
        await using var transaction = await BookingTransaction.BeginAsync(db, ct);
        var quote = await QuoteAsync(clientId, dto, ct);
        var terms = quote.CancellationTerms!;
        if (dto.ExpectedPolicyVersion.HasValue && dto.ExpectedPolicyVersion != terms.Version)
            throw new BookingException(409, "Cancellation terms changed. Review the updated terms before submitting.", "quote-changed");
        if (dto.ExpectedQuoteVersion is not null && dto.ExpectedQuoteVersion != quote.QuoteVersion)
            throw new BookingException(409, "The quote changed. Review the updated price before submitting.", "quote-changed");
        var active = db.Orders.Where(o => BookingRules.ActiveStatuses.Contains(o.Status));
        var managers = await db.Users.Where(u => u.Role == UserRoles.Manager).OrderBy(u => u.Id).ToListAsync(ct);
        var loads = await active.Where(o => o.ManagerId != null)
            .Select(o => new { o.ManagerId, o.ClientId }).Distinct().ToListAsync(ct);
        var manager = managers
            .Select(m => new { User = m, Count = loads.Count(l => l.ManagerId == m.Id),
                Existing = loads.Any(l => l.ManagerId == m.Id && l.ClientId == clientId) })
            .Where(m => m.Existing || m.Count < m.User.ClientLimit)
            .OrderByDescending(m => m.Existing).ThenBy(m => m.Count).ThenBy(m => m.User.Id)
            .Select(m => m.User).FirstOrDefault()
            ?? throw new BookingException(409, "No manager has capacity for another client. Please try later.");
        var order = new Order
        {
            ClientId = clientId, ManagerId = manager.Id, PremiseId = quote.PremiseId,
            CreatedAt = BookingRules.UtcNow(clock),
            ChangeCutoffHours = terms.CutoffHours,
            PenaltyPolicyVersion = terms.Version,
            EarlyCancellationPercent = terms.EarlyPercent,
            LateCancellationPercent = terms.LatePercent,
            EventDate = quote.StartsAt, EndDate = quote.EndsAt, ExpectedGuests = dto.Guests,
            PremiseName = quote.PremiseName, PremiseAddress = quote.Address,
            RentalRate = quote.Rental.UnitPrice, RentalAmount = quote.Rental.Amount, TotalAmount = quote.TotalAmount,
            RentalDiscount = quote.RentalDiscount, PromotionPercent = quote.PromotionPercent,
            OrderServices = quote.Services.Select(s => new OrderService
            {
                EventServiceId = s.Id, Name = s.Name, Category = s.Category,
                Quantity = (int)s.Quantity, UnitPrice = s.UnitPrice, Amount = s.Amount
            }).ToList()
        };
        db.Orders.Add(order);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return order;
    }

    public static async Task<Dictionary<string, StaffProgress>> StaffProgressAsync(AppDbContext db, ICollection<string> orderIds, CancellationToken ct)
    {
        if (orderIds.Count == 0) return [];
        var rows = await db.ExecutionBriefs.AsNoTracking()
            .Where(b => orderIds.Contains(b.Plan.OrderId) && b.SupersededAt == null && b.Plan.State == "dispatched"
                && b.Plan.OrderRevision == b.Plan.Order.Revision && b.PlanVersion == b.Plan.Version)
            .Select(b => new { b.Plan.OrderId, b.Status }).ToListAsync(ct);
        return rows.GroupBy(r => r.OrderId).ToDictionary(g => g.Key, g => new StaffProgress(g.Count(),
            g.Count(r => r.Status == "sent"), g.Count(r => r.Status == "acknowledged"),
            g.Count(r => r.Status == "in-progress"), g.Count(r => r.Status == "completed")));
    }

    public static OrderResponse ToResponse(Order order)
    {
        var hours = BookingRules.Hours(order.EventDate, order.EndDate);
        var rental = new PriceLine(order.PremiseId, order.PremiseName, "PremiseRental", order.RentalRate, hours, order.RentalAmount);
        var services = order.OrderServices.Select(s => new PriceLine(s.EventServiceId, s.Name, s.Category,
            s.UnitPrice, s.Quantity, s.Amount)).ToList();
        var pricing = new OrderQuote(order.PremiseId, order.PremiseName, order.PremiseAddress,
            order.EventDate, order.EndDate, hours, rental, services, order.TotalAmount, LegacyEstimate: order.LegacyEstimate,
            RentalDiscount: order.RentalDiscount, PromotionPercent: order.PromotionPercent,
            CancellationTerms: new(order.PenaltyPolicyVersion, order.ChangeCutoffHours, order.EarlyCancellationPercent, order.LateCancellationPercent));
        return new OrderResponse(order.Id, order.ClientId, order.Client?.DisplayName, order.ManagerId,
            order.PremiseId, order.PremiseName, order.PremiseAddress,
            order.EventDate.ToString("MMM dd, yyyy", System.Globalization.CultureInfo.InvariantCulture),
            order.EventDate, order.EndDate, order.Status, StatusLabel(order.Status),
            order.TotalAmount.ToString("N2", System.Globalization.CultureInfo.InvariantCulture) + " ₸",
            order.TotalAmount, order.ExpectedGuests, pricing,
            order.CancelledAt is { } cancelledAt && order.CancelledByUserId is { } cancelledById
                ? new OrderCancellation(cancelledById, order.CancelledByName ?? "Name unavailable", order.CancelledByRole ?? "", cancelledAt)
                : null, order.Revision, order.EventDate.AddHours(-order.ChangeCutoffHours), order.PendingChangeId,
            order.PaidAmount, order.PaymentConfirmedAt, order.ExecutionState, order.CreatedAt, order.CompletedAt, order.ArchivedAt);
    }
    public static string StatusLabel(string status) => status switch
    {
        "pending" => "Pending", "awaiting-payment" => "Awaiting Payment", "confirmed" => "Confirmed",
        "change-requested" => "Change Requested", "completed" => "Completed", "cancelled" => "Cancelled",
        "expired" => "Expired", _ => status
    };
}
