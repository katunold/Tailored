-- Convert stored measurement JSON values and template field metadata to text-based measurements.
UPDATE "measurement_templates"
SET "fields_json" = COALESCE(
  (
    SELECT json_group_array(json(json_set(value, '$.type', 'text')))
    FROM json_each("measurement_templates"."fields_json")
  ),
  '[]'
)
WHERE "fields_json" IS NOT NULL
  AND json_valid("fields_json");

UPDATE "current_measurements"
SET "values_json" = COALESCE(
  (
    SELECT json_group_object(key, CAST(value AS TEXT))
    FROM json_each("current_measurements"."values_json")
  ),
  '{}'
)
WHERE "values_json" IS NOT NULL
  AND json_valid("values_json");

UPDATE "order_items"
SET "measurement_snapshot_json" = COALESCE(
  (
    SELECT json_group_object(key, CAST(value AS TEXT))
    FROM json_each("order_items"."measurement_snapshot_json")
  ),
  '{}'
)
WHERE "measurement_snapshot_json" IS NOT NULL
  AND json_valid("measurement_snapshot_json");
