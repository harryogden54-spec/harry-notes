import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { Task } from "./TasksContext";
import { getLocalDateStr } from "./utils";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleTaskReminders(tasks: Task[]): Promise<void> {
  if (Platform.OS === "web") return;

  const now         = new Date();
  const today       = getLocalDateStr(now);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = getLocalDateStr(tomorrowDate);

  const pending = tasks.filter(t => !t.done && t.due_date);

  // Build the map of notifications we want (identifier → notification params).
  // Overdue tasks are excluded from the diff — they fire immediately (trigger: null)
  // and don't appear in getAllScheduledNotificationsAsync, so we always schedule them.
  type NotifParams = { content: Notifications.NotificationContentInput; trigger: Notifications.SchedulableNotificationTriggerInput };
  const desired = new Map<string, NotifParams>();
  const overdueToFire: Array<{ id: string; title: string; taskId: string }> = [];

  for (const task of pending) {
    if (!task.due_date) continue;

    if (task.due_date === today) {
      const triggerDate = new Date();
      triggerDate.setHours(9, 0, 0, 0);
      if (triggerDate > now) {
        desired.set(`task-today-${task.id}`, {
          content: { title: "Due today", body: task.title, data: { taskId: task.id } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
        });
      }
    } else if (task.due_date === tomorrowStr) {
      // Schedule at 9am tomorrow — scheduling at today 20:00 silently misses
      // users who open the app after 20:00 (triggerDate <= now, so it was skipped).
      const triggerDate = new Date(tomorrowDate);
      triggerDate.setHours(9, 0, 0, 0);
      desired.set(`task-tomorrow-${task.id}`, {
        content: { title: "Due tomorrow", body: task.title, data: { taskId: task.id } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
      });
    } else if (task.due_date < today) {
      overdueToFire.push({ id: `task-overdue-${task.id}`, title: task.title, taskId: task.id });
    }
  }

  // Diff: cancel only notifications that are no longer needed, schedule only new ones.
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  const existingIds = new Set(existing.map(n => n.identifier));
  const desiredIds  = new Set(desired.keys());

  for (const id of existingIds) {
    if (!desiredIds.has(id)) await Notifications.cancelScheduledNotificationAsync(id);
  }
  for (const [id, params] of desired) {
    if (!existingIds.has(id)) {
      await Notifications.scheduleNotificationAsync({ identifier: id, content: params.content, trigger: params.trigger });
    }
  }

  // Overdue: always fire immediately (they vanish from the scheduled list right away).
  for (const { id, title, taskId } of overdueToFire) {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title: "Overdue", body: title, data: { taskId } },
      trigger: null,
    });
  }
}
