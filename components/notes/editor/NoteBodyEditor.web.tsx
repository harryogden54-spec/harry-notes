import React, { useRef, useEffect, useCallback } from "react";
import { spacing, radius, fontFamily } from "@/lib/theme";
import {
  parseMarkdownToBlocks, blocksToMarkdown, inlineMarkdownToHtml, inlineNodeToMarkdown,
  type Block, type BlockType,
} from "./markdownDom";
import type { BodyEditorHandle } from "./NoteBodyEditor";

type Colors = ReturnType<typeof import("@/lib/useTheme").useTheme>["colors"];

// NoteBodyEditorProps includes several native-only fields (preview, replCtx,
// selRef, cursor, onToggleCheckboxLine) that this implementation ignores —
// true WYSIWYG has no Preview mode, and checkbox-preview-tap doesn't apply
// since checkboxes are already live/interactive here. Typed loosely rather
// than importing the full native prop type, since half of it doesn't apply.
type Props = {
  body: string;
  onChangeBody: (body: string) => void;
  bodyRef: React.RefObject<BodyEditorHandle | null>;
  colors: Colors;
  onPickImage: () => void;
  uploading: boolean;
  onWikiQueryChange: (q: string | null) => void;
};

function createBlockElement(b: Block): HTMLElement {
  if (b.type === "divider") return document.createElement("hr");

  if (b.type === "image") {
    const wrap = document.createElement("div");
    wrap.setAttribute("data-md-type", "image");
    wrap.contentEditable = "false";
    wrap.style.margin = "8px 0";
    const img = document.createElement("img");
    img.setAttribute("src", b.src ?? "");
    img.style.maxWidth = "100%";
    img.style.borderRadius = "8px";
    img.style.display = "block";
    wrap.appendChild(img);
    return wrap;
  }

  if (b.type === "bullet") {
    const li = document.createElement("li");
    li.setAttribute("data-md-type", "bullet");
    li.style.display = "list-item";
    li.style.marginLeft = "22px";
    li.innerHTML = inlineMarkdownToHtml(b.text) || "<br/>";
    return li;
  }

  if (b.type === "checkbox") {
    const row = document.createElement("div");
    row.setAttribute("data-md-type", "checkbox");
    row.setAttribute("data-checked", String(!!b.checked));
    row.style.display = "flex";
    row.style.alignItems = "flex-start";
    row.style.gap = "8px";
    row.style.margin = "2px 0";

    const toggle = document.createElement("span");
    toggle.contentEditable = "false";
    toggle.className = "md-checkbox-toggle";
    toggle.textContent = b.checked ? "☑" : "☐";
    (toggle.style as any).cursor = "pointer";
    (toggle.style as any).userSelect = "none";
    toggle.style.flexShrink = "0";
    toggle.style.marginTop = "2px";

    const label = document.createElement("span");
    label.setAttribute("data-md-checkbox-label", "true");
    label.style.flex = "1";
    label.style.textDecoration = b.checked ? "line-through" : "none";
    label.innerHTML = inlineMarkdownToHtml(b.text) || "<br/>";

    row.appendChild(toggle);
    row.appendChild(label);
    return row;
  }

  const tag = b.type === "h1" ? "h1" : b.type === "h2" ? "h2" : b.type === "h3" ? "h3" : "div";
  const el = document.createElement(tag);
  if (b.type !== "paragraph" && b.type !== "empty") el.setAttribute("data-md-type", b.type);
  el.innerHTML = inlineMarkdownToHtml(b.text) || "<br/>";
  return el;
}

function findTopLevelBlock(container: HTMLElement, node: Node | null): HTMLElement | null {
  while (node && node !== container) {
    if (node.parentElement === container) return node as HTMLElement;
    node = node.parentNode;
  }
  return null;
}

/** Markdown (with formatting preserved) for the content covered by a Range. */
function markdownInRange(range: Range): string {
  const frag = range.cloneContents();
  const wrapper = document.createElement("div");
  wrapper.appendChild(frag);
  return inlineNodeToMarkdown(wrapper);
}

function serializeContainer(container: HTMLElement): string {
  const blocks: Block[] = [];
  container.childNodes.forEach(node => {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName;
    if (tag === "HR") { blocks.push({ type: "divider", text: "" }); return; }
    if (tag === "H1") { blocks.push({ type: "h1", text: inlineNodeToMarkdown(el) }); return; }
    if (tag === "H2") { blocks.push({ type: "h2", text: inlineNodeToMarkdown(el) }); return; }
    if (tag === "H3") { blocks.push({ type: "h3", text: inlineNodeToMarkdown(el) }); return; }
    const mdType = el.getAttribute("data-md-type");
    if (mdType === "image") {
      const img = el.querySelector("img");
      blocks.push({ type: "image", text: "", src: img?.getAttribute("src") ?? "" });
      return;
    }
    if (mdType === "bullet") { blocks.push({ type: "bullet", text: inlineNodeToMarkdown(el) }); return; }
    if (mdType === "checkbox") {
      const label = el.querySelector('[data-md-checkbox-label]');
      const checked = el.getAttribute("data-checked") === "true";
      blocks.push({ type: "checkbox", text: label ? inlineNodeToMarkdown(label) : "", checked });
      return;
    }
    const text = inlineNodeToMarkdown(el);
    blocks.push(text.trim() === "" ? { type: "empty", text: "" } : { type: "paragraph", text });
  });
  return blocksToMarkdown(blocks);
}

