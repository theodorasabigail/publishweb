/**
 * Environment access with a single, honest failure mode.
 *
 * The site is deployed by a non-developer, so a missing variable must produce a
 * message that names the variable and says where to paste it -- never a stack
 * trace about `undefined`.
 */

function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export function requireEnv(name: string): string {
  const value = read(name);
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Add it in Vercel → Settings → Environment Variables, then redeploy. See docs/OPERATOR_SETUP.md.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: () => requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: () => requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  optional: read,
};

/** True when Supabase credentials are present. Lets pages degrade gracefully
 *  during the very first deploy, before the operator has pasted the keys in. */
export function isSupabaseConfigured(): boolean {
  return Boolean(read("NEXT_PUBLIC_SUPABASE_URL") && read("NEXT_PUBLIC_SUPABASE_ANON_KEY"));
}

export function siteUrl(): string {
  const explicit = read("NEXT_PUBLIC_SITE_URL");
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = read("VERCEL_PROJECT_PRODUCTION_URL") ?? read("VERCEL_URL");
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}
