# Theme System
The Hoppscotch theme system provides a comprehensive, CSS custom properties (CSS variables)-based theming architecture that enables multiple background modes (system, light, dark, black) and accent color selections (green, teal, blue, indigo, purple, yellow, orange, red, pink). It dynamically applies themes at runtime through a Vue module and persists user preferences across sessions.

## Overview
The theme system is designed around two independent axes of customization — **background mode** (the overall lightness/darkness of the UI) and **accent color** (the primary brand/attention color used throughout the interface). This separation of concerns allows users to freely mix any background mode with any accent color.

The system uses **CSS custom properties** (CSS variables) scoped to the `:root` element, with theme-specific selectors such as `:root.light`, `:root.dark`, `:root.black`, and `:root[data-accent="..."]` to toggle between theme variants. This approach delivers instant theme switching without requiring a page reload.

At the application layer, the `theming.ts` Vue module (`HoppModule`) orchestrates the runtime application of themes by:

- Reading the user's persisted preference for background color and accent color.
- Watching for changes and applying the appropriate CSS class and data attribute on the `<html>` element.
- Handling the `"system"` preference mode by subscribing to the user's OS-level `prefers-color-scheme` media query.

The theme is persisted in the app's setting store using the keys `BG_COLOR` (for background mode) and `THEME_COLOR` (for accent color), with defaults of `"system"` and `"indigo"` respectively.

## Architecture
### Theme System Component Architecture
加载图表中...
The architecture follows a clean layered design:

- **User Interaction Layer** — Vue components (`ColorModePicker`, `AccentModePicker`, Spotlight) that capture user intent.
- **Settings Store** — A reactive RxJS-based store (`newstore/settings.ts`) that holds the authoritative state for `BG_COLOR` and `THEME_COLOR`.
- **Core Module** — The `theming.ts` Vue module (implementing the `HoppModule` interface) that watches the settings store and applies changes to the DOM.
- **Persistence Layer** — `PersistenceService` that reads/writes settings from/to `localStorage`, including migration from legacy `nuxt-color-mode` format.
- **CSS Layer** — SCSS mixins that define CSS custom properties for each theme variant, activated by class and attribute selectors on `:root`.

### Theme Resolution Flow
加载图表中...
## Core Theme Files
The theme system is composed of four SCSS files that are imported by the main `themes.scss` entry point:

### `themes.scss` — Theme Entry Point
[`packages/hoppscotch-common/assets/themes/themes.scss`](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/assets/themes/themes.scss)

This file imports all theme partials and applies CSS variable mixins conditionally based on the class or attribute present on the `:root` element:

scss1@import "./base-themes.scss";
2@import "./editor-themes.scss";
3@import "./accent-themes.scss";
4@import "./tippy-themes.scss";
5
6:root {
7  @include base-theme;
8  @include dark-theme;
9  @include green-theme;
10  @include dark-editor-theme;
11  @include dark-tippy-theme;
12}
13
14:root.light {
15  @include light-theme;
16  @include light-editor-theme;
17  @include light-tippy-theme;
18  color-scheme: light;
19}
20
21:root.dark {
22  @include dark-theme;
23  @include dark-editor-theme;
24  @include dark-tippy-theme;
25  color-scheme: dark;
26}
27
28:root.black {
29  @include black-theme;
30  @include black-editor-theme;
31  @include black-tippy-theme;
32  color-scheme: dark;
33}
34
35:root[data-accent="blue"]  { @include blue-theme; }
36:root[data-accent="green"] { @include green-theme; }
37:root[data-accent="teal"]  { @include teal-theme; }
38:root[data-accent="indigo"] { @include indigo-theme; }
39:root[data-accent="purple"] { @include purple-theme; }
40:root[data-accent="orange"] { @include orange-theme; }
41:root[data-accent="pink"]   { @include pink-theme; }
42:root[data-accent="red"]    { @include red-theme; }
43:root[data-accent="yellow"] { @include yellow-theme; }
>
Source: [themes.scss](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/assets/themes/themes.scss#L1-L69)

The entry point uses a **fallback hierarchy** — the bare `:root` selector includes the dark theme as the default, then `:root.light`, `:root.dark`, and `:root.black` override specific variables. Accent colors are applied separately via `data-accent` attribute.

### Background Mode Mixins
[`packages/hoppscotch-common/assets/themes/base-themes.scss`](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/assets/themes/base-themes.scss)

Defines four background mode mixins: `base-theme`, `light-theme`, `dark-theme`, and `black-theme`. Key CSS variable categories include:

- **Surface colors** (`--primary-color`, `--primary-light-color`, `--primary-dark-color`, `--primary-contrast-color`)
- **Text colors** (`--secondary-color`, `--secondary-light-color`, `--secondary-dark-color`)
- **Divider/border colors** (`--divider-color`, `--divider-light-color`, `--divider-dark-color`)
- **Semantic colors** for HTTP methods (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
- **Status colors** for response codes (info, success, redirect, error, server error)
- **Editor theme name** (`--editor-theme`) mapping to CodeMirror theme identifiers
- **Banner and tooltip colors**

Design intent: By using CSS custom properties throughout the entire UI, a single class switch on `:root` propagates theme changes to every component without re-rendering or JavaScript recalculation.

### Accent Color Mixins
[`packages/hoppscotch-common/assets/themes/accent-themes.scss`](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/assets/themes/accent-themes.scss)

Defines nine accent color mixins, each setting `--accent-color`, `--accent-light-color`, `--accent-dark-color`, `--accent-contrast-color`, and three gradient variables. For example:

scss1@mixin green-theme {
2  --accent-color: theme("colors.emerald.500");
3  --accent-light-color: theme("colors.emerald.400");
4  --accent-dark-color: theme("colors.emerald.600");
5  --accent-contrast-color: theme("colors.white");
6  --gradient-from-color: theme("colors.emerald.400");
7  --gradient-via-color: theme("colors.emerald.500");
8  --gradient-to-color: theme("colors.emerald.600");
9}
>
Source: [accent-themes.scss](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/assets/themes/accent-themes.scss#L1-L9)

### Editor Theme Variables
[`packages/hoppscotch-common/assets/themes/editor-themes.scss`](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/assets/themes/editor-themes.scss)

Defines CodeMirror editor syntax highlighting colors through CSS variables (`--editor-type-color`, `--editor-name-color`, `--editor-keyword-color`, etc.) with light, dark, and black variants.

### Tooltip/Popover Theme Styles
[`packages/hoppscotch-common/assets/themes/tippy-themes.scss`](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/assets/themes/tippy-themes.scss)

Defines tooltip and popover styling via the `tippy.js` library with light, dark, and black theme variants sharing a common `base-tippy-styles` mixin.

## Core Module Implementation
### `theming.ts` — Theme Application Module
[`packages/hoppscotch-common/src/modules/theming.ts`](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/theming.ts)

This module exports a `HoppModule` that hooks into the Vue application lifecycle via `onVueAppInit`. It performs two independent tasks:

typescript1import { useSettingStatic } from "@composables/settings"
2import { usePreferredDark, useStorage } from "@vueuse/core"
3import { App, Ref, computed, reactive, watch } from "vue"
4
5import type { HoppBgColor } from "~/newstore/settings"
6import { PersistenceService } from "~/services/persistence"
7import { HoppModule } from "."
8import { getService } from "./dioc"
9
10export type HoppColorMode = {
11  preference: HoppBgColor
12  value: Readonly<Exclude<HoppBgColor, "system">>
13}
14
15const persistenceService = getService(PersistenceService)
16
17const applyColorMode = (app: App) => {
18  const [settingPref] = useSettingStatic("BG_COLOR")
19
20  const currentLocalPreference = useStorage<HoppBgColor>(
21    "nuxt-color-mode",
22    "system",
23    persistenceService.hoppLocalConfigStorage,
24    {
25      listenToStorageChanges: true,
26    }
27  )
28
29  const systemPrefersDark = usePreferredDark()
30
31  const selection = computed<Exclude<HoppBgColor, "system">>(() => {
32    if (currentLocalPreference.value === "system") {
33      return systemPrefersDark.value ? "dark" : "light"
34    }
35    return currentLocalPreference.value
36  })
37
38  watch(
39    selection,
40    (newSelection) => {
41      document.documentElement.setAttribute("class", newSelection)
42    },
43    { immediate: true }
44  )
45
46  watch(
47    settingPref,
48    (newPref) => {
49      currentLocalPreference.value = newPref
50    },
51    { immediate: true }
52  )
53
54  const exposed: HoppColorMode = reactive({
55    preference: currentLocalPreference,
56    value: selection as Readonly<Ref<Exclude<HoppBgColor, "system">>>,
57  })
58
59  app.provide("colorMode", exposed)
60}
61
62const applyAccentColor = (_app: App) => {
63  const [pref] = useSettingStatic("THEME_COLOR")
64
65  watch(
66    pref,
67    (newPref) => {
68      document.documentElement.setAttribute("data-accent", newPref)
69    },
70    { immediate: true }
71  )
72}
73
74export default <HoppModule>{
75  onVueAppInit(app) {
76    applyColorMode(app)
77    applyAccentColor(app)
78  },
79}
>
Source: [theming.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/theming.ts#L1-L81)

**Design intent:**

- **Two-axis independence**: Color mode and accent color are applied through separate mechanisms (`class` vs `data-accent` attribute) so they do not interfere with each other.
- **System preference fallback**: When `BG_COLOR` is set to `"system"`, the `usePreferredDark()` composable (which listens to `prefers-color-scheme: dark`) determines whether light or dark mode should be active. The resolved value is exposed via the `selection` computed property.
- **Local storage bridge**: The `currentLocalPreference` ref bridges between the app's internal setting store and `localStorage`, enabling the theme to persist between sessions. Changes to the setting store automatically sync to local storage.
- **Provide/inject pattern**: The resolved `HoppColorMode` (containing both the user preference and the resolved value) is provided to the component tree via `app.provide("colorMode", exposed)`, allowing any component to reactively read the current color mode without direct store access.

## Usage Examples
### Basic Usage: Applying a Theme Setting
The fundamental API for changing themes is the `applySetting()` function, which dispatches a new value to the settings store:

typescript1import { applySetting } from "~/newstore/settings"
2
3// Switch to system mode (follows OS preference)
4applySetting("BG_COLOR", "system")
5
6// Switch to light mode
7applySetting("BG_COLOR", "light")
8
9// Switch to dark mode
10applySetting("BG_COLOR", "dark")
11
12// Switch to black mode
13applySetting("BG_COLOR", "black")
>
Source: [settings.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/settings.ts#L280-L292)

### Color Mode Picker Component
The `ColorModePicker.vue` component demonstrates how themes are presented to the user as selectable options with distinct icons:

vue1<template>
2  <div class="flex">
3    <HoppButtonSecondary
4      v-for="(color, index) of colors"
5      :key="`color-${index}`"
6      v-tippy="{ theme: 'tooltip' }"
7      :title="t(getColorModeName(color))"
8      :class="{
9        'bg-primaryLight !text-accent hover:text-accent': color === active,
10      }"
11      class="rounded"
12      :icon="getIcon(color)"
13      @click="setBGMode(color)"
14    />
15  </div>
16</template>
17
18<script setup lang="ts">
19import IconMonitor from "~icons/lucide/monitor"
20import IconSun from "~icons/lucide/sun"
21import IconCloud from "~icons/lucide/cloud"
22import IconMoon from "~icons/lucide/moon"
23import { applySetting, HoppBgColor, HoppBgColors } from "~/newstore/settings"
24import { useSetting } from "@composables/settings"
25import { useI18n } from "@composables/i18n"
26
27const t = useI18n()
28const colors = HoppBgColors
29const active = useSetting("BG_COLOR")
30
31const setBGMode = (color: HoppBgColor) => {
32  applySetting("BG_COLOR", color)
33}
34
35const getIcon = (color: HoppBgColor) => {
36  switch (color) {
37    case "system": return IconMonitor
38    case "light":  return IconSun
39    case "dark":   return IconCloud
40    case "black":  return IconMoon
41    default:       return IconMonitor
42  }
43}
44</script>
>
Source: [ColorModePicker.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/smart/ColorModePicker.vue#L1-L65)

### Accent Color Picker Component
The `AccentModePicker.vue` component shows how accent colors are selected and applied:

vue1<template>
2  <div class="flex">
3    <HoppButtonSecondary
4      v-for="(color, index) of accentColors"
5      :key="`color-${index}`"
6      v-tippy="{ theme: 'tooltip' }"
7      :title="`${color.charAt(0).toUpperCase()}${color.slice(1)}`"
8      :class="[{ 'bg-primaryLight': color === active }]"
9      class="rounded"
10      :icon="color === active ? IconCircleDot : IconCircle"
11      :color="color"
12      @click="setActiveColor(color)"
13    />
14  </div>
15</template>
16
17<script setup lang="ts">
18import IconCircle from "~icons/lucide/circle"
19import IconCircleDot from "~icons/lucide/circle-dot"
20import {
21  HoppAccentColors,
22  HoppAccentColor,
23  applySetting,
24} from "~/newstore/settings"
25import { useSetting } from "@composables/settings"
26
27const accentColors = HoppAccentColors
28const active = useSetting("THEME_COLOR")
29
30const setActiveColor = (color: HoppAccentColor) => {
31  document.documentElement.setAttribute("data-accent", color)
32  applySetting("THEME_COLOR", color)
33}
34</script>
>
Source: [AccentModePicker.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/smart/AccentModePicker.vue#L1-L43)

### Keyboard Shortcuts and Actions
Theme changes can also be triggered via keyboard shortcuts through the action system. These are registered in the default layout:

typescript1defineActionHandler("settings.theme.system", () => {
2  applySetting("BG_COLOR", "system")
3})
4
5defineActionHandler("settings.theme.light", () => {
6  applySetting("BG_COLOR", "light")
7})
8
9defineActionHandler("settings.theme.dark", () => {
10  applySetting("BG_COLOR", "dark")
11})
12
13defineActionHandler("settings.theme.black", () => {
14  applySetting("BG_COLOR", "black")
15})
>
Source: [default.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/layouts/default.vue#L204-L218)

### Reading the Current Theme Programmatically
Components can read the current resolved theme value (without the "system" abstraction) via the provided `colorMode`:

typescript1import { inject } from "vue"
2import type { HoppColorMode } from "~/modules/theming"
3
4// In a component setup
5const colorMode = inject<HoppColorMode>("colorMode")
6
7// colorMode.preference — the user's stored preference ("system", "light", "dark", "black")
8// colorMode.value      — the resolved value ("light", "dark") — never "system"
## Configuration Options
### Background Color Modes
OptionTypeDefaultDescription`BG_COLOR``"system" | "light" | "dark" | "black"``"system"`The background mode of the UI. `"system"` follows the OS-level preference.
### Accent Colors
OptionTypeDefaultDescription`THEME_COLOR``"green" | "teal" | "blue" | "indigo" | "purple" | "yellow" | "orange" | "red" | "pink"``"indigo"`The accent color used for interactive elements, highlights, and brand accents.
## API Reference
### `HoppBgColors` and `HoppBgColor`
typescriptexport const HoppBgColors = ["system", "light", "dark", "black"] as const
export type HoppBgColor = (typeof HoppBgColors)[number]
>
Source: [settings.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/settings.ts#L8-L10)

An array constant and union type representing all available background mode options.

### `HoppAccentColors` and `HoppAccentColor`
typescript1export const HoppAccentColors = [
2  "green", "teal", "blue", "indigo", "purple",
3  "yellow", "orange", "red", "pink",
4] as const
5export type HoppAccentColor = (typeof HoppAccentColors)[number]
>
Source: [settings.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/settings.ts#L12-L28)

An array constant and union type representing all available accent color options.

### `applySetting(settingKey, value)`
typescript1export function applySetting<K extends keyof SettingsDef>(
2  settingKey: K,
3  value: SettingsDef[K]
4): void
>
Source: [settings.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/settings.ts#L280-L292)

**Parameters:**

- `settingKey` (K): The key of the setting to apply. For theming, use `"BG_COLOR"` or `"THEME_COLOR"`.
- `value` (SettingsDef[K]): The value to set. Must match the expected type for the setting key.

**Description:** Dispatches a value change to the reactive RxJS-based settings store, which triggers subscribers (including the theme module) to apply the change.

### `useSetting(settingKey)`
typescriptexport function useSetting<K extends keyof SettingsDef>(
  settingKey: K
): Ref<SettingsDef[K]>
>
Source: [composables/settings.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/composables/settings.ts#L57-L75)

**Parameters:**

- `settingKey` (K): The key of the setting to observe.

**Returns:** A reactive Vue `Ref` that updates whenever the setting value changes in the store.

### `useSettingStatic(settingKey)`
typescriptexport function useSettingStatic<K extends keyof SettingsDef>(
  settingKey: K
): [Ref<SettingsDef[K]>, () => void]
**Parameters:**

- `settingKey` (K): The key of the setting to observe.

**Returns:** A tuple containing a reactive `Ref` with the current value and a void function to force re-initialization. This variant works outside of Vue component setup contexts (e.g., in modules).

### `HoppColorMode` type
typescript1export type HoppColorMode = {
2  preference: HoppBgColor
3  value: Readonly<Exclude<HoppBgColor, "system">>
4}
>
Source: [theming.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/theming.ts#L10-L13)

**Properties:**

- `preference` (HoppBgColor): The user's stored preference, which may be `"system"`.
- `value` (Readonly<Exclude<HoppBgColor, "system">>): The resolved color mode — `"light"` or `"dark"`, never `"system"`. This is readonly to prevent external mutation.

## CSS Custom Properties Reference
### Base / Surface Variables
VariableLight ValueDark ValueBlack Value`--primary-color``theme("colors.white")``#181818``#0f0f0f``--primary-light-color``theme("colors.gray.50")``#1c1c1e``theme("colors.neutral.900")``--primary-dark-color``theme("colors.gray.100")``theme("colors.neutral.800")``#181818``--secondary-color``theme("colors.gray.500")``theme("colors.neutral.400")``theme("colors.neutral.400")``--secondary-dark-color``theme("colors.gray.900")``theme("colors.zinc.50")``theme("colors.neutral.50")``--divider-color``theme("colors.gray.100")``#1f1f1f``theme("colors.neutral.900")`
### Accent Variables (per accent color)
VariableDescription`--accent-color`Primary accent (e.g., `theme("colors.emerald.500")` for green)`--accent-light-color`Lighter accent variant for hover/active states`--accent-dark-color`Darker accent variant for selections and emphasis`--accent-contrast-color`Text color that contrasts well against accent backgrounds`--gradient-from-color`Start color for accent gradients`--gradient-via-color`Midpoint color for accent gradients`--gradient-to-color`End color for accent gradients
### HTTP Method Color Variables
VariableLight ValueDark/Black Value`--method-get-color``theme("colors.green.500")``theme("colors.emerald.500")``--method-post-color``theme("colors.amber.500")``theme("colors.yellow.500")``--method-put-color``theme("colors.blue.500")``theme("colors.sky.500")``--method-delete-color``theme("colors.red.500")``theme("colors.rose.500")`
## Related Links

- [Theme SCSS Entry Point](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/assets/themes/themes.scss) — Main SCSS file that imports and applies all theme mixins
- [Background Theme Mixins](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/assets/themes/base-themes.scss) — Light, dark, and black background variable definitions
- [Accent Color Mixins](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/assets/themes/accent-themes.scss) — All nine accent color variable definitions
- [Editor Theme Variables](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/assets/themes/editor-themes.scss) — CodeMirror syntax highlighting theme variables
- [Tooltip/Popover Themes](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/assets/themes/tippy-themes.scss) — Tippy.js tooltip and popover theme styles
- [Theming Module](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/modules/theming.ts) — Core Vue module that applies theme settings at runtime
- [Settings Store](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/settings.ts) — Settings store with BG_COLOR and THEME_COLOR definitions
- [Color Mode Picker Component](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/smart/ColorModePicker.vue) — UI component for selecting background modes
- [Accent Mode Picker Component](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/smart/AccentModePicker.vue) — UI component for selecting accent colors
- [CodeMirror Base Theme](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/editor/themes/baseTheme.ts) — Editor base theme using CSS variable references
- [Settings Validation Schema](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/persistence/validation-schemas/index.ts) — Zod schemas for validating persisted theme settings
- [Settings Composables](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/composables/settings.ts) — Reactive composables for reading/writing settings