using HappyHoliday.Authentication;
using HappyHoliday.Contracts;
using HappyHoliday.Data;
using HappyHoliday.Repositories;
using HappyHoliday.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace HappyHoliday.Controllers;

[ApiController]
[Authorize]
[Route("api/users")]
public sealed class UsersController(IUserRepository users, AppDbContext db) : ControllerBase
{
    // GET /api/users/me
    [HttpGet("me")]
    public async Task<ActionResult<UserResponse>> GetCurrentUser(CancellationToken ct)
    {
        var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(System.IdentityModel.Tokens.Jwt.JwtRegisteredClaimNames.Sub);
        if (!Guid.TryParse(userIdStr, out var id))
            return Unauthorized();
        var user = await users.FindByIdAsync(id, ct);
        return user is null ? Unauthorized() : Ok(user.ToResponse());
    }

    // GET /api/users/clients  — managers only: clients with real booking stats
    [HttpGet("clients")]
    [Authorize(Roles = $"{UserRoles.Manager},{UserRoles.Admin}")]
    public async Task<IActionResult> GetClients(CancellationToken ct)
    {
        var clientUsers = await users.GetByRoleAsync(UserRoles.Client, ct);
        var clientIds   = clientUsers.Select(u => u.Id).ToList();

        // Fetch orders for all clients in one query
        var orderStats = await db.Orders
            .Where(o => clientIds.Contains(o.ClientId))
            .GroupBy(o => o.ClientId)
            .Select(g => new
            {
                ClientId      = g.Key,
                TotalBookings = g.Count(),
                LastBooking   = g.Max(o => o.EventDate)
            })
            .ToListAsync(ct);

        var statsMap = orderStats.ToDictionary(s => s.ClientId);

        return Ok(clientUsers.Select(u =>
        {
            statsMap.TryGetValue(u.Id, out var stats);
            return new
            {
                u.Id,
                name          = u.DisplayName,
                email         = u.Email,
                phone         = "—",
                totalBookings = stats?.TotalBookings ?? 0,
                lastBooking   = stats?.LastBooking.ToString("MMM dd, yyyy") ?? "No bookings",
                company       = "",
                notes         = ""
            };
        }));
    }

    // DELETE /api/users/{id}  — managers only
    // GET /api/users/staff
    [HttpGet("staff")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> GetStaff(CancellationToken ct)
    {
        var managers = await users.GetByRoleAsync(UserRoles.Manager, ct);
        var admins = await users.GetByRoleAsync(UserRoles.Admin, ct);
        var staff = managers.Concat(admins).ToList();

        return Ok(staff.Select(u => new
        {
            u.Id,
            name  = u.DisplayName,
            email = u.Email,
            role  = u.Role,
            createdAt = u.CreatedAt
        }));
    }

    // PUT /api/users/{id}
    [HttpPut("{id:guid}")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> UpdateUser(Guid id, [FromBody] UpdateUserDto dto, CancellationToken ct)
    {
        var user = await users.FindByIdAsync(id, ct);
        if (user is null) return NotFound();

        user.DisplayName = dto.Name;
        user.Email = dto.Email;
        user.NormalizedEmail = dto.Email.ToUpperInvariant();
        user.Role = dto.Role;
        
        await db.SaveChangesAsync(ct);
        return Ok(user.ToResponse());
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = $"{UserRoles.Manager},{UserRoles.Admin}")]
    public async Task<IActionResult> DeleteUser(Guid id, CancellationToken ct)
    {
        var user = await users.FindByIdAsync(id, ct);
        if (user is null) return NotFound();
        await users.DeleteAsync(user, ct);
        return NoContent();
    }
}

public record UpdateUserDto(string Name, string Email, string Role);
