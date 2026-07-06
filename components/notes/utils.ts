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
