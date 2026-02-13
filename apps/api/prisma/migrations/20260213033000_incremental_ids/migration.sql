PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS "order_items";
DROP TABLE IF EXISTS "orders";
DROP TABLE IF EXISTS "current_measurements";
DROP TABLE IF EXISTS "measurement_templates";
DROP TABLE IF EXISTS "item_type_defaults";
DROP TABLE IF EXISTS "client_measurement_profiles";
DROP TABLE IF EXISTS "item_types";
DROP TABLE IF EXISTS "clients";

CREATE TABLE "clients" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

CREATE TABLE "item_types" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE "measurement_templates" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "item_type_id" INTEGER NOT NULL,
    "fields_json" TEXT NOT NULL,
    CONSTRAINT "measurement_templates_item_type_id_fkey" FOREIGN KEY ("item_type_id") REFERENCES "item_types" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "current_measurements" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "client_id" INTEGER NOT NULL,
    "item_type_id" INTEGER NOT NULL,
    "values_json" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "current_measurements_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "current_measurements_item_type_id_fkey" FOREIGN KEY ("item_type_id") REFERENCES "item_types" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "client_measurement_profiles" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "client_id" INTEGER NOT NULL,
    "values_json" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "client_measurement_profiles_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "orders" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "client_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLACED',
    "due_date" DATETIME,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "order_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "order_id" INTEGER NOT NULL,
    "item_type_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "color" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "measurement_snapshot_json" TEXT NOT NULL,
    "notes" TEXT,
    CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "order_items_item_type_id_fkey" FOREIGN KEY ("item_type_id") REFERENCES "item_types" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "item_type_defaults" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "item_type_id" INTEGER NOT NULL,
    "default_material" TEXT NOT NULL,
    "default_color" TEXT NOT NULL,
    CONSTRAINT "item_type_defaults_item_type_id_fkey" FOREIGN KEY ("item_type_id") REFERENCES "item_types" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "clients_phone_key" ON "clients"("phone");
CREATE INDEX "clients_full_name_idx" ON "clients"("full_name");
CREATE UNIQUE INDEX "item_types_name_key" ON "item_types"("name");
CREATE UNIQUE INDEX "measurement_templates_item_type_id_key" ON "measurement_templates"("item_type_id");
CREATE UNIQUE INDEX "current_measurements_client_id_item_type_id_key" ON "current_measurements"("client_id", "item_type_id");
CREATE UNIQUE INDEX "client_measurement_profiles_client_id_key" ON "client_measurement_profiles"("client_id");
CREATE INDEX "orders_status_idx" ON "orders"("status");
CREATE INDEX "orders_client_id_created_at_idx" ON "orders"("client_id", "created_at");
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");
CREATE UNIQUE INDEX "item_type_defaults_item_type_id_key" ON "item_type_defaults"("item_type_id");

PRAGMA foreign_keys=ON;
