"use client";

import { useState } from "react";
import { slugify } from "@/lib/utils";

/**
 * Title and URL slug together. The slug follows the title until the operator
 * edits it, then it stops moving -- so renaming a published post never
 * silently breaks its link.
 */
export function TitleAndSlug({
  titleName,
  slugName,
  titleLabel,
  defaultTitle = "",
  defaultSlug = "",
  prefix,
}: {
  titleName: string;
  slugName: string;
  titleLabel: string;
  defaultTitle?: string;
  defaultSlug?: string;
  prefix: string;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [slug, setSlug] = useState(defaultSlug);
  const [slugTouched, setSlugTouched] = useState(Boolean(defaultSlug));

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="label" htmlFor={titleName}>
          {titleLabel} *
        </label>
        <input
          id={titleName}
          name={titleName}
          className="input"
          required
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (!slugTouched) setSlug(slugify(event.target.value));
          }}
        />
      </div>

      <div>
        <label className="label" htmlFor={slugName}>
          Web address
        </label>
        <div className="flex items-center gap-1.5">
          <span className="shrink-0 text-xs text-bark-500">{prefix}</span>
          <input
            id={slugName}
            name={slugName}
            className="input font-mono text-xs"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            onBlur={(event) => setSlug(slugify(event.target.value))}
          />
        </div>
        <p className="mt-1.5 text-xs text-bark-500">
          Changing this breaks any existing links to the page.
        </p>
      </div>
    </div>
  );
}
