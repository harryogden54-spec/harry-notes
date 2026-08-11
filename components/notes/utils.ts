import { Platform, LayoutAnimation } from "react-native";
import { stripMarkdown } from "@/lib/utils";
import type { Note, Block } from "@/lib/NotesContext";

export function animate() {
  if (Platform.OS !== "web") LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

/** The note's own body lines, with any managed tag line already removed. */
function bodyLines(note: Note): string[] {
  return splitTagLine(note.body ?? "")[1].split("\n");
}

/**
 * What to *show* as a note's title. An untitled note falls back to its first
 * non-empty line rather than the word "Untitled", so a list of real notes never
 * reads as a column of blanks.
 *
 * Display only — never use this to resolve a `[[wiki link]]`. Links match on the
 * stored `title` (with "Untitled" as the literal fallback), and a derived title
 * changes whenever the first line is edited, which would silently break them.
 */
export function noteDisplayTitle(note: Note, max = 80): string {
  if (note.title?.trim()) return note.title;
  const first = bodyLines(note).map(l => stripMarkdown(l).trim()).find(Boolean);
  return first ? first.slice(0, max) : "Untitled";
}

/**
 * Single source of truth for a note's preview text. Block-based notes (incl.
 * lists migrated into notes) show their block contents joined by " · ";
 * plain notes show their stripped body. Tolerates a missing body.
 *
 * When the note has no title of its own, its first line is being shown as the
 * title (see noteDisplayTitle), so the preview starts after it — otherwise the
 * card prints the same sentence twice.
 */
export function notePreview(note: Note, max = 120): string {
  if (note.blocks && note.blocks.length > 0) {
    return note.blocks.map(b => b.content).filter(Boolean).join(" · ").slice(0, max);
  }
  const lines = bodyLines(note);
  const rest = note.title?.trim()
    ? lines
    : lines.slice(lines.findIndex(l => stripMarkdown(l).trim()) + 1);
  return stripMarkdown(rest.join("\n").trim()).slice(0, max);
}

/**
 * Inline note tags: `//tag` typed anywhere in the body (start of line or after
 * whitespace, so protocol slashes in URLs like https://… never match).
 * The tag text stays in the note; this just extracts the names for filtering.
 */
export const TAG_PATTERN = /(^|\s)\/\/([A-Za-z0-9_-]+)/g;

export function extractTags(body: string): string[] {
  const tags = new Set<string>();
  for (const m of (body ?? "").matchAll(TAG_PATTERN)) tags.add(m[2].toLowerCase());
  return [...tags];
}

/** A line consisting only of //tag tokens (the editor keeps managed tags on one). */
const TAG_ONLY_LINE = /^(\s*\/\/[A-Za-z0-9_-]+)+\s*$/;

/**
 * Split a leading tag-only line off the body: [tagLine | null, rest].
 * The editor hides this line (tags are managed from the TagRow) and re-joins
 * it on save, so the stored format is unchanged.
 */
export function splitTagLine(body: string): [string | null, string] {
  const lines = (body ?? "").split("\n");
  if (lines.length > 0 && TAG_ONLY_LINE.test(lines[0])) {
    return [lines[0], lines.slice(1).join("\n")];
  }
  return [null, body ?? ""];
}

/** "  //Uni maths! " → "uni-maths" style cleanup for the tag input. */
export function normalizeTag(raw: string): string | null {
  const t = raw.trim().replace(/^\/+/, "").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "");
  return t || null;
}

/** Add a //tag marker, kept on a tag-only line at the top of the body. */
export function addTagToBody(body: string, tag: string): string {
  if (extractTags(body).includes(tag)) return body;
  const lines = (body ?? "").split("\n");
  if (lines.length > 0 && TAG_ONLY_LINE.test(lines[0])) {
    lines[0] = `${lines[0].trimEnd()} //${tag}`;
    return lines.join("\n");
  }
  return (body ?? "").trim() === "" ? `//${tag}` : `//${tag}\n${body}`;
}

/** Remove every //tag occurrence; tag-only lines left empty are dropped. */
export function removeTagFromBody(body: string, tag: string): string {
  const pattern = new RegExp(`(^|\\s)//${tag}(?=\\s|$)`, "gi");
  // Sentinel marking a line to delete entirely — can't collide with real text.
  const DROP = String.fromCharCode(0); // NUL sentinel, cannot appear in note text
  const lines = (body ?? "").split("\n").map(line => {
    if (!extractTags(line).includes(tag)) return line;
    const tagOnly = TAG_ONLY_LINE.test(line);
    const cleaned = line.replace(pattern, "$1").replace(/ {2,}/g, " ");
    const final = tagOnly ? cleaned.trim() : cleaned.trimEnd();
    return final === "" ? DROP : final;
  });
  return lines.filter(l => l !== DROP).join("\n");
}

const CHECKBOX_LINE = /^[-*] \[[ xX]\]/;
const CHECKED_LINE  = /^[-*] \[[xX]\]/;

/**
 * After the checkbox on `lineIndex` is toggled, reorder its contiguous
 * checklist group: checked items sink to the bottom of the group, un-checked
 * items lift back above the checked cluster. Returns the reordered lines.
 */
export function sinkToggledCheckbox(lines: string[], lineIndex: number): string[] {
  const line = lines[lineIndex];
  if (line === undefined || !CHECKBOX_LINE.test(line)) return lines;
  let start = lineIndex;
  while (start > 0 && CHECKBOX_LINE.test(lines[start - 1])) start--;
  let end = lineIndex;
  while (end < lines.length - 1 && CHECKBOX_LINE.test(lines[end + 1])) end++;

  const group = [...lines.slice(start, lineIndex), ...lines.slice(lineIndex + 1, end + 1)];
  let insertAt = group.length;
  if (!CHECKED_LINE.test(line)) {
    const firstChecked = group.findIndex(l => CHECKED_LINE.test(l));
    if (firstChecked !== -1) insertAt = firstChecked;
  }
  group.splice(insertAt, 0, line);
  return [...lines.slice(0, start), ...group, ...lines.slice(end + 1)];
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * Convert a legacy block-based note into a markdown body.
 *
 * The bulk one-time migration that used this was retired — it had been gated
 * behind a `blocks_migrated_v1` flag since June and so no-opped forever on every
 * existing install. This remains as NoteEditor's convert-on-open fallback, which
 * is the real safety net: it also covers a block note arriving later via sync
 * from a device that never ran the migration.
 */
export function blocksToMarkdown(blocks: Block[]): string {
  return blocks
    .map(b => {
      const content = b.content ?? "";
      switch (b.type) {
        case "heading":  return `# ${content}`;
        case "bullet":   return `- ${content}`;
        case "checkbox": return `- [${b.checked ? "x" : " "}] ${content}`;
        default:         return content;
      }
    })
    .join("\n");
}
