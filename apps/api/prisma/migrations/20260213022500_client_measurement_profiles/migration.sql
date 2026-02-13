-- CreateTable
CREATE TABLE "client_measurement_profiles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "client_id" TEXT NOT NULL,
    "values_json" TEXT NOT NULL,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "client_measurement_profiles_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "client_measurement_profiles_client_id_key" ON "client_measurement_profiles"("client_id");
