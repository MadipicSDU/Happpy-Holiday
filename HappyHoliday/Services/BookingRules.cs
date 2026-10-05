using HappyHoliday.Models;

namespace HappyHoliday.Services;

public static class BookingRules
{
    public static bool IsActive(string status) => status is not ("cancelled" or "completed");
    public static bool Overlaps(DateTime start, DateTime end, DateTime otherStart, DateTime otherEnd) =>
        start < otherEnd && otherStart < end;

    // Count the peak concurrent reservations, rather than all bookings that touch a long period.
    public static bool ExceedsPremiseLimit(IEnumerable<Order> orders, DateTime start, DateTime end)
    {
        var boundaries = orders.Where(o => IsActive(o.Status) && Overlaps(start, end, o.EventDate, o.EndDate))
            .SelectMany(o => new[] { (Time: o.EventDate < start ? start : o.EventDate, Delta: 1),
                (Time: o.EndDate > end ? end : o.EndDate, Delta: -1) })
            .OrderBy(b => b.Time).ThenBy(b => b.Delta);
        var count = 1;
        foreach (var boundary in boundaries)
        {
            count += boundary.Delta;
            if (count > 3) return true;
        }
        return false;
    }

    public static decimal Money(decimal value) => decimal.Round(value, 2, MidpointRounding.AwayFromZero);
    public static decimal Hours(DateTime start, DateTime end) => (end - start).Ticks / (decimal)TimeSpan.TicksPerHour;
}
