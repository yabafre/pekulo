# Tamagui Compiler

> Static extraction and optimization for web and native

## Overview

The Tamagui Compiler is a **Babel-based optimization tool** that statically analyzes JSX and `styled()` functions to generate platform-native primitives. It transforms your Tamagui components at build time into highly optimized code—plain `div`s on web and React Native `View`s on native platforms.

### What It Does

- **Static Extraction**: Analyzes component styles at compile time and extracts them to CSS (web) or StyleSheet (native)
- **Component Flattening**: Removes unnecessary wrapper components and merges nested styles
- **Tree Shaking**: Eliminates unused style logic from your runtime bundle
- **Atomic CSS Generation**: Creates optimized atomic CSS classes for web
- **Media Query Optimization**: Converts runtime media queries to CSS @media rules on web

### Benefits

- **Smaller Bundle Size**: Removes abstraction layers and runtime style generation code
- **Faster Runtime**: Pre-computed styles require less JavaScript execution
- **Better Performance**: Near-zero runtime overhead on web with atomic CSS
- **Automatic Optimization**: Works transparently without code changes

### How It Works

```tsx
// Your code
<Button size="$4" backgroundColor="$blue10">
  Click me
</Button>

// After compiler (web)
<div className="button-base _bg-blue10 _p-16">Click me</div>

// After compiler (native)
<View style={styles.button_base_blue10_p16}>
  <Text>Click me</Text>
</View>
```

## Setup

The compiler is **optional** but recommended for production. Tamagui works at runtime without it, so you can add it when ready to optimize.

<Notice>
  The compiler generates a `.tamagui` directory with built versions of your components and config. Add this to your `.gitignore`.
</Notice>

### Next.js

Install the Next.js plugin:

```bash
npm install @tamagui/next-plugin
```

Configure `next.config.js`:

```js
const { withTamagui } = require('@tamagui/next-plugin')

module.exports = withTamagui({
  config: './tamagui.config.ts',
  components: ['tamagui'],
  
  // Optional: disable in dev for faster iteration
  disableExtraction: process.env.NODE_ENV === 'development',
  
  // Optional: exclude specific React Native Web exports
  excludeReactNativeWebExports: ['Switch', 'ProgressBar', 'Picker'],
})
```

**For App Router**, generate a static CSS file:

```js
module.exports = withTamagui({
  config: './tamagui.config.ts',
  components: ['tamagui'],
  outputCSS: './public/tamagui.css',
  disableExtraction: process.env.NODE_ENV === 'development',
})
```

Then import it in `app/layout.tsx`:

```tsx
import '../public/tamagui.css'
```

### Vite

Install the Vite plugin:

```bash
npm install @tamagui/vite-plugin
```

Update `vite.config.ts`:

```ts
import { tamaguiPlugin } from '@tamagui/vite-plugin'

export default defineConfig({
  plugins: [
    tamaguiPlugin({
      config: './tamagui.config.ts',
      components: ['tamagui'],
      optimize: true, // enables optimization
    }),
  ],
})
```

### Webpack

Install the loader:

```bash
npm install tamagui-loader
```

Configure `webpack.config.js`:

```js
const { TamaguiPlugin } = require('tamagui-loader')

module.exports = {
  plugins: [
    new TamaguiPlugin({
      config: './tamagui.config.ts',
      components: ['tamagui'],
      importsWhitelist: ['constants.js', 'colors.js'],
      logTimings: true,
      disableExtraction: process.env.NODE_ENV === 'development',
    }),
  ],
}
```

Or use the loader directly:

```js
const { shouldExclude } = require('tamagui-loader')

module.exports = {
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: (path) => shouldExclude(path, __dirname, tamaguiOptions),
        use: [
          'thread-loader', // optional: parallel processing
          'esbuild-loader',
          {
            loader: 'tamagui-loader',
            options: {
              config: './tamagui.config.ts',
              components: ['tamagui'],
            },
          },
        ],
      },
    ],
  },
}
```

### Expo / Metro (Babel)

Install the Babel plugin:

```bash
npm install @tamagui/babel-plugin
```

Add to `babel.config.js`:

```js
module.exports = {
  plugins: [
    [
      '@tamagui/babel-plugin',
      {
        components: ['tamagui'],
        config: './tamagui.config.ts',
        importsWhitelist: ['constants.js', 'colors.js'],
        logTimings: true,
        disableExtraction: process.env.NODE_ENV === 'development',
      },
    ],
  ],
}
```

