# Tamagui Configuration

> Setting up createTamagui with tokens, themes, media, and fonts

## createTamagui Overview

`createTamagui` is the core function that initializes your Tamagui design system. It accepts a configuration object and returns a typed config that you pass to `TamaguiProvider`.

### Complete Function Signature

```typescript
import type { CreateTamaguiProps } from '@tamagui/web'

function createTamagui<Conf extends CreateTamaguiProps>(
  config: Conf
): InferTamaguiConfig<Conf>
```

### All Configuration Options

The `createTamagui` function accepts an object with these properties:

- **`tokens`** - Base design tokens (colors, sizes, space, radius, zIndex)
- **`themes`** - Theme definitions that reference tokens
- **`fonts`** - Font families with size/lineHeight/weight configurations
- **`media`** - Responsive breakpoint definitions
- **`animations`** - Animation driver configuration
- **`shorthands`** - Short aliases for style properties
- **`settings`** - Behavioral configuration options
- **`selectionStyles`** - Custom text selection styling
- **`defaultProps`** - Default props for base components

## Tokens

Tokens are your base design variables, similar to CSS custom properties. They're created with `createTokens` and referenced in themes and components.

### Token Schema

Tamagui supports these token categories:

```typescript
import { createTokens } from 'tamagui'

const tokens = createTokens({
  // Colors - no units
  color: {
    white: '#fff',
    black: '#000',
    gray1: '#f9f9f9',
    gray2: '#f0f0f0',
    // ...
  },

  // Sizes - dimensional values (px added automatically)
  size: {
    0: 0,
    1: 5,
    2: 10,
    3: 15,
    4: 20,
    true: 20, // default size token
    5: 25,
    6: 35,
    7: 45,
    8: 55,
    9: 75,
    10: 95,
  },

  // Space - like size but can be negative
  space: {
    0: 0,
    1: 5,
    2: 10,
    3: 15,
    true: 15, // default space token
    4: 20,
    '-1': -5,
    '-2': -10,
    // ...
  },

  // Radius - border radius values
  radius: {
    0: 0,
    1: 3,
    2: 5,
    3: 7,
    4: 9,
    true: 9,
    5: 10,
    6: 16,
    7: 19,
    8: 22,
    9: 26,
  },

  // Z-index - stacking order
  zIndex: {
    0: 0,
    1: 100,
    2: 200,
    3: 300,
    4: 400,
    5: 500,
  },
})
```

### Creating Custom Tokens

You can add custom token categories:

```typescript
const tokens = createTokens({
  // Standard categories
  size: { /* ... */ },
  space: { /* ... */ },
  color: { /* ... */ },
  
  // Custom categories (unitless by default)
  opacity: {
    subtle: 0.5,
    medium: 0.75,
    opaque: 1,
  },
  
  duration: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
})
```

### Token Naming Conventions

- Use numbered keys (1-10) for scalable values
- Add a `true` key mapping to your default value
- Prefix with `$` when referencing in styles: `fontSize="$4"`
- Space tokens support negative values: `space: { '-1': -5 }`

## Media Queries

Media queries enable responsive design with type-safe breakpoints.

### Breakpoint Configuration

```typescript
export const media = {
  // Mobile-first approach - max-width
  xs: { maxWidth: 660 },
  sm: { maxWidth: 800 },
  md: { maxWidth: 1020 },
  lg: { maxWidth: 1280 },
  xl: { maxWidth: 1650 },
  
  // Desktop-first approach - min-width
  gtXs: { minWidth: 661 },
  gtSm: { minWidth: 801 },
  gtMd: { minWidth: 1021 },
  gtLg: { minWidth: 1281 },
  gtXl: { minWidth: 1651 },
}
```

### Mobile-First Approach

Tamagui recommends a mobile-first approach:

```typescript
// Define max-width breakpoints
const media = {
  sm: { maxWidth: 800 },
  md: { maxWidth: 1020 },
  lg: { maxWidth: 1280 },
}

// Use in components
<Text 
  fontSize="$4"      // mobile default
  $sm={{ fontSize: '$5' }}   // tablets
  $md={{ fontSize: '$6' }}   // desktops
  $lg={{ fontSize: '$7' }}   // large screens
/>
```

