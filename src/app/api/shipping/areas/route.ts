import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  BITESHIP_API,
  authHeader,
  classifyFailure,
  parseAreas,
  type BiteshipArea,
} from "@/lib/shipping/biteship";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const TIMEOUT_MS = 6000;

/**
 * Look up an Indonesian address area.
 *
 * Server-side because it needs the Biteship key, which cannot go near a
 * browser. The response is deliberately thin — the fields the address form
 * fills in, and the area id — rather than Biteship's payload, so the form is
 * not coupled to their field names.
 *
 * Returns an empty list rather than an error whenever the lookup cannot run:
 * no key configured, the shop on flat zones, Biteship down. The form falls
 * back to plain typing in that case, which is what it did before this existed.
 * A customer must never be unable to give their address because a courier's
 * API is having a bad afternoon.
 */
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  // Two characters match half of Indonesia and cost a request each keystroke.
  if (query.length < 3) {
    return NextResponse.json({ areas: [] as BiteshipArea[] });
  }

  if (!env.optional("BITESHIP_API_KEY")) {
    return NextResponse.json({ areas: [] as BiteshipArea[], unavailable: true });
  }

  let response: Response;
  try {
    const url = new URL(`${BITESHIP_API}/v1/maps/areas`);
    url.searchParams.set("countries", "ID");
    url.searchParams.set("input", query);
    url.searchParams.set("type", "single");

    response = await fetch(url, {
      headers: { authorization: authHeader() },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    console.warn("biteship: area lookup failed", error);
    return NextResponse.json({ areas: [] as BiteshipArea[], unavailable: true });
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const failure = classifyFailure(response.status, payload);
    // An auth or balance problem is the operator's to fix and will not come
    // right on its own, so it is worth saying out loud in the log. The
    // customer still just sees a form they can type into.
    if (failure.kind === "auth" || failure.kind === "balance") {
      console.error("biteship: area lookup rejected", failure);
    }
    return NextResponse.json({ areas: [] as BiteshipArea[], unavailable: true });
  }

  const areas = parseAreas(payload).slice(0, 8);

  // Signed-in or not, this is a lookup a customer needs at checkout, so it is
  // open. The session read is only to keep the response uncached per-user by
  // Next's router cache heuristics.
  await getSession();

  return NextResponse.json({ areas });
}
