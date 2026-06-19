import fs from "node:fs";
import { env, validateEnv } from "./config";
import { createApp } from "./app";
import { connectDb } from "./db";

async function main() {
  validateEnv();
  fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });
  await connectDb();

  const app = createApp();

  app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