### Custom Media Queries

You can define any media query:

```typescript
const media = {
  // Orientation
  portrait: { orientation: 'portrait' },
  landscape: { orientation: 'landscape' },
  
  // Pointer capability
  hover: { hover: 'hover' },
  touch: { hover: 'none' },
  
  // Dark mode
  dark: { prefers: 'dark' },
  light: { prefers: 'light' },
  
  // Custom combinations
  short: { maxHeight: 700 },
  tall: { minHeight: 900 },
}
```

### mediaQueryDefaultActive (SSR)

For server-side rendering, specify which media queries should be active initially:

```typescript
export const mediaQueryDefaultActive = {
  // Mobile-first: smaller breakpoints true by default
  xs: true,
  sm: true,
  md: true,
  lg: true,
  xl: true,
  
  // Desktop-first: larger breakpoints false by default
  gtXs: false,
  gtSm: false,
  gtMd: false,
  gtLg: false,
}
```

This prevents hydration mismatches by ensuring the server renders with predictable media states.

## Fonts

Fonts are created with the `createFont` helper, which provides intelligent defaults for missing size/lineHeight/weight mappings.

### createFont Helper

```typescript
import { createFont } from 'tamagui'
import { isWeb } from '@tamagui/constants'

const bodyFont = createFont({
  // Font family - different for web/native
  family: isWeb 
    ? 'Inter, Helvetica, Arial, sans-serif' 
    : 'Inter',

  // Size scale (required)
  size: {
    1: 12,
    2: 14,
    3: 15,
    4: 16,
    5: 18,
    6: 20,
    7: 24,
    8: 28,
    9: 32,
    10: 44,
  },

  // Line height for each size
  lineHeight: {
    1: 17,
    2: 20,
    3: 22,
    4: 24,
    5: 26,
    6: 28,
    7: 32,
    8: 36,
    9: 40,
    10: 52,
  },

  // Font weights
  weight: {
    1: '300',  // light
    4: '400',  // normal
    6: '600',  // semibold
    7: '700',  // bold
  },

  // Letter spacing
  letterSpacing: {
    1: 0,
    4: 0.5,
    7: -0.5,
    9: -1,
  },

  // Transform
  transform: {
    6: 'uppercase',
    7: 'none',
  },

  // Color (can reference theme variables)
  color: {
    6: '$colorFocus',
    7: '$color',
  },

  // Android font face mapping (REQUIRED for native)
  face: {
    400: { normal: 'Inter', italic: 'Inter-Italic' },
    500: { normal: 'InterMedium' },
    600: { normal: 'InterSemiBold' },
    700: { normal: 'InterBold', italic: 'InterBold-Italic' },
  },
})
```

### System Fonts vs Custom Fonts

**System fonts (web):**
```typescript
const systemFont = createFont({
  family: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  size: { /* ... */ },
})
```

**Custom fonts (web):**
```typescript
// Load via @font-face first
const customFont = createFont({
  family: 'MyCustomFont, sans-serif',
  size: { /* ... */ },
})
```

**Custom fonts (native):**
```typescript
// Load with expo-font or React Native
import { useFonts } from 'expo-font'

function App() {
  const [loaded] = useFonts({
    Inter: require('./assets/fonts/Inter-Regular.otf'),
    InterBold: require('./assets/fonts/Inter-Bold.otf'),
  })
  
  if (!loaded) return null
  return <MyApp />
}

// Then reference in createFont
const nativeFont = createFont({
  family: 'Inter',
  face: {
    400: { normal: 'Inter' },
    700: { normal: 'InterBold' },
  },
  // ...
})
```

### Font Size, lineHeight, weight, letterSpacing

`createFont` fills in missing values automatically:

```typescript
const headingFont = createFont({
  size: {
    1: 12,
    10: 44,
  },
  // If you only define some sizes, createFont fills gaps
  // by repeating the last defined value
})

// Result:
// size: { 1: 12, 2: 12, 3: 12, ..., 10: 44 }
```

