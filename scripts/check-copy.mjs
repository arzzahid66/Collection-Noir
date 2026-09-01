#!/usr/bin/env node
/**
 * Brand copy and palette lint.
 *
 * The copy rules are easy to hold in mind while writing a page and easy to
 * lose three months later, so they are enforced here rather than left to
 * memory. Run with:  node scripts/check-copy.mjs
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/*
 * `.next-dev` and `.next-prod` are named individually rather than caught by
 * `.next`, because next.config.mjs gives the development server and a
 * production build a directory each: sharing one breaks whichever ran
 * second. Only `.next` was listed here, so a lint run with a dev server
 * still up read its compiled output and reported the source's own words back
 * as hundreds of violations.
 */
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  ".next-dev",
  ".next-prod",
  ".git",
  ".venv",
  "venv",
  "__pycache__",
  ".pytest_cache",
  ".playwright-mcp",
  "out",
]);

const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".py", ".md"]);

/**
 * Files whose job is to contain prohibited content, because they check for it.
 *
 * This lint necessarily lists every banned term. The test suites necessarily
 * assert that those terms and colours are absent from the site, which means
 * naming them. Linting them would be circular: the only way to satisfy it would
 * be to stop testing for the rule.
 *
 * This is a whole-file exemption rather than a per-line `copy-lint-ok`, kept
 * deliberately short. Nothing that renders to a visitor is on it.
 */
const SELF_CHECKING = new Set(
  [
    ["scripts", "check-copy.mjs"],
    ["scripts", "e2e.mjs"],
    ["backend", "tests", "test_catalogue.py"],
    ["backend", "tests", "test_api.py"],
  ].map((parts) => join(root, ...parts)),
);

/**
 * Prohibited lexicon, from section 02 of the Website Build Specification.
 *
 * That section names "luxury" and "stunning" specifically, then any adjective
 * doing the work the photography should be doing, and rules out conventional
 * e-commerce language because nothing is held in stock.
 *
 * An earlier revision of this list came from a separate build brief and banned
 * "timeless", "classic", "contemporary" and "centrepiece". Those four appear
 * inside the approved product copy in section 08, which section 11 makes
 * authoritative, so a lint that rejected them would have rejected the client's
 * own signed off wording. They have been removed and the change is logged in
 * PENDING_CHANGES.md.
 */
const BANNED_WORDS = [
  "luxury",
  "luxurious",
  "stunning",
  "gorgeous",
  "breathtaking",
  "premium",
  "exclusive",
  "homeware",
  "shop now",
  "add to cart",
  "add to basket",
  "add to bag",
  "buy now",
  "checkout",
  "customers",
  "customer",
];

/**
 * Stat blocks, ruled out by section 02: "500+ projects", "10 years of
 * excellence". Caught as a figure immediately followed by a plus sign, or a
 * "N years of" construction.
 */
const STAT_BLOCK = /\b\d+\+\s|\b\d+\s+years\s+of\b/i;

/**
 * "unique" is prohibited unless followed by a specific reason, and it is also
 * an ordinary programming term. Matches that look like identifiers are
 * ignored, so `unique=True` and `.unique()` pass while prose does not.
 */
const IDENTIFIER_BEFORE = /[._]$/;
const IDENTIFIER_AFTER = /^[=(_]/;

/**
 * Colours that must never appear.
 *
 * Pure black and pure white are never substituted for Ink or Ivory.
 *
 * Two bans have been lifted as the source of truth changed, and both are
 * logged in PENDING_CHANGES.md:
 *
 *   - #1C1814 was banned as an Instagram only ground. The Website Build
 *     Specification gave it as Umber, so the ban was lifted.
 *   - #1C1714 was banned as "the near true black Ink was corrected away
 *     from", on the strength of section 03. The frontend correction brief,
 *     which the client has since confirmed is authoritative, sets exactly
 *     that value as Ink, the colour of all body text and headings. Banning it
 *     would now reject the approved palette, so the ban is lifted.
 */
const BANNED_COLOURS = [
  ["#000000", "pure black"],
  ["#ffffff", "pure white"],
];

const problems = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full);
    } else if (SCAN_EXTENSIONS.has(extname(entry))) {
      inspect(full);
    }
  }
}

function inspect(file) {
  if (SELF_CHECKING.has(file)) return;
  const rel = relative(root, file).split(sep).join("/");
  const isStylesheet = extname(file) === ".css";
  const lines = readFileSync(file, "utf8").split(/\r?\n/);

  lines.forEach((line, index) => {
    // A line may state a rule rather than break it, for example a comment
    // recording which colour is deliberately absent. Marking such a line keeps
    // the exception explicit and greppable rather than silently allowed.
    if (line.includes("copy-lint-ok")) return;

    const at = `${rel}:${index + 1}`;
    const lower = line.toLowerCase();

    // Em dashes. Correct English punctuation is used instead.
    if (line.includes("—")) {
      problems.push({ at, message: "em dash. Use correct English punctuation instead." });
    }

    // Exclamation marks in prose. Skip the negation and history operators
    // that appear legitimately in code.
    if (/[a-z\s]!(\s|$)/i.test(line) && !/!==?|!\[|!important|\!\)/.test(line)) {
      problems.push({ at, message: "exclamation mark." });
    }

    for (const term of BANNED_WORDS) {
      const pattern = new RegExp(`\\b${term.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "gi");
      let match;
      while ((match = pattern.exec(line)) !== null) {
        problems.push({ at, message: `prohibited word "${match[0]}".` });
      }
    }

    if (STAT_BLOCK.test(line)) {
      problems.push({
        at,
        message: 'stat block. Section 02 rules out "500+ projects" constructions.',
      });
    }

    // "unique" only where it reads as prose rather than as code.
    const uniquePattern = /\bunique\b/gi;
    let uniqueMatch;
    while ((uniqueMatch = uniquePattern.exec(line)) !== null) {
      const before = line.slice(0, uniqueMatch.index);
      const after = line.slice(uniqueMatch.index + uniqueMatch[0].length);
      if (IDENTIFIER_BEFORE.test(before) || IDENTIFIER_AFTER.test(after)) continue;
      problems.push({
        at,
        message: '"unique" is only allowed when followed by a specific reason.',
      });
    }

    for (const [hex, description] of BANNED_COLOURS) {
      if (lower.includes(hex)) {
        problems.push({ at, message: `${hex} is ${description}.` });
      }
    }

    // Every colour in a stylesheet comes from the token file.
    if (isStylesheet && !rel.endsWith("tokens.css")) {
      const hexes = line.match(/#[0-9a-f]{3,8}\b/gi) ?? [];
      for (const hex of hexes) {
        // The console's two ratio badge colours are the documented exception.
        // They exist only in the administration area, never on the site.
        if (rel.endsWith("admin.css") && /#(4a6b4a|8a6a2f)/i.test(hex)) continue;
        problems.push({
          at,
          message: `hardcoded colour ${hex}. Reference a token from tokens.css instead.`,
        });
      }
    }
  });
}

walk(root);

if (problems.length === 0) {
  console.log("Copy and palette rules: no issues found.");
  process.exit(0);
}

console.error(`Copy and palette rules: ${problems.length} issue(s).\n`);
for (const problem of problems) {
  console.error(`  ${problem.at}  ${problem.message}`);
}
process.exit(1);
