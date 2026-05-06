# Tamagui Animation System

> Animation drivers, enterStyle/exitStyle, and AnimatePresence for smooth cross-platform animations

Tamagui provides a powerful, flexible animation system that works seamlessly across web and native platforms. The system is built around swappable animation drivers, allowing you to optimize bundle size and performance for each platform while maintaining a unified API.

---

## Animation Drivers

Tamagui supports four animation drivers, each optimized for different use cases. All drivers share the same animation configuration format, making them interchangeable:

### Driver Comparison

| Driver | Platform | Bundle Impact | Performance | Spring Physics |
|--------|----------|---------------|-------------|----------------|
| **CSS** | Web only | Lightest (~1KB) | Fast (CSS transitions) | No (easing only) |
| **React Native** | Web + Native | No extra hit beyond RNW | On-thread | Yes (basic) |
| **Reanimated** | Web + Native | Larger (~40KB) | Off-thread (native), slower (web) | Yes (advanced) |
| **Motion** | Web only | Medium (~15KB) | Off-thread (WAAPI) | Yes (excellent) |

### CSS Driver (`@tamagui/animations-css`)

Best for simple web-only apps. Uses CSS transitions under the hood for maximum performance with minimal bundle size.

```tsx
import { createAnimations } from '@tamagui/animations-css'

export const animations = createAnimations({
  quick: 'ease-in 200ms',
  medium: 'ease-in-out 400ms',
  slow: 'cubic-bezier(0.215, 0.610, 0.355, 1.000) 600ms',
  bouncy: 'cubic-bezier(0.68, -0.55, 0.265, 1.55) 500ms',
})
```

**Limitations:**
- No spring physics (easing curves only)
- Cannot animate properties that require native driver on native platforms

### React Native Driver (`@tamagui/animations-react-native`)

Zero bundle overhead beyond React Native Web. Good for basic cross-platform animations.

```tsx
import { createAnimations } from '@tamagui/animations-react-native'

export const animations = createAnimations({
  bouncy: {
    type: 'spring',
    damping: 10,
    mass: 0.9,
    stiffness: 100,
  },
  lazy: {
    type: 'spring',
    damping: 18,
    stiffness: 50,
  },
  quick: {
    type: 'spring',
    damping: 20,
    mass: 1.2,
    stiffness: 250,
  },
  timing: {
    type: 'timing',
    duration: 300,
  },
})
```

**Spring Config Properties:**
- `type?: 'spring'` - Default spring animation
- `damping?: number` - Controls bounce (higher = less bounce)
- `mass?: number` - Weight of spring (higher = slower)
- `stiffness?: number` - Spring tension (higher = faster)
- `velocity?: number` - Initial velocity
- `overshootClamping?: boolean` - Prevent overshooting
- `delay?: number` - Delay in milliseconds

**Timing Config Properties:**
- `type: 'timing'` - Timing-based animation
- `duration?: number` - Duration in milliseconds
- `easing?: EasingFunction` - React Native easing function
- `delay?: number` - Delay in milliseconds

**Performance Note:**
- Runs on JavaScript thread (not native thread)
- Properties like `transform` and `opacity` can use native driver
- Color and layout properties (width, height, borderRadius) cannot use native driver and may be slower

### Reanimated Driver (`@tamagui/animations-reanimated`)

Most powerful option for native with off-thread animations. Larger bundle but best native performance.

```tsx
import { createAnimations } from '@tamagui/animations-reanimated'

export const animations = createAnimations({
  bouncy: {
    type: 'spring',
    damping: 10,
    stiffness: 100,
  },
  lazy: {
    type: 'spring',
    damping: 20,
    stiffness: 60,
  },
})
```

### Motion Driver (`@tamagui/animations-motion`)

Web-only driver with excellent spring physics using WAAPI (Web Animations API).

```tsx
import { createAnimations } from '@tamagui/animations-motion'

export const animations = createAnimations({
  bouncy: {
    type: 'spring',
    damping: 10,
    stiffness: 100,
  },
})
```

---

## Animation Configuration

### Basic Setup

Add your chosen driver to `tamagui.config.ts`:

```tsx
import { createAnimations } from '@tamagui/animations-react-native'
import { createTamagui } from 'tamagui'

export default createTamagui({
  animations: createAnimations({
    quick: {
      type: 'spring',
      damping: 20,
      stiffness: 250,
    },
    medium: {
      type: 'spring',
      damping: 15,
      stiffness: 150,
    },
    slow: {
      type: 'spring',
      damping: 12,
      stiffness: 80,
    },
    bouncy: {
      type: 'spring',
      damping: 8,
      stiffness: 100,
    },
    lazy: {
      type: 'spring',
      damping: 18,
      stiffness: 50,
    },
  }),
})
```

