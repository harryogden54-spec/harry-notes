import React, { useMemo, useState, useCallback } from "react";
import { View, Pressable, ScrollView, Modal, TextInput as RNTextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/useTheme";
import { Text, Select } from "@/components/ui";
import { spacing, radius, shape, fontFamily, iconSize, inputText } from "@/lib/theme";
import {
  useDumpsActions, goalsForHorizon, goalsOf, goalTitle, goalDetail,
  GOAL_HORIZONS, GOAL_HORIZON_LABEL, type Dump, type GoalHorizon,
} from "@/lib/DumpContext";

const HORIZON_OPTIONS = GOAL_HORIZONS.map(h => ({ value: h, label: GOAL_HORIZON_LABEL[h] }));

type Props = {
  dumps: Dump[];
};

/**
 * Goals, living in the Browse box's idle space.
 *
 * Deliberately not a page. A goals page is a place you have to decide to visit,
 * and a goal you have to go and look at is a goal you stop looking at. This is
 * the largest area on the Dump screen that is visible without doing anything —
 * it previously held a decorative quote — so the goals are simply there
 * whenever you are not searching.
 *
 * The quote is not gone: it is now the empty state, shown only until the first
 * goal exists.
 */
export function GoalsBox({ dumps }: Props) {
  const { colors } = useTheme();
  const { addDump, updateDump, deleteDump } = useDumpsActions();

  const [expanded, setExpanded] = useState<string | null>(null);
  /** The goal being edited, or "new" for the add sheet. */
  const [editing, setEditing] = useState<Dump | "new" | null>(null);

  const goals = useMemo(() => goalsOf(dumps), [dumps]);
  const byHorizon = useMemo(
    () => GOAL_HORIZONS.map(h => ({ horizon: h, items: goalsForHorizon(dumps, h) })),
    [dumps]
  );

  const toggleAchieved = useCallback((g: Dump) => {
    updateDump(g.id, { achieved: g.achieved ? undefined : true });
  }, [updateDump]);

  if (goals.length === 0) {
    return (
      <>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing[2.5], paddingVertical: spacing[6] }}>
          <View style={{
            width: 34, height: 34, borderRadius: 999,
            borderWidth: 1, borderColor: colors.bgBorder,
            alignItems: "center", justifyContent: "center", marginBottom: spacing[0.5],
          }}>
            <Ionicons name="search" size={iconSize.md} color={colors.textTertiary} />
          </View>
          <Text size="base" secondary style={{ textAlign: "center", maxWidth: 380 }}>
            Harry you are probably doing better than you think
          </Text>
          <Text size="sm" tertiary style={{ textAlign: "center", maxWidth: 380, fontStyle: "italic" }}>
            &ldquo;its no swiss picnic for me either&rdquo; — Myself
          </Text>
          <Text size="meta" tertiary style={{ textAlign: "center", marginTop: spacing[1] }}>
            Search above, or pick a day on the calendar.
          </Text>
          <Pressable
            onPress={() => setEditing("new")}
            style={({ hovered }: any) => ({
              flexDirection: "row", alignItems: "center", gap: spacing[1.5],
              ...shape.pill, paddingVertical: spacing[1.5], marginTop: spacing[2],
              borderWidth: 1, borderColor: colors.bgBorder,
              backgroundColor: hovered ? colors.bgTertiary : "transparent",
            })}
            accessibilityRole="button"
            accessibilityLabel="Set a goal"
          >
            <Ionicons name="add" size={iconSize.xs} color={colors.textSecondary} />
            <Text size="meta" weight="medium" secondary>Set a goal</Text>
          </Pressable>
        </View>
        <GoalEditor
          target={editing}
          onClose={() => setEditing(null)}
          addDump={addDump}
          updateDump={updateDump}
          deleteDump={deleteDump}
        />
      </>
    );
  }

  const open = goals.filter(g => !g.achieved).length;

  return (
    <View style={{ flex: 1, gap: spacing[2.5] }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2] }}>
        <Text size="cardTitle" weight="semibold">Goals</Text>
        <View style={{ ...shape.countPill, backgroundColor: colors.bgTertiary, borderWidth: 1, borderColor: colors.bgBorder }}>
          <Text size="meta" tertiary>{open}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => setEditing("new")}
          hitSlop={8}
          accessibilityLabel="Add a goal"
          style={({ hovered }: any) => ({
            padding: spacing[1], borderRadius: radius.md,
            backgroundColor: hovered ? colors.bgTertiary : "transparent",
          })}
        >
          <Ionicons name="add" size={iconSize.sm} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: spacing[4], paddingBottom: spacing[2] }}>
        {byHorizon.map(({ horizon, items }) => {
          if (items.length === 0) return null;
          return (
            <View key={horizon} style={{ gap: spacing[1.5] }}>
              <Text size="label" weight="semibold" secondary style={{ textTransform: "uppercase" }}>
                {GOAL_HORIZON_LABEL[horizon]}
              </Text>
              {items.map(g => (
                <GoalRow
                  key={g.id}
                  goal={g}
                  expanded={expanded === g.id}
                  onToggleExpand={() => setExpanded(prev => (prev === g.id ? null : g.id))}
                  onToggleAchieved={() => toggleAchieved(g)}
                  onEdit={() => setEditing(g)}
                />
              ))}
            </View>
          );
        })}
      </ScrollView>

      <GoalEditor
        target={editing}
        onClose={() => setEditing(null)}
        addDump={addDump}
        updateDump={updateDump}
        deleteDump={deleteDump}
      />
    </View>
  );
}

