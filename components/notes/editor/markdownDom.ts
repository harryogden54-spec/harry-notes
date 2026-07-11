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

const INLINE_PATTERNS: [RegExp, (inner: string) => string][] = [
  [/\*\*(.+?)\*\*/s, s => `<b>${escapeHtml(s)}</b>`],
  [/__(.+?)__/s,     s => `<b>${escapeHtml(s)}</b>`],
  [/_(.+?)_/s,       s => `<i>${escapeHtml(s)}</i>`],
  [/\*(.+?)\*/s,     s => `<i>${escapeHtml(s)}</i>`],
  [/`(.+?)`/s,       s => `<code>${escapeHtml(s)}</code>`],
  [/\[\[(.+?)\]\]/s, s => `<span class="wikilink">[[${escapeHtml(s)}]]</span>`],
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
    if (tag === "b" || tag === "strong") { out += `**${inner}**`; return; }
    if (tag === "i" || tag === "em")     { out += `_${inner}_`; return; }
    if (tag === "code")                  { out += `\`${inner}\``; return; }
    if (el.classList?.contains("wikilink")) { out += inner; return; }
    if (tag === "br") { out += ""; return; }
    // Unknown inline element (e.g. from a paste) — keep its text content only.
    out += el.textContent ?? "";
  });
  return out;
}