You can also use helper functions:

```typescript
import { createInterFont } from '@tamagui/font-inter'

const bodyFont = createInterFont(
  {
    size: { 1: 12, 10: 44 },
    weight: { 1: '400' },
  },
  {
    // Helpers for generating lineHeight
    sizeLineHeight: (size) => Math.round(size * 1.2 + 4),
    sizeSize: (size) => Math.round(size),
  }
)
```

## Settings

The `settings` object controls Tamagui's behavior.

### allowedStyleValues

Type-level validation for style values (TypeScript only):

```typescript
import { createTamagui } from 'tamagui'

const config = createTamagui({
  settings: {
    allowedStyleValues: {
      strict: {
        // Only allow token values
        space: 'only-tokens',
        color: 'only-tokens',
      },
      somewhat: {
        // Tokens + number/string
        fontSize: 'strict',
      },
      allowAllValues: {
        // No restrictions
        opacity: 'all',
      },
    },
  },
})
```

Possible values: `'strict'` | `'somewhat-strict'` | `'only-tokens'` | `'all'`

### shouldAddPrefersColorThemes

Automatically generate `prefers-color-scheme` CSS media queries:

```typescript
const config = createTamagui({
  settings: {
    shouldAddPrefersColorThemes: true, // default
  },
})
```

When enabled, if you have `light` and `dark` themes, Tamagui generates:

```css
@media (prefers-color-scheme: dark) {
  .t_dark { /* dark theme variables */ }
}
@media (prefers-color-scheme: light) {
  .t_light { /* light theme variables */ }
}
```

### themeClassNameOnRoot (deprecated: use addThemeClassName)

Apply theme class to `<html>` or `<body>` instead of TamaguiProvider:

```typescript
const config = createTamagui({
  settings: {
    addThemeClassName: 'body', // or 'html' or false
  },
})
```

### fastSchemeChange

Optimize theme switching performance by placing theme classes on root:

```typescript
const config = createTamagui({
  settings: {
    fastSchemeChange: true,
  },
})
```

### defaultFont

Set the fallback font for all components:

```typescript
const config = createTamagui({
  fonts: {
    body: bodyFont,
    heading: headingFont,
  },
  settings: {
    defaultFont: 'body', // without $ prefix
  },
})
```

Now all `Text` components default to `fontFamily="$body"`.

### disableSSR

Skip the double-render on initial mount (for SPA apps):

```typescript
const config = createTamagui({
  settings: {
    disableSSR: true, // client-only apps
  },
})
```

### onlyAllowShorthands

Removes TypeScript types for longform props if shorthands exist:

```typescript
const config = createTamagui({
  shorthands: {
    bg: 'backgroundColor',
  },
  settings: {
    onlyAllowShorthands: true,
  },
})

// Now only `bg` is allowed, not `backgroundColor`
<View bg="red" /> // ✅
<View backgroundColor="red" /> // ❌ TypeScript error
```

## Selection Styles

Custom text selection colors for web:

```typescript
const config = createTamagui({
  selectionStyles: (theme) => {
    // Return null to skip generation
    if (!theme.color5) return null
    
    return {
      backgroundColor: theme.color5,
      color: theme.color11,
    }
  },
})
```

Generates:

```css
::selection {
  background-color: var(--color5);
  color: var(--color11);
}
```

## Type Declaration

Augment Tamagui's types with your custom config:

```typescript
import { createTamagui } from 'tamagui'

export const config = createTamagui({
  tokens,
  themes,
  fonts,
  media,
})

export type Conf = typeof config

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}
```

This enables full autocomplete and type safety throughout your app.

## Complete Example

Here's a full working configuration:

