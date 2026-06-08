import React from "react";
import { View, Image } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { Text, Checkbox } from "@/components/ui";
import { spacing, fontFamily, radius } from "@/lib/theme";
import { evalREPL, type REPLContext } from "./replEval";

type Colors = ReturnType<typeof useTheme>["colors"];

export function renderInline(text: string, colors: Colors): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  const patterns: [RegExp, (inner: string) => React.ReactNode][] = [
    [/\*\*(.+?)\*\*/s, (s) => <Text key={keyIdx++} style={{ fontFamily: fontFamily.bold, color: colors.textPrimary }}>{s}</Text>],
    [/__(.+?)__/s,     (s) => <Text key={keyIdx++} style={{ fontFamily: fontFamily.bold, color: colors.textPrimary }}>{s}</Text>],
    [/_(.+?)_/s,       (s) => <Text key={keyIdx++} style={{ fontStyle: "italic", color: colors.textSecondary }}>{s}</Text>],
    [/\*(.+?)\*/s,     (s) => <Text key={keyIdx++} style={{ fontStyle: "italic", color: colors.textSecondary }}>{s}</Text>],
    [/`(.+?)`/s,       (s) => <Text key={keyIdx++} style={{ fontFamily: "monospace" as any, fontSize: 13, color: colors.accent, backgroundColor: colors.bgTertiary }}>{` ${s} `}</Text>],
    [/\[\[(.+?)\]\]/s, (s) => <Text key={keyIdx++} style={{ color: colors.accent, textDecorationLine: "underline" }}>{s}</Text>],
  ];

  while (remaining.length > 0) {
    let earliest: { index: number; match: RegExpMatchArray; render: (s: string) => React.ReactNode } | null = null;
    for (const [regex, render] of patterns) {
      const m = remaining.match(regex);
      if (m && m.index !== undefined) {
        if (!earliest || m.index < earliest.index) earliest = { index: m.index, match: m, render };
      }
    }
    if (!earliest) {
      parts.push(<Text key={keyIdx++} style={{ color: colors.textSecondary }}>{remaining}</Text>);
      break;
    }
    if (earliest.index > 0) parts.push(<Text key={keyIdx++} style={{ color: colors.textSecondary }}>{remaining.slice(0, earliest.index)}</Text>);
    parts.push(earliest.render(earliest.match[1]));
    remaining = remaining.slice(earliest.index + earliest.match[0].length);
  }
  return parts;
}

export function MarkdownView({ body, colors, replCtx, onToggleCheckbox }: {
  body: string;
  colors: Colors;
  replCtx?: REPLContext;
  /** Tap handler for a `- [ ]` / `- [x]` line; receives the line index. */
  onToggleCheckbox?: (lineIndex: number) => void;
}) {
  const lines = body.split("\n");
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const key = `md-${i}`;

    // ── Image lines: "![alt](url)" ──────────────────────────────────────────
    const imgMatch = line.match(/^!\[[^\]]*\]\(([^)]+)\)\s*$/);
    if (imgMatch) {
      nodes.push(
        <Image
          key={key}
          source={{ uri: imgMatch[1] }}
          resizeMode="contain"
          style={{ width: "100%", height: 240, borderRadius: radius.md, marginVertical: spacing[2], backgroundColor: colors.bgTertiary }}
        />
      );
      continue;
    }

    // ── Checkbox lines: "- [ ] " / "- [x] " ─────────────────────────────────
    const cbMatch = line.match(/^[-*] \[([ xX])\]\s?(.*)$/);
    if (cbMatch) {
      const checked = cbMatch[1].toLowerCase() === "x";
      nodes.push(
        <View key={key} style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing[2], marginVertical: 2 }}>
          <View style={{ marginTop: 3 }}>
            <Checkbox checked={checked} onToggle={() => onToggleCheckbox?.(i)} size={16} />
          </View>
          <Text style={{ flex: 1, color: checked ? colors.textTertiary : colors.textSecondary, fontSize: 15, lineHeight: 24, textDecorationLine: checked ? "line-through" : "none" }}>
            {renderInline(cbMatch[2], colors)}
          </Text>
        </View>
      );
      continue;
    }

    // ── REPL lines: "> expression" ──────────────────────────────────────────
    if (line.startsWith("> ") && replCtx) {
      const expr   = line.slice(2);
      const result = evalREPL(expr, replCtx);
      nodes.push(
        <View key={key} style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], marginVertical: 2 }}>
          <Text style={{ color: colors.textTertiary, fontSize: 13, lineHeight: 22, fontFamily: fontFamily.medium }}>{">"}</Text>
          <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 14, lineHeight: 22, fontFamily: "monospace" as any }}>{expr}</Text>
          {result !== undefined && (
            <View style={{ backgroundColor: colors.bgTertiary, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: colors.bgBorder }}>
              <Text style={{ fontSize: 12, color: colors.accent, fontFamily: "monospace" as any }}>{result}</Text>
            </View>
          )}
        </View>
      );
      continue;
    }

    if (line.startsWith("### "))     nodes.push(<Text key={key} style={{ fontSize: 15, fontFamily: fontFamily.bold, color: colors.textPrimary, marginTop: spacing[3], marginBottom: spacing[1] }}>{renderInline(line.slice(4), colors)}</Text>);
    else if (line.startsWith("## ")) nodes.push(<Text key={key} style={{ fontSize: 18, fontFamily: fontFamily.bold, color: colors.textPrimary, marginTop: spacing[4], marginBottom: spacing[1.5] }}>{renderInline(line.slice(3), colors)}</Text>);
    else if (line.startsWith("# "))  nodes.push(<Text key={key} style={{ fontSize: 22, fontFamily: fontFamily.bold, color: colors.textPrimary, marginTop: spacing[5], marginBottom: spacing[2] }}>{renderInline(line.slice(2), colors)}</Text>);
    else if (line.match(/^---+$/))   nodes.push(<View key={key} style={{ height: 1, backgroundColor: colors.bgBorder, marginVertical: spacing[3] }} />);
    else if (line.match(/^[-*] /))   nodes.push(
      <View key={key} style={{ flexDirection: "row", gap: spacing[2], marginVertical: 2 }}>
        <Text style={{ color: colors.textTertiary, fontSize: 15, lineHeight: 24 }}>•</Text>
        <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 15, lineHeight: 24 }}>{renderInline(line.slice(2), colors)}</Text>
      </View>
    );
    else if (line.trim() === "") nodes.push(<View key={key} style={{ height: spacing[2] }} />);
    else nodes.push(<Text key={key} style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 24 }}>{renderInline(line, colors)}</Text>);
  }
  return <View style={{ gap: 0 }}>{nodes}</View>;
}
