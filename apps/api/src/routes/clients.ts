import { Router } from "express";
import { AppContext } from "../app.ts";
import { CreateClientSchema, UpdateClientSchema } from "../validation/schemas.ts";

export function clientsRouter(ctx: AppContext) {
  const route = Router();

  route.get("/", async (req, res) => {
    const q = String(req.query.query || "").trim();

    const clients = await ctx.prisma.client.findMany({
      where: q
        ? {
            OR: [
              { fullName: { contains: q } },
              { phone: { contains: q } },
            ],
          }
        : undefined,
      orderBy: { updatedAt: "desc" },
      take: 50,
    });

    res.json(clients);
  });

  route.post("/", async (req, res) => {
    const dto = CreateClientSchema.parse(req.body);
    const created = await ctx.prisma.client.create({ data: dto });
    res.status(201).json(created);
  });

  route.get("/:id", async (req, res) => {
    const id = req.params.id;
    const client = await ctx.prisma.client.findUnique({ where: { id } });
    if (!client) return res.status(404).json({ error: "Client not found" });
    res.json(client);
  });

  route.put("/:id", async (req, res) => {
    const id = req.params.id;
    const dto = UpdateClientSchema.parse(req.body);
    const updated = await ctx.prisma.client.update({ where: { id }, data: dto });
    res.json(updated);
  });

  return route;
}