```typescript
import { shorthands } from '@tamagui/shorthands'
import { createFont, createTamagui, createTokens } from 'tamagui'
import { createAnimations } from '@tamagui/animations-react-native'
import { isWeb } from '@tamagui/constants'

// 1. Create tokens
const tokens = createTokens({
  color: {
    white: '#fff',
    black: '#000',
    gray1: '#fcfcfc',
    gray2: '#f9f9f9',
    gray3: '#f0f0f0',
    gray4: '#e8e8e8',
    gray5: '#e0e0e0',
    gray6: '#d1d1d1',
    gray7: '#b4b4b4',
    gray8: '#8b8b8b',
    gray9: '#6f6f6f',
    gray10: '#525252',
    gray11: '#3a3a3a',
    gray12: '#1f1f1f',
    blue1: '#f0f9ff',
    blue2: '#e0f2fe',
    blue3: '#bae6fd',
    blue4: '#7dd3fc',
    blue5: '#38bdf8',
    blue6: '#0ea5e9',
    blue7: '#0284c7',
    blue8: '#0369a1',
    blue9: '#075985',
    blue10: '#0c4a6e',
  },
  
  size: {
    0: 0,
    1: 5,
    2: 10,
    3: 15,
    4: 20,
    true: 20,
    5: 25,
    6: 35,
    7: 45,
    8: 55,
    9: 75,
    10: 95,
  },
  
  space: {
    0: 0,
    1: 5,
    2: 10,
    3: 15,
    true: 15,
    4: 20,
    5: 25,
    '-1': -5,
    '-2': -10,
  },
  
  radius: {
    0: 0,
    1: 3,
    2: 5,
    3: 7,
    4: 9,
    true: 9,
    5: 10,
    6: 16,
  },
  
  zIndex: {
    0: 0,
    1: 100,
    2: 200,
    3: 300,
    4: 400,
    5: 500,
  },
})

// 2. Create fonts
const bodyFont = createFont({
  family: isWeb ? 'Inter, system-ui, sans-serif' : 'Inter',
  
  size: {
    1: 12,
    2: 14,
    3: 15,
    4: 16,
    5: 18,
    6: 20,
    7: 24,
    8: 28,
    9: 32,
    10: 44,
  },
  
  lineHeight: {
    1: 17,
    2: 20,
    3: 22,
    4: 24,
    5: 26,
    6: 28,
    7: 32,
    8: 36,
    9: 40,
    10: 52,
  },
  
  weight: {
    1: '300',
    4: '400',
    6: '600',
    7: '700',
  },
  
  letterSpacing: {
    4: 0,
    9: -1,
  },
  
  face: {
    300: { normal: 'Inter' },
    400: { normal: 'Inter' },
    600: { normal: 'InterSemiBold' },
    700: { normal: 'InterBold' },
  },
})

const headingFont = createFont({
  family: isWeb ? 'Inter, system-ui, sans-serif' : 'Inter',
  
  size: {
    5: 13,
    6: 15,
    7: 18,
    8: 24,
    9: 32,
    10: 44,
  },
  
  weight: {
    6: '600',
    7: '700',
  },
  
  letterSpacing: {
    5: 1,
    9: -1,
    10: -1.5,
  },
  
  face: {
    600: { normal: 'InterSemiBold' },
    700: { normal: 'InterBold' },
  },
})

// 3. Create themes
const themes = {
  light: {
    background: tokens.color.white,
    backgroundHover: tokens.color.gray2,
    backgroundPress: tokens.color.gray3,
    backgroundFocus: tokens.color.gray4,
    color: tokens.color.gray12,
    colorHover: tokens.color.gray11,
    colorPress: tokens.color.gray10,
    colorFocus: tokens.color.blue6,
    borderColor: tokens.color.gray6,
    borderColorHover: tokens.color.gray7,
    shadowColor: tokens.color.gray8,
  },
  
  dark: {
    background: tokens.color.gray12,
    backgroundHover: tokens.color.gray11,
    backgroundPress: tokens.color.gray10,
    backgroundFocus: tokens.color.gray9,
    color: tokens.color.white,
    colorHover: tokens.color.gray1,
    colorPress: tokens.color.gray2,
    colorFocus: tokens.color.blue4,
    borderColor: tokens.color.gray6,
    borderColorHover: tokens.color.gray5,
    shadowColor: tokens.color.black,
  },
  
  light_blue: {
    background: tokens.color.blue1,
    backgroundHover: tokens.color.blue2,
    color: tokens.color.blue10,
    colorHover: tokens.color.blue9,
  },
  
  dark_blue: {
    background: tokens.color.blue10,
    backgroundHover: tokens.color.blue9,
    color: tokens.color.blue1,
    colorHover: tokens.color.blue2,
  },
}

// 4. Create media queries
const media = {
  xs: { maxWidth: 660 },
  sm: { maxWidth: 800 },
  md: { maxWidth: 1020 },
  lg: { maxWidth: 1280 },
  xl: { maxWidth: 1650 },
  gtXs: { minWidth: 661 },
  gtSm: { minWidth: 801 },
  gtMd: { minWidth: 1021 },
  gtLg: { minWidth: 1281 },
}

const mediaQueryDefaultActive = {
  xs: true,
  sm: true,
  md: true,
  lg: true,
  xl: true,
  gtXs: false,
  gtSm: false,
  gtMd: false,
  gtLg: false,
}

// 5. Create animations
const animations = createAnimations({
  fast: {
    damping: 20,
    mass: 1.2,
    stiffness: 250,
  },
  medium: {
    damping: 15,
    mass: 1,
    stiffness: 120,
  },
  slow: {
    damping: 20,
    stiffness: 60,
  },
})

// 6. Create the config
export const config = createTamagui({
  tokens,
  themes,
  fonts: {
    body: bodyFont,
    heading: headingFont,
  },
  media,
  shorthands,
  animations,
  
  settings: {
    defaultFont: 'body',
    shouldAddPrefersColorThemes: true,
    mediaQueryDefaultActive,
    fastSchemeChange: true,
    allowedStyleValues: 'somewhat-strict',
  },
  
  selectionStyles: (theme) => ({
    backgroundColor: theme.backgroundFocus,
    color: theme.color,
  }),
})

export type Conf = typeof config

declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}

// 7. Wrap your app
import { TamaguiProvider } from 'tamagui'

export default function App() {
  return (
    <TamaguiProvider config={config} defaultTheme="light">
      <MyApp />
    </TamaguiProvider>
  )
}
```