<Notice theme="blue">
  The Babel plugin is **optional** on native—Tamagui doesn't optimize as aggressively on React Native, so you can start without it and add it later if needed.
</Notice>

### CLI-Based In-Place Compilation

For bundlers without a plugin (like Turbopack), use `@tamagui/cli` to pre-compile:

```bash
npm install -D @tamagui/cli
```

Create `tamagui.build.ts`:

```ts
import type { TamaguiBuildOptions } from 'tamagui'

export default {
  config: './tamagui.config.ts',
  components: ['tamagui'],
  outputCSS: './public/tamagui.css',
} satisfies TamaguiBuildOptions
```

Add to `package.json`:

```json
{
  "scripts": {
    "build": "tamagui build --target web ./src -- next build"
  }
}
```

The `--` syntax runs your build command after optimization, then **automatically restores** your source files.

**CLI Usage:**

```bash
# Build all files in directory
tamagui build ./src

# Target specific platform
tamagui build --target web ./src
tamagui build --target native ./src

# Build specific file
tamagui build ./src/components/Button.tsx

# Use patterns
tamagui build --include "components/**" --exclude "**/*.test.tsx" ./src

# Verify minimum optimizations (CI)
tamagui build --target web --expect-optimizations 10 ./src
```

## How Static Extraction Works

The compiler performs **partial evaluation** of your components to determine which styles can be extracted at build time.

### What Gets Extracted

✅ **Static Props**
```tsx
<View backgroundColor="$blue10" padding="$4" />
// → Extracted to atomic CSS/StyleSheet
```

✅ **Token References**
```tsx
<Text fontSize="$6" color="$color" />
// → Resolved to theme tokens at compile time
```

✅ **Variants**
```tsx
<Button variant="outlined" size="large" />
// → Variant styles extracted statically
```

✅ **Media Queries (Web)**
```tsx
<View $sm={{ padding: '$2' }} $md={{ padding: '$4' }} />
// → Converted to CSS @media rules
```

✅ **Pseudo Styles (Web)**
```tsx
<Button hoverStyle={{ backgroundColor: '$blue11' }} />
// → Converted to CSS :hover
```

### What Doesn't Get Extracted

❌ **Dynamic Props**
```tsx
const size = Math.random() > 0.5 ? '$4' : '$6'
<View padding={size} />
// → Falls back to runtime
```

❌ **Spread Props**
```tsx
<View {...dynamicProps} />
// → Cannot analyze at compile time
```

❌ **Conditional Logic**
```tsx
<View padding={isLarge ? '$4' : '$2'} />
// → Requires runtime evaluation
```

❌ **Function References**
```tsx
const getColor = () => '$blue10'
<View backgroundColor={getColor()} />
// → Cannot evaluate functions
```

### Flattening Styled Components

The compiler **flattens** component trees when possible:

```tsx
// Before
const OuterBox = styled(YStack, {
  padding: '$4',
  backgroundColor: '$background',
})

const InnerBox = styled(OuterBox, {
  borderRadius: '$3',
})

<InnerBox />

// After compilation (web)
<div className="_p-16 _bg-background _br-12" />

// After compilation (native)
<View style={styles.combined_p16_bgBackground_br12} />
```

**Requirements for Flattening:**
- All props must be statically analyzable
- No dynamic children or render props
- Component must be in configured `components` array

## Configuration Options

All compiler plugins accept these options:

### Core Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `config` | `string` | **Required** | Path to your `tamagui.config.ts` file |
| `components` | `string[]` | `['tamagui']` | Array of npm packages containing Tamagui components to optimize |
| `importsWhitelist` | `string[]` | `[]` | Files the compiler can import at build time (e.g., `['constants.js', 'colors.js']`) |
| `logTimings` | `boolean` | `true` | Log compilation times and optimization stats |
| `disable` | `boolean` | `false` | Disable all compiler features (extraction + debug attrs) |
| `disableExtraction` | `boolean` | `false` | Disable CSS extraction (faster dev iteration) |
| `disableDebugAttr` | `boolean` | `false` | Disable debug `data-*` attributes in DOM |
| `disableFlattening` | `boolean` | `false` | Disable component tree flattening |
| `enableDynamicEvaluation` | `boolean` | `false` | **(Experimental)** Extract `styled()` outside configured components |

