import React from "react";
import { View, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text } from "@/components/ui";
import { spacing, fontFamily } from "@/lib/theme";

export type Sel = { start: number; end: number };

export function insertInline(text: string, sel: Sel, mark: string): { text: string; cursor: Sel } {
  const selected = text.slice(sel.start, sel.end);
  if (selected) {
    const next = text.slice(0, sel.start) + mark + selected + mark + text.slice(sel.end);
    return { text: next, cursor: { start: sel.start + mark.length, end: sel.end + mark.length } };
  }
  const next = text.slice(0, sel.start) + mark + mark + text.slice(sel.start);
  return { text: next, cursor: { start: sel.start + mark.length, end: sel.start + mark.length } };
}

export function insertLinePrefix(text: string, sel: Sel, prefix: string): { text: string; cursor: Sel } {
  const lineStart = text.lastIndexOf("\n", sel.start - 1) + 1;
  const next = text.slice(0, lineStart) + prefix + text.slice(lineStart);
  return { text: next, cursor: { start: sel.start + prefix.length, end: sel.end + prefix.length } };
}

/** Strip a heading/bullet/checkbox prefix from the current line — back to regular text. */
export function removeLinePrefix(text: string, sel: Sel): { text: string; cursor: Sel } {
  const lineStart = text.lastIndexOf("\n", sel.start - 1) + 1;
  const lineEnd = text.indexOf("\n", lineStart);
  const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
  const m = line.match(/^(#{1,6}\s+|[-*]\s+\[[ xX]\]\s?|[-*]\s+)/);
  if (!m) return { text, cursor: sel };
  const removed = m[1].length;
  const next = text.slice(0, lineStart) + line.slice(removed) + (lineEnd === -1 ? "" : text.slice(lineEnd));
  const clamp = (p: number) => Math.max(lineStart, p - removed);
  return { text: next, cursor: { start: clamp(sel.start), end: clamp(sel.end) } };
}

export function insertBlock(text: string, sel: Sel, block: string): { text: string; cursor: Sel } {
  const before = text[sel.start - 1] === "\n" ? "" : "\n";
  const after = text[sel.end] === "\n" ? "" : "\n";
  const insert = before + block + after;
  const next = text.slice(0, sel.start) + insert + text.slice(sel.end);
  return { text: next, cursor: { start: sel.start + insert.length, end: sel.start + insert.length } };
}

type Props = {
  body: string;
  selRef: React.MutableRefObject<Sel>;
  onApply: (text: string, cursor: Sel) => void;
  /** Optional photo button — picks an image and inserts it at the cursor. */
  onPickImage?: () => void;
  /** Shows a spinner on the photo button while an upload is in flight. */
  uploading?: boolean;
};

/**
 * One button per tool. Letter glyphs (the type scale) all render at the same
 * size and weight; everything else is an Ionicon. The set previously mixed
 * letters with bare unicode marks (•, ☑, `, —, ⊞) that each carried their own
 * font metrics, so they sat at different optical sizes and weights along the row.
 */
type Tool =
  | { key: string; glyph: string; bold?: boolean; italic?: boolean; fn: () => void; endsGroup?: boolean }
  | { key: string; icon: React.ComponentProps<typeof Ionicons>["name"]; fn: () => void; endsGroup?: boolean };

export function MarkdownToolbar({ body, selRef, onApply, onPickImage, uploading }: Props) {
  const { colors } = useTheme();
  const prefix = (p: string) => () => { const r = insertLinePrefix(body, selRef.current, p); onApply(r.text, r.cursor); };
  const inline = (m: string) => () => { const r = insertInline(body, selRef.current, m); onApply(r.text, r.cursor); };
  const block  = (b: string) => () => { const r = insertBlock(body, selRef.current, b); onApply(r.text, r.cursor); };

  const tools: Tool[] = [
    { key: "bold",   glyph: "B", bold: true,   fn: inline("**") },
    { key: "italic", glyph: "I", italic: true, fn: inline("_"), endsGroup: true },
    { key: "h1",     glyph: "H1",              fn: prefix("# ") },
    { key: "h2",     glyph: "H2",              fn: prefix("## ") },
    { key: "h3",     glyph: "H3",              fn: prefix("### ") },
    { key: "text",   glyph: "T",               fn: () => { const r = removeLinePrefix(body, selRef.current); onApply(r.text, r.cursor); }, endsGroup: true },
    { key: "bullet", icon: "list-outline",             fn: prefix("- ") },
    { key: "check",  icon: "checkbox-outline",         fn: prefix("- [ ] ") },
    { key: "code",   icon: "code-slash-outline",       fn: inline("`") },
    { key: "rule",   icon: "remove-outline",           fn: block("---") },
    { key: "table",  icon: "grid-outline",             fn: block("| Column 1 | Column 2 |\n| --- | --- |\n|  |  |"), endsGroup: true },
  ];

  const btn = { paddingHorizontal: spacing[3], paddingVertical: spacing[2], minWidth: 40, alignItems: "center" as const };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always"
      style={{ borderTopWidth: 1, borderTopColor: colors.bgBorder, backgroundColor: colors.bgSecondary }}
      contentContainerStyle={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[2] }}
    >
      {tools.map(t => (
        <React.Fragment key={t.key}>
          <Pressable onPress={t.fn} style={btn}>
            {"icon" in t
              ? <Ionicons name={t.icon} size={17} color={colors.textSecondary} />
              : (
                <Text size="sm" style={{
                  color: colors.textSecondary,
                  fontFamily: t.bold ? fontFamily.bold : fontFamily.semibold,
                  fontStyle: t.italic ? "italic" : "normal",
                }}>
                  {t.glyph}
                </Text>
              )}
          </Pressable>
          {t.endsGroup && (
            <View style={{ width: 1, height: 16, backgroundColor: colors.bgBorder, marginHorizontal: spacing[1] }} />
          )}
        </React.Fragment>
      ))}
      {onPickImage && (
        <Pressable onPress={onPickImage} disabled={uploading} style={btn}>
          {uploading
            ? <ActivityIndicator size="small" color={colors.textSecondary} />
            : <Ionicons name="image-outline" size={17} color={colors.textSecondary} />}
        </Pressable>
      )}
    </ScrollView>
  );
}
