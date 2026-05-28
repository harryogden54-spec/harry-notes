/**
 * BlockEditor — renders a list of Block objects as styled TextInputs.
 *
 * Keyboard behaviour:
 *   Enter at end of bullet/checkbox  → new block of same type
 *   Enter on empty bullet/checkbox   → convert to plain text
 *   Enter on heading/text            → new text block below
 *   Backspace at start of empty      → delete block, focus previous
 *
 * Inline shortcuts (detected on change):
 *   # at start  → heading
 *   - at start  → bullet
 *   [] at start → checkbox
 */

import React, { useRef, useCallback } from "react";
import { View, TextInput, Platform } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { spacing, fontFamily } from "@/lib/theme";
import { Checkbox } from "@/components/ui";
import type { Block, BlockType } from "@/lib/NotesContext";

function newBlockId() {
  return `b_${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
}

type Props = {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  onToggleCheck: (blockId: string) => void;
  placeholder?: string;
};

export function BlockEditor({ blocks, onChange, onToggleCheck, placeholder }: Props) {
  const { colors } = useTheme();
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const focusBlock = useCallback((index: number) => {
    setTimeout(() => inputRefs.current[index]?.focus(), 30);
  }, []);

  const handleChange = useCallback((index: number, text: string) => {
    // Inline shortcut detection — only on web where typing is fast
    if (Platform.OS === "web") {
      const trimmed = text.trimStart();
      if (trimmed.startsWith("# ") && blocks[index].type !== "heading") {
        onChange(blocks.map((b, i) => i === index ? { ...b, type: "heading" as BlockType, content: trimmed.slice(2) } : b));
        return;
      }
      if (trimmed.startsWith("- ") && blocks[index].type !== "bullet") {
        onChange(blocks.map((b, i) => i === index ? { ...b, type: "bullet" as BlockType, content: trimmed.slice(2) } : b));
        return;
      }
      if ((trimmed.startsWith("[] ") || trimmed.startsWith("[ ] ")) && blocks[index].type !== "checkbox") {
        const content = trimmed.startsWith("[] ") ? trimmed.slice(3) : trimmed.slice(4);
        onChange(blocks.map((b, i) => i === index ? { ...b, type: "checkbox" as BlockType, content } : b));
        return;
      }
    }
    onChange(blocks.map((b, i) => i === index ? { ...b, content: text } : b));
  }, [blocks, onChange]);

  const handleSubmit = useCallback((index: number) => {
    const block = blocks[index];
    const isEmpty = block.content.trim() === "";

    // Empty bullet/checkbox → convert to text
    if (isEmpty && (block.type === "bullet" || block.type === "checkbox")) {
      onChange(blocks.map((b, i) => i === index ? { ...b, type: "text" as BlockType } : b));
      return;
    }

    // Insert new block after current
    const newType: BlockType = (block.type === "bullet" || block.type === "checkbox")
      ? block.type
      : "text";
    const newBlock: Block = { id: newBlockId(), type: newType, content: "", checked: false };
    const next = [...blocks.slice(0, index + 1), newBlock, ...blocks.slice(index + 1)];
    onChange(next);
    focusBlock(index + 1);
  }, [blocks, onChange, focusBlock]);

  const handleKeyPress = useCallback((index: number, key: string) => {
    if (key !== "Backspace") return;
    const block = blocks[index];
    if (block.content !== "") return; // only delete empty blocks
    if (blocks.length <= 1) return;   // keep at least one block

    const next = blocks.filter((_, i) => i !== index);
    onChange(next);
    focusBlock(Math.max(0, index - 1));
  }, [blocks, onChange, focusBlock]);

  return (
    <View style={{ gap: spacing[1] }}>
      {blocks.map((block, index) => (
        <BlockRow
          key={block.id}
          block={block}
          inputRef={(el) => { inputRefs.current[index] = el; }}
          colors={colors}
          placeholder={index === 0 && blocks.length === 1 ? (placeholder ?? "Start writing…") : undefined}
          onChange={(text) => handleChange(index, text)}
          onSubmitEditing={() => handleSubmit(index)}
          onKeyPress={(key) => handleKeyPress(index, key)}
          onToggleCheck={() => onToggleCheck(block.id)}
        />
      ))}
    </View>
  );
}

// ─── Individual block row ──────────────────────────────────────────────────────

type RowProps = {
  block: Block;
  inputRef: (el: TextInput | null) => void;
  colors: ReturnType<typeof useTheme>["colors"];
  placeholder?: string;
  onChange: (text: string) => void;
  onSubmitEditing: () => void;
  onKeyPress: (key: string) => void;
  onToggleCheck: () => void;
};

function BlockRow({
  block, inputRef, colors, placeholder,
  onChange, onSubmitEditing, onKeyPress, onToggleCheck,
}: RowProps) {
  const isHeading  = block.type === "heading";
  const isBullet   = block.type === "bullet";
  const isCheckbox = block.type === "checkbox";

  const textStyle = {
    color: colors.textPrimary,
    fontSize: isHeading ? 20 : 15,
    fontFamily: isHeading ? fontFamily.bold : fontFamily.regular,
    lineHeight: isHeading ? 28 : 22,
    flex: 1,
  };

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing[2], minHeight: isHeading ? 32 : 26 }}>
      {/* Prefix */}
      {isCheckbox && (
        <View style={{ marginTop: 3 }}>
          <Checkbox checked={block.checked ?? false} onToggle={onToggleCheck} size={16} />
        </View>
      )}
      {isBullet && (
        <View style={{ width: 16, alignItems: "center", marginTop: 8 }}>
          <View style={{ width: 5, height: 5, borderRadius: 99, backgroundColor: colors.textTertiary }} />
        </View>
      )}
      {isHeading && (
        <View style={{ width: 3, height: 20, borderRadius: 99, backgroundColor: colors.accent, marginTop: 5 }} />
      )}

      {/* Text input */}
      <TextInput
        ref={inputRef}
        value={block.content}
        onChangeText={onChange}
        onSubmitEditing={onSubmitEditing}
        onKeyPress={({ nativeEvent }) => onKeyPress(nativeEvent.key)}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        multiline={isHeading || (!isBullet && !isCheckbox)} // bullets/checkboxes are single-line
        blurOnSubmit={!isHeading}
        returnKeyType="next"
        style={[
          textStyle,
          block.checked ? { textDecorationLine: "line-through", color: colors.textTertiary } : {},
          // @ts-ignore
          { outlineStyle: "none" },
        ]}
      />
    </View>
  );
}
