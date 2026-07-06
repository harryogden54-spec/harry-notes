import React, { useCallback, useRef } from "react";
import { View, Image } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { Text, Checkbox } from "@/components/ui";
import { spacing, fontFamily, radius } from "@/lib/theme";
import { evalREPL, type REPLContext } from "./replEval";

type Colors = ReturnType<typeof useTheme>["colors"];

// Parsed inline spans cached per theme (WeakMap key = the memoized colors
// object from useTheme) and per line text. Reusing the same element array
// across renders is safe — elements are immutable. The cap guards against
// unbounded growth from heavy editing sessions.
const INLINE_CACHE_MAX = 2000;
const inlineCache = new WeakMap<object, Map<string, React.ReactNode>>();

export function renderInline(text: string, colors: Colors): React.ReactNode {
  let cache = inlineCache.get(colors);
  if (!cache) {
    cache = new Map();
    inlineCache.set(colors, cache);
  }
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  const parts = renderInlineUncached(text, colors);
  if (cache.size >= INLINE_CACHE_MAX) cache.clear();
  cache.set(text, parts);
  return parts;
}

function renderInlineUncached(text: string, colors: Colors): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIdx = 0;

  const patterns: [RegExp, (m: RegExpMatchArray) => React.ReactNode][] = [
    [/\*\*(.+?)\*\*/s, (m) => <Text key={keyIdx++} style={{ fontFamily: fontFamily.bold, color: colors.textPrimary }}>{m[1]}</Text>],
    [/__(.+?)__/s,     (m) => <Text key={keyIdx++} style={{ fontFamily: fontFamily.bold, color: colors.textPrimary }}>{m[1]}</Text>],
    [/_(.+?)_/s,       (m) => <Text key={keyIdx++} style={{ fontStyle: "italic", color: colors.textSecondary }}>{m[1]}</Text>],
    [/\*(.+?)\*/s,     (m) => <Text key={keyIdx++} style={{ fontStyle: "italic", color: colors.textSecondary }}>{m[1]}</Text>],
    [/`(.+?)`/s,       (m) => <Text key={keyIdx++} style={{ fontFamily: "monospace" as any, fontSize: 13, color: colors.accent, backgroundColor: colors.bgTertiary }}>{` ${m[1]} `}</Text>],
    [/\[\[(.+?)\]\]/s, (m) => <Text key={keyIdx++} style={{ color: colors.accent, textDecorationLine: "underline" }}>{m[1]}</Text>],
    // Note tags: `//tag` at line start or after whitespace (never protocol
    // slashes in URLs). m[1] = leading whitespace, m[2] = tag name.
    [/(^|\s)\/\/([A-Za-z0-9_-]+)/, (m) => (
      <Text key={keyIdx++} style={{ color: colors.textSecondary }}>
        {m[1]}
        <Text style={{ color: colors.accent, backgroundColor: `${colors.accent}1A`, fontFamily: fontFamily.medium }}>{`//${m[2]}`}</Text>
      </Text>
    )],
  ];

  while (remaining.length > 0) {
    let earliest: { index: number; match: RegExpMatchArray; render: (m: RegExpMatchArray) => React.ReactNode } | null = null;
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
    parts.push(earliest.render(earliest.match));
    remaining = remaining.slice(earliest.index + earliest.match[0].length);
  }
  return parts;
}

