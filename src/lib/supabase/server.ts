import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { env } from "@/lib/env";

/** Request-scoped Supabase client that carries the signed-in user's session.
 *  RLS applies, so this is what every user-facing read should go through. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Session refresh is handled by the middleware instead.
        }
      },
    },
  });
}

/** Read-only client for static/ISR rendering, where there is no request cookie
 *  jar to read. Sees only what an anonymous visitor can see. */
export function createStaticClient() {
  return createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