/** One goal: tick, title, and its detail on demand. */
function GoalRow({ goal, expanded, onToggleExpand, onToggleAchieved, onEdit }: {
  goal: Dump;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleAchieved: () => void;
  onEdit: () => void;
}) {
  const { colors } = useTheme();
  const detail = goalDetail(goal);
  const done = !!goal.achieved;

  return (
    <View style={{ gap: spacing[1] }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing[2] }}>
        <Pressable
          onPress={onToggleAchieved}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={done ? `Mark "${goalTitle(goal)}" not achieved` : `Mark "${goalTitle(goal)}" achieved`}
          style={{ paddingTop: 2 }}
        >
          <View style={{
            width: 15, height: 15, borderRadius: 999,
            borderWidth: 1.5,
            borderColor: done ? colors.accent : colors.bgBorder,
            backgroundColor: done ? colors.accent : "transparent",
            alignItems: "center", justifyContent: "center",
          }}>
            {done && <Ionicons name="checkmark" size={9} color={colors.textInverse} />}
          </View>
        </Pressable>

        <Pressable
          onPress={detail ? onToggleExpand : onEdit}
          style={{ flex: 1 }}
          accessibilityRole="button"
        >
          <Text
            size="sm"
            style={{
              lineHeight: 20,
              color: done ? colors.textTertiary : colors.textPrimary,
              textDecorationLine: done ? "line-through" : "none",
            }}
          >
            {goalTitle(goal) || "Untitled goal"}
          </Text>
        </Pressable>

        {!!detail && (
          <Pressable onPress={onToggleExpand} hitSlop={8} accessibilityLabel={expanded ? "Hide detail" : "Show detail"}>
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={iconSize.xs}
              color={colors.textTertiary}
              style={{ marginTop: 4 }}
            />
          </Pressable>
        )}
        <Pressable onPress={onEdit} hitSlop={8} accessibilityLabel={`Edit "${goalTitle(goal)}"`}>
          <Ionicons name="create-outline" size={iconSize.xs} color={colors.textTertiary} style={{ marginTop: 4 }} />
        </Pressable>
      </View>

      {expanded && !!detail && (
        <Text size="sm" tertiary style={{ lineHeight: 20, paddingLeft: spacing[2] + 15 }}>
          {detail}
        </Text>
      )}
    </View>
  );
}

/**
 * Add / edit sheet.
 *
 * animationType="none" is deliberate — see the note in AddDumpBox: react-native-web's
 * ModalAnimation only unmounts an animated modal from its `animationend` handler,
 * so a suppressed animation strands an invisible pointer-events-none copy over
 * the page.
 */
