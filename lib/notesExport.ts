/**
 * Web-only notes export/import helpers (Settings screen).
 *
 * Export: one .md file per note, bundled into a ZIP built by hand (stored,
 * no compression) so we don't need a zip dependency. Multi-page documents
 * become a folder: "Title/Title.md" + "Title/Page.md" per child page.
 *
 * Import: file picker for .md files — each file becomes a note, filename
 * (minus extension) as the title.
 */

import type { Note } from "./NotesContext";

// ─── Minimal ZIP writer (store method) ───────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

type ZipEntry = { name: string; data: Uint8Array };

export function buildZip(entries: ZipEntry[]): Blob {
  const enc = new TextEncoder();
  const now = dosDateTime(new Date());
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  const u16 = (v: number) => [v & 0xff, (v >> 8) & 0xff];
  const u32 = (v: number) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];

  for (const { name, data } of entries) {
    const nameBytes = enc.encode(name);
    const crc = crc32(data);
    // Local file header: version 20, flag 0x0800 (UTF-8 names), method 0 (store)
    const header = new Uint8Array([
      ...u32(0x04034b50), ...u16(20), ...u16(0x0800), ...u16(0),
      ...u16(now.time), ...u16(now.date), ...u32(crc),
      ...u32(data.length), ...u32(data.length),
      ...u16(nameBytes.length), ...u16(0),
    ]);
    chunks.push(header, nameBytes, data);

    central.push(new Uint8Array([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0),
      ...u16(now.time), ...u16(now.date), ...u32(crc),
      ...u32(data.length), ...u32(data.length),
      ...u16(nameBytes.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0), ...u32(offset),
    ]), nameBytes);
    offset += header.length + nameBytes.length + data.length;
  }

  let cdSize = 0;
  for (const c of central) cdSize += c.length;
  const end = new Uint8Array([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(entries.length), ...u16(entries.length),
    ...u32(cdSize), ...u32(offset), ...u16(0),
  ]);

  return new Blob([...chunks, ...central, end] as BlobPart[], { type: "application/zip" });
}

// ─── Notes → ZIP entries ─────────────────────────────────────────────────────

function safeName(title: string, fallback: string): string {
  const cleaned = (title || fallback).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim().slice(0, 80);
  return cleaned || fallback;
}

export function notesToZip(notes: Note[]): Blob {
  const enc = new TextEncoder();
  const docs = notes.filter(n => !n.parent_id);
  const entries: ZipEntry[] = [];
  const used = new Set<string>();

  const unique = (name: string): string => {
    let candidate = name;
    let i = 2;
    while (used.has(candidate.toLowerCase())) candidate = name.replace(/(\.md$|$)/, ` (${i++})$1`);
    used.add(candidate.toLowerCase());
    return candidate;
  };

  for (const doc of docs) {
    const base = safeName(doc.title, "Untitled");
    const pages = notes
      .filter(n => n.parent_id === doc.id)
      .sort((a, b) => (a.page_order ?? 0) - (b.page_order ?? 0) || a.created_at.localeCompare(b.created_at));
    if (pages.length === 0) {
      entries.push({ name: unique(`${base}.md`), data: enc.encode(doc.body) });
    } else {
      entries.push({ name: unique(`${base}/${base}.md`), data: enc.encode(doc.body) });
      pages.forEach((p, i) => {
        entries.push({
          name: unique(`${base}/${safeName(p.title, `Page ${i + 2}`)}.md`),
          data: enc.encode(p.body),
        });
      });
    }
  }
  return buildZip(entries);
}

// ─── Import ──────────────────────────────────────────────────────────────────

export type ImportedNote = { title: string; body: string };

/** Opens a file picker for .md files; resolves with one entry per file
 *  (empty array if the user cancels). Web only. */
export function pickMarkdownFiles(): Promise<ImportedNote[]> {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ".md,.markdown,.txt,text/markdown,text/plain";
    input.onchange = async () => {
      const files = Array.from(input.files ?? []);
      const out: ImportedNote[] = [];
      for (const f of files) {
        const body = await f.text();
        out.push({ title: f.name.replace(/\.(md|markdown|txt)$/i, ""), body });
      }
      resolve(out);
    };
    // Cancel fires no change event; resolve empty when focus returns without files.
    window.addEventListener("focus", () => setTimeout(() => { if (!input.files?.length) resolve([]); }, 500), { once: true });
    input.click();
  });
}
