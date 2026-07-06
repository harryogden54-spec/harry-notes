import React, { useRef, useEffect } from "react";
import { View, TextInput } from "react-native";
import { MarkdownToolbar, insertBlock, type Sel } from "../MarkdownToolbar";
import { getWikiQuery } from "../WikiLinkSuggestions";
import { MarkdownView } from "../MarkdownView";
import type { REPLContext } from "../replEval";

type Colors = ReturnType<typeof import("@/lib/useTheme").useTheme>["colors"];

/** Imperative contract NoteEditor uses to drive body edits that need
 *  platform-specific handling — a real TextInput + raw text splicing on
 *  native, DOM/Range manipulation on web's contentEditable container. */
export type BodyEditorHandle = {
  focus: () => void;
  insertWikiLink: (title: string) => void;
  insertImage: (url: string) => void;
};

export type NoteBodyEditorProps = {
  body: string;
  onChangeBody: (body: string) => void;
  bodyRef: React.RefObject<BodyEditorHandle | null>;
  selRef: React.MutableRefObject<Sel>;
  cursor: Sel | undefined;
  setCursor: (c: Sel | undefined) => void;
  preview: boolean;
  colors: Colors;
  replCtx: REPLContext;
  onToggleCheckboxLine: (lineIndex: number) => void;
  onWikiQueryChange: (q: string | null) => void;
  onPickImage: () => void;
  uploading: boolean;
};

/**
 * Native body editor — the original single-TextInput markdown editor with
 * its formatting toolbar and Preview/Edit toggle, moved out of NoteEditor.tsx
 * as-is. Web gets a different implementation (NoteBodyEditor.web.tsx);
 * Metro resolves the right file per-platform automatically.
 */
export function NoteBodyEditor({
  body, onChangeBody, bodyRef, selRef, cursor, setCursor,
  preview, colors, replCtx, onToggleCheckboxLine, onWikiQueryChange,
  onPickImage, uploading,
}: NoteBodyEditorProps) {
  const inputRef = useRef<TextInput | null>(null);
  const bodyStateRef = useRef(body);
  bodyStateRef.current = body;

  useEffect(() => {
    (bodyRef as React.MutableRefObject<BodyEditorHandle | null>).current = {
      focus: () => inputRef.current?.focus(),
      insertWikiLink: (title: string) => {
        const text = bodyStateRef.current;
        const pos = selRef.current.start;
        const replaced = text.slice(0, pos).replace(/\[\[([^\][]*)$/, `[[${title}]]`);
        const newBody = replaced + text.slice(pos);
        onChangeBody(newBody);
        setCursor({ start: replaced.length, end: replaced.length });
        onWikiQueryChange(null);
      },
      insertImage: (url: string) => {
        const r = insertBlock(bodyStateRef.current, selRef.current, `![](${url})`);
        onChangeBody(r.text);
        setCursor(r.cursor);
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyRef]);

  function handleChangeText(next: string) {
    onChangeBody(next);
    setCursor(undefined);
    onWikiQueryChange(getWikiQuery(next, selRef.current.start));
  }

  return (
    <>
      {!preview && (
        <View style={{ borderBottomWidth: 1, borderBottomColor: colors.bgBorder, backgroundColor: colors.bgSecondary }}>
          <MarkdownToolbar
            body={body}
            selRef={selRef}
            onApply={(text, cur) => { onChangeBody(text); setCursor(cur); onWikiQueryChange(null); }}
            onPickImage={onPickImage}
            uploading={uploading}
          />
        </View>
      )}

      {preview ? (
        body.trim()
          ? <MarkdownView body={body} colors={colors} replCtx={replCtx} onToggleCheckbox={onToggleCheckboxLine} />
          : <View />
      ) : (
        <TextInput
          ref={inputRef}
          value={body}
          onChangeText={handleChangeText}
          onSelectionChange={e => { selRef.current = e.nativeEvent.selection; }}
          selection={cursor}
          placeholder="Start writing…"
          placeholderTextColor={colors.textTertiary}
          multiline
          textAlignVertical="top"
          style={[{ color: colors.textSecondary, fontSize: 15, lineHeight: 26, minHeight: 300 }, { outlineStyle: "none", minHeight: "60vh" } as any]}
        />
      )}
    </>
  );
}
