/**
 * One-time migration: converts all existing NoteList items into Notes
 * with block-based content (checkbox/bullet blocks).
 *
 * Runs behind a storage flag "lists_migrated_v1" so it only executes once.
 * The original lists data is left in place in ListsContext — it simply becomes
 * unused once the Notes tab takes over.
 */

import { storage } from "./storage";
import type { NoteList } from "./ListsContext";
import type { Note, Block } from "./NotesContext";

const MIGRATION_FLAG = "lists_migrated_v1";

function newId() {
  return `mig_${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function listToNote(list: NoteList): Note {
  const blocks: Block[] = (list.items ?? []).map(item => ({
    id: newId(),
    type: item.type === "checkbox" ? "checkbox" : "bullet",
    content: item.content,
    checked: item.done,
  }));

  // If no items, start with an empty text block so the editor isn't blank.
  if (blocks.length === 0) {
    blocks.push({ id: newId(), type: "text", content: "" });
  }

  return {
    id: list.id,
    title: list.name,
    body: "",
    blocks,
    pinned: list.pinned ?? false,
    type: "note",
    created_at: list.created_at,
    updated_at: list.updated_at,
  };
}

export async function migrateListsToNotes(
  lists: NoteList[],
  existingNotes: Note[],
  addMigratedNotes: (notes: Note[]) => void,
): Promise<void> {
  const alreadyDone = await storage.get<boolean>(MIGRATION_FLAG);
  if (alreadyDone) return;

  if (lists.length === 0) {
    await storage.set(MIGRATION_FLAG, true);
    return;
  }

  const existingIds = new Set(existingNotes.map(n => n.id));
  const toMigrate = lists.filter(l => !existingIds.has(l.id));

  if (toMigrate.length > 0) {
    const migratedNotes = toMigrate.map(listToNote);
    addMigratedNotes(migratedNotes);
  }

  await storage.set(MIGRATION_FLAG, true);
}
