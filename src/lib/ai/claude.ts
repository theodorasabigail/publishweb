import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type * as z from "zod/v4";
import { env } from "@/lib/env";

/**
 * The one place the site talks to Claude.
 *
 * Used to read things people write the way people write them -- a WhatsApp
 * order, "Gayo 200g stock 12" -- into the exact shape the shop's own code then
 * checks and saves. Claude never writes to the database: everything it returns
 * is shown to the operator first, and every id it names is checked against
 * the catalogue on the way back.
 *
 * Optional. With no ANTHROPIC_API_KEY the callers fall back to plainer
 * matching, so nothing on the site depends on this being set up.
 */

/** Overridable without a code change, e.g. ANTHROPIC_MODEL=claude-haiku-5-5. */
const DEFAULT_MODEL = "claude-opus-5-5";

export function aiConfigured(): boolean {
  return Boolean(env.optional("ANTHROPIC_API_KEY"));
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic({ apiKey: env.optional("ANTHROPIC_API_KEY") });
  return client;
}

export class AiUnavailableError extends Error {}

/**
 * Ask Claude to read `text` into `schema`.
 *
 * Throws AiUnavailableError with a message the operator can act on when there
 * is no key, the key is wrong, the account is out of credit, or Claude
 * declines -- callers show that message and keep the plain path working.
 */
export async function readStructured<Schema extends z.ZodType>({
  schema,
  system,
  text,
  image,
}: {
  schema: Schema;
  system: string;
  text: string;
  /** A picture to read alongside the text -- a screenshot, a photo of a list. */
  image?: { data: Buffer; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" };
}): Promise<z.infer<Schema>> {
  if (!aiConfigured()) {
    throw new AiUnavailableError(
      "Reading messages with AI is not switched on. Add ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables, then redeploy.",
    );
  }

  let response;
  try {
    response = await getClient().beta.messages.parse({
      model: env.optional("ANTHROPIC_MODEL") ?? DEFAULT_MODEL,
      max_tokens: 16000,
      // If the model declines for policy reasons, let the API retry on its
      // own default fallback model rather than leaving the operator stuck.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [
        {
          role: "user",
          content: image
            ? [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: image.mediaType,
                    data: image.data.toString("base64"),
                  },
                },
                { type: "text", text },
              ]
            : text,
        },
      ],
      output_config: {
        effort: "medium",
        format: betaZodOutputFormat(schema),
      },
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      throw new AiUnavailableError(
        "The Anthropic key was not accepted. Check ANTHROPIC_API_KEY in Vercel, then redeploy.",
      );
    }
    if (error instanceof Anthropic.PermissionDeniedError) {
      throw new AiUnavailableError(
        "The Anthropic account refused the request — it may be out of credit. Check console.anthropic.com.",
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new AiUnavailableError("Too many requests at once — wait a moment and try again.");
    }
    if (error instanceof Anthropic.BadRequestError && /credit|billing/i.test(error.message)) {
      throw new AiUnavailableError(
        "The Anthropic account is out of credit. Top it up at console.anthropic.com.",
      );
    }
    if (error instanceof Anthropic.APIError) {
      console.error("claude: request failed", error.status, error.message);
      throw new AiUnavailableError("Could not reach the AI just now. Try again in a moment.");
    }
    throw error;
  }

  if (response.stop_reason === "refusal") {
    throw new AiUnavailableError("The AI would not read that message. Fill this one in by hand.");
  }
  if (!response.parsed_output) {
    throw new AiUnavailableError("The AI's answer could not be read. Try again, or fill it in by hand.");
  }
  return response.parsed_output;
}
