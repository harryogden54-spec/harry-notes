import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import "react-native-reanimated";
import "../global.css";

import { Platform, StyleSheet } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { Ionicons } from "@expo/vector-icons";
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
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    ...Ionicons.font,
  });

  // All hooks must be declared before any conditional return.
  const isFirst = useRef(true);
  const fadeOpacity = useSharedValue(0);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fadeOpacity.value }));
  const overlayColor = scheme === "dark" ? "#0D0D0D" : "#FFFFFF";

  useEffect(() => {
    if (!fontsLoaded) return;
    // Fire-and-forget: don't block render on DB init
    if (Platform.OS === "web") {
      SplashScreen.hideAsync();
      return;
    }
    initDb().catch(console.error).finally(() => SplashScreen.hideAsync());
  }, [fontsLoaded]);

  // Request permission once on first load, then reschedule whenever tasks change
  useEffect(() => {
    if (Platform.OS === "web" || !tasksLoaded) return;
    requestNotificationPermission().then(granted => {
      if (granted) scheduleTaskReminders(tasks);
    });
  }, [tasks, tasksLoaded]);

  // Theme cross-fade: flash an opaque overlay then fade it out on scheme change
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    fadeOpacity.value = 1;
    fadeOpacity.value = withTiming(0, { duration: 200 });
  }, [scheme]);

  // Gate render on native only — splash screen covers the wait.
  // On web, render immediately; CSS @font-face handles the font swap.
  if (!fontsLoaded && Platform.OS !== "web") return null;

  return (
    <NavThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false, presentation: "modal" }} />
      </Stack>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }, fadeStyle]} pointerEvents="none" />
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