### importsWhitelist

The compiler takes a **conservative approach** to partial evaluation. Only files in this whitelist can be imported and read during compilation:

```js
{
  importsWhitelist: ['constants.js', 'colors.js']
}
```

This allows the compiler to inline values from these files:

```tsx
// colors.js (whitelisted)
export const PRIMARY = '#0066FF'

// Button.tsx
<Button backgroundColor={PRIMARY} />
// → Compiler can inline PRIMARY value
```

### disableExtraction

Disable static extraction in development for **faster hot reloading**:

```js
{
  disableExtraction: process.env.NODE_ENV === 'development'
}
```

When disabled, Tamagui uses runtime style generation but keeps helpful debug attributes.

### enableDynamicEvaluation

**(Experimental)** Enables extracting `styled()` definitions anywhere in your app, not just in configured `components`:

```js
{
  enableDynamicEvaluation: true
}
```

**How it works:**
1. Detects `styled()` outside component modules
2. Forces exports of all top-level variables
3. Bundles file with esbuild to `.tamagui-dynamic-eval-*.js`
4. Loads and optimizes the component

**Caveats:**
- May cause webpack warnings
- Can have cache invalidation issues
- Use with caution in production

## Optimization Patterns

### Use Static Values

✅ **Good**: Static props compile perfectly
```tsx
<Button size="$4" variant="outlined">Click</Button>
```

❌ **Avoid**: Dynamic expressions fall back to runtime
```tsx
<Button size={isLarge ? '$6' : '$4'}>Click</Button>
```

### Leverage Variants

✅ **Good**: Define variants in `styled()` for full extraction
```tsx
const Button = styled(View, {
  variants: {
    size: {
      small: { padding: '$2', fontSize: '$3' },
      large: { padding: '$4', fontSize: '$6' },
    },
  },
})

<Button size="large" />
```

❌ **Avoid**: Computing styles at runtime
```tsx
<Button style={{ padding: size === 'large' ? 16 : 8 }} />
```

### Prefer Token References

✅ **Good**: Tokens resolve at compile time
```tsx
<View backgroundColor="$blue10" padding="$4" />
```

❌ **Avoid**: Raw values bypass optimization
```tsx
<View backgroundColor="#0066FF" padding={16} />
```

### Use Media Queries Declaratively

✅ **Good**: Media props convert to CSS @media
```tsx
<View
  padding="$2"
  $sm={{ padding: '$4' }}
  $md={{ padding: '$6' }}
/>
```

❌ **Avoid**: `useMedia()` hook requires runtime
```tsx
const media = useMedia()
<View padding={media.sm ? '$4' : '$2'} />
```

<Notice theme="blue">
  The compiler understands `useMedia()` on web and can remove it in favor of CSS, but only for straightforward usage: `const media = useMedia()` followed by `media.sm`. De-structuring works, but not renaming.
</Notice>

### Minimize Spread Props

✅ **Good**: Explicit props
```tsx
<Button size="$4" variant="outlined" />
```

❌ **Avoid**: Spreads prevent static analysis
```tsx
<Button {...buttonProps} />
```

## Debugging

### Enable Debug Logging

Add `// debug` pragma at the top of any file:

```tsx
// debug
import { Button } from 'tamagui'

export default () => <Button>Test</Button>
```

This prints detailed extraction info:

```
[tamagui] Optimized Button (12ms)
  - Extracted: backgroundColor, padding, borderRadius
  - Flattened: true
  - Generated: 3 atomic classes
  - Skipped: onPress (event handler)
```

### Debug Pragma Options

```tsx
// debug            - Basic extraction info
// debug-verbose    - Detailed step-by-step analysis
```

### Check Optimization Stats

When `logTimings: true`, the compiler outputs per-file stats:

```
[tamagui] src/Button.tsx (45ms)
  - Components: 3 optimized, 1 skipped
  - Flattened: 2
  - CSS classes: 12
```

### Verify Extraction

Use the debug overlay (web only, development mode):

```tsx
<TamaguiProvider config={config} defaultTheme="light">
  {/* Your app */}
</TamaguiProvider>
```

In development, Tamagui adds `data-*` attributes to show optimization status:

```html
<div data-tamagui="button" data-optimized="true" data-flattened="true">
  Click me
</div>
```

