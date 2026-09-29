using System.IdentityModel.Tokens.Jwt;
using HappyHoliday.Authentication;
using HappyHoliday.Contracts;
using HappyHoliday.Repositories;
using HappyHoliday.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HappyHoliday.Controllers;

[ApiController]
[Authorize]
[Route("api/users")]
public sealed class UsersController(IUserRepository users) : ControllerBase
{
    [HttpGet("me")]
    [ProducesResponseType<UserResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<UserResponse>> GetCurrentUser(CancellationToken cancellationToken)
    {
        var email = User.FindFirst(JwtRegisteredClaimNames.Email)?.Value;
        var user = email is null
            ? null
            : await users.FindByEmailAsync(email, cancellationToken);

        return user is null ? Unauthorized() : Ok(user.ToResponse());
    }

    [HttpGet("manager-area")]
    [Authorize(Roles = UserRoles.Manager)]
    [ProducesResponseType<object>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public ActionResult GetManagerArea() => Ok(new
    {
        message = "Only managers can access this endpoint."
    });

    [HttpPost("deleteuser/{userid}")]
    [Authorize(Roles = UserRoles.Manager)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult> DeleteUser(Guid userid, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdAsync(userid, cancellationToken);
        if (user is null)
        {
            return NotFound();
        }

        await users.DeleteAsync(user, cancellationToken);
        return Ok();
    }
}
