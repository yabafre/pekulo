# Breaking Changes and New Features

> Migration guide for Tamagui v1.x to current (v1.144+)

This document covers major breaking changes and new features introduced in recent Tamagui versions, helping you migrate from older v1.x versions to the current release.

---

## Breaking Changes

### 1. Media Query Realignment (Config V4)

**What changed:** Media queries in `@tamagui/config/v4` and `v5` now use Tailwind-aligned naming and mobile-first breakpoints.

**Old approach (v1-v3):**
```tsx
media: {
  tiny: { maxWidth: 500 },
  small: { maxWidth: 700 },
  medium: { maxWidth: 900 },
  large: { maxWidth: 1200 },
}
```

**New approach (v4+):**
```tsx
media: {
  '2xs': { minWidth: 340 },
  'xs': { minWidth: 460 },
  'sm': { minWidth: 640 },
  'md': { minWidth: 768 },
  'lg': { minWidth: 1024 },
  'xl': { minWidth: 1280 },
  '2xl': { minWidth: 1536 },
}
```

**Migration steps:**
1. Update your media query definitions in `tamagui.config.ts`
2. Replace old media prop usages: `$tiny` → `$2xs`, `$small` → `$xs`, etc.
3. Convert desktop-first (`maxWidth`) to mobile-first (`minWidth`) approach
4. Test responsive layouts across breakpoints

---

### 2. Animation Driver Changes

**What changed:** Animation drivers now require explicit imports from specific entry points in v5.

**Old approach:**
```tsx
import { defaultConfig } from '@tamagui/config/v4'
// animations included automatically
```

**New approach (v5):**
```tsx
import { defaultConfig } from '@tamagui/config/v5'
import { animations } from '@tamagui/config/v5-css'
// or '@tamagui/config/v5-motion', '@tamagui/config/v5-rn', '@tamagui/config/v5-reanimated'

export const config = createTamagui({
  ...defaultConfig,
  animations,
})
```

**Available animation drivers:**
- `@tamagui/config/v5-css` - CSS animations (smallest bundle, great for web)
- `@tamagui/config/v5-motion` - Motion animations (spring physics)
- `@tamagui/config/v5-rn` - React Native Animated API
- `@tamagui/config/v5-reanimated` - Reanimated (best native performance)

**CSS variable fixes on web:**
Animation timing may differ slightly due to CSS variable optimizations. Test animations after upgrading.

**Migration steps:**
1. Import animations separately from driver-specific entry points
2. Test all animations in your app
3. Consider using different drivers per platform (CSS for web, Reanimated for native)

---

### 3. Theme Inverse Detection on iOS (`fastSchemeChange`)

**What changed:** The `fastSchemeChange` setting now uses `DynamicColorIOS` on iOS, which can cause issues with automatic theme detection.

**Impact:**
- When `fastSchemeChange: true`, iOS may not correctly detect light/dark mode changes
- Explicit theme setting required in some cases

**Workaround:**
```tsx
// Explicitly set theme instead of relying on auto-detection
<Theme name={colorScheme === 'dark' ? 'dark' : 'light'}>
  <App />
</Theme>
```

**Migration steps:**
1. If you encounter theme switching issues on iOS, explicitly control theme with state
2. Consider setting `fastSchemeChange: false` if auto-detection is critical
3. Test light/dark mode switching thoroughly on iOS devices

---

### 4. Font Configuration Type Checking (`exactOptionalPropertyTypes`)

**What changed:** TypeScript 4.4+ `exactOptionalPropertyTypes` compiler option now enforces stricter type checking on font configs.

**Old approach (allowed):**
```tsx
const font = createFont({
  size: {
    1: 12,
    2: 14,
  },
  lineHeight: {
    1: 17,
    // 2 would auto-fill
  },
})
```

**New requirement:**
All font property keys must match or be subsets of `size` keys. Enable `exactOptionalPropertyTypes: false` in `tsconfig.json` if needed, or ensure all keys align.

