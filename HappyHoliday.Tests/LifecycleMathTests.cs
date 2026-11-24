using HappyHoliday.Models;
using HappyHoliday.Services;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace HappyHoliday.Tests;

[TestClass]
public sealed class LifecycleMathTests
{
    [TestMethod]
    public void CancellationUsesExactDeadlineStoredRatesAndMoneyRounding()
    {
        var start = new DateTime(2027, 1, 10, 12, 0, 0, DateTimeKind.Utc);
        var order = new Order { EventDate = start, TotalAmount = 123.45m, PaidAmount = 100m, ChangeCutoffHours = 24,
            EarlyCancellationPercent = 10, LateCancellationPercent = 100, PenaltyPolicyVersion = 7 };
        var early = CancellationWorkflow.Calculate(order, start.AddDays(-1).AddTicks(-1));
        Assert.IsFalse(early.IsLate); Assert.AreEqual(12.35m, early.PenaltyAmount); Assert.AreEqual(87.65m, early.RefundAmount);
        var late = CancellationWorkflow.Calculate(order, start.AddDays(-1));
        Assert.IsTrue(late.IsLate); Assert.AreEqual(123.45m, late.PenaltyAmount); Assert.AreEqual(23.45m, late.AmountDue);
        Assert.AreEqual(0m, late.RefundAmount); Assert.AreEqual(7, late.PolicyVersion);
    }
    [TestMethod]
    public void ReportsMergeOverlapClipBoundariesAndIgnoreDisjointPeriods()
    {
        var start = new DateTime(2027, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        var periods = new[] { (start.AddHours(-2), start.AddHours(2)), (start.AddHours(1), start.AddHours(4)),
            (start.AddHours(4), start.AddHours(5)), (start.AddHours(10), start.AddHours(12)) };
        Assert.AreEqual(5m, ReportMath.OccupiedHours(periods, start, start.AddHours(6)));
        Assert.AreEqual(2m, ReportMath.OccupiedHours(periods, start.AddHours(2), start.AddHours(4)));
        Assert.AreEqual(0m, ReportMath.OccupiedHours(periods, start.AddHours(6), start.AddHours(10)));
    }
    [TestMethod]
    public void CsvQuotesTextAndNeutralizesFormulaPrefixes()
    {
        Assert.AreEqual("\"Hall, \"\"A\"\"\"", ReportMath.Csv("Hall, \"A\""));
        foreach (var value in new[] { "=1+1", "+SUM(1)", "-2+3", "@test", "  =1+1" })
            StringAssert.StartsWith(ReportMath.Csv(value), "\"'");
        Assert.AreEqual("\"123.45\"", ReportMath.Csv(123.45m));
    }
}
