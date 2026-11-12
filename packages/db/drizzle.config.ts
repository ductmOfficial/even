import { defineConfig } from "drizzle-kit";

// Generates SQL migrations from src/schema.ts. The app applies them itself (src/migrate.ts),
// in the browser and in tests, so drizzle-kit never needs a database connection.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
});
