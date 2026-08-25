/**
 * Round-trip tests for the note editor's markdown <-> HTML rules.
 * Run with `npm run test:markdown`.
 *
 * These are the rules that decide what happens to ordinary prose containing
 * `*` and `_`. Getting them wrong is silent: a filename turns into italics and
 * the underscores are gone from storage the next time the note is saved.
 */
import { inlineMarkdownToHtml, parseMarkdownToBlocks, blocksToMarkdown } from "./markdownDom";

let failures = 0;
let checks = 0;

function eq(actual: string, expected: string, label: string) {
  checks++;
  if (actual !== expected) {
    failures++;
    console.error(`FAIL  ${label}\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
  }
}

function html(md: string, expected: string, label = md) {
  eq(inlineMarkdownToHtml(md), expected, label);
}

// ── Emphasis that should apply ───────────────────────────────────────────────
html("**bold**", "<b>bold</b>");
html("__bold__", "<b>bold</b>");
html("*ital*", "<i>ital</i>");
html("_ital_", "<i>ital</i>");
html("`code`", "<code>code</code>");
html("a **b** c", "a <b>b</b> c");
html("**bold** and _ital_", "<b>bold</b> and <i>ital</i>");
html("mid*word*emphasis", "mid<i>word</i>emphasis");
html("[[Some Note]]", '<span class="wikilink">[[Some Note]]</span>');

// ── Prose that must NOT become emphasis ──────────────────────────────────────
// The whole point of the flanking rules: these all used to be mangled.
html("snake_case_variable", "snake_case_variable");
html("file_name_here.txt and more_stuff", "file_name_here.txt and more_stuff");
html("2 * 3 * 4 = 24", "2 * 3 * 4 = 24");
html("5 stars * * *", "5 stars * * *");
html("a * b", "a * b");
html("a _ b", "a _ b");
html("****", "****");
html("__", "__");
html("trailing star *", "trailing star *");

// ── Nested marks ─────────────────────────────────────────────────────────────
html("**_both_**", "<b><i>both</i></b>");
html("_**both**_", "<i><b>both</b></i>");
html("**bold with `code`**", "<b>bold with <code>code</code></b>");
html("`literal **stars**`", "<code>literal **stars**</code>");

// ── Escaping ─────────────────────────────────────────────────────────────────
html("a < b & c", "a &lt; b &amp; c");
html("**a < b**", "<b>a &lt; b</b>");

// ── Block round-trips: markdown in, same markdown out ────────────────────────
const BODIES = [
  "# Heading\n\nSome **bold** text.",
  "- one\n- two\n- three",
  "- [ ] todo\n- [x] done",
  "| a | b |\n| --- | --- |\n| 1 | 2 |",
  "---",
  "![](https://example.com/x.png)",
  "A line with snake_case_name and 2 * 3.",
  "> repl line stays verbatim",
  "",
  "trailing blank\n",
];
for (const body of BODIES) {
  eq(blocksToMarkdown(parseMarkdownToBlocks(body)), body, `round-trip ${JSON.stringify(body)}`);
}

console.log(`${checks - failures}/${checks} markdown checks passed`);
if (failures > 0) process.exit(1);
