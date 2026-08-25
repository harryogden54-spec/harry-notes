import React, { useEffect, useRef, useState } from "react";
import {
  View, Pressable, Modal, TextInput as RNTextInput, Platform, useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text, Checkbox } from "@/components/ui";
import { spacing, radius, fontFamily, iconSize } from "@/lib/theme";
import { useDumpsActions, type Dump } from "@/lib/DumpContext";

const SAVE_DEBOUNCE_MS = 600;

export function wordCount(text: string): number {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}

type Props = {
  /** Today's journal entry, or undefined until the first character is typed. */
  entry: Dump | undefined;
  date: string;
};

/**
 * Block D: today's journal. One entry per day — the calendar dot, the day panel
 * and this box are all the same row, so making it a list of captures again
 * would leave the calendar unable to say what a day holds.
 *
 * The row is created lazily on the first keystroke rather than on mount, so
 * opening the screen and closing it doesn't leave an empty entry behind (which
 * would still light up the calendar).
 */
export function JournalBox({ entry, date }: Props) {
  const { colors, shadow } = useTheme();
  const { addDump, updateDump } = useDumpsActions();
  const { width, height } = useWindowDimensions();

  const [text, setText]       = useState(entry?.content ?? "");
  const [expanded, setExpanded] = useState(false);
  const idRef    = useRef<string | undefined>(entry?.id);
  const timer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Whether the local draft is ahead of `entry` — see the sync effect below.
  const dirtyRef = useRef(false);

  // Adopt a newer copy of the entry (another device, or the row arriving from
  // the first sync) only when nothing is waiting to be written here. Without
  // the guard an in-flight remote merge would yank the caret mid-sentence.
  useEffect(() => {
    idRef.current = entry?.id;
    if (dirtyRef.current) return;
    setText(entry?.content ?? "");
  }, [entry?.id, entry?.content]);

  // A new day means a different row: drop whatever was on screen.
  useEffect(() => {
    dirtyRef.current = false;
    setText(entry?.content ?? "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  function flush(value: string) {
    dirtyRef.current = false;
    if (idRef.current) {
      updateDump(idRef.current, { content: value });
    } else if (value.trim()) {
      idRef.current = addDump({ tag: "journal", note_date: date, content: value });
    }
  }

  function handleChange(value: string) {
    setText(value);
    dirtyRef.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flush(value), SAVE_DEBOUNCE_MS);
  }

  // Unmounting mid-debounce (tab switch, screen teardown) must not lose the
  // tail of what was typed. The cleanup reads the latest text from a ref and
  // the effect has no deps on purpose: listing `text` would re-run the cleanup
  // on every keystroke, which is the debounce written backwards.
  const textRef = useRef(text);
  useEffect(() => { textRef.current = text; }, [text]);
  useEffect(() => () => {
    if (timer.current) {
      clearTimeout(timer.current);
      if (dirtyRef.current) flush(textRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleHandwritten() {
    const next = !entry?.handwritten;
    if (idRef.current) {
      updateDump(idRef.current, { handwritten: next || undefined });
    } else {
      // Ticking the box before writing anything is a real intent — create the
      // row so the flag survives, and the text lands in it on the next keystroke.
      idRef.current = addDump({ tag: "journal", note_date: date, content: text });
      updateDump(idRef.current, { handwritten: next || undefined });
    }
  }

  const handwritten = !!entry?.handwritten;

  const field = (big: boolean) => (
    <RNTextInput
      value={text}
      onChangeText={handleChange}
      multiline
      textAlignVertical="top"
      placeholder="How was it, then?"
      placeholderTextColor={colors.textTertiary}
      style={[
        {
          flex: big ? 1 : undefined,
          minHeight: big ? undefined : 120,
          color: colors.textPrimary,
          fontSize: big ? 16 : 15,
          lineHeight: big ? 26 : 22,
          fontFamily: fontFamily.regular,
        },
        { outlineStyle: "none" } as any,
      ]}
    />
  );

  // One press target for box and label. The Checkbox is deliberately inert:
  // nested pressables on react-native-web let the inner one handle the click,
  // so a live checkbox inside a live row toggles once or twice depending on
  // exactly where the pointer landed.
  const HandwrittenToggle = (
    <Pressable
      onPress={toggleHandwritten}
      style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: handwritten }}
      accessibilityLabel="Written by hand"
    >
      <View pointerEvents="none">
        <Checkbox size={16} checked={handwritten} onToggle={toggleHandwritten} />
      </View>
      <Text size="meta" secondary>Written by hand</Text>
    </Pressable>
  );

  return (
    <View style={{ gap: spacing[3] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
        <Text size="cardTitle" weight="semibold" style={{ flex: 1 }}>Today&apos;s dump</Text>
        <Pressable
          onPress={() => setExpanded(true)}
          hitSlop={10}
          accessibilityLabel="Expand journal"
          // @ts-ignore web-only tooltip
          title={Platform.OS === "web" ? "Expand" : undefined}
        >
          <Ionicons name="expand-outline" size={iconSize.sm} color={colors.textTertiary} />
        </Pressable>
      </View>

      <View style={{
        backgroundColor: colors.bgTertiary,
        borderRadius: radius.lg,
        borderWidth: 1, borderColor: colors.bgBorder,
        padding: spacing[3],
      }}>
        {field(false)}
      </View>

      {HandwrittenToggle}

      {/* Expanded: a large centred panel rather than the whole window — the
          nav and the rest of the screen stay visible around it on purpose.

          animationType="none" is deliberate. react-native-web's ModalAnimation
          only clears its `animatedOut` style — which carries
          `pointerEvents: 'none'` — when the CSS animation fires `animationend`.
          Under `prefers-reduced-motion: reduce` the browser never runs it, so a
          fade/slide modal can strand an inert, invisible copy of itself in the
          DOM. With no animation the library calls its own end callback
          directly. MobileTabBar's sheet already does this. */}
      <Modal visible={expanded} transparent animationType="none" onRequestClose={() => setExpanded(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: colors.scrim, alignItems: "center", justifyContent: "center", padding: spacing[6] }}
          onPress={() => setExpanded(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{
              width: Math.min(width * 0.88, 900),
              height: Math.min(height * 0.86, 760),
              backgroundColor: colors.bgSecondary,
              borderRadius: radius["2xl"],
              borderWidth: 1, borderColor: colors.bgBorder,
              padding: spacing[5],
              gap: spacing[3],
              ...shadow("overlay"),
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
              <Text size="lg" weight="bold" style={{ flex: 1 }}>Today&apos;s dump</Text>
              <Pressable onPress={() => setExpanded(false)} hitSlop={10} accessibilityLabel="Close">
                <Ionicons name="contract-outline" size={iconSize.md} color={colors.textTertiary} />
              </Pressable>
            </View>

            <View style={{ flex: 1 }}>{field(true)}</View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[4] }}>
              {HandwrittenToggle}
              <View style={{ flex: 1 }} />
              <Text size="meta" tertiary>
                {wordCount(text)} word{wordCount(text) === 1 ? "" : "s"}
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
