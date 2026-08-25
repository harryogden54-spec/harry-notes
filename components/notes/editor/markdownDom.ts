/**
 * Pure markdown <-> block/DOM conversion for the web WYSIWYG editor
 * (NoteBodyEditor.web.tsx). Mirrors the exact line/inline rules
 * MarkdownView.tsx uses for read-only rendering, so what you see while
 * editing on web matches what native/preview renders.
 *
 * Lossless-fallback invariant: any line this parser doesn't specifically
 * recognise becomes a "paragraph" block carrying the raw line verbatim,
 * and paragraphs always serialise back byte-identical. This protects
 * sync, [[wikilink]] backlink matching, and note previews from being
 * corrupted by a block type this editor doesn't specially render yet
 * (REPL "> " lines and images round-trip this way in v1 — visible as
 * plain text while editing, unchanged in storage).
 */

// Relative, not "@/lib/...": `npm run test:markdown` compiles this file with a
// bare tsc invocation that has no module-alias config. See lib/mdEmphasis.ts.
import {
  MD_BOLD_STARS, MD_BOLD_UNDERSCORES, MD_ITALIC_UNDERSCORE, MD_ITALIC_STARS,
  MD_CODE, MD_WIKILINK,
} from "../../../lib/mdEmphasis";


export type BlockType = "h1" | "h2" | "h3" | "bullet" | "checkbox" | "divider" | "image" | "paragraph" | "empty" | "tablerow" | "tablesep";

export type Block = {
  type: BlockType;
  text: string;
  checked?: boolean;
  src?: string;
  cells?: string[];        // tablerow only
};

// ─── Table rows ──────────────────────────────────────────────────────────────
// A table is just consecutive `| a | b |` lines; the `| --- | --- |` separator
// row is carried verbatim (tablesep) so storage round-trips byte-identical.
// Cell text escapes literal pipes as \| so cell content can't break the row.

export function splitTableRow(line: string): string[] {
  const inner = line.trim().replace(/^\|/, "").replace(/\|\s*$/, "");
  return inner
    .split(/(?<!\\)\|/)
    .map(c => c.trim().replace(/\\\|/g, "|"));
}

export function joinTableRow(cells: string[]): string {
  return `| ${cells.map(c => c.replace(/\|/g, "\\|")).join(" | ")} |`;
}

export function parseMarkdownToBlocks(body: string): Block[] {
  return body.split("\n").map(parseLine);
}

function parseLine(line: string): Block {
  const imgMatch = line.match(/^!\[[^\]]*\]\(([^)]+)\)\s*$/);
  if (imgMatch) return { type: "image", text: "", src: imgMatch[1] };
  const cbMatch = line.match(/^[-*] \[([ xX])\]\s?(.*)$/);
  if (cbMatch) return { type: "checkbox", text: cbMatch[2], checked: cbMatch[1].toLowerCase() === "x" };
  if (line.startsWith("### ")) return { type: "h3", text: line.slice(4) };
  if (line.startsWith("## "))  return { type: "h2", text: line.slice(3) };
  if (line.startsWith("# "))   return { type: "h1", text: line.slice(2) };
  if (/^---+$/.test(line))     return { type: "divider", text: "" };
  if (/^\|.*\|\s*$/.test(line)) {
    if (/^\|[\s:|-]+\|\s*$/.test(line) && line.includes("-")) return { type: "tablesep", text: line };
    return { type: "tablerow", text: line, cells: splitTableRow(line) };
  }
  const bulletMatch = line.match(/^[-*] (.*)$/);
  if (bulletMatch) return { type: "bullet", text: bulletMatch[1] };
  if (line.trim() === "") return { type: "empty", text: "" };
  return { type: "paragraph", text: line };
}

export function blockToMarkdownLine(b: Block): string {
  switch (b.type) {
    case "image":     return `![](${b.src ?? ""})`;
    case "checkbox":  return `- [${b.checked ? "x" : " "}] ${b.text}`;
    case "h1":        return `# ${b.text}`;
    case "h2":        return `## ${b.text}`;
    case "h3":        return `### ${b.text}`;
    case "divider":   return "---";
    case "tablerow":  return joinTableRow(b.cells ?? []);
    case "tablesep":  return b.text;
    case "bullet":    return `- ${b.text}`;
    case "empty":     return "";
    default:          return b.text;
  }
}

