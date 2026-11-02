using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HappyHoliday.Data.Migrations
{
    /// <inheritdoc />
    public partial class CancellationAudit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CancelledAt",
                table: "orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CancelledByName",
                table: "orders",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CancelledByRole",
                table: "orders",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "CancelledByUserId",
                table: "orders",
                type: "uuid",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CancelledAt",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "CancelledByName",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "CancelledByRole",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "CancelledByUserId",
                table: "orders");
        }
    }
}
