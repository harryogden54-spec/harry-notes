/**
 * One-time migration: convert block-based notes into a single markdown `body`
 * string. The notes editor now uses one editable TextInput (markdown) so text
 * is fully selectable/copyable and supports a top formatting bar + inline
 * photos. Block notes (heading/text/bullet/checkbox) map cleanly to markdown.
 *
 * Runs behind a storage flag so it executes once. `blocksToMarkdown` is also
 * reused by NoteEditor as a defensive convert-on-open for any block note that
 * arrives later via sync from a device that hasn't migrated yet.
 */

import { storage } from "./storage";
import type { Note, Block } from "./NotesContext";

const MIGRATION_FLAG = "blocks_migrated_v1";

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

export async function migrateBlocksToBody(
  notes: Note[],
  updateNote: (id: string, updates: Partial<Omit<Note, "id" | "created_at">>) => void,
): Promise<void> {
  const alreadyDone = await storage.get<boolean>(MIGRATION_FLAG);
  if (alreadyDone) return;

  const toMigrate = notes.filter(n => Array.isArray(n.blocks) && n.blocks.length > 0);
  for (const n of toMigrate) {
    updateNote(n.id, { body: blocksToMarkdown(n.blocks!), blocks: undefined });
  }

  await storage.set(MIGRATION_FLAG, true);
}