### Common Issues

**No styles extracted:**
- Check `components` includes your package
- Verify `config` path is correct
- Ensure props are static, not dynamic

**Component not flattened:**
- Dynamic props prevent flattening
- Check for spread operators
- Render props block flattening

**Slow compilation:**
- Enable `disableExtraction` in dev mode
- Use `thread-loader` for parallel processing
- Limit `importsWhitelist` to essential files

## Platform-Specific Output

### Web: Atomic CSS

The compiler generates **atomic CSS classes**:

```tsx
<View backgroundColor="$blue10" padding="$4" />

// Generates CSS
._bg-blue10 { background-color: var(--blue10); }
._p-16 { padding: 16px; }

// HTML output
<div className="_bg-blue10 _p-16"></div>
```

**Benefits:**
- High reusability (same class across components)
- Minimal CSS file size (each style defined once)
- Optimal browser caching
- No runtime style injection

**Media queries** become CSS `@media`:

```tsx
<View padding="$2" $md={{ padding: '$4' }} />

// Generates
._p-8 { padding: 8px; }
@media (min-width: 768px) {
  ._md_p-16 { padding: 16px; }
}
```

### Native: React Native StyleSheet

The compiler generates optimized `StyleSheet` objects:

```tsx
<View backgroundColor="$blue10" padding="$4" />

// Generates
const styles = StyleSheet.create({
  base_bg_blue10_p_16: {
    backgroundColor: '#0066FF',
    padding: 16,
  },
})

// Component output
<View style={styles.base_bg_blue10_p_16} />
```

**Benefits:**
- Pre-computed styles (no runtime calculations)
- Optimized style references
- Reduced bridge traffic

**Note:** Media queries (`$sm`, `$md`, etc.) are **not extracted** on native—they require runtime evaluation via `useMedia()`.

## Bundle Size Impact

Expected improvements with the compiler enabled:

| Scenario | Without Compiler | With Compiler | Improvement |
|----------|------------------|---------------|-------------|
| **Simple app** (10 components) | ~45KB | ~28KB | **~38%** |
| **Medium app** (50 components) | ~120KB | ~65KB | **~46%** |
| **Large app** (200+ components) | ~380KB | ~180KB | **~53%** |

*Sizes are gzipped JavaScript bundles. Actual results vary based on component complexity and dynamic prop usage.*

**Additional savings:**
- CSS extraction reduces runtime style injection code
- Component flattening eliminates wrapper components
- Dead code elimination removes unused variants

## Disabling the Compiler

### Disable for Entire File

Add pragma at the top:

```tsx
// tamagui-ignore

import { Button } from 'tamagui'
// Rest of file...
```

### Disable for Single Component

Use the `disableOptimization` prop:

```tsx
<Button disableOptimization>Click me</Button>
```

This bypasses the compiler and uses full runtime styling.

## Quick Reference

| Feature | Web | Native | Notes |
|---------|-----|--------|-------|
| **Static extraction** | ✅ | ✅ | Core optimization |
| **Component flattening** | ✅ | ✅ | Removes wrappers |
| **Atomic CSS** | ✅ | ❌ | Web-only |
| **Media query extraction** | ✅ | ❌ | Native uses runtime |
| **Pseudo styles** | ✅ | ❌ | `:hover`, `:focus` web-only |
| **Token resolution** | ✅ | ✅ | Both platforms |
| **Variant extraction** | ✅ | ✅ | Both platforms |

**Setup Checklist:**
- [ ] Install appropriate plugin (`@tamagui/next-plugin`, `@tamagui/vite-plugin`, etc.)
- [ ] Configure `config` path to `tamagui.config.ts`
- [ ] Set `components` array to packages you use
- [ ] Add `importsWhitelist` for constants/colors files
- [ ] Enable `disableExtraction` in dev for faster iteration
- [ ] Add `.tamagui/` to `.gitignore`
- [ ] Test with `// debug` pragma to verify extraction

**CI Verification:**
```bash
# Fail build if fewer than 10 components optimized
tamagui build --expect-optimizations 10 ./src
```

**Environment Variables:**
```bash
TAMAGUI_TARGET=web              # or 'native'
DEBUG=tamagui                   # Verbose logging
TAMAGUI_IGNORE_BUNDLE_ERRORS=true  # Suppress warnings
```
