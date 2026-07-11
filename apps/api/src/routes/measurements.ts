import { Router } from "express";
import { AppContext } from "../app.ts";
import { UpsertCurrentMeasurementSchema } from "../validation/schemas.ts";

type MeasurementField = {
  key: string;
  label: string;
  type: "number" | "text";
  required: boolean;
};

const DEFAULT_MEASUREMENT_FIELDS = [
  { key: "neck", label: "Neck", type: "text", required: false },
  { key: "cabba", label: "Cabba", type: "text", required: false },
  { key: "sleeves", label: "Sleeves", type: "text", required: false },
  { key: "length", label: "Length", type: "text", required: false },
  { key: "bust", label: "Bust", type: "text", required: false },
  { key: "waist", label: "Waist", type: "text", required: false },
  { key: "shoulders", label: "Shoulders", type: "text", required: false },
  { key: "width", label: "Width", type: "text", required: false },
] as const;

function parseFieldsJson(fieldsJson: string): MeasurementField[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fieldsJson);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const fields: MeasurementField[] = [];
  for (const field of parsed) {
    if (!field || typeof field !== "object") continue;
    const f = field as {
      key?: string;
      label?: string;
      type?: string;
      required?: boolean;
    };

    const key = String(f.key || "").trim();
    if (!key) continue;

    fields.push({
      key,
      label: String(f.label || key),
      type: f.type === "number" ? "number" : "text",
      required: Boolean(f.required),
    });
  }

  return fields;
}

function normalizeMeasurementValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function normalizeMeasurementValues(values: Record<string, unknown>): Record<string, string> {
  return Object.entries(values).reduce<Record<string, string>>((acc, [key, value]) => {
    const normalized = normalizeMeasurementValue(value);
    if (normalized !== null) {
      acc[key] = normalized;
    }
    return acc;
  }, {});
}

function parseValuesJson(valuesJson: string | null): Record<string, string> {
  if (!valuesJson) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(valuesJson);
  } catch {
    return {};
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }

  return normalizeMeasurementValues(parsed as Record<string, unknown>);
}