### Platform-Specific Drivers

Use file extensions to load different drivers per platform:

```tsx
// animations.ts (web)
import { createAnimations } from '@tamagui/animations-motion'

export const animations = createAnimations({
  bouncy: {
    type: 'spring',
    damping: 10,
    stiffness: 100,
  },
})
```

```tsx
// animations.native.ts
import { createAnimations } from '@tamagui/animations-reanimated'

export const animations = createAnimations({
  bouncy: {
    type: 'spring',
    damping: 10,
    stiffness: 100,
  },
})
```

```tsx
// tamagui.config.ts
import { animations } from './animations' // Picks .native.ts on native

export default createTamagui({
  animations,
})
```

### Multiple Drivers

Configure multiple drivers and switch between them using `animatedBy`:

```tsx
import { createAnimations as createCSS } from '@tamagui/animations-css'
import { createAnimations as createSpring } from '@tamagui/animations-moti'

export default createTamagui({
  animations: {
    default: createCSS({ 
      quick: 'ease-in 200ms',
    }),
    spring: createSpring({ 
      bouncy: { type: 'spring', damping: 10 },
    }),
  },
})
```

```tsx
<Square transition="quick" />                    {/* uses default (CSS) */}
<Square animatedBy="spring" transition="bouncy" /> {/* uses spring driver */}
```

### Lazy Loading Drivers

Reduce initial bundle size by lazy loading animation drivers:

```tsx
import { Configuration } from 'tamagui'
import { createAnimations } from '@tamagui/animations-moti'

const springDriver = createAnimations({ bouncy: { type: 'spring', damping: 10 } })

export function AuthenticatedLayout({ children }) {
  return (
    <Configuration animationDriver={springDriver}>
      {children}
    </Configuration>
  )
}
```

Or add drivers dynamically:

```tsx
import { loadAnimationDriver } from 'tamagui'
import { createAnimations } from '@tamagui/animations-moti'

const driver = createAnimations({ bouncy: { type: 'spring', damping: 10 } })
loadAnimationDriver('spring', driver)

// Add types for autocomplete
declare module 'tamagui' {
  interface TypeOverride {
    animationDrivers(): 'spring'
  }
}
```

---

## Basic Animation Usage

### The `transition` Prop

The `transition` prop activates animations on any component. It accepts an animation name from your config:

```tsx
import { Square } from 'tamagui'

export default () => (
  <Square
    transition="bouncy"
    bg="$blue10"
    size={100}
    hoverStyle={{ scale: 1.1 }}
    pressStyle={{ scale: 0.9 }}
  />
)
```

**Important Rules:**

1. **Always keep the transition prop** - Once added, keep it on the component (use `null`/`false` to disable)
2. **Use conditional values** - `transition={active ? 'bouncy' : null}` ✅
3. **Don't use spread** - `{...active && { transition: 'bouncy' }}` ❌
4. **Changing the key** - If you must add/remove transition after render, change the component's key

```tsx
// Good
<View transition={isAnimated ? 'bouncy' : null} />

// Bad - causes issues with animation hooks
<View {...(isAnimated && { transition: 'bouncy' })} />
```

### Animating Hover and Press States

```tsx
import { Button } from 'tamagui'

export default () => (
  <Button
    transition="quick"
    hoverStyle={{
      scale: 1.05,
      backgroundColor: '$blue11',
    }}
    pressStyle={{
      scale: 0.95,
      backgroundColor: '$blue9',
    }}
  >
    Click Me
  </Button>
)
```

---

## enterStyle / exitStyle Pattern

The `enterStyle` and `exitStyle` props define mount and unmount animations respectively.

### How It Works

1. **Mount**: Component starts with `enterStyle` values
2. **Enter Animation**: Animates from `enterStyle` to base style
3. **Active State**: Component sits at base style
4. **Exit Animation**: When unmounting (inside `AnimatePresence`), animates from base to `exitStyle`
5. **Unmount**: Component is removed from DOM

```tsx
import { View } from 'tamagui'

export default () => (
  <View
    transition="bouncy"
    opacity={1}
    scale={1}
    y={0}
    enterStyle={{
      opacity: 0,
      scale: 0.9,
      y: 10,
    }}
  />
)
```

