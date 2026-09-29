using HappyHoliday.Contracts;
using HappyHoliday.Models;

namespace HappyHoliday.Services;

public static class UserMappingExtensions
{
    public static UserResponse ToResponse(this AppUser user) => new(
        user.Id,
        user.DisplayName,
        user.Email,
        user.Role,
        user.CreatedAt);
}
