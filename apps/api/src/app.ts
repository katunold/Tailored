import { PrismaClient } from '@prisma/client';
import express from 'express';
import cors from 'cors';
import { clientsRouter } from './routes/clients.ts';
import { itemTypesRouter } from './routes/itemTypes.ts';
import { measurementsRouter } from './routes/measurements.ts';
import { ordersRouter } from './routes/orders.ts';

export type AppContext = {
  // add any shared context properties here, e.g. database connection, services, etc.
  prisma: PrismaClient
};

export function createApp(context: AppContext) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' })); // increase payload limit if needed

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/api/clients', clientsRouter(context));
  app.use('/api/item-types', itemTypesRouter(context));
  app.use('/api/measurements', measurementsRouter(context));
  app.use('/api/orders', ordersRouter(context));

    // basic error handler
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  });

  return app;

}