**Note:** You don't need to define base values for opacity, scale, x, y - Tamagui normalizes them:
- `opacity` defaults to `1`
- `scale` defaults to `1`
- `x`, `y` default to `0`

### Real-World Example: Card Entry

```tsx
import { Card, H3, Paragraph } from 'tamagui'

export const AnimatedCard = () => (
  <Card
    transition="medium"
    enterStyle={{
      opacity: 0,
      y: 20,
      scale: 0.95,
    }}
    p="$4"
    elevate
  >
    <H3>Welcome</H3>
    <Paragraph>This card animates in on mount</Paragraph>
  </Card>
)
```

### Staggered Entry Animations

Use `delay` to create staggered animations:

```tsx
import { Square, XStack } from 'tamagui'

export default () => (
  <XStack gap="$2">
    {[0, 1, 2, 3].map((i) => (
      <Square
        key={i}
        transition={['bouncy', { delay: i * 100 }]}
        enterStyle={{ opacity: 0, scale: 0.5, y: 20 }}
        size={50}
        bg="$blue10"
      />
    ))}
  </XStack>
)
```

---

## AnimatePresence

`AnimatePresence` enables exit animations by keeping components in the DOM until their exit animation completes.

### Basic Usage

```tsx
import { AnimatePresence, View } from 'tamagui'
import { useState } from 'react'

export default () => {
  const [visible, setVisible] = useState(true)
  
  return (
    <AnimatePresence>
      {visible && (
        <View
          key="panel"
          transition="bouncy"
          bg="$green10"
          p="$4"
          enterStyle={{
            opacity: 0,
            y: 10,
            scale: 0.9,
          }}
          exitStyle={{
            opacity: 0,
            y: -10,
            scale: 0.9,
          }}
        />
      )}
    </AnimatePresence>
  )
}
```

**Key Requirements:**
- Children must have unique `key` prop
- Wrap only direct children that should animate
- Works with any animation driver

### Props

| Prop | Type | Description |
|------|------|-------------|
| `initial` | `boolean` | If `false`, disables enter animations on first render |
| `exitBeforeEnter` | `boolean` | If `true`, waits for exit to finish before entering new children |
| `onExitComplete` | `() => void` | Callback fired when all exiting children finish animating |
| `custom` | `Object` | Custom data passed to children for conditional exit animations |
| `presenceAffectsLayout` | `boolean` | Whether siblings re-render when child exits (default: `true`) |

### Custom Exit Data

Use the `custom` prop to pass data that affects how components exit:

```tsx
import { AnimatePresence, styled, Image, YStack } from 'tamagui'
import { useState } from 'react'

const GalleryItem = styled(YStack, {
  fullscreen: true,
  zIndex: 1,
  
  variants: {
    going: {
      ':number': (direction) => ({
        enterStyle: {
          x: direction > 0 ? 1000 : -1000,
          opacity: 0,
        },
        exitStyle: {
          zIndex: 0,
          x: direction < 0 ? 1000 : -1000,
          opacity: 0,
        },
      }),
    },
  } as const,
})

export function ImageGallery() {
  const [[page, direction], setPage] = useState([0, 0])
  const images = ['img1.jpg', 'img2.jpg', 'img3.jpg']
  
  const paginate = (newDirection: number) => {
    setPage([page + newDirection, newDirection])
  }
  
  return (
    <AnimatePresence initial={false} custom={{ going: direction }}>
      <GalleryItem key={page} transition="quick" going={direction}>
        <Image src={images[page]} />
      </GalleryItem>
    </AnimatePresence>
  )
}
```

### exitBeforeEnter

Ensure only one child renders at a time:

```tsx
import { AnimatePresence, View } from 'tamagui'

export default ({ currentTab }) => (
  <AnimatePresence exitBeforeEnter>
    <View
      key={currentTab}
      transition="medium"
      enterStyle={{ opacity: 0, x: 20 }}
      exitStyle={{ opacity: 0, x: -20 }}
    >
      {/* Tab content */}
    </View>
  </AnimatePresence>
)
```

---

## Animation Props

### Granular Per-Property Animations

Animate different properties with different configs:

```tsx
import { YStack } from 'tamagui'

export default () => (
  <YStack
    transition={{
      x: 'bouncy',
      opacity: 'quick',
      y: {
        type: 'bouncy',
        overshootClamping: true,
      },
    }}
  />
)
```

### Array Syntax with Defaults

Set a default animation and override specific properties:

