import { Router } from "express";
import { AppContext } from "../app.ts";
import { UpsertCurrentMeasurementSchema } from "../validation/schemas.ts";

type ProfileRow = {
  id: number;
  client_id: number;
  values_json: string;
  updated_at: Date | string;
};

export function measurementsRouter(ctx: AppContext) {
  const route = Router();
  const parseId = (value: string): number | null => {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
  };

  // GET /api/measurements/fields
  route.get("/fields", async (_req, res) => {
    const templates = await ctx.prisma.measurementTemplate.findMany({
      select: { fieldsJson: true },
    });

    const byKey = new Map<string, { key: string; label: string; type: string; required: boolean }>();

    for (const tpl of templates) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(tpl.fieldsJson);
      } catch {
        continue;
      }

      const fields = Array.isArray(parsed) ? parsed : [];

      for (const field of fields) {
        if (!field || typeof field !== "object") continue;

        const f = field as {
          key?: string;
          label?: string;
          type?: string;
          required?: boolean;
        };

        const key = String(f.key || "").trim();
        if (!key) continue;

        const existing = byKey.get(key);
        const normalized = {
          key,
          label: String(f.label || key),
          type: f.type === "text" ? "text" : "number",
          required: Boolean(f.required),
        };

        if (!existing) {
          byKey.set(key, normalized);
          continue;
        }

        byKey.set(key, {
          ...existing,
          required: existing.required || normalized.required,
        });
      }
    }

    // Fallback: if templates are missing/broken, derive known keys from stored profile/current values.
    if (byKey.size === 0) {
      const knownValuesRows = (await ctx.prisma.$queryRawUnsafe(
        `SELECT values_json FROM client_measurement_profiles
         UNION ALL
         SELECT values_json FROM current_measurements`
      )) as Array<{ values_json: string }>;

      for (const row of knownValuesRows) {
        let values: unknown;
        try {
          values = JSON.parse(row.values_json);
        } catch {
          continue;
        }

        if (!values || typeof values !== "object" || Array.isArray(values)) {
          continue;
        }

        for (const key of Object.keys(values)) {
          const trimmed = key.trim();
          if (!trimmed || byKey.has(trimmed)) continue;

          const label = trimmed
            .replace(/[_-]+/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());

          byKey.set(trimmed, {
            key: trimmed,
            label,
            type: "number",
            required: false,
          });
        }
      }
    }

    const fields = Array.from(byKey.values()).sort((a, b) => a.label.localeCompare(b.label));
    res.json(fields);
  });

  // GET /api/measurements/profile/:clientId
  route.get("/profile/:clientId", async (req, res) => {
    const clientId = parseId(req.params.clientId);
    if (clientId === null) return res.status(400).json({ error: "Invalid client id" });

    const rows = (await ctx.prisma.$queryRawUnsafe(
      `SELECT id, client_id, values_json, updated_at
       FROM client_measurement_profiles
       WHERE client_id = ?
       LIMIT 1`,
      clientId
    )) as ProfileRow[];
    const profile = rows[0] ?? null;

    res.json(
      profile
        ? {
            id: profile.id,
            clientId: profile.client_id,
            valuesJson: profile.values_json,
            updatedAt: profile.updated_at,
            values: JSON.parse(profile.values_json),
          }
        : null
    );
  });

  // PUT /api/measurements/profile/:clientId
  route.put("/profile/:clientId", async (req, res) => {
    const clientId = parseId(req.params.clientId);
    if (clientId === null) return res.status(400).json({ error: "Invalid client id" });
    const dto = UpsertCurrentMeasurementSchema.parse(req.body);
    const valuesJson = JSON.stringify(dto.values);

    const existingRows = (await ctx.prisma.$queryRawUnsafe(
      `SELECT id FROM client_measurement_profiles WHERE client_id = ? LIMIT 1`,
      clientId
    )) as Array<{ id: number }>;
    const existing = existingRows[0] ?? null;

    if (existing) {
      await ctx.prisma.$executeRawUnsafe(
        `UPDATE client_measurement_profiles
         SET values_json = ?, updated_at = CURRENT_TIMESTAMP
         WHERE client_id = ?`,
        valuesJson,
        clientId
      );
    } else {
      await ctx.prisma.$executeRawUnsafe(
        `INSERT INTO client_measurement_profiles (client_id, values_json, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)`,
        clientId,
        valuesJson
      );
    }

    const savedRows = (await ctx.prisma.$queryRawUnsafe(
      `SELECT id, client_id, values_json, updated_at
       FROM client_measurement_profiles
       WHERE client_id = ?
       LIMIT 1`,
      clientId
    )) as ProfileRow[];
    const saved = savedRows[0];

    res.json({
      id: saved.id,
      clientId: saved.client_id,
      valuesJson: saved.values_json,
      updatedAt: saved.updated_at,
      values: dto.values,
    });
  });

  return route;
}
