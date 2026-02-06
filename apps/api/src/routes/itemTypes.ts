import { Router } from "express";
import { AppContext } from "../app.ts";
import { z } from "zod";

const UpdateDefaultsSchema = z.object({
  defaultColor: z.string().min(1),
  defaultMaterial: z.string().min(1),
});

export function itemTypesRouter(ctx: AppContext) {
  const route = Router();

  route.get("/", async (_req, res) => {
    const types = await ctx.prisma.itemType.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      include: { defaults: true, measurementTemplate: true },
    });
    res.json(types);
  });

  route.get("/:id/template", async (req, res) => {
    const id = req.params.id;
    const tpl = await ctx.prisma.measurementTemplate.findUnique({
      where: { itemTypeId: id },
    });
    if (!tpl) return res.status(404).json({ error: "Template not found" });
    res.json({ itemTypeId: id, fields: JSON.parse(tpl.fieldsJson) });
  });

  route.get("/:id/defaults", async (req, res) => {
    const id = req.params.id;
    const d = await ctx.prisma.itemTypeDefaults.findUnique({ where: { itemTypeId: id } });
    if (!d) return res.status(404).json({ error: "Defaults not found" });
    res.json(d);
  });

  route.put("/:id/defaults", async (req, res) => {
    const id = req.params.id;
    const dto = UpdateDefaultsSchema.parse(req.body);

    const saved = await ctx.prisma.itemTypeDefaults.upsert({
      where: { itemTypeId: id },
      update: dto,
      create: { itemTypeId: id, ...dto },
    });

    res.json(saved);
  });

  return route;
}