```tsx
import { YStack } from 'tamagui'

export default () => (
  <YStack
    transition={[
      'bouncy',        // default for all properties
      {
        y: 'slow',     // override for y
        scale: {       // override with config
          type: 'quick',
          delay: 100,
        },
      },
    ]}
  />
)
```

### Enter/Exit Transitions

Use different animations for entering and exiting:

```tsx
import { AnimatePresence, View } from 'tamagui'

export default ({ show }) => (
  <AnimatePresence>
    {show && (
      <View
        key="modal"
        transition={{ 
          enter: 'lazy',    // slow enter
          exit: 'quick',    // fast exit
        }}
        enterStyle={{ opacity: 0, y: 20 }}
        exitStyle={{ opacity: 0, y: -20 }}
      />
    )}
  </AnimatePresence>
)
```

Combine with default for property changes while mounted:

```tsx
<View
  transition={{ 
    enter: 'lazy', 
    exit: 'quick', 
    default: 'bouncy',  // for other state changes
  }}
  enterStyle={{ opacity: 0 }}
  exitStyle={{ opacity: 0 }}
/>
```

Or use with array syntax:

```tsx
<View
  transition={[
    'bouncy',
    { 
      enter: 'lazy', 
      exit: 'quick', 
      delay: 200,
      x: 'slow',
    }
  ]}
  enterStyle={{ opacity: 0, x: -100 }}
  exitStyle={{ opacity: 0, x: 100 }}
/>
```

### animateOnly

Limit animations to specific properties:

```tsx
import { Square } from 'tamagui'

export default () => (
  <Square
    transition="bouncy"
    animateOnly={['opacity', 'scale']}
    hoverStyle={{
      opacity: 0.8,
      scale: 1.1,
      backgroundColor: '$blue10', // Won't animate
    }}
  />
)
```

### delay

Add delay before animation starts (all drivers support this):

```tsx
import { View } from 'tamagui'

export default () => (
  <View
    transition={['quick', { delay: 300 }]}
    enterStyle={{ opacity: 0 }}
  />
)
```

Per-property delay:

```tsx
<View
  transition={{
    opacity: { type: 'quick', delay: 0 },
    y: { type: 'bouncy', delay: 100 },
  }}
  enterStyle={{ opacity: 0, y: 20 }}
/>
```

---

## Platform Differences

### Web (CSS Driver)

```tsx
// Generates CSS like:
.component {
  transition: opacity 200ms ease-in, transform 200ms ease-in;
}

// For enter animations, temporarily adds:
.t_unmounted {
  /* enterStyle values */
}
```

**Pros:**
- Minimal bundle size
- Browser-optimized CSS transitions
- No JavaScript execution overhead

**Cons:**
- No spring physics (easing curves only)
- Limited to CSS-animatable properties

### Native (React Native Driver)

```tsx
// Uses React Native Animated API
const animatedValue = new Animated.Value(0)

Animated.spring(animatedValue, {
  toValue: 1,
  damping: 10,
  stiffness: 100,
  useNativeDriver: true, // When possible
}).start()
```

**Native Driver Support:**
- ✅ `transform` (translateX, translateY, scale, rotate)
- ✅ `opacity`
- ❌ Layout properties (width, height, padding, margin)
- ❌ Colors (backgroundColor, borderColor)
- ❌ Border radius

**Properties that can't use native driver:**
```tsx
const costlyToAnimate = {
  borderRadius: true,
  borderWidth: true,
  backgroundColor: true,
  borderColor: true,
  // Layout-affecting properties
}
```

These properties animate on the JavaScript thread, which may cause performance issues for complex animations.

### Reanimated Driver

Runs off the JavaScript thread on native for smooth 60fps animations, even for "costly" properties:

```tsx
// Runs on UI thread
const animatedValue = useSharedValue(0)
animatedValue.value = withSpring(1, {
  damping: 10,
  stiffness: 100,
})
```

**Performance:**
- Native: Excellent (off-thread)
- Web: Slower than React Native driver (worklet overhead)

---

## Performance Tips

### 1. Choose the Right Driver

- **Simple web app**: CSS driver
- **Cross-platform with basic animations**: React Native driver
- **Complex native animations**: Reanimated driver
- **Web-only with advanced springs**: Motion driver

### 2. Use Native Driver When Possible

Stick to `transform` and `opacity` for best performance on native:

```tsx
// Good - uses native driver
<View
  transition="quick"
  enterStyle={{
    opacity: 0,
    scale: 0.9,
    x: 20,
  }}
/>

// Slower - can't use native driver
<View
  transition="quick"
  enterStyle={{
    backgroundColor: '$red10',
    borderRadius: 20,
  }}
/>
```

