using HappyHoliday.Authentication;
using HappyHoliday.Contracts;
using HappyHoliday.Data;
using HappyHoliday.Models;
using Microsoft.EntityFrameworkCore;

namespace HappyHoliday.Services;

public sealed class BookingException(int status, string message) : Exception(message)
{
    public int Status { get; } = status;
}

public sealed class OrderingService(AppDbContext db, TimeProvider clock)
{
    public async Task<OrderQuote> QuoteAsync(Guid clientId, CreateOrderDto dto, CancellationToken ct)
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
        var active = db.Orders.Where(o => o.Status != "cancelled" && o.Status != "completed"
                                         && o.EventDate < end && o.EndDate > start);
        if (await active.AnyAsync(o => o.PremiseId == premise.Id, ct))
            throw new BookingException(409, "This premise is occupied during the requested period.");
        if (BookingRules.ExceedsPremiseLimit(await active.Where(o => o.ClientId == clientId).ToListAsync(ct), start, end))
            throw new BookingException(409, "A client may reserve at most three premises at any one time.");
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
        return new OrderQuote(premise.Id, premise.Name, premise.Address, start, end, hours, rental, lines,
            rental.Amount + lines.Sum(s => s.Amount));
    }

    public async Task<Order> CreateAsync(Guid clientId, CreateOrderDto dto, CancellationToken ct)
    {
        await using var transaction = await BookingTransaction.BeginAsync(db, ct);
        var quote = await QuoteAsync(clientId, dto, ct);
        var active = db.Orders.Where(o => o.Status != "cancelled" && o.Status != "completed");
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
            EventDate = quote.StartsAt, EndDate = quote.EndsAt, ExpectedGuests = dto.Guests,
            PremiseName = quote.PremiseName, PremiseAddress = quote.Address,
            RentalRate = quote.Rental.UnitPrice, RentalAmount = quote.Rental.Amount, TotalAmount = quote.TotalAmount,
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

    public static OrderResponse ToResponse(Order order)
    {
        var hours = BookingRules.Hours(order.EventDate, order.EndDate);
        var rental = new PriceLine(order.PremiseId, order.PremiseName, "PremiseRental", order.RentalRate, hours, order.RentalAmount);
        var services = order.OrderServices.Select(s => new PriceLine(s.EventServiceId, s.Name, s.Category,
            s.UnitPrice, s.Quantity, s.Amount)).ToList();
        var pricing = new OrderQuote(order.PremiseId, order.PremiseName, order.PremiseAddress,
            order.EventDate, order.EndDate, hours, rental, services, order.TotalAmount, LegacyEstimate: order.LegacyEstimate);
        return new OrderResponse(order.Id, order.ClientId, order.Client?.DisplayName, order.ManagerId,
            order.PremiseId, order.PremiseName, order.PremiseAddress,
            order.EventDate.ToString("MMM dd, yyyy", System.Globalization.CultureInfo.InvariantCulture),
            order.EventDate, order.EndDate, order.Status, StatusLabel(order.Status),
            order.TotalAmount.ToString("N2", System.Globalization.CultureInfo.InvariantCulture) + " ₸",
            order.TotalAmount, order.ExpectedGuests, pricing);
    }
    public static string StatusLabel(string status) => status switch
    {
        "pending" => "Pending", "awaiting-payment" => "Awaiting Payment", "confirmed" => "Confirmed",
        "change-requested" => "Change Requested", "completed" => "Completed", "cancelled" => "Cancelled", _ => status
    };
}
