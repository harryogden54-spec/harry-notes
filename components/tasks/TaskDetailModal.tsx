/**
 * The single surface for looking at a task — creating and editing both land
 * here, on every platform.
 *
 * Previously there were three presentations for the same content: a 420px
 * slide-over drawer on desktop, a full-window sheet on mobile, and a separate
 * TaskComposerModal for creation. Same fields, three layouts to keep in step.
 *
 * Creation works by making the task first and opening this on it, rather than
 * holding a draft: TaskDetailPanel edits live through updateTask, so a draft
 * would need a parallel write path. The screen deletes the task again if it is
 * closed still empty, which keeps the orphan case out of the data.
 */
import React from "react";
import { View, Modal, Pressable, Platform, useWindowDimensions } from "react-native";
import { useTheme } from "@/lib/useTheme";
import { spacing, radius, layout, getShadow } from "@/lib/theme";
import type { Task } from "@/lib/TasksContext";
import { TaskDetailPanel } from "./TaskDetailPanel";

type Props = {
  /** The task to show, or null when nothing is open. */
  task: Task | null;
  onClose: () => void;
};

export function TaskDetailModal({ task, onClose }: Props) {
  const { colors, scheme, shadow } = useTheme();
  const { width, height } = useWindowDimensions();
  const narrow = width < 640;

  if (!task) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: narrow ? spacing[3] : spacing[6] }}>
        <Pressable
          onPress={onClose}
          accessibilityLabel="Close task"
          style={{ position: "absolute", inset: 0, backgroundColor: colors.scrim } as any}
        />
        <View
          style={{
            width: "100%",
            maxWidth: layout.panel.modal,
            // Cap so a long task with many subtasks scrolls inside the card
            // rather than running off screen.
            maxHeight: height * (narrow ? 0.9 : 0.85),
            backgroundColor: colors.bgPrimary,
            borderRadius: narrow ? radius.xl : 24,
            borderWidth: 1,
            borderColor: colors.bgBorder,
            overflow: "hidden",
            ...shadow("overlay"),
            ...(Platform.OS === "web" ? { maxHeight: narrow ? "90vh" : "85vh" } as any : {}),
          }}
        >
          <TaskDetailPanel task={task} onClose={onClose} />
        </View>
      </View>
    </Modal>
  );
}
