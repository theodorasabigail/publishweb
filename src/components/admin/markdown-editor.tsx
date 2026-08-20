"use client";

import { useRef, useState } from "react";
import {
  Bold,
  Eye,
  Heading2,
  Italic,
  Link2,
  List,
  Pencil,
  Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The post editor.
 *
 * Markdown with a formatting toolbar and a live preview, rather than a
 * WYSIWYG. The operator never has to type a symbol they do not want to --
 * the buttons do the wrapping -- and what gets stored stays clean enough that
 * the published typography is always ours, not pasted-in Word styling.
 */
const TOOLBAR = [
  { icon: Bold, label: "Bold", wrap: ["**", "**"], placeholder: "bold text" },
  { icon: Italic, label: "Italic", wrap: ["*", "*"], placeholder: "italic text" },
  { icon: Heading2, label: "Heading", wrap: ["\n## ", "\n"], placeholder: "Heading" },
  { icon: Quote, label: "Quote", wrap: ["\n> ", "\n"], placeholder: "A line worth pulling out" },
  { icon: List, label: "List", wrap: ["\n- ", ""], placeholder: "First item" },
  { icon: Link2, label: "Link", wrap: ["[", "](https://)"], placeholder: "link text" },
] as const;

export function MarkdownEditor({
  name,
  defaultValue = "",
}: {
  name: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function applyWrap(before: string, after: string, placeholder: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd } = textarea;
    const selected = value.slice(selectionStart, selectionEnd) || placeholder;
    const next =
      value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd);

    setValue(next);

    // Put the caret around the inserted text so the operator can just type.
    requestAnimationFrame(() => {
      textarea.focus();
      const start = selectionStart + before.length;
      textarea.setSelectionRange(start, start + selected.length);
    });
  }

  return (
    <div className="rounded-lg border border-bark-200">
      <div className="flex flex-wrap items-center gap-1 border-b border-bark-200 bg-bark-50 px-2 py-1.5">
        {TOOLBAR.map((item) => (
          <button
            key={item.label}
            type="button"
            title={item.label}
            onClick={() => applyWrap(item.wrap[0], item.wrap[1], item.placeholder)}
            className="rounded p-1.5 text-bark-600 hover:bg-white hover:text-bark-900"
          >
            <item.icon className="h-4 w-4" />
          </button>
        ))}

        <div className="ml-auto flex gap-1">
          <TabButton
            active={tab === "write"}
            onClick={() => setTab("write")}
            icon={Pencil}
            label="Write"
          />
          <TabButton
            active={tab === "preview"}
            onClick={() => setTab("preview")}
            icon={Eye}
            label="Preview"
          />
        </div>
      </div>

      {tab === "write" ? (
        <textarea
          ref={textareaRef}
          name={name}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="min-h-[420px] w-full resize-y rounded-b-lg px-4 py-3 font-mono text-sm leading-relaxed focus:outline-none"
          placeholder="Write the post here. Use the buttons above for headings, bold, quotes and links."
        />
      ) : (
        <>
          <input type="hidden" name={name} value={value} />
          <div className="min-h-[420px] px-4 py-3">
            <SimplePreview source={value} />
          </div>
        </>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Eye;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs",
        active ? "bg-white text-bark-900 shadow-sm" : "text-bark-600 hover:text-bark-900",
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

/**
 * A rough preview only. The published page is rendered server-side through the
 * real Markdown pipeline; this exists so the operator can sanity-check
 * structure without a round-trip.
 */
function SimplePreview({ source }: { source: string }) {
  if (!source.trim()) {
    return <p className="text-sm text-bark-600">Nothing to preview yet.</p>;
  }

  const blocks = source.split(/\n{2,}/);

  return (
    <div className="prose max-w-none">
      {blocks.map((block, index) => {
        const trimmed = block.trim();

        if (trimmed.startsWith("## ")) {
          return <h2 key={index}>{inline(trimmed.slice(3))}</h2>;
        }
        if (trimmed.startsWith("# ")) {
          return <h1 key={index}>{inline(trimmed.slice(2))}</h1>;
        }
        if (trimmed.startsWith("> ")) {
          return (
            <blockquote key={index}>
              {inline(trimmed.replace(/^> ?/gm, ""))}
            </blockquote>
          );
        }
        if (/^[-*] /.test(trimmed)) {
          return (
            <ul key={index}>
              {trimmed.split("\n").map((line, lineIndex) => (
                <li key={lineIndex}>{inline(line.replace(/^[-*] ?/, ""))}</li>
              ))}
            </ul>
          );
        }
        return <p key={index}>{inline(trimmed)}</p>;
      })}
    </div>
  );
}

/** Bold and italic only -- enough to judge the shape of a paragraph. */
function inline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}