**Migration steps:**
1. Review your font configurations
2. Either align all property keys or disable `exactOptionalPropertyTypes`
3. Ensure `lineHeight`, `weight`, `letterSpacing` are subsets of `size` keys

---

### 5. Deprecated: `createTheme` Helper

**What changed:** The `createTheme` helper function is deprecated.

**Old approach:**
```tsx
import { createTheme } from '@tamagui/core'

const myTheme = createTheme({
  background: '#000',
  color: '#fff',
})
```

**New approach:**
```tsx
// Use plain objects
const myTheme = {
  background: '#000',
  color: '#fff',
}

// Or use createThemes for complex theme suites
import { createThemes } from '@tamagui/theme-builder'

const themes = createThemes({
  base: {
    palette: {
      light: ['#fff', '#f2f2f2', ...],
      dark: ['#000', '#111', ...],
    },
  },
})
```

**Migration steps:**
1. Replace `createTheme()` calls with plain objects
2. For complex theme suites, use `createThemes` or `createV5Theme`
3. Update theme type definitions if needed

---

### 6. Compound Variants Removed

**What changed:** Explicit `compoundVariants` option removed. Use dynamic variant functions instead.

**Old approach:**
```tsx
const Button = styled(View, {
  variants: {
    size: { small: {...}, large: {...} },
    color: { red: {...}, blue: {...} },
  },
  compoundVariants: [
    {
      size: 'small',
      color: 'red',
      css: { border: '2px solid red' },
    },
  ],
})
```

**New approach:**
```tsx
const Button = styled(View, {
  variants: {
    size: {
      small: (val, { props }) => ({
        padding: 10,
        // Conditionally apply styles based on other props
        ...(props.color === 'red' && {
          border: '2px solid red',
        }),
      }),
      large: {...},
    },
    color: { red: {...}, blue: {...} },
  },
})
```

**Migration steps:**
1. Identify all `compoundVariants` usages
2. Convert to dynamic variant functions with conditional logic
3. Test all variant combinations

---

### 7. `native` Prop Deprecated (Dialogs, Sheets, Popovers)

**What changed:** The `native` prop is deprecated in favor of using the `Adapt` API.

**Old approach:**
```tsx
<AlertDialog native>
  <AlertDialog.Trigger />
  <AlertDialog.Content>...</AlertDialog.Content>
</AlertDialog>
```

**New approach:**
```tsx
<AlertDialog>
  <AlertDialog.Trigger />
  <Adapt when="sm" platform="touch">
    <Sheet>
      <Sheet.Frame>
        <Adapt.Contents />
      </Sheet.Frame>
    </Sheet>
  </Adapt>
  <AlertDialog.Content>...</AlertDialog.Content>
</AlertDialog>
```

**Migration steps:**
1. Remove `native` prop from AlertDialog, Sheet, and Popover components
2. Implement Adapt API for platform-specific rendering
3. Test on both web and native platforms

---

### 8. `space` Property Deprecated in favor of `gap`

**What changed:** The `space` property for adding spacing between children is deprecated. Use standard `gap` instead.

**Old approach:**
```tsx
<YStack space="$4">
  <Text>Item 1</Text>
  <Text>Item 2</Text>
</YStack>
```

**New approach:**
```tsx
<YStack gap="$4">
  <Text>Item 1</Text>
  <Text>Item 2</Text>
</YStack>
```

**Migration steps:**
1. Find and replace all `space=` with `gap=`
2. Update any custom components that use the `space` prop
3. Remove `Unspaced` wrapper usage (now use `gap={0}` to override)

---

### 9. Input Component API Changes

**What changed:** Input components now use web-standard event handlers.

**Old approach:**
```tsx
<Input onChangeText={(text) => setValue(text)} />
```

**New approach (preferred):**
```tsx
<Input onChange={(e) => setValue(e.nativeEvent.text)} />

// onChangeText still works but is deprecated
```