### 3. Limit Simultaneous Animations

Animate fewer properties for better performance:

```tsx
// Better
<View
  transition="quick"
  animateOnly={['opacity', 'y']}
  enterStyle={{ opacity: 0, y: 20 }}
/>

// Slower (animates all properties)
<View
  transition="quick"
  enterStyle={{ opacity: 0, y: 20 }}
/>
```

### 4. Use Will-Change on Web (CSS Driver)

For frequently animated elements, add `will-change`:

```tsx
<View
  style={{ willChange: 'transform, opacity' }}
  transition="quick"
/>
```

### 5. Avoid Layout Thrashing

Don't animate width/height - use `scale` instead:

```tsx
// Good
<View
  transition="quick"
  scale={1.2}
/>

// Bad (causes layout recalculation)
<View
  transition="quick"
  width={120}
  height={120}
/>
```

### 6. Debounce Rapid State Changes

If state changes rapidly, debounce to avoid animation spam:

```tsx
import { useDebouncedValue } from 'tamagui'

const debouncedValue = useDebouncedValue(value, 100)

<View
  transition="quick"
  opacity={debouncedValue ? 1 : 0.5}
/>
```

### 7. Profile Your Animations

Use React DevTools Profiler and browser performance tools to identify bottlenecks:

```tsx
// Enable verbose debugging
<View
  debug="verbose"
  transition="bouncy"
/>
```

---

## Quick Reference

### Animation Config (React Native Driver)

```tsx
createAnimations({
  quick: {
    type: 'spring',
    damping: 20,
    stiffness: 250,
  },
  timing: {
    type: 'timing',
    duration: 300,
  },
})
```

### Animation Config (CSS Driver)

```tsx
createAnimations({
  quick: 'ease-in 200ms',
  slow: 'cubic-bezier(0.215, 0.610, 0.355, 1.000) 600ms',
})
```

### Basic Animation

```tsx
<View
  transition="quick"
  hoverStyle={{ opacity: 0.8 }}
/>
```

### Enter Animation

```tsx
<View
  transition="bouncy"
  enterStyle={{ opacity: 0, y: 20 }}
/>
```

### Exit Animation

```tsx
<AnimatePresence>
  {visible && (
    <View
      key="item"
      transition="quick"
      exitStyle={{ opacity: 0, x: -20 }}
    />
  )}
</AnimatePresence>
```

### Per-Property Animation

```tsx
<View
  transition={{
    opacity: 'quick',
    y: 'bouncy',
  }}
/>
```

### With Delay

```tsx
<View
  transition={['quick', { delay: 200 }]}
  enterStyle={{ opacity: 0 }}
/>
```

### Platform-Specific

```tsx
// animations.ts (web)
export const animations = createAnimations({ ... })

// animations.native.ts
export const animations = createAnimations({ ... })

// tamagui.config.ts
import { animations } from './animations'
```

---

## Common Patterns

### Modal Enter/Exit

```tsx
<AnimatePresence>
  {open && (
    <Dialog.Portal key="modal">
      <Dialog.Overlay
        transition="quick"
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
      />
      <Dialog.Content
        transition="medium"
        enterStyle={{ opacity: 0, scale: 0.9, y: -20 }}
        exitStyle={{ opacity: 0, scale: 0.95, y: 10 }}
      >
        {/* Content */}
      </Dialog.Content>
    </Dialog.Portal>
  )}
</AnimatePresence>
```

### List Item Hover

```tsx
<ListItem
  transition="quick"
  hoverStyle={{
    backgroundColor: '$blue4',
    scale: 1.02,
  }}
  pressStyle={{
    backgroundColor: '$blue5',
    scale: 0.98,
  }}
/>
```

### Toast Notifications

```tsx
<AnimatePresence>
  {toasts.map((toast) => (
    <Toast
      key={toast.id}
      transition={['quick', { delay: 50 }]}
      enterStyle={{ opacity: 0, y: -20 }}
      exitStyle={{ opacity: 0, x: 100 }}
    >
      {toast.message}
    </Toast>
  ))}
</AnimatePresence>
```

### Accordion

```tsx
<Accordion.Content
  transition="medium"
  enterStyle={{ height: 0, opacity: 0 }}
  exitStyle={{ height: 0, opacity: 0 }}
>
  {/* Content */}
</Accordion.Content>
```