export function blocksToMarkdown(blocks: Block[]): string {
  return blocks.map(blockToMarkdownLine).join("\n");
}

// ─── Inline markdown <-> HTML ───────────────────────────────────────────────
// Only bold/italic/code/wikilink — the set the toolbar + MarkdownView both
// support. escapeHtml first so raw < > & in note text can't break the DOM.

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Bold and italic recurse into their own content so `**_both_**` renders as
// bold italic rather than a bold run containing two literal underscores.
// Recursion terminates because the inner text is always a strict substring.
// Code and wikilinks deliberately do not recurse: their content is literal.
const INLINE_PATTERNS: [RegExp, (inner: string) => string][] = [
  [MD_BOLD_STARS,         s => `<b>${inlineMarkdownToHtml(s)}</b>`],
  [MD_BOLD_UNDERSCORES,   s => `<b>${inlineMarkdownToHtml(s)}</b>`],
  [MD_ITALIC_UNDERSCORE,  s => `<i>${inlineMarkdownToHtml(s)}</i>`],
  [MD_ITALIC_STARS,       s => `<i>${inlineMarkdownToHtml(s)}</i>`],
  [MD_CODE,               s => `<code>${escapeHtml(s)}</code>`],
  [MD_WIKILINK,           s => `<span class="wikilink">[[${escapeHtml(s)}]]</span>`],
];

/** Inline markdown text -> HTML string (safe to assign via innerHTML). */
export function inlineMarkdownToHtml(text: string): string {
  let remaining = text;
  let html = "";
  while (remaining.length > 0) {
    let earliest: { index: number; match: RegExpMatchArray; render: (s: string) => string } | null = null;
    for (const [regex, render] of INLINE_PATTERNS) {
      const m = remaining.match(regex);
      if (m && m.index !== undefined) {
        if (!earliest || m.index < earliest.index) earliest = { index: m.index, match: m, render };
      }
    }
    if (!earliest) { html += escapeHtml(remaining); break; }
    if (earliest.index > 0) html += escapeHtml(remaining.slice(0, earliest.index));
    html += earliest.render(earliest.match[1]);
    remaining = remaining.slice(earliest.index + earliest.match[0].length);
  }
  return html || "";
}

/**
 * Bold/italic carried by an inline style rather than by tag. Browsers emit
 * `<span style="font-weight: bold">` for execCommand under styleWithCSS and for
 * most rich pastes; without this the mark was silently flattened away by the
 * unknown-element branch below.
 */
function styledAs(el: HTMLElement): { bold: boolean; italic: boolean } {
  const weight = el.style?.fontWeight ?? "";
  const style  = el.style?.fontStyle ?? "";
  return {
    bold: weight === "bold" || weight === "bolder" || (/^\d+$/.test(weight) && Number(weight) >= 600),
    italic: style === "italic" || style === "oblique",
  };
}

/** Walk a DOM node's inline content (bold/italic/code/wikilink/text) back to markdown. */
export function inlineNodeToMarkdown(node: Node): string {
  let out = "";
  node.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      out += child.textContent ?? "";
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const inner = inlineNodeToMarkdown(el);
    if (el.classList?.contains("wikilink")) { out += inner; return; }
    if (tag === "br") { out += ""; return; }

    // An empty mark has nothing to emphasise and its delimiters collide: an
    // empty <b> serialises to `****`, which the parser reads back as an
    // italicised asterisk. Contentless marks are dropped instead.
    if (inner === "") return;

    const styled = styledAs(el);
    const bold   = tag === "b" || tag === "strong" || styled.bold;
    const italic = tag === "i" || tag === "em"     || styled.italic;

    if (tag === "code")  { out += `\`${inner}\``;  return; }
    if (bold && italic)  { out += `**_${inner}_**`; return; }
    if (bold)            { out += `**${inner}**`;   return; }
    if (italic)          { out += `_${inner}_`;     return; }

    // Unknown inline element (e.g. from a paste) — keep its markdown content.
    // `inner`, not textContent: textContent would throw away any bold or
    // italic nested inside it.
    out += inner;
  });
  return out;
}
