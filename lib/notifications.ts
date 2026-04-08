import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { Task } from "./TasksContext";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function scheduleTaskReminders(tasks: Task[]): Promise<void> {
  if (Platform.OS === "web") return;

  // Cancel all existing scheduled notifications before rescheduling
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now     = new Date();
  const today   = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const pending = tasks.filter(t => !t.done && t.due_date);

  for (const task of pending) {
    if (!task.due_date) continue;

    if (task.due_date === today) {
      // Schedule for 9am today, or immediately if past 9am
      const triggerDate = new Date();
      triggerDate.setHours(9, 0, 0, 0);
      if (triggerDate <= now) continue; // already past, skip

      await Notifications.scheduleNotificationAsync({
        identifier: `task-today-${task.id}`,
        content: {
          title: "Due today",
          body: task.title,
          data: { taskId: task.id },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
      });
    } else if (task.due_date === tomorrowStr) {
      // Schedule for 9am today as a "due tomorrow" reminder
      const triggerDate = new Date();
      triggerDate.setHours(20, 0, 0, 0); // 8pm reminder for tomorrow
      if (triggerDate <= now) continue;

      await Notifications.scheduleNotificationAsync({
        identifier: `task-tomorrow-${task.id}`,
        content: {
          title: "Due tomorrow",
          body: task.title,
          data: { taskId: task.id },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
      });
    } else if (task.due_date < today) {
      // Overdue — fire immediately (once per overdue task per app open)
      await Notifications.scheduleNotificationAsync({
        identifier: `task-overdue-${task.id}`,
        content: {
          title: "Overdue",
          body: task.title,
          data: { taskId: task.id },
        },
        trigger: null, // fire immediately
      });
    }
  }
}
