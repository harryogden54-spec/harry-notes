import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import "react-native-reanimated";
import "../global.css";

import { Platform, StyleSheet, View } from "react-native";
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
import { useTheme } from "@/lib/useTheme";
import { ToastProvider } from "@/lib/ToastContext";
import { StickyNotesProvider } from "@/lib/StickyNotesContext";
import { ToastContainer } from "@/components/ui";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

SplashScreen.preventAutoHideAsync();

function AppShell() {
  const { scheme, themeReady } = useThemeContext();
  const { colors } = useTheme();
  const { tasks, loaded: tasksLoaded } = useTasks();
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

  // Gate render on native until fonts loaded.
  // Gate render on web until Ionicons font loaded AND theme resolved (prevents flash).
  if (!fontsLoaded) return null;
  if (!themeReady) return <View style={{ flex: 1, backgroundColor: colors.bgPrimary }} />;

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
