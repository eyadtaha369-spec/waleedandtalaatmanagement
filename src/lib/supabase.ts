import { createClient } from "@supabase/supabase-js";

const env = import.meta.env as Record<string, string | undefined>;
const supabaseUrl = env["VITE_SUPABASE_URL"] as string;
const supabaseKey = env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string;

if (!supabaseUrl || !supabaseKey) {
  console.warn("Supabase env vars are missing (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).");
}

export const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseKey || "placeholder-anon-key");
