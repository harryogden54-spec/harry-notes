/**
 * Inline note photos via Supabase Storage.
 *
 * Images are uploaded to the public `note-images` bucket and referenced from a
 * note's markdown body as `![](publicUrl)`. We store URLs (not bytes) so notes
 * stay small and sync cheaply, and other devices load the image when online.
 *
 * Path layout: `<sync_key>/<noteId>/<timestamp>-<rand>.<ext>` — namespaced by
 * sync key so a device's images live under its own prefix. Note: the bucket is
 * public, so URLs are guessable; acceptable for this personal sync-key model.
 */

import * as ImagePicker from "expo-image-picker";
import { supabase, SYNC_ENABLED } from "./supabase";
import { getSyncKey } from "./syncKey";

const BUCKET = "note-images";

export type ImageUploadResult =
  | { ok: true; url: string }
  | { ok: false; reason: "offline" | "permission" | "cancelled" | "error"; message?: string };

function extFromUri(uri: string, mime?: string): string {
  if (mime?.includes("png"))  return "png";
  if (mime?.includes("webp")) return "webp";
  if (mime?.includes("heic")) return "heic";
  if (mime?.includes("gif"))  return "gif";
  const m = uri.split("?")[0].match(/\.(\w+)$/);
  return (m?.[1] ?? "jpg").toLowerCase();
}

export async function pickAndUploadNoteImage(noteId: string): Promise<ImageUploadResult> {
  if (!SYNC_ENABLED) return { ok: false, reason: "offline", message: "Sync isn't configured" };
  const syncKey = await getSyncKey();
  if (!syncKey) return { ok: false, reason: "offline", message: "Set a sync key to add photos" };

  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { ok: false, reason: "permission" };

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
  });
  if (picked.canceled || picked.assets.length === 0) return { ok: false, reason: "cancelled" };

  const asset = picked.assets[0];
  try {
    const res = await fetch(asset.uri);
    const arrayBuffer = await res.arrayBuffer();
    const mime = asset.mimeType ?? res.headers.get("content-type") ?? "image/jpeg";
    const ext = extFromUri(asset.uri, mime);
    const path = `${syncKey}/${noteId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, arrayBuffer, {
      contentType: mime,
      upsert: false,
    });
    if (error) return { ok: false, reason: "error", message: error.message };

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { ok: true, url: data.publicUrl };
  } catch (e: any) {
    return { ok: false, reason: "error", message: e?.message ?? "Upload failed" };
  }
}