/**
 * Web body editor — true WYSIWYG via a single contentEditable container.
 * Each top-level DOM child is one markdown line ("block"); bold/italic use
 * document.execCommand (still universally supported for this exact case);
 * H/H2/bullet/checklist swap the current block's element type.
 *
 * Lossless-fallback: DOM rebuilds only happen when `body` changes for a
 * reason other than this editor's own last edit (see lastSerializedRef) —
 * otherwise the live DOM (and caret) would be destroyed on every keystroke.
 */
export function NoteBodyEditor({ body, onChangeBody, bodyRef, colors, onPickImage, uploading, onWikiQueryChange }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastSerializedRef = useRef<string | null>(null);
  // Clicking a wikilink suggestion chip moves focus away from the
  // contentEditable container first, which clears/collapses the live
  // selection — so we stash the caret range whenever a "[[query" match is
  // found and restore it in insertWikiLink rather than trusting
  // window.getSelection() at click time.
  const lastWikiCaretRangeRef = useRef<Range | null>(null);

  const serialize = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const md = serializeContainer(container);
    lastSerializedRef.current = md;
    onChangeBody(md);
  }, [onChangeBody]);

  // Wikilink query: text from the start of the current block up to the
  // caret, matched against the same "[[partial" pattern getWikiQuery uses.
  const updateWikiQuery = useCallback(() => {
    const container = containerRef.current;
    const sel = window.getSelection();
    if (!container || !sel || sel.rangeCount === 0) { onWikiQueryChange(null); return; }
    const caretRange = sel.getRangeAt(0);
    const block = findTopLevelBlock(container, caretRange.startContainer);
    if (!block) { onWikiQueryChange(null); return; }
    const preRange = document.createRange();
    preRange.selectNodeContents(block);
    preRange.setEnd(caretRange.endContainer, caretRange.endOffset);
    const before = preRange.toString();
    const match = before.match(/\[\[([^\][]*)$/);
    onWikiQueryChange(match ? match[1] : null);
    lastWikiCaretRangeRef.current = match ? caretRange.cloneRange() : null;
  }, [onWikiQueryChange]);

  useEffect(() => {
    const handle: BodyEditorHandle = {
      focus: () => containerRef.current?.focus(),

      insertWikiLink: (title: string) => {
        const container = containerRef.current;
        const sel = window.getSelection();
        if (!container || !sel) return;
        // Prefer the stashed range from when the "[[query" was detected —
        // clicking the suggestion chip already moved focus away, clearing
        // the live selection by the time this runs.
        const caretRange = lastWikiCaretRangeRef.current ?? (sel.rangeCount > 0 ? sel.getRangeAt(0) : null);
        if (!caretRange) return;
        const block = findTopLevelBlock(container, caretRange.startContainer);
        if (!block) return;

        const preRange = document.createRange();
        preRange.selectNodeContents(block);
        preRange.setEnd(caretRange.endContainer, caretRange.endOffset);
        const beforeMd = markdownInRange(preRange);
        const bracketIdx = beforeMd.lastIndexOf("[[");
        if (bracketIdx === -1) return;

        const postRange = document.createRange();
        postRange.selectNodeContents(block);
        postRange.setStart(caretRange.endContainer, caretRange.endOffset);
        const afterMd = markdownInRange(postRange);

        const newBlockMd = `${beforeMd.slice(0, bracketIdx)}[[${title}]] ${afterMd}`;
        block.innerHTML = inlineMarkdownToHtml(newBlockMd) || "<br/>";

        const r = document.createRange();
        r.selectNodeContents(block);
        r.collapse(false);
        sel.removeAllRanges();
        sel.addRange(r);
        container.focus();
        lastWikiCaretRangeRef.current = null;
        onWikiQueryChange(null);
        serialize();
      },

      insertImage: (url: string) => {
        const container = containerRef.current;
        if (!container) return;
        const sel = window.getSelection();
        const block = sel && sel.rangeCount > 0 ? findTopLevelBlock(container, sel.getRangeAt(0).startContainer) : null;
        const imgBlock = createBlockElement({ type: "image", text: "", src: url });
        if (block) block.after(imgBlock);
        else container.appendChild(imgBlock);
        serialize();
      },
    };
    (bodyRef as React.MutableRefObject<BodyEditorHandle | null>).current = handle;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyRef, serialize, onWikiQueryChange]);

  // Rebuild the DOM only for external changes (note switch, remote sync) —
  // not for the echo of our own edits.
  useEffect(() => {
    if (body === lastSerializedRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";
    const blocks = parseMarkdownToBlocks(body);
    for (const b of blocks) container.appendChild(createBlockElement(b));
    lastSerializedRef.current = body;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [body]);

  const handleInput = useCallback(() => { serialize(); updateWikiQuery(); }, [serialize, updateWikiQuery]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.classList?.contains("md-checkbox-toggle")) {
      const row = target.closest('[data-md-type="checkbox"]') as HTMLElement | null;
      if (!row) return;
      const checked = row.getAttribute("data-checked") === "true";
      const next = !checked;
      row.setAttribute("data-checked", String(next));
      target.textContent = next ? "☑" : "☐";
      const label = row.querySelector('[data-md-checkbox-label]') as HTMLElement | null;
      if (label) label.style.textDecoration = next ? "line-through" : "none";
      serialize();
    }
  }, [serialize]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onWikiQueryChange(null); return; }
    if (e.key !== "Enter" || e.shiftKey) return;
    const container = containerRef.current;
    const sel = window.getSelection();
    if (!container || !sel || sel.rangeCount === 0) return;
    const block = findTopLevelBlock(container, sel.getRangeAt(0).startContainer);
    if (!block) return;
    const isSpecial = block.tagName === "H1" || block.tagName === "H2" || block.tagName === "H3"
      || block.getAttribute("data-md-type") === "bullet" || block.getAttribute("data-md-type") === "checkbox";
    if (!isSpecial) return; // let the browser's default Enter create a plain sibling div
    e.preventDefault();
    const next = document.createElement("div");
    next.innerHTML = "<br/>";
    block.after(next);
    const range = document.createRange();
    range.setStart(next, 0);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    serialize();
  }, [serialize, onWikiQueryChange]);

  const setCurrentBlockType = useCallback((type: BlockType) => {
    const container = containerRef.current;
    const sel = window.getSelection();
    if (!container || !sel || sel.rangeCount === 0) return;
    const block = findTopLevelBlock(container, sel.getRangeAt(0).startContainer);
    if (!block) return;
    const currentLabel = block.getAttribute("data-md-type") === "checkbox"
      ? block.querySelector('[data-md-checkbox-label]')
      : block;
    const text = currentLabel ? inlineNodeToMarkdown(currentLabel) : "";
    const next = createBlockElement({ type, text, checked: false });
    block.replaceWith(next);
    const range = document.createRange();
    range.selectNodeContents(next);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    container.focus();
    serialize();
  }, [serialize]);

  const tools: { label: string; bold?: boolean; italic?: boolean; onPress: () => void }[] = [
    { label: "B", bold: true,   onPress: () => document.execCommand("bold") },
    { label: "I", italic: true, onPress: () => document.execCommand("italic") },
    { label: "H",                onPress: () => setCurrentBlockType("h1") },
    { label: "H2",               onPress: () => setCurrentBlockType("h2") },
    { label: "•",                onPress: () => setCurrentBlockType("bullet") },
    { label: "☑",                onPress: () => setCurrentBlockType("checkbox") },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
      <div
        style={{
          display: "flex", flexDirection: "row", alignItems: "center", gap: spacing[1],
          borderBottom: `1px solid ${colors.bgBorder}`, background: colors.bgSecondary,
          padding: `${spacing[2]}px ${spacing[3]}px`, marginBottom: spacing[3],
        }}
      >
        {tools.map(t => (
          <button
            key={t.label}
            onMouseDown={e => e.preventDefault()}
            onClick={t.onPress}
            style={{
              border: "none", background: "transparent", cursor: "pointer",
              color: colors.textSecondary, fontSize: 14,
              fontFamily: t.bold ? fontFamily.bold : fontFamily.regular,
              fontStyle: t.italic ? "italic" : "normal",
              padding: `${spacing[2]}px ${spacing[3]}px`, borderRadius: radius.sm,
            }}
          >
            {t.label}
          </button>
        ))}
        <button
          onMouseDown={e => e.preventDefault()}
          onClick={onPickImage}
          disabled={uploading}
          style={{
            border: "none", background: "transparent", cursor: uploading ? "default" : "pointer",
            color: colors.textSecondary, fontSize: 13,
            padding: `${spacing[2]}px ${spacing[3]}px`, borderRadius: radius.sm,
            opacity: uploading ? 0.5 : 1,
          }}
        >
          {uploading ? "…" : "🖼"}
        </button>
      </div>
      <div
        ref={containerRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onPaste={handlePaste}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        style={{
          flex: 1,
          outline: "none",
          color: colors.textSecondary,
          fontSize: 15,
          lineHeight: "26px",
          minHeight: "60vh",
        }}
      />
    </div>
  );
}
