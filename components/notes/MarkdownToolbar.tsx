import React from "react";
import { ScrollView, Pressable, ActivityIndicator } from "react-native";
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

export function MarkdownToolbar({ body, selRef, onApply, onPickImage, uploading }: Props) {
  const { colors } = useTheme();
  const tools = [
    { label: "B", bold: true,   fn: () => { const r = insertInline(body, selRef.current, "**"); onApply(r.text, r.cursor); } },
    { label: "I", italic: true, fn: () => { const r = insertInline(body, selRef.current, "_");  onApply(r.text, r.cursor); } },
    { label: "H",               fn: () => { const r = insertLinePrefix(body, selRef.current, "# ");  onApply(r.text, r.cursor); } },
    { label: "H2",              fn: () => { const r = insertLinePrefix(body, selRef.current, "## "); onApply(r.text, r.cursor); } },
    { label: "•",               fn: () => { const r = insertLinePrefix(body, selRef.current, "- ");  onApply(r.text, r.cursor); } },
    { label: "☑",               fn: () => { const r = insertLinePrefix(body, selRef.current, "- [ ] "); onApply(r.text, r.cursor); } },
    { label: "`",               fn: () => { const r = insertInline(body, selRef.current, "`");  onApply(r.text, r.cursor); } },
    { label: "—",               fn: () => { const r = insertBlock(body, selRef.current, "---"); onApply(r.text, r.cursor); } },
  ];

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="always"
      style={{ borderTopWidth: 1, borderTopColor: colors.bgBorder, backgroundColor: colors.bgSecondary }}
      contentContainerStyle={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing[2] }}
    >
      {tools.map(t => (
        <Pressable key={t.label} onPress={t.fn} style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}>
          <Text size="sm" style={{ color: colors.textSecondary, fontFamily: (t as any).bold ? fontFamily.bold : fontFamily.regular, fontStyle: (t as any).italic ? "italic" : "normal" }}>
            {t.label}
          </Text>
        </Pressable>
      ))}
      {onPickImage && (
        <Pressable onPress={onPickImage} disabled={uploading} style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}>
          {uploading
            ? <ActivityIndicator size="small" color={colors.textSecondary} />
            : <Ionicons name="image-outline" size={17} color={colors.textSecondary} />}
        </Pressable>
      )}
    </ScrollView>
  );
}
