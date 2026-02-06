-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "full_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "item_types" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "measurement_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "item_type_id" TEXT NOT NULL,
    "fields_json" TEXT NOT NULL,
    CONSTRAINT "measurement_templates_item_type_id_fkey" FOREIGN KEY ("item_type_id") REFERENCES "item_types" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "current_measurements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client_id" TEXT NOT NULL,
    "item_type_id" TEXT NOT NULL,
    "values_json" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "current_measurements_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "current_measurements_item_type_id_fkey" FOREIGN KEY ("item_type_id") REFERENCES "item_types" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLACED',
    "due_date" DATETIME,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order_id" TEXT NOT NULL,
    "item_type_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "color" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "measurement_snapshot_json" TEXT NOT NULL,
    "notes" TEXT,
    CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "order_items_item_type_id_fkey" FOREIGN KEY ("item_type_id") REFERENCES "item_types" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "item_type_defaults" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "item_type_id" TEXT NOT NULL,
    "default_material" TEXT NOT NULL,
    "default_color" TEXT NOT NULL,
    CONSTRAINT "item_type_defaults_item_type_id_fkey" FOREIGN KEY ("item_type_id") REFERENCES "item_types" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_phone_key" ON "clients"("phone");

-- CreateIndex
CREATE INDEX "clients_full_name_idx" ON "clients"("full_name");

-- CreateIndex
CREATE UNIQUE INDEX "item_types_name_key" ON "item_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "measurement_templates_item_type_id_key" ON "measurement_templates"("item_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "current_measurements_client_id_item_type_id_key" ON "current_measurements"("client_id", "item_type_id");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_client_id_created_at_idx" ON "orders"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_type_defaults_item_type_id_key" ON "item_type_defaults"("item_type_id");
