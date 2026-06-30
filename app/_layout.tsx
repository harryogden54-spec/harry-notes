import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useMemo, useRef } from "react";
import "react-native-reanimated";
import "../global.css";

import { Platform, StyleSheet, View } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { Ionicons } from "@expo/vector-icons";
import { initDb } from "@/lib/db";
import { requestNotificationPermission, scheduleTaskReminders } from "@/lib/notifications";
import { useTasksData } from "@/lib/TasksContext";
import { TasksProvider } from "@/lib/TasksContext";
import { useListsData } from "@/lib/ListsContext";
import { useNotesData, useNotesActions } from "@/lib/NotesContext";
import { migrateListsToNotes } from "@/lib/migrateListsToNotes";
import { migrateBlocksToBody } from "@/lib/migrateBlocksToBody";
import { ListsProvider } from "@/lib/ListsContext";
import { NotesProvider } from "@/lib/NotesContext";
import { DumpProvider } from "@/lib/DumpContext";
import { ThemeProvider, useThemeContext } from "@/lib/ThemeContext";
import { useTheme } from "@/lib/useTheme";
import { ToastProvider } from "@/lib/ToastContext";
import { ToastContainer } from "@/components/ui";
import { CommandPaletteProvider } from "@/lib/CommandPaletteContext";
import { CommandPalette } from "@/components/CommandPalette";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

SplashScreen.preventAutoHideAsync();

function AppShell() {
  const { scheme, themeReady } = useThemeContext();
  const { colors } = useTheme();
  const { tasks, loaded: tasksLoaded } = useTasksData();
  const { lists, loaded: listsLoaded } = useListsData();
  const { notes, loaded: notesLoaded } = useNotesData();
  const { bulkAddNotes, updateNote: updateNoteFn } = useNotesActions();
  // On web, both Inter and Ionicons are declared via CSS @font-face in
  // global.css pointing at /assets/fonts/. We must NOT load them via useFonts
  // on web: expo-font injects @font-face rules with Metro-hashed URLs that
  // Cloudflare Pages serves as index.html, overriding the working CSS rules
  // and causing blank squares (Ionicons) or serif fallback (Inter).
  const [nativeFontsLoaded] = useFonts(
    Platform.OS === "web"
      ? {} // CSS handles all fonts on web — resolve immediately
      : {
          Inter_400Regular,
          Inter_500Medium,
          Inter_600SemiBold,
          Inter_700Bold,
          ...Ionicons.font,
        }
  );
  // On web the CSS font-face loads synchronously; on native wait for useFonts.
  const fontsLoaded = Platform.OS === "web" ? true : (nativeFontsLoaded ?? false);

  // All hooks must be declared before any conditional return.
  const isFirst = useRef(true);
  const fadeOpacity = useSharedValue(0);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fadeOpacity.value }));
  const overlayColor = colors.bgPrimary;

  useEffect(() => {
    if (!fontsLoaded) return;
    // Fire-and-forget: don't block render on DB init
    if (Platform.OS === "web") {
      SplashScreen.hideAsync();
      return;
    }
    initDb().catch(console.error).finally(() => SplashScreen.hideAsync());
  }, [fontsLoaded]);

  // One-time migration: convert existing lists → notes with checkbox blocks,
  // then convert any block-based notes into markdown bodies (order matters so
  // freshly-migrated lists are converted too).
  useEffect(() => {
    if (!listsLoaded || !notesLoaded) return;
    (async () => {
      await migrateListsToNotes(lists, notes, bulkAddNotes);
      await migrateBlocksToBody(notes, updateNoteFn);
    })().catch(console.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listsLoaded, notesLoaded]);

  // Fingerprint only id+due_date — title changes do not affect scheduling and
  // were causing cancelAllScheduledNotificationsAsync on every keystroke.
  const notifKey = useMemo(
    () => tasks
      .filter(t => !t.done && t.due_date)
      .map(t => `${t.id}:${t.due_date}`)
      .sort()
      .join("|"),
    [tasks]
  );

  useEffect(() => {
    if (Platform.OS === "web" || !tasksLoaded) return;
    requestNotificationPermission().then(granted => {
      if (granted) scheduleTaskReminders(tasks);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifKey, tasksLoaded]);

  // Theme cross-fade: flash an opaque overlay then fade it out on scheme change
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    fadeOpacity.value = 1;
    fadeOpacity.value = withTiming(0, { duration: 200 });
  }, [scheme]);

  // Gate render on native until fonts loaded.
  // Gate render on web until Ionicons font loaded AND theme resolved (prevents flash).
  if (!fontsLoaded) return null;
  if (!themeReady) return <View style={{ flex: 1, backgroundColor: colors.bgPrimary }} />;

  return (
    <NavThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false, presentation: "modal" }} />
        <Stack.Screen name="settings/appearance" options={{ headerShown: false, presentation: "modal" }} />
      </Stack>
      <CommandPalette />
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor, pointerEvents: "none" }, fadeStyle]} />
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
              <DumpProvider>
              <ToastProvider>
                <CommandPaletteProvider>
                  <AppShell />
                  <ToastContainer />
                </CommandPaletteProvider>
              </ToastProvider>
              </DumpProvider>
            </NotesProvider>
          </ListsProvider>
        </TasksProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
