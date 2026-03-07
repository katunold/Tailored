-- Move legacy client-wide profiles into per-product current measurements.
INSERT INTO "current_measurements" ("client_id", "item_type_id", "values_json", "updated_at")
SELECT cmp."client_id", it."id", cmp."values_json", cmp."updated_at"
FROM "client_measurement_profiles" cmp
JOIN "item_types" it ON 1 = 1
LEFT JOIN "current_measurements" cm
  ON cm."client_id" = cmp."client_id" AND cm."item_type_id" = it."id"
WHERE cm."id" IS NULL;

DROP TABLE IF EXISTS "client_measurement_profiles";
