"use client";

import { createBrowserClient } from "@supabase/ssr";

/** Supabase client for browser components. Uses the anon key, so every read and
 *  write is still subject to Row Level Security. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
