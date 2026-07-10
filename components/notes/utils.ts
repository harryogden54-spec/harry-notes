import { Platform, LayoutAnimation } from "react-native";
import { stripMarkdown } from "@/lib/utils";
import type { Note } from "@/lib/NotesContext";

export function animate() {
  if (Platform.OS !== "web") LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

/**
 * Single source of truth for a note's preview text. Block-based notes (incl.
 * lists migrated into notes) show their block contents joined by " · ";
 * plain notes show their stripped body. Tolerates a missing body.
 */
export function notePreview(note: Note, max = 120): string {
  const text = note.blocks && note.blocks.length > 0
    ? note.blocks.map(b => b.content).filter(Boolean).join(" · ")
    : stripMarkdown((note.body ?? "").trim());
  return text.slice(0, max);
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