function GoalEditor({ target, onClose, addDump, updateDump, deleteDump }: {
  target: Dump | "new" | null;
  onClose: () => void;
  addDump: ReturnType<typeof useDumpsActions>["addDump"];
  updateDump: ReturnType<typeof useDumpsActions>["updateDump"];
  deleteDump: ReturnType<typeof useDumpsActions>["deleteDump"];
}) {
  const { colors } = useTheme();
  const isNew = target === "new";
  const existing = target && target !== "new" ? target : null;

  const [text, setText] = useState("");
  const [horizon, setHorizon] = useState<GoalHorizon>("open");

  // Re-seed whenever a different goal is opened. Keyed on the id (or "new") so
  // switching straight from one goal to another refills the fields.
  const key = existing?.id ?? (isNew ? "new" : "");
  const [seededFor, setSeededFor] = useState("");
  if (target && key !== seededFor) {
    setSeededFor(key);
    setText(existing?.content ?? "");
    setHorizon((existing?.horizon as GoalHorizon) ?? "open");
  }

  if (!target) return null;

  function save() {
    const content = text.trim();
    if (!content) { onClose(); return; }
    if (existing) updateDump(existing.id, { content, horizon });
    else addDump({ tag: "goal", content, horizon });
    onClose();
  }

  function remove() {
    if (existing) deleteDump(existing.id);
    onClose();
  }

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing[4] }}>
        <Pressable
          onPress={onClose}
          accessibilityLabel="Close"
          style={{ position: "absolute", inset: 0, backgroundColor: colors.scrim } as any}
        />
        <View style={{
          width: "100%", maxWidth: 460, gap: spacing[3],
          backgroundColor: colors.bgSecondary,
          borderRadius: radius.xl, borderWidth: 1, borderColor: colors.bgBorder,
          padding: spacing[4],
        }}>
          <Text size="cardTitle" weight="semibold">{existing ? "Edit goal" : "New goal"}</Text>

          <RNTextInput
            value={text}
            onChangeText={setText}
            placeholder={"The goal in a line…\nAnything else worth remembering about it goes underneath."}
            placeholderTextColor={colors.textTertiary}
            multiline
            autoFocus
            style={[
              {
                minHeight: 132, ...inputText, fontFamily: fontFamily.regular,
                color: colors.textPrimary, textAlignVertical: "top",
                backgroundColor: colors.bgTertiary,
                borderRadius: radius.lg, borderWidth: 1, borderColor: colors.bgBorder,
                paddingHorizontal: spacing[3], paddingVertical: spacing[2.5],
              },
              { outlineStyle: "none" } as any,
            ]}
          />
          <Text size="meta" tertiary>First line is the goal; the rest is detail.</Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], zIndex: 10 }}>
            <Text size="meta" secondary>Horizon</Text>
            <Select
              value={horizon}
              options={HORIZON_OPTIONS}
              onChange={setHorizon}
              placeholder="No deadline"
              width={190}
              panelMinWidth={190}
            />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing[2], marginTop: spacing[1] }}>
            {existing && (
              <Pressable onPress={remove} hitSlop={6} accessibilityLabel="Delete goal"
                style={({ hovered }: any) => ({
                  padding: spacing[2], borderRadius: radius.md,
                  backgroundColor: hovered ? `${colors.danger}14` : "transparent",
                })}>
                <Ionicons name="trash-outline" size={iconSize.sm} color={colors.danger} />
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            <Pressable onPress={onClose} style={{ paddingHorizontal: spacing[3], paddingVertical: spacing[2] }}>
              <Text size="sm" secondary>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={save}
              style={{
                paddingHorizontal: spacing[4], paddingVertical: spacing[2],
                borderRadius: radius.md,
                backgroundColor: text.trim() ? colors.accent : colors.bgTertiary,
              }}
              accessibilityRole="button"
            >
              <Text size="sm" weight="semibold" style={{ color: text.trim() ? colors.textInverse : colors.textTertiary }}>
                Save
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
