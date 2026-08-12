/**
 * Convert desktop font files (.otf / .ttf) in src/fonts/ to .woff2.
 *
 * Desktop formats are what you get when you buy a font, and they are 30-50%
 * larger than woff2 for identical rendering. Every visitor pays that
 * difference on every first load, so it is worth the one command.
 *
 *   npm run fonts:convert
 *
 * Originals are left in place — this only ever adds .woff2 files next to
 * them. Existing .woff2 files are skipped unless you pass --force.
 *
 * Requires Python with fonttools and brotli:
 *   pip install fonttools brotli
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const FONTS_DIR = join(import.meta.dirname, "..", "src", "fonts");
const force = process.argv.includes("--force");

function kb(bytes) {
  return `${Math.round(bytes / 1024)} KB`;
}

if (!existsSync(FONTS_DIR)) {
  console.error(`No such directory: ${FONTS_DIR}`);
  process.exit(1);
}

// Confirm the toolchain before touching anything, so a missing dependency is
// one clear message rather than a stack trace per file.
try {
  execFileSync("python3", ["-c", "import fontTools, brotli"], { stdio: "pipe" });
} catch {
  console.error(
    "Missing the conversion tools. Install them with:\n\n  pip install fonttools brotli\n",
  );
  process.exit(1);
}

const sources = readdirSync(FONTS_DIR).filter((name) =>
  /\.(otf|ttf)$/i.test(name),
);

if (!sources.length) {
  console.log("No .otf or .ttf files in src/fonts/ — nothing to convert.");
  console.log("Add your font files there first, then run this again.");
  process.exit(0);
}

let converted = 0;
let totalBefore = 0;
let totalAfter = 0;

for (const source of sources) {
  const input = join(FONTS_DIR, source);
  const output = input.replace(/\.(otf|ttf)$/i, ".woff2");

  if (existsSync(output) && !force) {
    console.log(`skip  ${source} — .woff2 already exists (use --force to redo)`);
    continue;
  }

  try {
    execFileSync(
      "python3",
      [
        "-c",
        [
          "import sys",
          "from fontTools.ttLib import TTFont",
          "f = TTFont(sys.argv[1])",
          "f.flavor = 'woff2'",
          "f.save(sys.argv[2])",
        ].join("\n"),
        input,
        output,
      ],
      { stdio: "pipe" },
    );

    const before = statSync(input).size;
    const after = statSync(output).size;
    totalBefore += before;
    totalAfter += after;
    converted++;

    const saved = Math.round((1 - after / before) * 100);
    console.log(
      `ok    ${source} → ${source.replace(/\.(otf|ttf)$/i, ".woff2")}  ` +
        `${kb(before)} → ${kb(after)} (${saved}% smaller)`,
    );
  } catch (error) {
    console.error(`FAIL  ${source}: ${error.message.split("\n")[0]}`);
  }
}

if (converted > 0) {
  const saved = Math.round((1 - totalAfter / totalBefore) * 100);
  console.log(
    `\n${converted} file(s): ${kb(totalBefore)} → ${kb(totalAfter)}, ${saved}% smaller overall.`,
  );
  console.log("Now point src/lib/fonts.ts at the .woff2 files.");
}
