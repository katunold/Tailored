import { Router } from "express";
import { AppContext } from "../app.ts";
import { UpsertCurrentMeasurementSchema } from "../validation/schemas.ts";

export function measurementsRouter(ctx: AppContext) {
  const route = Router();

  // GET /api/measurements/current?clientId=...&itemTypeId=...
  route.get("/current", async (req, res) => {
    const clientId = String(req.query.clientId || "");
    const itemTypeId = String(req.query.itemTypeId || "");
    if (!clientId || !itemTypeId) return res.status(400).json({ error: "clientId and itemTypeId required" });

    const cm = await ctx.prisma.currentMeasurement.findUnique({
      where: { clientId_itemTypeId: { clientId, itemTypeId } },
    });

    res.json(cm ? { ...cm, values: JSON.parse(cm.valuesJson) } : null);
  });

  // PUT /api/measurements/current/:clientId/:itemTypeId
  route.put("/current/:clientId/:itemTypeId", async (req, res) => {
    const { clientId, itemTypeId } = req.params;
    const dto = UpsertCurrentMeasurementSchema.parse(req.body);

    const saved = await ctx.prisma.currentMeasurement.upsert({
      where: { clientId_itemTypeId: { clientId, itemTypeId } },
      update: { valuesJson: JSON.stringify(dto.values) },
      create: { clientId, itemTypeId, valuesJson: JSON.stringify(dto.values) },
    });

    res.json({ ...saved, values: dto.values });
  });

  return route;
}
