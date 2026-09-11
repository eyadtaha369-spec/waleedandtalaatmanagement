import { createClient } from "@supabase/supabase-js";

// SERVER-ONLY. Never import this file from client code — it uses the
// service role key, which must never reach the browser bundle. Because
// this file has no "use client" marker and only the server function in
// team-actions.ts imports it, TanStack Start's server-function bundling
// keeps it out of the client chunk.
export function createAdminClient() {
  const url = process.env['VITE_SUPABASE_URL'];
  const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !serviceKey) {
    throw new Error("Server is missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
