import { marked } from "marked";

/**
 * Blog bodies are written in the admin editor as Markdown.
 *
 * Raw HTML in the source is escaped rather than passed through. The editor is
 * admin-only, but a stored-XSS hole in a shop's blog is not worth the
 * convenience of inline <div>s, and nothing in the editor's toolbar needs them.
 */
marked.setOptions({
  gfm: true,
  breaks: false,
});

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function renderMarkdown(source: string | null | undefined): string {
  if (!source) return "";
  return marked.parse(escapeHtml(source), { async: false });
}

/** Plain text version, for excerpts, meta descriptions and RSS summaries. */
export function markdownToPlainText(source: string | null | undefined): string {
  if (!source) return "";
  return source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
