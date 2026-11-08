using HappyHoliday.Models;
using HappyHoliday.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace HappyHoliday.Tests;

[TestClass]
public sealed class BookingRulesTests
{
    [TestMethod]
    public void ServiceCapacityCountsPeakUnitsAndReleasesAdjacentSlots()
    {
        var start = new DateTime(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var intervals = new[] { (start, start.AddHours(1), 3), (start.AddHours(1), start.AddHours(2), 3), (start.AddMinutes(30), start.AddMinutes(90), 2) };
        Assert.AreEqual(5L, BookingRules.PeakUnits(intervals, start, start.AddHours(2)));
        Assert.AreEqual(3L, BookingRules.PeakUnits(intervals, start.AddMinutes(90), start.AddHours(2)));
    }
    [TestMethod]
    public void DisjointBookingsDoNotConsumeSimultaneousSlots()
    {
        var start = new DateTime(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var orders = Enumerable.Range(0, 6).Select(i => new Order { EventDate = start.AddHours(i), EndDate = start.AddHours(i + 1) }).ToList();
        Assert.IsFalse(BookingRules.ExceedsPremiseLimit(orders, start, start.AddHours(6)));
        Assert.IsFalse(BookingRules.Overlaps(start, start.AddHours(1), start.AddHours(1), start.AddHours(2)));
    }

    [TestMethod]
    public void PartialOverlapCountsPeakIncludingNewBooking()
    {
        var start = new DateTime(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var orders = Enumerable.Range(0, 3).Select(i => new Order { EventDate = start.AddHours(i), EndDate = start.AddHours(i + 2) }).ToList();
        Assert.IsFalse(BookingRules.ExceedsPremiseLimit(orders, start, start.AddHours(5)));
        orders.Add(new Order { EventDate = start, EndDate = start.AddHours(4) });
        Assert.IsTrue(BookingRules.ExceedsPremiseLimit(orders, start, start.AddHours(5)));
        orders[^1].Status = "cancelled";
        Assert.IsFalse(BookingRules.ExceedsPremiseLimit(orders, start, start.AddHours(5)));
    }
}