// One markdown line, memoized: editing line 40 of a 200-line note re-parses
// only line 40. replCtx is only passed for "> " lines, so data changes
// (tasks/notes counts) invalidate REPL lines without touching prose lines.
const MarkdownLine = React.memo(function MarkdownLine({ line, index, colors, replCtx, onToggleCheckbox }: {
  line: string;
  index: number;
  colors: Colors;
  replCtx?: REPLContext;
  onToggleCheckbox?: (lineIndex: number) => void;
}) {
  // ── Image lines: "![alt](url)" ──────────────────────────────────────────
  const imgMatch = line.match(/^!\[[^\]]*\]\(([^)]+)\)\s*$/);
  if (imgMatch) {
    return (
      <Image
        source={{ uri: imgMatch[1] }}
        resizeMode="contain"
        style={{ width: "100%", height: 240, borderRadius: radius.md, marginVertical: spacing[2], backgroundColor: colors.bgTertiary }}
      />
    );
  }

  // ── Checkbox lines: "- [ ] " / "- [x] " ─────────────────────────────────
  const cbMatch = line.match(/^[-*] \[([ xX])\]\s?(.*)$/);
  if (cbMatch) {
    const checked = cbMatch[1].toLowerCase() === "x";
    return (
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing[2], marginVertical: 2 }}>
        <View style={{ marginTop: 3 }}>
          <Checkbox checked={checked} onToggle={() => onToggleCheckbox?.(index)} size={16} />
        </View>
        <Text style={{ flex: 1, color: checked ? colors.textTertiary : colors.textSecondary, fontSize: 15, lineHeight: 24, textDecorationLine: checked ? "line-through" : "none" }}>
          {renderInline(cbMatch[2], colors)}
        </Text>
      </View>
    );
  }

  // ── REPL lines: "> expression" ──────────────────────────────────────────
  if (line.startsWith("> ") && replCtx) {
    const expr   = line.slice(2);
    const result = evalREPL(expr, replCtx);
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], marginVertical: 2 }}>
        <Text style={{ color: colors.textTertiary, fontSize: 13, lineHeight: 22, fontFamily: fontFamily.medium }}>{">"}</Text>
        <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 14, lineHeight: 22, fontFamily: "monospace" as any }}>{expr}</Text>
        {result !== undefined && (
          <View style={{ backgroundColor: colors.bgTertiary, borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: colors.bgBorder }}>
            <Text style={{ fontSize: 12, color: colors.accent, fontFamily: "monospace" as any }}>{result}</Text>
          </View>
        )}
      </View>
    );
  }

  if (line.startsWith("### ")) return <Text style={{ fontSize: 15, fontFamily: fontFamily.bold, color: colors.textPrimary, marginTop: spacing[3], marginBottom: spacing[1] }}>{renderInline(line.slice(4), colors)}</Text>;
  if (line.startsWith("## "))  return <Text style={{ fontSize: 18, fontFamily: fontFamily.bold, color: colors.textPrimary, marginTop: spacing[4], marginBottom: spacing[1.5] }}>{renderInline(line.slice(3), colors)}</Text>;
  if (line.startsWith("# "))   return <Text style={{ fontSize: 22, fontFamily: fontFamily.bold, color: colors.textPrimary, marginTop: spacing[5], marginBottom: spacing[2] }}>{renderInline(line.slice(2), colors)}</Text>;
  if (line.match(/^---+$/))    return <View style={{ height: 1, backgroundColor: colors.bgBorder, marginVertical: spacing[3] }} />;
  if (line.match(/^[-*] /)) {
    return (
      <View style={{ flexDirection: "row", gap: spacing[2], marginVertical: 2 }}>
        <Text style={{ color: colors.textTertiary, fontSize: 15, lineHeight: 24 }}>•</Text>
        <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 15, lineHeight: 24 }}>{renderInline(line.slice(2), colors)}</Text>
      </View>
    );
  }
  if (line.trim() === "") return <View style={{ height: spacing[2] }} />;
  return <Text style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 24 }}>{renderInline(line, colors)}</Text>;
});

export function MarkdownView({ body, colors, replCtx, onToggleCheckbox }: {
  body: string;
  colors: Colors;
  replCtx?: REPLContext;
  /** Tap handler for a `- [ ]` / `- [x]` line; receives the line index. */
  onToggleCheckbox?: (lineIndex: number) => void;
}) {
  // Stable identity for the toggle callback so an inline handler from the
  // parent doesn't defeat MarkdownLine's memo.
  const toggleRef = useRef(onToggleCheckbox);
  toggleRef.current = onToggleCheckbox;
  const stableToggle = useCallback((lineIndex: number) => toggleRef.current?.(lineIndex), []);

  const lines = body.split("\n");
  return (
    <View style={{ gap: 0 }}>
      {lines.map((line, i) => (
        <MarkdownLine
          key={`md-${i}`}
          line={line}
          index={i}
          colors={colors}
          replCtx={line.startsWith("> ") ? replCtx : undefined}
          onToggleCheckbox={onToggleCheckbox ? stableToggle : undefined}
        />
      ))}
    </View>
  );
}
