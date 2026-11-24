using System.Globalization;

namespace HappyHoliday.Services;

public static class ReportMath
{
    public static decimal OccupiedHours(IEnumerable<(DateTime Start, DateTime End)> periods, DateTime from, DateTime to)
    {
        var clipped = periods.Where(p => p.Start < to && p.End > from)
            .Select(p => (Start: p.Start < from ? from : p.Start, End: p.End > to ? to : p.End)).OrderBy(p => p.Start).ToList();
        if (clipped.Count == 0) return 0;
        var start = clipped[0].Start; var end = clipped[0].End; decimal hours = 0;
        foreach (var period in clipped.Skip(1))
        {
            if (period.Start <= end) { if (period.End > end) end = period.End; }
            else { hours += BookingRules.Hours(start, end); start = period.Start; end = period.End; }
        }
        return hours + BookingRules.Hours(start, end);
    }
    // Quote every field and neutralize spreadsheet formula prefixes in exported user text.
    public static string Csv(object? value)
    {
        var text = Convert.ToString(value, CultureInfo.InvariantCulture) ?? "";
        if (text.TrimStart().FirstOrDefault() is '=' or '+' or '-' or '@' or '\t' or '\r') text = "'" + text;
        return "\"" + text.Replace("\"", "\"\"") + "\"";
    }
}
