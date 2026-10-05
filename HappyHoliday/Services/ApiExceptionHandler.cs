using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace HappyHoliday.Services;

public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        var (status, detail) = exception switch
        {
            BookingException booking => (booking.Status, booking.Message),
            DbUpdateException { InnerException: PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } }
                => (409, "A record with this unique value already exists."),
            DbUpdateException { InnerException: PostgresException { SqlState: PostgresErrorCodes.ForeignKeyViolation } }
                => (409, "This record is referenced by booking history or was changed. Refresh and try again."),
            _ => (500, "An unexpected error occurred.")
        };
        if (status == 500) logger.LogError(exception, "Unhandled API error");
        context.Response.StatusCode = status;
        await context.Response.WriteAsJsonAsync(new Microsoft.AspNetCore.Mvc.ProblemDetails
        {
            Status = status, Title = status == 500 ? "Server error" : "Request rejected", Detail = detail
        }, ct);
        return true;
    }
}
