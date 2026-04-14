import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";
import "../global.css";

import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { initDb } from "@/lib/db";
import { requestNotificationPermission, scheduleTaskReminders } from "@/lib/notifications";
import { useTasks } from "@/lib/TasksContext";
import { TasksProvider } from "@/lib/TasksContext";
import { ListsProvider } from "@/lib/ListsContext";
import { NotesProvider } from "@/lib/NotesContext";
import { ThemeProvider, useThemeContext } from "@/lib/ThemeContext";
import { ToastProvider } from "@/lib/ToastContext";
import { StickyNotesProvider } from "@/lib/StickyNotesContext";
import { ToastContainer } from "@/components/ui";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

SplashScreen.preventAutoHideAsync();

function AppShell() {
  const { scheme } = useThemeContext();
  const { tasks, loaded: tasksLoaded } = useTasks();

  useEffect(() => {
    // Fire-and-forget: don't block render on DB init
    if (Platform.OS === "web") {
      SplashScreen.hideAsync();
      return;
    }
    initDb().catch(console.error).finally(() => SplashScreen.hideAsync());
  }, []);

  // Request permission once on first load, then reschedule whenever tasks change
  useEffect(() => {
    if (Platform.OS === "web" || !tasksLoaded) return;
    requestNotificationPermission().then(granted => {
      if (granted) scheduleTaskReminders(tasks);
    });
  }, [tasks, tasksLoaded]);

  return (
    <NavThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false, presentation: "modal" }} />
      </Stack>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <TasksProvider>
          <ListsProvider>
            <NotesProvider>
              <StickyNotesProvider>
                <ToastProvider>
                  <AppShell />
                  <ToastContainer />
                </ToastProvider>
              </StickyNotesProvider>
            </NotesProvider>
          </ListsProvider>
        </TasksProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