## Quick Reference

| Property | Type | Description |
|----------|------|-------------|
| `tokens` | `TokensParsed` | Base design tokens (color, size, space, radius, zIndex) |
| `themes` | `ThemesLikeObject` | Theme definitions referencing tokens |
| `fonts` | `Record<string, GenericFont>` | Font configurations created with `createFont` |
| `media` | `Record<string, MediaQueryObject>` | Responsive breakpoint definitions |
| `animations` | `AnimationDriver` | Animation configuration (css/react-native/reanimated/motion) |
| `shorthands` | `Record<string, string>` | Style property aliases |
| `settings.defaultFont` | `string` | Default font family key |
| `settings.shouldAddPrefersColorThemes` | `boolean` | Generate prefers-color-scheme media queries |
| `settings.mediaQueryDefaultActive` | `Record<string, boolean>` | SSR media query defaults |
| `settings.fastSchemeChange` | `boolean` | Optimize theme switching |
| `settings.disableSSR` | `boolean` | Skip double-render for SPAs |
| `settings.onlyAllowShorthands` | `boolean` | Hide longform prop types |
| `settings.allowedStyleValues` | `AllowedStyleValuesSetting` | Type-level style validation |
| `selectionStyles` | `(theme) => SelectionStyles` | Custom text selection colors |

**Common token patterns:**
- Use numbered keys: `{ 1: small, 5: medium, 10: large }`
- Add `true` key for defaults: `{ true: 20 }`
- Reference with `$` prefix: `fontSize="$4"`
- Negative space: `space: { '-1': -5 }`

**Font requirements:**
- Define `size` (required)
- Define `face` for Android native
- Use `isWeb` for platform-specific families
- Use `createFont` for automatic filling

**Media query tips:**
- Mobile-first: use `maxWidth`
- Set `mediaQueryDefaultActive` for SSR
- Use in components: `$md={{ fontSize: '$6' }}`

**Theme naming:**
- Sub-themes: `light_blue`, `dark_blue`
- Deep nesting: `light_blue_subtle`
- Parent fallback: partial themes inherit from parent