export function measurementsRouter(ctx: AppContext) {
  const route = Router();
  const parseId = (value: string): number | null => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  };

  // GET /api/measurements/fields
  route.get("/fields", async (req, res) => {
    const itemTypeIdRaw = String(req.query.itemTypeId || "").trim();
    const itemTypeId = itemTypeIdRaw ? parseId(itemTypeIdRaw) : null;

    if (itemTypeIdRaw && itemTypeId === null) {
      return res.status(400).json({ error: "Invalid item type id" });
    }

    let templatesToUse: Array<{ fieldsJson: string }> = [];
    if (itemTypeId === null) {
      templatesToUse = await ctx.prisma.measurementTemplate.findMany({
        select: { fieldsJson: true },
      });
    } else {
      const scopedTemplate = await ctx.prisma.measurementTemplate.findUnique({
        where: { itemTypeId },
        select: { fieldsJson: true },
      });
      templatesToUse = scopedTemplate ? [scopedTemplate] : [];
    }

    const byKey = new Map<string, MeasurementField>();

    for (const tpl of templatesToUse) {
      for (const field of parseFieldsJson(tpl.fieldsJson)) {
        const key = field.key;
        const existing = byKey.get(key);
        if (!existing) {
          byKey.set(key, field);
          continue;
        }

        byKey.set(key, {
          ...existing,
          required: existing.required || field.required,
        });
      }
    }

    // Fallback: if templates are missing/broken, derive known keys from stored item measurements.
    if (byKey.size === 0) {
      const knownValuesRows = (await ctx.prisma.$queryRawUnsafe(
        itemTypeId === null
          ? `SELECT values_json FROM current_measurements`
          : `SELECT values_json FROM current_measurements WHERE item_type_id = ?`,
        ...(itemTypeId === null ? [] : [itemTypeId])
      )) as Array<{ values_json: string }>;

      for (const row of knownValuesRows) {
        for (const key of Object.keys(parseValuesJson(row.values_json))) {
          const trimmed = key.trim();
          if (!trimmed || byKey.has(trimmed)) continue;

          const label = trimmed
            .replace(/[_-]+/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());

          byKey.set(trimmed, {
            key: trimmed,
            label,
            type: "text",
            required: false,
          });
        }
      }
    }

    if (byKey.size === 0) {
      for (const field of DEFAULT_MEASUREMENT_FIELDS) {
        byKey.set(field.key, { ...field });
      }
    }

    const fields = Array.from(byKey.values()).sort((a, b) => a.label.localeCompare(b.label));
    res.json(fields);
  });

  // GET /api/measurements/profile/:clientId
  route.get("/profile/:clientId", async (req, res) => {
    const clientId = parseId(req.params.clientId);
    if (clientId === null) return res.status(400).json({ error: "Invalid client id" });

    const itemTypeIdRaw = String(req.query.itemTypeId || "").trim();
    const itemTypeId = itemTypeIdRaw ? parseId(itemTypeIdRaw) : null;
    if (itemTypeIdRaw && itemTypeId === null) {
      return res.status(400).json({ error: "Invalid item type id" });
    }

    const itemTypes = await ctx.prisma.itemType.findMany({
      where: { isActive: true, ...(itemTypeId === null ? {} : { id: itemTypeId }) },
      orderBy: { name: "asc" },
      include: {
        measurementTemplate: true,
        currentMeasures: {
          where: { clientId },
          take: 1,
        },
      },
    });

    if (itemTypeId !== null && itemTypes.length === 0) {
      return res.status(404).json({ error: "Item type not found" });
    }

    const products = itemTypes.map((itemTypeRow) => {
      const current = itemTypeRow.currentMeasures[0] ?? null;
      return {
        itemTypeId: itemTypeRow.id,
        itemTypeName: itemTypeRow.name,
        fields: itemTypeRow.measurementTemplate ? parseFieldsJson(itemTypeRow.measurementTemplate.fieldsJson) : [],
        measurementId: current?.id ?? null,
        valuesJson: current?.valuesJson ?? null,
        updatedAt: current?.updatedAt ?? null,
        values: parseValuesJson(current?.valuesJson ?? null),
      };
    });

    if (itemTypeId !== null) {
      return res.json(products[0] ?? null);
    }

    res.json({ clientId, products });
  });

  // PUT /api/measurements/profile/:clientId/:itemTypeId
  route.put("/profile/:clientId/:itemTypeId", async (req, res) => {
    const clientId = parseId(req.params.clientId);
    if (clientId === null) return res.status(400).json({ error: "Invalid client id" });
    const itemTypeId = parseId(req.params.itemTypeId);
    if (itemTypeId === null) return res.status(400).json({ error: "Invalid item type id" });
    const dto = UpsertCurrentMeasurementSchema.parse(req.body);
    const normalizedValues = normalizeMeasurementValues(dto.values);
    const valuesJson = JSON.stringify(normalizedValues);

    const itemType = await ctx.prisma.itemType.findUnique({
      where: { id: itemTypeId },
      include: { measurementTemplate: true },
    });
    if (!itemType) {
      return res.status(404).json({ error: "Item type not found" });
    }

    const saved = await ctx.prisma.currentMeasurement.upsert({
      where: { clientId_itemTypeId: { clientId, itemTypeId } },
      update: { valuesJson },
      create: { clientId, itemTypeId, valuesJson },
    });

    res.json({
      id: saved.id,
      clientId: saved.clientId,
      itemTypeId: saved.itemTypeId,
      itemTypeName: itemType.name,
      fields: itemType.measurementTemplate ? parseFieldsJson(itemType.measurementTemplate.fieldsJson) : [],
      valuesJson: saved.valuesJson,
      updatedAt: saved.updatedAt,
      values: normalizedValues,
    });
  });

  return route;
}
