# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start dev server (choose platform)
npm run start          # Expo Go / dev client
npm run ios            # iOS simulator
npm run android        # Android emulator
npm run web            # Browser

# Deploy (web only — Cloudflare Pages via Wrangler)
npm run deploy         # expo export --platform web && wrangler pages deploy
```

There is no test runner configured. TypeScript is checked implicitly by the Expo build toolchain.

## Architecture

**Stack:** Expo SDK 54 · expo-router v6 · React Native 0.81 · NativeWind v4 (Tailwind CSS) · expo-sqlite · Supabase (sync)

### Routing

expo-router file-based routing. All screens live under `app/`:
- `app/(tabs)/` — tab bar: `index` (Dashboard), `tasks`, `lists`, `notes`, `calendar`
- `app/settings.tsx` — modal screen
- `app/_layout.tsx` — root layout: wraps everything in providers, initialises the DB, requests notification permissions

### State / Data layer

Each domain has a Context + Provider in `lib/`:

| Context | File | Persists to |
|---------|------|-------------|
| Tasks | `TasksContext.tsx` | AsyncStorage → Supabase (debounced 1.5 s) |
| Lists | `ListsContext.tsx` | AsyncStorage → Supabase |
| Notes | `NotesContext.tsx` | AsyncStorage → Supabase |
| Theme | `ThemeContext.tsx` | AsyncStorage |
| Toast | `ToastContext.tsx` | in-memory only |

All providers are composed in `app/_layout.tsx`. The pattern is: load from local storage first (instant), then merge with remote (last-`updated_at` wins).

`lib/db.ts` — expo-sqlite singleton (`getDb()`) with versioned migrations (`SCHEMA_VERSION`). SQLite is used as the durable local store on native; web falls back to AsyncStorage only.

`lib/storage.ts` — thin async wrapper around `@react-native-async-storage/async-storage`.

`lib/supabase.ts` — `syncFetch`, `syncUpsert`, `syncDelete` helpers used by the context providers.

### Design system

**Single source of truth:** `lib/theme.ts` exports typed tokens (`colors`, `lightColors`, `spacing`, `radius`, `typography`). These mirror `tailwind.config.js` exactly so the same values work both in NativeWind classes and in `StyleSheet` / inline styles (e.g. react-navigation theme config).

- Use NativeWind Tailwind classes wherever possible
- Use `lib/useTheme.ts` (`useTheme()`) when you need JS-side color values — it returns the correct palette for the current color scheme
- Never hardcode color hex values; always reference tokens

**Color palette (Linear-inspired, dark-first):**
- Backgrounds: `bg-bg-primary` (#0D0D0D) → `bg-bg-secondary` (#141414) → `bg-bg-tertiary` (#1A1A1A)
- Accent: `accent` (#5B6AD0 indigo)
- Text: `text-text-primary` / `text-text-secondary` / `text-text-tertiary`

### UI components

Shared primitives live in `components/ui/` and are re-exported from `components/ui/index.ts`:
`Text`, `Card`, `CardPressable`, `Divider`, `Badge`, `Button`, `Checkbox`, `TextInput`, `DatePicker`, `EmptyState`, `SearchBar`, `Toast`, `ToastContainer`

Always prefer these over raw RN primitives to keep styling consistent.