**Migration steps:**
1. Update to `onChange` for new code
2. Gradually migrate existing `onChangeText` usages
3. Both work during transition period

---

### 10. `useButton` API Deprecated

**What changed:** The `useButton` hook is deprecated. Use compound component APIs instead.

**Migration:**
See the [How to Build a Button](/docs/guides/how-to-build-a-button) guide for the new pattern using `Button.Icon`, `Button.Text`, etc.

---

## New Features

### Enhanced Adapt System

**What it does:** Provides fine-grained control over component rendering based on platform, media queries, and more.

**Example:**
```tsx
<Dialog>
  <Dialog.Trigger />
  
  {/* Render as Sheet on small screens and touch devices */}
  <Adapt when="sm" platform="touch">
    <Sheet modal dismissOnSnapToBottom>
      <Sheet.Frame>
        <Adapt.Contents />
      </Sheet.Frame>
      <Sheet.Overlay />
    </Sheet>
  </Adapt>
  
  {/* Default Dialog on larger screens */}
  <Dialog.Portal>
    <Dialog.Overlay />
    <Dialog.Content>...</Dialog.Content>
  </Dialog.Portal>
</Dialog>
```

**Features:**
- Conditional rendering based on media queries
- Platform-specific components (web vs native, touch vs mouse)
- Seamless integration with existing components
- Automatic content injection via `Adapt.Contents`

---

### Bento Premium Components (172+)

**What it is:** A collection of 172+ production-ready, accessible, and customizable components available through Tamagui Takeout.

**Component categories:**
- Forms (inputs, selects, date pickers, autocomplete)
- Navigation (tabs, breadcrumbs, pagination)
- Data display (tables, cards, lists, avatars)
- Overlays (modals, drawers, tooltips, popovers)
- Layout (grids, stacks, dividers)
- Feedback (alerts, toasts, spinners, progress bars)

