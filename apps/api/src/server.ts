import { PrismaClient } from "@prisma/client";
import { createApp } from "./app.ts";

async function main() {
  const prisma = new PrismaClient();
  const app = createApp({ prisma });

  const port = Number(process.env.PORT || 3030);
  app.listen(port, () => console.log(`API running on http://127.0.0.1:${port}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
