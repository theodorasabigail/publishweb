import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** OAuth and email-confirmation landing point: swaps the code for a session
 *  cookie, then sends the customer where they were originally headed. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");
  const next =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//")
      ? nextParam
      : "/account";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(new URL("/login?error=auth_failed", url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
