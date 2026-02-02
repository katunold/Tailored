import express from 'express';

const app = express();
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

const port = Number(process.env.PORT ?? 4001);
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[api] listening on ${port}`);
});
