"use client";

import { useState } from "react";

export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setState("saving");
    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "footer" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Something went wrong");
      setState("done");
      setMessage("You're on the list. We only send when there's something to say.");
      setEmail("");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "Something went wrong");
    }
  }

  return (
    <div className="rounded-2xl border border-sea-800 bg-sea-900/60 p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-serif text-lg text-cream">The Journal, by email</p>
          <p className="mt-1.5 max-w-md text-sm text-sea-300">
            New lots, roasting notes, and the occasional argument about water.
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex w-full gap-2 sm:w-auto">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@email.com"
            aria-label="Email address"
            className="w-full rounded-full border border-sea-700 bg-sea-950 px-4 py-2.5 text-sm text-cream placeholder:text-sea-500 focus:border-sea-400 focus:outline-none sm:w-64"
          />
          <button
            type="submit"
            disabled={state === "saving"}
            className="btn shrink-0 bg-cream text-sea-950 hover:bg-white"
          >
            {state === "saving" ? "…" : "Subscribe"}
          </button>
        </form>
      </div>

      {message && (
        <p
          className={`mt-3 text-sm ${state === "error" ? "text-red-300" : "text-sea-200"}`}
          role="status"
        >
          {message}
        </p>
      )}
    </div>
  );
}
