# Tamagui Theme System

> Color scales, theme creation, and dynamic theming for cross-platform applications

Tamagui's theme system is built on a powerful color scale foundation that enables contextual theme switching, automatic light/dark mode support, and seamless integration between web and native platforms. Themes operate similarly to CSS variables but work consistently across all platforms.

## Table of Contents

- [12-Step Color Scale System](#12-step-color-scale-system)
- [Creating Themes](#creating-themes)
- [Theme Tokens](#theme-tokens)
- [Theme Switching](#theme-switching)
- [Dynamic Themes](#dynamic-themes)
- [useTheme Hook](#usetheme-hook)
- [Best Practices](#best-practices)
- [Quick Reference](#quick-reference)

---

## 12-Step Color Scale System

Tamagui uses a **Radix UI-compatible 12-step color scale** where each step has a specific semantic purpose. This system ensures accessible, consistent color usage across light and dark themes.

### Scale Steps (1-12)

The 12 steps are numbered from 1 (most subtle) to 12 (highest contrast):

| Step | Light Theme Usage | Dark Theme Usage | Common Use Cases |
|------|-------------------|------------------|------------------|
| **1** | Subtle background | Subtle background | App backgrounds, cards |
| **2** | UI element background | UI element background | Subtle buttons, hover states |
| **3** | Hovered UI element background | Hovered UI element background | Hover backgrounds |
| **4** | Active / selected element background | Active element background | Selected states |
| **5** | Subtle borders and separators | Subtle borders | Dividers, borders (subtle) |
| **6** | UI element border and focus rings | UI element border | Regular borders, focus rings |
| **7** | Hovered UI element border | Hovered borders | Hover borders |
| **8** | Solid backgrounds | Solid backgrounds | Component backgrounds |
| **9** | Hovered solid backgrounds | Hovered solid backgrounds | Primary buttons |
| **10** | Low-contrast text | Low-contrast text | Placeholders, disabled text |
| **11** | High-contrast text | High-contrast text | Body text |
| **12** | Highest contrast text | Highest contrast text | Headings, emphasis |

### Light vs Dark Considerations

- **Light themes**: Colors progress from white/light (step 1) to black/dark (step 12)
- **Dark themes**: Colors progress from black/dark (step 1) to white/light (step 12)
- The semantic meaning remains consistent across both modes

### Example: Using the Scale

```tsx
import { YStack, Text } from 'tamagui'

export function ColorScaleExample() {
  return (
    <YStack 
      backgroundColor="$color1"  // Subtle app background
      borderColor="$color6"      // Regular border
      padding="$4"
    >
      <Text color="$color11">Body text with good contrast</Text>
      <Text color="$color10">Subtle text for less emphasis</Text>
    </YStack>
  )
}
```

---

## Creating Themes

Tamagui offers multiple approaches to theme creation, from simple plain objects to powerful builders for complex theme systems.

### Plain Object Themes

The simplest way to define themes is using plain JavaScript objects:

```tsx
import { createTamagui, createTokens } from 'tamagui'

const tokens = createTokens({
  color: {
    white: '#fff',
    black: '#000',
    blue: '#0066cc',
    blueDark: '#003d7a',
  },
  // ... other tokens
})

export default createTamagui({
  tokens,
  themes: {
    light: {
      background: '#fff',
      color: '#000',
      borderColor: '#ddd',
      // Semantic color tokens
      color1: '#fff',
      color2: '#f8f8f8',
      color11: '#333',
      color12: '#000',
    },
    dark: {
      background: '#000',
      color: '#fff',
      borderColor: '#333',
      color1: '#000',
      color2: '#111',
      color11: '#ddd',
      color12: '#fff',
    },
    // Sub-themes automatically compose with parent
    light_blue: {
      background: tokens.color.blue,
      color: tokens.color.white,
    },
    dark_blue: {
      background: tokens.color.blueDark,
      color: tokens.color.white,
    },
  },
})
```

### createV5Theme Helper

The **v5 theme system** provides a streamlined API using Radix UI colors:

```tsx
import { createV5Theme, defaultChildrenThemes } from '@tamagui/themes'
import { blue, blueDark, brand, brandDark } from '@tamagui/colors'

// Use defaults
const themes = createV5Theme()

// Customize with brand colors
const themesWithBrand = createV5Theme({
  childrenThemes: {
    ...defaultChildrenThemes,
    brand: { light: brand, dark: brandDark },
  },
})

// Minimal setup (base themes only, no color variants)
const minimalThemes = createV5Theme({
  childrenThemes: {},
})
```

**Default children themes** (color variants):
- `gray`, `blue`, `red`, `yellow`, `green`, `orange`, `pink`, `purple`, `teal`, `neutral`

**Default grandchildren themes** (surface variants):
- `accent`, `alt1`, `alt2`, `surface1`, `surface2`, `surface3`

### Advanced: createThemes and ThemeBuilder

For complete control, use `createThemes` with templates and palettes:

```tsx
import { createThemes } from '@tamagui/theme-builder'
import { gray, grayDark, blue, blueDark } from '@tamagui/colors'

const themes = createThemes({
  // Define templates that map palette indices to theme tokens
  templates: {
    base: {
      background: 1,
      backgroundHover: 2,
      backgroundPress: 3,
      borderColor: 6,
      borderColorHover: 7,
      color: 11,
      colorHover: 12,
    },
    surface1: {
      background: 2,
      backgroundHover: 3,
      borderColor: 5,
      color: 11,
    },
  },

  // Base palette for light/dark
  base: {
    palette: {
      light: ['#fff', '#f8f8f8', '#eee', '#ddd', '#ccc', '#999', '#666', '#333', '#111', '#000'],
      dark: ['#000', '#111', '#222', '#333', '#444', '#666', '#999', '#ccc', '#ddd', '#fff'],
    },
  },

  // Color variant themes (use Radix colors)
  childrenThemes: {
    blue: {
      palette: {
        light: Object.values(blue),
        dark: Object.values(blueDark),
      },
    },
  },

  // Surface variant themes
  grandChildrenThemes: {
    surface1: { template: 'surface1' },
  },
})
```

### Adjusting Palettes

Programmatically adjust colors using HSL manipulation:

```tsx
import { 
  adjustPalettes, 
  defaultChildrenThemes,
  type HSL 
} from '@tamagui/themes'

const adjustedThemes = adjustPalettes(defaultChildrenThemes, {
  // Apply to all themes
  default: {
    light: (hsl: HSL, index: number) => ({
      ...hsl,
      s: hsl.s * 0.8,  // Reduce saturation by 20%
    }),
    dark: (hsl: HSL, index: number) => ({
      ...hsl,
      s: hsl.s * 0.5,  // Reduce saturation by 50%
      l: hsl.l * 0.9,  // Slightly darker
    }),
  },
  // Specific overrides
  yellow: {
    light: (hsl: HSL, index: number) => ({
      ...hsl,
      s: hsl.s * 0.5,  // Tone down yellow saturation
    }),
  },
})
```

---

## Theme Tokens

Theme tokens are the actual color values that change based on the active theme. They're prefixed with `$` when used in components.

### Core Theme Tokens

Tamagui components use these semantic tokens by default:

```tsx
type ThemeTokens = {
  // Backgrounds
  background: string
  backgroundHover: string
  backgroundPress: string
  backgroundFocus: string
  backgroundStrong: string
  backgroundTransparent: string
  
  // Text colors
  color: string
  colorHover: string
  colorPress: string
  colorFocus: string
  colorTransparent: string
  
  // Borders
  borderColor: string
  borderColorHover: string
  borderColorFocus: string
  borderColorPress: string
  
  // Shadows
  shadowColor: string
  shadowColorHover: string
  shadowColorPress: string
  shadowColorFocus: string
  
  // Color scale (1-12)
  color1: string
  color2: string
  // ... through color12
  
  // Half-step interpolations
  color0pt5: string
  color1pt5: string
  color2pt5: string
  
  // Opacity variants
  color01: string    // 10% opacity
  color0075: string  // 7.5% opacity
  color005: string   // 5% opacity
  // ...
}
```

### How Theme Tokens Resolve

Tamagui resolves theme values with this priority:

1. **Current theme** – Check the active theme (e.g., `dark_blue`)
2. **Parent theme** – Walk up the theme hierarchy
3. **Color tokens (fallback)** – Use `tokens.color` if theme value not found

```tsx
import { Button, Theme } from 'tamagui'

export function ThemeResolution() {
  return (
    <Theme name="dark">
      {/* Uses dark.background */}
      <Button backgroundColor="$background">
        Base Dark
      </Button>
      
      <Theme name="blue">
        {/* Uses dark_blue.background */}
        <Button backgroundColor="$background">
          Dark Blue
        </Button>
        
        {/* Falls back to tokens.color.red if not in theme */}
        <Button backgroundColor="$red">
          Fallback Token
        </Button>
      </Theme>
    </Theme>
  )
}
```

### Theme-Specific vs Global Tokens

- **Theme tokens** (`$background`, `$color`) – Change with active theme
- **Global tokens** (`$size.4`, `$space.2`) – Remain constant across themes
- **Color tokens** (`$blue10`, `$red8`) – Static colors that can be theme fallbacks

```tsx
import { YStack } from 'tamagui'

<YStack
  backgroundColor="$background"  // Theme token (changes with theme)
  padding="$4"                   // Global token (always same)
  borderColor="$blue10"          // Color token (always same)
/>
```

---

## Theme Switching

Tamagui provides multiple ways to switch themes contextually using the `<Theme>` component.

### Theme Component Usage

Wrap any subtree to apply a theme:

```tsx
import { Button, Theme, YStack } from 'tamagui'

export function ThemeSwitchingExample() {
  return (
    <YStack>
      {/* Default theme (from root provider) */}
      <Button>Default Theme</Button>
      
      {/* Explicitly set dark theme */}
      <Theme name="dark">
        <Button>Dark Theme</Button>
      </Theme>
      
      {/* Blue variant of current theme */}
      <Theme name="blue">
        <Button>Blue Theme</Button>
      </Theme>
    </YStack>
  )
}
```

### Nested Themes

Themes compose automatically using underscore-based naming:

```tsx
import { Button, Theme } from 'tamagui'

export function NestedThemes() {
  return (
    <Theme name="dark">
      {/* Uses "dark" theme */}
      <Button>Dark</Button>
      
      <Theme name="blue">
        {/* Uses "dark_blue" theme (auto-composed) */}
        <Button>Dark Blue</Button>
        
        <Theme name="surface1">
          {/* Uses "dark_blue_surface1" theme */}
          <Button>Dark Blue Surface</Button>
        </Theme>
      </Theme>
    </Theme>
  )
}
```

**Naming convention**: Themes are automatically composed with `_` separators:
- Parent: `dark`
- Child: `blue`
- Result: `dark_blue`

### themeInverse

Quickly flip between light/dark variants:

```tsx
import { Button, Theme } from 'tamagui'

export function InverseExample() {
  return (
    <Theme name="light">
      <Button>Light Button</Button>
      
      {/* Automatically switches to dark_blue */}
      <Theme name="blue" inverse>
        <Button>Dark Blue Button</Button>
      </Theme>
    </Theme>
  )
}
```

### Component-Level Theme Prop

Apply themes directly to components without wrapping:

```tsx
import { Button, YStack } from 'tamagui'

export function ComponentTheme() {
  return (
    <YStack>
      <Button theme="dark">Dark Button</Button>
      <Button theme="blue">Blue Button</Button>
      <Button theme="dark_blue">Dark Blue Button</Button>
    </YStack>
  )
}
```

### useThemeName Hook

Access the current theme name:

```tsx
import { useThemeName } from 'tamagui'

export function ThemeIndicator() {
  const themeName = useThemeName()
  
  return <Text>Current theme: {themeName}</Text>
}
```

---

## Dynamic Themes

Create or modify themes at runtime for advanced use cases.

### Runtime Theme Generation

Generate themes programmatically:

```tsx
import { addTheme, Theme, Button } from 'tamagui'

export function DynamicThemeExample() {
  const createCustomTheme = (primaryColor: string) => {
    const customTheme = {
      background: '#fff',
      color: '#000',
      primary: primaryColor,
      primaryHover: adjustBrightness(primaryColor, -10),
    }
    
    // Register theme at runtime
    addTheme({
      name: 'custom',
      theme: customTheme,
    })
  }
  
  return (
    <Button onPress={() => createCustomTheme('#ff6b6b')}>
      Create Custom Theme
    </Button>
  )
}
```

### Theme Composition

Combine multiple theme definitions:

```tsx
import { createTheme } from '@tamagui/core'

const baseTheme = {
  background: '#fff',
  color: '#000',
}

const accentTheme = {
  ...baseTheme,
  accentBackground: '#007bff',
  accentColor: '#fff',
}

const themes = {
  light: baseTheme,
  light_accent: accentTheme,
}
```

### Color Utilities

Tamagui provides utilities for color manipulation:

```tsx
import { opacify, interpolateColor } from '@tamagui/themes'

// Add opacity to a color
const transparent = opacify('#ff0000', 0.5)  // rgba(255, 0, 0, 0.5)

// Interpolate between two colors
const midpoint = interpolateColor('#000000', '#ffffff', 0.5)  // #808080
```

---

## useTheme Hook

Access theme values reactively in components.

### Getting Theme Values

```tsx
import { useTheme, YStack } from 'tamagui'

export function ThemeConsumer() {
  const theme = useTheme()
  
  return (
    <YStack backgroundColor={theme.background.val}>
      <Text style={{ color: theme.color.val }}>
        Themed Text
      </Text>
    </YStack>
  )
}
```

### The Variable Object

Each theme value is a `Variable` with additional properties:

```tsx
import { useTheme } from 'tamagui'

export function VariableExample() {
  const theme = useTheme()
  
  // Variable properties
  console.log({
    val: theme.background.val,           // Raw value: '#000'
    variable: theme.background.variable, // CSS var: 'var(--background)'
    name: theme.background.name,         // Token name: 'background'
  })
  
  return null
}
```

### theme.color.val Pattern

Access the raw value for external libraries:

```tsx
import { useTheme } from 'tamagui'
import { SomeExternalComponent } from 'some-library'

export function ExternalIntegration() {
  const theme = useTheme()
  
  return (
    <SomeExternalComponent
      style={{
        // Use .val to get the raw color value
        backgroundColor: theme.background.val,
        color: theme.color.val,
      }}
    />
  )
}
```

### Optimized .get() Method

For performance-critical scenarios, use `.get()`:

```tsx
import { useTheme } from 'tamagui'

export function OptimizedTheme() {
  const theme = useTheme()
  
  // On web: returns 'var(--background)' (no re-render on theme change)
  // On native: returns '#000' (re-renders on theme change)
  const background = theme.background.get()
  
  // Force web-only optimization
  const backgroundWeb = theme.background.get('web')
  
  return (
    <div style={{ backgroundColor: background }}>
      Content
    </div>
  )
}
```

### Combining useTheme with useMedia

Mix responsive design with theming:

```tsx
import { useTheme, useMedia, YStack } from 'tamagui'

export function ResponsiveTheme() {
  const theme = useTheme()
  const media = useMedia()
  
  return (
    <YStack
      backgroundColor={media.sm ? theme.color1 : theme.color2}
      {...(media.lg && {
        borderColor: theme.borderColor,
      })}
    />
  )
}
```

---

## Best Practices

### Theme Organization

**1. Use semantic naming for custom themes**

```tsx
// ✅ Good: Semantic names
const themes = {
  light: { /* ... */ },
  dark: { /* ... */ },
  light_brand: { /* ... */ },
  dark_brand: { /* ... */ },
}

// ❌ Avoid: Generic or unclear names
const themes = {
  theme1: { /* ... */ },
  theme2: { /* ... */ },
}
```

**2. Leverage the 12-step scale consistently**

```tsx
// ✅ Good: Use standard scale tokens
<YStack
  backgroundColor="$color1"
  borderColor="$color6"
>
  <Text color="$color11">Body</Text>
</YStack>

// ❌ Avoid: Custom one-off colors
<YStack backgroundColor="#f7f7f7" borderColor="#cccccc">
  <Text color="#1a1a1a">Body</Text>
</YStack>
```

**3. Define base and variant themes separately**

```tsx
const themes = {
  // Base themes
  light: baseLight,
  dark: baseDark,
  
  // Color variants (auto-compose with base)
  light_blue: { /* ... */ },
  dark_blue: { /* ... */ },
  
  // Surface variants (auto-compose with color variants)
  light_blue_surface1: { /* ... */ },
  dark_blue_surface1: { /* ... */ },
}
```

### Performance Considerations

**1. Prefer theme tokens over direct token access**

```tsx
// ✅ Good: Theme token (changes with theme, optimized)
<Button backgroundColor="$background" />

// ❌ Less optimal: Direct token (doesn't change with theme)
<Button backgroundColor="$blue10" />
```

**2. Use .get() for external integrations**

```tsx
import { useTheme } from 'tamagui'

// ✅ Good: Optimized for web (no re-render)
const theme = useTheme()
const bg = theme.background.get()

// ❌ Less optimal: Always re-renders
const bgVal = theme.background.val
```

**3. Avoid theme switching in loops**

```tsx
// ❌ Avoid: Creating theme context in loops
{items.map(item => (
  <Theme name={item.theme} key={item.id}>
    <Item {...item} />
  </Theme>
))}

// ✅ Better: Apply theme via prop
{items.map(item => (
  <Item {...item} theme={item.theme} key={item.id} />
))}
```

**4. Memoize expensive theme calculations**

```tsx
import { useMemo } from 'react'
import { useTheme } from 'tamagui'

export function ExpensiveThemeCalc() {
  const theme = useTheme()
  
  const derivedColors = useMemo(() => ({
    lighter: adjustBrightness(theme.background.val, 20),
    darker: adjustBrightness(theme.background.val, -20),
  }), [theme.background.val])
  
  return <YStack backgroundColor={derivedColors.lighter} />
}
```

### Accessibility

**1. Ensure sufficient contrast**

```tsx
// Use color11/color12 for text on color1/color2 backgrounds
<YStack backgroundColor="$color1">
  <Text color="$color11">Good contrast</Text>
</YStack>
```

**2. Test both light and dark themes**

```tsx
// Use themeInverse to test both modes quickly
<Theme name="light">
  <Component />
  <Theme inverse>
    <Component />
  </Theme>
</Theme>
```

---

## Quick Reference

### Common Theme Tokens

```tsx
// Backgrounds
$background, $backgroundHover, $backgroundPress, $backgroundFocus
$color1, $color2, $color3  // Subtle backgrounds

// Text Colors
$color, $colorHover, $colorPress
$color10, $color11, $color12  // Low to high contrast text

// Borders
$borderColor, $borderColorHover, $borderColorPress
$color5, $color6, $color7  // Border scale

// Shadows
$shadowColor, $shadow1, $shadow2, ..., $shadow6
```

### Theme Component Props

```tsx
<Theme
  name="dark"           // Theme name
  inverse               // Flip light/dark
  reset                 // Clear parent theme
  debug                 // Log theme info
>
  {children}
</Theme>
```

### useTheme Return Value

```tsx
const theme = useTheme()

theme.background.val       // Raw value: '#000'
theme.background.variable  // CSS var: 'var(--background)'
theme.background.get()     // Optimized getter
theme.background.name      // Token name: 'background'
```

### Theme Creation Methods

```tsx
// Simple object
const themes = { light: { /* ... */ }, dark: { /* ... */ } }

// V5 helper
import { createV5Theme } from '@tamagui/themes'
const themes = createV5Theme({ /* options */ })

// Advanced builder
import { createThemes } from '@tamagui/theme-builder'
const themes = createThemes({ /* config */ })
```

### Color Scale Reference

| Step | Purpose | Example Use |
|------|---------|-------------|
| 1-4  | Backgrounds | App background, cards, hover states |
| 5-7  | Borders | Dividers, input borders, focus rings |
| 8-9  | Solid colors | Buttons, badges, solid backgrounds |
| 10-12 | Text | Placeholder, body text, headings |

### Debugging Themes

```tsx
import { useTheme, useThemeName } from 'tamagui'

export function ThemeDebugger() {
  const theme = useTheme()
  const name = useThemeName()
  
  console.log('Current theme:', name)
  console.log('Theme values:', theme)
  
  return <Text>Theme: {name}</Text>
}
```

---

## Additional Resources

- **Official Docs**: [tamagui.dev/docs/core/theme](https://tamagui.dev/docs/core/theme)
- **Theme Builder Guide**: [tamagui.dev/docs/guides/theme-builder](https://tamagui.dev/docs/guides/theme-builder)
- **Radix Colors**: [@tamagui/colors](https://www.radix-ui.com/colors)
- **Source Code**: `@tamagui/themes`, `@tamagui/theme-builder`, `@tamagui/web`
