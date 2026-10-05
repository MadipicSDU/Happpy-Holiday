using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HappyHoliday.Data.Migrations
{
    /// <inheritdoc />
    public partial class Sprint2Ordering : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_order_services_event_services_EventServiceId",
                table: "order_services");

            migrationBuilder.DropForeignKey(
                name: "FK_orders_premises_PremiseId",
                table: "orders");

            migrationBuilder.DropForeignKey(
                name: "FK_orders_users_ClientId",
                table: "orders");

            migrationBuilder.DropForeignKey(
                name: "FK_orders_users_ManagerId",
                table: "orders");

            migrationBuilder.DropIndex(
                name: "IX_orders_PremiseId",
                table: "orders");

            migrationBuilder.DropIndex(
                name: "IX_order_services_OrderId",
                table: "order_services");

            migrationBuilder.AddColumn<int>(
                name: "ClientLimit",
                table: "users",
                type: "integer",
                nullable: false,
                defaultValue: 10);

            // EnsureCreated databases already have these unmigrated fields.
            migrationBuilder.Sql("ALTER TABLE users ADD COLUMN IF NOT EXISTS \"Phone\" varchar(20);");
            migrationBuilder.Sql("ALTER TABLE premises ADD COLUMN IF NOT EXISTS \"ImageUrl\" varchar(2000);");

            migrationBuilder.AddColumn<DateTime>(
                name: "EndDate",
                table: "orders",
                type: "timestamp with time zone",
                nullable: false,
                defaultValue: new DateTime(2000, 1, 1, 0, 0, 0, DateTimeKind.Utc));

            migrationBuilder.AddColumn<string>(
                name: "PremiseAddress",
                table: "orders",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PremiseName",
                table: "orders",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "RentalAmount",
                table: "orders",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "RentalRate",
                table: "orders",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "Amount",
                table: "order_services",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "Category",
                table: "order_services",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Name",
                table: "order_services",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<decimal>(
                name: "UnitPrice",
                table: "order_services",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<bool>(name: "LegacyEstimate", table: "orders", type: "boolean", nullable: false, defaultValue: false);
            // Legacy orders never persisted duration or price snapshots. Retain their total,
            // assume the old four-hour default and mark them for operator reconciliation.
            migrationBuilder.Sql("""
                UPDATE order_services os SET "Name" = s."Name", "Category" = s."Category",
                    "UnitPrice" = s."Price", "Amount" = s."Price" * os."Quantity"
                FROM event_services s WHERE os."EventServiceId" = s."Id";
                UPDATE orders o SET "EndDate" = o."EventDate" + interval '4 hours',
                    "PremiseName" = p."Name", "PremiseAddress" = p."Address",
                    "RentalAmount" = o."TotalAmount" - COALESCE((SELECT SUM(os."Amount") FROM order_services os WHERE os."OrderId" = o."Id"), 0),
                    "LegacyEstimate" = true
                FROM premises p WHERE o."PremiseId" = p."Id";
                UPDATE orders SET "RentalRate" = round("RentalAmount" / 4, 2);
                """);

            migrationBuilder.CreateIndex(
                name: "IX_orders_PremiseId_EventDate_EndDate",
                table: "orders",
                columns: new[] { "PremiseId", "EventDate", "EndDate" });

            migrationBuilder.CreateIndex(
                name: "IX_order_services_OrderId_EventServiceId",
                table: "order_services",
                columns: new[] { "OrderId", "EventServiceId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_order_services_event_services_EventServiceId",
                table: "order_services",
                column: "EventServiceId",
                principalTable: "event_services",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_orders_premises_PremiseId",
                table: "orders",
                column: "PremiseId",
                principalTable: "premises",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_orders_users_ClientId",
                table: "orders",
                column: "ClientId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_orders_users_ManagerId",
                table: "orders",
                column: "ManagerId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "LegacyEstimate", table: "orders");
            migrationBuilder.DropForeignKey(
                name: "FK_order_services_event_services_EventServiceId",
                table: "order_services");

            migrationBuilder.DropForeignKey(
                name: "FK_orders_premises_PremiseId",
                table: "orders");

            migrationBuilder.DropForeignKey(
                name: "FK_orders_users_ClientId",
                table: "orders");

            migrationBuilder.DropForeignKey(
                name: "FK_orders_users_ManagerId",
                table: "orders");

            migrationBuilder.DropIndex(
                name: "IX_orders_PremiseId_EventDate_EndDate",
                table: "orders");

            migrationBuilder.DropIndex(
                name: "IX_order_services_OrderId_EventServiceId",
                table: "order_services");

            migrationBuilder.DropColumn(
                name: "ClientLimit",
                table: "users");

            migrationBuilder.DropColumn(
                name: "Phone",
                table: "users");

            migrationBuilder.DropColumn(
                name: "ImageUrl",
                table: "premises");

            migrationBuilder.DropColumn(
                name: "EndDate",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "PremiseAddress",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "PremiseName",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "RentalAmount",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "RentalRate",
                table: "orders");

            migrationBuilder.DropColumn(
                name: "Amount",
                table: "order_services");

            migrationBuilder.DropColumn(
                name: "Category",
                table: "order_services");

            migrationBuilder.DropColumn(
                name: "Name",
                table: "order_services");

            migrationBuilder.DropColumn(
                name: "UnitPrice",
                table: "order_services");

            migrationBuilder.CreateIndex(
                name: "IX_orders_PremiseId",
                table: "orders",
                column: "PremiseId");

            migrationBuilder.CreateIndex(
                name: "IX_order_services_OrderId",
                table: "order_services",
                column: "OrderId");

            migrationBuilder.AddForeignKey(
                name: "FK_order_services_event_services_EventServiceId",
                table: "order_services",
                column: "EventServiceId",
                principalTable: "event_services",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_orders_premises_PremiseId",
                table: "orders",
                column: "PremiseId",
                principalTable: "premises",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_orders_users_ClientId",
                table: "orders",
                column: "ClientId",
                principalTable: "users",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_orders_users_ManagerId",
                table: "orders",
                column: "ManagerId",
                principalTable: "users",
                principalColumn: "Id");
        }
    }
}
