/**
 * PWA share-target landing route.
 *
 * `share_target` in public/manifest.json points the OS share sheet here with
 * ?title=&text=&url=. This route turns those into a Dump capture and hands off
 * to the Dump screen, so anything shareable becomes an inbox item without
 * retyping it.
 *
 * Platform reality: the Web Share Target API is Chromium-only. On Android Chrome
 * (and desktop Chrome/Edge, installed) "harry notes" appears in the share sheet
 * directly. **iOS Safari does not implement it**, so the manifest entry is inert
 * on iPhone — but this route is a plain GET URL, so an iOS Shortcut ("Receive
 * text from share sheet" → "Open URL" with
 * https://harry-notes.pages.dev/share?text=<input>) reaches exactly the same
 * code path. That is the supported iOS route.
 *
 * GET, not POST: Cloudflare Pages serves this app as static files with an SPA
 * fallback, so there is no server to accept a multipart POST. GET keeps the
 * whole thing client-side. The cost is that shared *files* aren't supported,
 * only title/text/url.
 */
import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Text, GradientBackground } from "@/components/ui";
import { useDumpsActions, useDumpsData } from "@/lib/DumpContext";
import { useTheme } from "@/lib/useTheme";
import { spacing } from "@/lib/theme";

/** Shared payloads vary by app: some put the URL in `text`, some in `url`, some
 *  repeat the title inside `text`. Assemble without duplicating. */
function buildContent(title?: string, text?: string, url?: string): string {
  const bits: string[] = [];
  const t = title?.trim();
  const x = text?.trim();
  const u = url?.trim();
  if (t) bits.push(t);
  if (x && x !== t) bits.push(x);
  if (u && !(x ?? "").includes(u) && u !== t) bits.push(u);
  return bits.join("\n\n").trim();
}

export default function ShareTargetScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ title?: string; text?: string; url?: string }>();
  const { addDump } = useDumpsActions();
  const { loaded } = useDumpsData();
  const handled = useRef(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // Must wait for `loaded`. The collection's initial load ends in
    // setItems(local), which replaces the whole array — a dump added before
    // that resolves would be silently discarded.
    if (!loaded || handled.current) return;
    handled.current = true;

    const content = buildContent(params.title, params.text, params.url);
    try {
      // Nothing shared (someone opened /share directly) — just go to Dump
      // rather than creating an empty capture.
      if (content) {
        addDump({ tag: "knowledge", content });
      }
      router.replace("/(tabs)/dump");
    } catch {
      setFailed(true);
    }
  }, [loaded, params.title, params.text, params.url, addDump, router]);

  return (
    <GradientBackground>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing[6], gap: spacing[2] }}>
        <Text size="lg" weight="semibold">{failed ? "Couldn't save that" : "Saving to Dump…"}</Text>
        <Text size="sm" secondary style={{ textAlign: "center" }}>
          {failed
            ? "Open Dump and add it manually."
            : "One moment."}
        </Text>
        {failed && (
          <Text
            size="sm"
            color={colors.accent}
            onPress={() => router.replace("/(tabs)/dump")}
            style={{ marginTop: spacing[2] }}
          >
            Go to Dump
          </Text>
        )}
      </View>
    </GradientBackground>
  );
}
