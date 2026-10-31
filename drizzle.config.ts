import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  // Schema DDL is maintained as reviewed SQL because it includes Supabase auth/storage,
  // RLS policies, SECURITY DEFINER functions, triggers, and workflow transitions.
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