**Access:**
Visit [tamagui.dev/takeout](https://tamagui.dev/takeout) or use CLI:
```bash
npx tamagui add <component-name>
```

**Requires Tamagui Takeout subscription.**

---

### TanStack Table Integration

**What it is:** First-class integration with TanStack Table (React Table v8) for building powerful data tables.

**Features:**
- Full type safety with Tamagui styling
- Sorting, filtering, pagination built-in
- Virtual scrolling for large datasets
- Responsive column management
- Works seamlessly with Tamagui themes

**Example:**
```tsx
import { useReactTable } from '@tanstack/react-table'
import { Table } from '@tamagui/bento/table' // Requires Takeout

const MyTable = () => {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return <Table table={table} />
}
```

---

### React Hook Form Integration

**What it is:** Seamless integration with React Hook Form for form validation and management.

**Features:**
- Type-safe form handling
- Built-in validation
- Works with all Tamagui input components
- Automatic error display

**Example:**
```tsx
import { useForm } from 'react-hook-form'
import { Form, Input, Button } from 'tamagui'

const MyForm = () => {
  const { register, handleSubmit } = useForm()
  
  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <Input {...register('email', { required: true })} />
      <Button type="submit">Submit</Button>
    </Form>
  )
}
```

---

### Better Auth (Takeout)

**What it is:** Drop-in authentication solution with multiple provider support.

**Features:**
- Email/password, OAuth (Google, GitHub, etc.)
- Session management
- Protected routes
- User management UI
- TypeScript support

**Part of Tamagui Takeout subscription.**

---

### Zero Sync (Takeout)

**What it is:** Real-time data synchronization between client and server.

**Features:**
- Optimistic updates
- Conflict resolution
- Offline support
- Type-safe queries
- Works with any backend

**Part of Tamagui Takeout subscription.**

---

### One.js Router (Takeout)

**What it is:** File-based routing for React Native and Web with zero config.

**Features:**
- Automatic route generation from file structure
- Type-safe navigation
- Deep linking support
- Shared layouts
- Nested routes
- Works with Expo

**Example:**
```tsx
// app/index.tsx
export default function Home() {
  return <View><Text>Home</Text></View>
}

// Navigate with type safety
import { router } from 'one'
router.push('/profile/123')
```

**Part of Tamagui Takeout subscription.**

---

### Drizzle ORM Integration (Takeout)

**What it is:** TypeScript ORM integration for type-safe database operations.

**Features:**
- Full type inference
- SQL-like API
- Migrations
- Multiple database support (PostgreSQL, MySQL, SQLite)
- Works with Tamagui's data components

**Part of Tamagui Takeout subscription.**

---

### `createV5Theme` Helper

**What it is:** Simplified theme creation for v5 configs.

**Features:**
- Zero-config defaults with light/dark themes
- Easy color palette customization
- Works with @tamagui/colors (Radix)
- Accessible color scales

**Example:**
```tsx
import { createV5Theme, defaultChildrenThemes } from '@tamagui/config/v5'
import { cyan, cyanDark, amber, amberDark } from '@tamagui/colors'

const themes = createV5Theme({
  childrenThemes: {
    ...defaultChildrenThemes,
    cyan: { light: cyan, dark: cyanDark },
    amber: { light: amber, dark: amberDark },
  },
})
```

---

### Enhanced Media Queries (V5)

**What's new:** Expanded media query options including height-based and max-width variants.

**New queries:**
- Height-based: `heightXXS`, `heightXS`, `heightSM`, `heightMD`, `heightLG`
- Max-width (desktop-first): `maxXXS`, `maxXS`, `maxSM`, `maxMD`, `maxLG`, `maxXL`, `maxXXL`
- Pointer: `pointerTouch` for touch device detection

**Example:**
```tsx
<View
  $heightSM={{ padding: '$2' }}
  $maxMD={{ display: 'none' }}
  $pointerTouch={{ cursor: 'pointer' }}
/>
```

---

### Theme Tree Shaking (Production Optimization)

**What it is:** Remove theme JavaScript from client bundles (themes hydrate from CSS).

**Setup:**
```tsx
import { defaultConfig, themes } from '@tamagui/config/v5'

export const config = createTamagui({
  ...defaultConfig,
  themes: process.env.VITE_ENVIRONMENT === 'client' 
    ? ({} as typeof themes) 
    : themes,
})
```

**Benefits:**
- 20KB+ bundle size reduction
- Faster client load times
- Requires SSR (themes rendered to CSS on server)

---

### Button Web Form Props

**What's new:** Full HTML button attribute support for web forms.

**Example:**
```tsx
<Form action="/submit">
  <Button type="submit">Submit</Button>
  <Button type="reset">Reset</Button>
  <Button 
    type="submit" 
    formAction="/alternative"
    formMethod="post"
  >
    Submit to Different Endpoint
  </Button>
</Form>
```

**Note:** Button defaults to `type="button"` to prevent unintended form submissions.

---

### Improved Color Palettes (V5)

**What's new:** Richer color system based on Radix Colors with better accessibility.

**Features:**
- 12-step color scales for all themes
- Semantic color tokens (`background`, `color`, `borderColor` with hover/press/focus variants)
- Opacity variants (`color01`, `color0075`, `color005`, etc.)
- Interpolated colors (`color1pt5`, `color2pt5`)
- Fixed black/white scales
- Accent color support

**Example:**
```tsx
<View bg="$blue5" borderColor="$blue7">
  <Text color="$blue11">Accessible text</Text>
</View>
```

---

### `iconSize` Prop (Button)

**What's new:** Explicit icon size control separate from button size.

**Example:**
```tsx
<Button icon={Star} iconSize="$2" size="$5">
  Icon sized explicitly
</Button>
```

---

### `adjustPalette` and `adjustPalettes` Helpers (V5)

**What it is:** Transform color palettes with callbacks for custom color adjustments.

**Example:**
```tsx
import { adjustPalette, defaultChildrenThemes } from '@tamagui/config/v5'

// Desaturate and lighten a single palette
const mutedBlue = adjustPalette(blue, (hsl, i) => ({
  ...hsl,
  s: hsl.s * 0.7,
  l: Math.min(100, hsl.l * 1.1),
}))

// Adjust multiple palettes
const mutedThemes = adjustPalettes(defaultChildrenThemes, {
  default: {
    light: (hsl) => ({ ...hsl, s: hsl.s * 0.8 }),
    dark: (hsl) => ({ ...hsl, s: hsl.s * 0.6 }),
  },
})
```

---

## Migration Checklist

### Pre-Migration
- [ ] Review changelog and this document thoroughly
- [ ] Create a backup branch
- [ ] Document current config (media queries, themes, fonts)
- [ ] List all custom styled components using deprecated features

### Update Dependencies
- [ ] Update to latest Tamagui version: `npm install tamagui@latest`
- [ ] Update config package: `npm install @tamagui/config@latest`
- [ ] Update any Bento/Takeout packages if subscribed

### Config Updates
- [ ] Migrate to v5 config or manually update media queries to v4+ format
- [ ] Choose and configure animation driver explicitly
- [ ] Update theme definitions (remove `createTheme`, use `createThemes` or `createV5Theme`)
- [ ] Review and update font configurations
- [ ] Add `styleCompat: 'react-native'` if targeting React Native defaults

### Component Updates
- [ ] Replace `space` props with `gap`
- [ ] Remove `native` props, implement Adapt API
- [ ] Update Input `onChangeText` to `onChange`
- [ ] Replace `useButton` with compound component pattern
- [ ] Remove `compoundVariants`, use dynamic variant functions
- [ ] Update Button with explicit `type` for forms

### Testing
- [ ] Test responsive layouts across all breakpoints
- [ ] Test animations on web and native
- [ ] Test theme switching (light/dark) on all platforms
- [ ] Test all forms and inputs
- [ ] Test platform-specific adaptations (Adapt API)
- [ ] Visual regression testing

### Performance
- [ ] Enable theme tree shaking for production builds
- [ ] Verify compiler optimizations are working (`// debug` in components)
- [ ] Check bundle size improvements

---

## Performance Improvements

### Compiler Optimizations
- Better tree flattening for styled components
- More aggressive CSS extraction
- Improved media query compilation
- Faster hot reload in development

### Runtime Improvements
- Reduced re-renders with `fastSchemeChange` on iOS
- Better theme proxying and caching
- Optimized media query subscriptions
- Improved variant resolution

### Bundle Size
- Theme tree shaking can save 20KB+
- Smaller animation driver bundles (v5)
- Better dead code elimination

---

## Quick Reference

### Config V4 → V5 Differences

| Feature | V4 | V5 |
|---------|----|----|
| **Colors** | 4 colors (blue, red, green, yellow) | 11 colors + neutral |
| **Animations** | Included | Separate imports required |
| **styleCompat** | Not set (legacy) | `'react-native'` default |
| **defaultPosition** | `'relative'` | `'static'` |
| **Theme Helper** | `createThemes` | `createV5Theme` or `createThemes` |

### Common Replacements

| Old | New |
|-----|-----|
| `space` prop | `gap` prop |
| `native` prop | `Adapt` API |
| `onChangeText` | `onChange` |
| `useButton` | Compound components |
| `createTheme` | Plain objects or `createThemes` |
| `compoundVariants` | Dynamic variant functions |

### Resource Links

- [Config V5 Docs](/docs/core/config-v5)
- [Config V4 Docs](/docs/core/config-v4)
- [Theme Builder Guide](/docs/guides/theme-builder)
- [Adapt Documentation](/docs/components/adapt)
- [How to Build a Button](/docs/guides/how-to-build-a-button)
- [Tamagui Takeout](https://tamagui.dev/takeout)

---

**Document version:** 1.0 (based on Tamagui v1.144+)  
**Last updated:** 2024-01-24

For the most current information, always check the official Tamagui documentation at [tamagui.dev](https://tamagui.dev).
