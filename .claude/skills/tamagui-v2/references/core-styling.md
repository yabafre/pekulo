# Core Styling System

> Based on tamagui/tamagui official documentation

Comprehensive reference for Tamagui's core styling engine covering the `styled()` API, variant systems, context management, composition patterns, and TypeScript integration.

## Table of Contents

- [The styled() API](#the-styled-api)
- [Variant Systems](#variant-systems)
- [createStyledContext Pattern](#createstyledcontext-pattern)
- [withStaticProperties Composition](#withstaticproperties-composition)
- [TypeScript Integration](#typescript-integration)
- [Shorthands (v4)](#shorthands-v4)
- [Platform-Specific Styling](#platform-specific-styling)
- [Quick Reference](#quick-reference)

---

## The styled() API

The `styled()` function creates new components by extending existing ones with custom styles and variants.

### Basic Signature

```typescript
import { View, styled } from '@tamagui/core'

export const RoundedSquare = styled(View, {
  borderRadius: 20,
})
```

### Complete Configuration

```typescript
import { View, styled, GetProps } from '@tamagui/core'

export const CustomComponent = styled(
  View,                          // Parent component
  {
    // Base styles
    padding: '$4',
    backgroundColor: '$background',
    borderRadius: '$2',
    
    // Variants definition
    variants: {
      size: {
        small: { padding: '$2' },
        large: { padding: '$6' },
      },
    },
    
    // Default variant values
    defaultVariants: {
      size: 'small',
    },
    
    // Component name (for debugging)
    name: 'CustomComponent',
    
    // Styled context (for compound components)
    context: MyContext,
    
    // Render as specific HTML element (web only)
    render: 'button',
  },
  {
    // Static configuration (third argument)
    acceptsClassName: true,
    isText: false,
    isReactNative: false,
    
    // Custom props that accept tokens
    accept: {
      fill: 'color',
    } as const,
  }
)

// Helper to extract props type
export type CustomComponentProps = GetProps<typeof CustomComponent>
```

### Key Features

- **Inheritance**: All parent component props and variants are available
- **Optimizable**: Compiler extracts styles to CSS at build time
- **Type-safe**: Full TypeScript inference for props and variants
- **Composable**: Chain multiple `styled()` calls to build up complexity

### Order is Important

Style prop order matters for both overrides and variant behavior:

```typescript
// background can be overridden, width cannot
export default (props: ViewProps) => (
  <View
    background="red"
    {...props}        // background can override "red"
    width={200}       // width always 200
  />
)

// Variant order matters too
<MyView huge scale={3} />  // scale = 3 (prop wins)
<MyView scale={3} huge />  // scale = 2 (variant wins)
```

---

## Variant Systems

Tamagui supports **five types of variants**, each with different capabilities:

### 1. Basic Variants (Key-Value Mapping)

Simple key-value pairs mapping variant names to style objects:

```typescript
const Button = styled(View, {
  variants: {
    variant: {
      primary: {
        backgroundColor: '$blue10',
        color: 'white',
      },
      secondary: {
        backgroundColor: '$gray5',
        color: '$gray12',
      },
      outlined: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '$borderColor',
      },
    },
  } as const,
})

// Usage:
<Button variant="primary">Submit</Button>
```

### 2. Spread Variants (Token-based)

Use `...size`, `...fontSize`, `...color`, or `...space` to automatically map token values:

```typescript
const Circle = styled(View, {
  borderRadius: 100_000,
  
  variants: {
    size: {
      '...size': (size, { tokens }) => {
        return {
          width: tokens.size[size] ?? size,
          height: tokens.size[size] ?? size,
        }
      },
    },
  } as const,
})

// Accepts any size token or number:
<Circle size="$4" />
<Circle size="$10" />
<Circle size={100} />
```

### 3. Font-Sized Variants (Typography)

Use `getFontSized` helper for text components that need font scaling:

```typescript
import { getFontSized } from '@tamagui/get-font-sized'
import { Text, styled } from '@tamagui/core'

const SizableText = styled(Text, {
  name: 'SizableText',
  fontFamily: '$body',
  
  variants: {
    size: getFontSized,
  } as const,
  
  defaultVariants: {
    size: '$true',
  },
})

// Returns styles like:
// { fontSize: ..., lineHeight: ..., fontWeight: ..., letterSpacing: ... }
```

### 4. Boolean Variants with Dynamic Styles

Boolean variants that compute styles based on other props:

```typescript
const InputGroup = styled(XGroup, {
  variants: {
    applyFocusStyle: {
      ':boolean': (val, { props }) => {
        if (val) {
          return props.focusStyle || {
            outlineColor: '$outlineColor',
            outlineWidth: 2,
            borderColor: '$borderColorFocus',
          }
        }
      },
    },
  } as const,
})
```

### 5. Number Variants (Numeric Values)

Accept any number and compute styles dynamically:

```typescript
const Spacer = styled(View, {
  variants: {
    scaleIcon: {
      ':number': {} as any,  // Type placeholder
    },
    gap: {
      ':number': (val, { tokens }) => ({
        gap: val,
      }),
    },
  } as const,
})

<Spacer scaleIcon={1.5} gap={20} />
```

### Compound Variants (Access Other Props)

All variant functions receive `{ props, tokens, theme, font }` as second argument:

```typescript
const Button = styled(View, {
  variants: {
    size: {
      '...size': (val = '$true', { tokens, props }) => {
        const radiusToken = tokens.radius[val] ?? tokens.radius['$true']
        return {
          height: val,
          borderRadius: props.circular ? 100_000 : radiusToken,
          paddingHorizontal: tokens.space[val],
        }
      },
    },
  } as const,
})
```

---

## createStyledContext Pattern

For **compound component APIs** where parent props cascade to children:

### Basic Usage

```typescript
import { createStyledContext, styled, View, Text } from '@tamagui/core'
import type { SizeTokens } from '@tamagui/core'

// 1. Create context with default values
export const ButtonContext = createStyledContext<{
  size: SizeTokens
}>({
  size: '$4',
})

// 2. Reference context in styled components
export const ButtonFrame = styled(View, {
  name: 'Button',
  context: ButtonContext,
  
  variants: {
    size: {
      '...size': (name, { tokens }) => ({
        height: tokens.size[name],
        borderRadius: tokens.radius[name],
        gap: tokens.space[name].val * 0.2,
      }),
    },
  } as const,
  
  defaultVariants: {
    size: '$4',
  },
})

export const ButtonText = styled(Text, {
  name: 'ButtonText',
  context: ButtonContext,
  
  variants: {
    size: {
      '...fontSize': (name, { font }) => ({
        fontSize: font?.size[name],
      }),
    },
  } as const,
})
```

### Real Example from Bento (InputContext)

```typescript
import { createStyledContext } from 'tamagui'
import type { ColorTokens, FontSizeTokens } from 'tamagui'

const defaultContextValues = {
  size: '$true',
  scaleIcon: 1.2,
  color: undefined,
} as const

export const InputContext = createStyledContext<{
  size: FontSizeTokens
  scaleIcon: number
  color?: ColorTokens | string
}>(defaultContextValues)

// Used in InputGroup, InputIcon, InputLabel, etc.
const InputGroupFrame = styled(XGroup, {
  context: InputContext,
  variants: {
    size: {
      '...size': (val, { tokens }) => ({
        borderRadius: tokens.radius[val],
      }),
    },
  } as const,
})

// Accessing context in functional components
const InputIcon = InputIconFrame.styleable<{
  scaleIcon?: number
  color?: ColorTokens | string
}>((props, ref) => {
  const inputContext = InputContext.useStyledContext()
  const { size = '$true', color, scaleIcon = 1 } = inputContext
  
  const iconSize = getIconSize(size as FontSizeTokens, scaleIcon)
  // ... render icon with context values
})
```

### Context API

- **`Context.Provider`**: Provides context values to children
- **`Context.useStyledContext(scope?)`**: Hook to access context values
- **`Context.props`**: Default values
- **`Context.context`**: Underlying React context

### Scoped Contexts

```typescript
const MyContext = createStyledContext(
  { size: '$4' },
  'myNamespace'  // Namespace for scoping
)

<MyContext.Provider scope="form1" size="$3">
  <Input />  {/* Uses form1 scope */}
</MyContext.Provider>

<MyContext.Provider scope="form2" size="$5">
  <Input />  {/* Uses form2 scope */}
</MyContext.Provider>
```

---

## withStaticProperties Composition

Create **compound component APIs** like `Card.Header`, `Input.Icon`, `Button.Text`:

### Basic Pattern

```typescript
import { withStaticProperties, styled, View, Text } from '@tamagui/core'

const CardFrame = styled(View, {
  padding: '$4',
  borderRadius: '$4',
  backgroundColor: '$background',
})

const CardHeader = styled(View, {
  paddingBottom: '$2',
  borderBottomWidth: 1,
  borderColor: '$borderColor',
})

const CardTitle = styled(Text, {
  fontSize: '$6',
  fontWeight: 'bold',
})

// Compose into single export
export const Card = withStaticProperties(CardFrame, {
  Header: CardHeader,
  Title: CardTitle,
})

// Usage:
<Card>
  <Card.Header>
    <Card.Title>Card Title</Card.Title>
  </Card.Header>
  <Text>Card content here</Text>
</Card>
```

### Bento Input Example (Full Pattern)

```typescript
import { 
  XGroup, 
  withStaticProperties, 
  createStyledContext,
  styled 
} from 'tamagui'

// 1. Create context
const InputContext = createStyledContext({ size: '$true' })

// 2. Create individual components with context
const InputContainerFrame = styled(View, {
  context: InputContext,
  flexDirection: 'column',
})

const InputGroupImpl = InputGroupFrame.styleable((props, ref) => {
  const [focused, setFocused] = useState(false)
  return (
    <FocusContext.Provider focused={focused} setFocused={setFocused}>
      <InputGroupFrame ref={ref} {...props} />
    </FocusContext.Provider>
  )
})

const InputArea = styled(TInput, { context: InputContext })
const InputSection = styled(XGroup.Item, { context: InputContext })
const InputIcon = InputIconFrame.styleable((props, ref) => { /* ... */ })
const InputLabel = styled(Label, { context: InputContext })

// 3. Compose with withStaticProperties
export const Input = withStaticProperties(InputContainerFrame, {
  Box: InputGroupImpl,
  Area: InputArea,
  Section: InputSection,
  Button: InputButton,
  Icon: InputIcon,
  Label: InputLabel,
  Info: InputInfo,
  XGroup: withStaticProperties(InputXGroup, { Item: XGroup.Item }),
})

// 4. Usage:
<Input size="$4">
  <Input.Label>Email</Input.Label>
  <Input.Box>
    <Input.Section>
      <Input.Icon><User /></Input.Icon>
    </Input.Section>
    <Input.Section>
      <Input.Area placeholder="Enter email" />
    </Input.Section>
  </Input.Box>
  <Input.Info>We'll never share your email</Input.Info>
</Input>
```

---

## TypeScript Integration

### Type Inference with `as const`

**Always use `as const`** on variants for proper type inference:

```typescript
const Button = styled(View, {
  variants: {
    variant: {
      primary: { bg: '$blue10' },
      secondary: { bg: '$gray5' },
    },
    size: {
      small: { padding: '$2' },
      large: { padding: '$6' },
    },
  } as const,  // ← REQUIRED for type inference
})

// Now properly typed:
<Button variant="primary" size="large" />
<Button variant="invalid" />  // ← Type error
```

### GetProps Utility

Extract component prop types:

```typescript
import { GetProps, styled, View } from '@tamagui/core'

const MyButton = styled(View, {
  variants: {
    variant: {
      primary: {},
      secondary: {},
    },
  } as const,
})

// Extract all props including variants
export type MyButtonProps = GetProps<typeof MyButton>

// Use in your own components
export function CustomButton(props: MyButtonProps) {
  return <MyButton {...props} />
}
```

### styleable Wrapper (For HOCs)

When wrapping styled components in functional components that need to be styled again:

```typescript
const StyledText = styled(Text, {
  color: '$color',
})

// ✅ Correct: Use .styleable()
const HigherOrderText = StyledText.styleable<{ 
  customProp?: boolean 
}>((props, ref) => {
  // Add logic here
  return <StyledText ref={ref} {...props} />
})

// Now this works correctly:
const FinalText = styled(HigherOrderText, {
  variants: {
    size: {
      large: { fontSize: '$8' },
    },
  },
})
```

### Generic Type Parameters

```typescript
import { TamaguiComponent, GetRef, GetProps } from '@tamagui/core'

type MyComponent = TamaguiComponent<
  TamaDefer,                    // Deferred type resolution
  GetRef<ParentComponent>,      // Ref type
  ParentNonStyledProps,         // Non-style props
  ParentStylesBase,             // Base style props
  MyVariants,                   // Variant types
  StaticConfig                  // Static configuration
>
```

### Variant Type Extraction

```typescript
import { 
  GetStyledVariants, 
  GetVariantValues,
  VariantSpreadFunction 
} from '@tamagui/core'

const MyButton = styled(View, {
  variants: {
    size: { small: {}, large: {} },
    variant: { primary: {}, secondary: {} },
  } as const,
})

// Extract variant types
type ButtonVariants = GetStyledVariants<typeof MyButton>
// Result: { size?: 'small' | 'large', variant?: 'primary' | 'secondary' }

// Extract specific variant values
type SizeValues = GetVariantValues<ButtonVariants['size']>
// Result: 'small' | 'large'
```

---

## Shorthands (v4)

Tamagui provides built-in shorthands for common CSS properties:

### Complete Shorthand Table

| Shorthand | Full Property | Example |
|-----------|--------------|---------|
| **Text** |
| `text` | `textAlign` | `text="center"` |
| **Spacing** |
| `m` | `margin` | `m="$4"` |
| `mt` | `marginTop` | `mt={10}` |
| `mr` | `marginRight` | `mr="$2"` |
| `mb` | `marginBottom` | `mb="$3"` |
| `ml` | `marginLeft` | `ml="$2"` |
| `mx` | `marginHorizontal` | `mx="$4"` |
| `my` | `marginVertical` | `my="$2"` |
| `p` | `padding` | `p="$4"` |
| `pt` | `paddingTop` | `pt={10}` |
| `pr` | `paddingRight` | `pr="$2"` |
| `pb` | `paddingBottom` | `pb="$3"` |
| `pl` | `paddingLeft` | `pl="$2"` |
| `px` | `paddingHorizontal` | `px="$4"` |
| `py` | `paddingVertical` | `py="$2"` |
| **Layout** |
| `b` | `bottom` | `b={0}` |
| `l` | `left` | `l={0}` |
| `r` | `right` | `r={0}` |
| `t` | `top` | `t={0}` |
| `content` | `alignContent` | `content="center"` |
| `items` | `alignItems` | `items="center"` |
| `justify` | `justifyContent` | `justify="space-between"` |
| `self` | `alignSelf` | `self="flex-start"` |
| **Sizing** |
| `maxH` | `maxHeight` | `maxH={500}` |
| `maxW` | `maxWidth` | `maxW="100%"` |
| `minH` | `minHeight` | `minH={200}` |
| `minW` | `minWidth` | `minW={100}` |
| **Flex** |
| `grow` | `flexGrow` | `grow={1}` |
| `shrink` | `flexShrink` | `shrink={0}` |
| **Visual** |
| `bg` | `backgroundColor` | `bg="$background"` |
| `rounded` | `borderRadius` | `rounded="$4"` |
| `z` | `zIndex` | `z={100}` |
| **Misc** |
| `select` | `userSelect` | `select="none"` |

### Usage Example

```typescript
<View 
  bg="$background"
  p="$4"
  m="$2"
  rounded="$4"
  items="center"
  justify="space-between"
>
  <Text color="$color">Content</Text>
</View>

// Equivalent to:
<View
  backgroundColor="$background"
  padding="$4"
  margin="$2"
  borderRadius="$4"
  alignItems="center"
  justifyContent="space-between"
>
  <Text color="$color">Content</Text>
</View>
```

### Custom Shorthands

```typescript
import { createTamagui } from '@tamagui/core'

export default createTamagui({
  shorthands: {
    // Add custom shorthands
    shadow: 'boxShadow',
    w: 'width',
    h: 'height',
  } as const,
})
```

---

## Platform-Specific Styling

Target specific platforms with media query-style props:

### Platform Pseudo Props

```typescript
<View
  backgroundColor="$blue10"
  $platform-web={{
    cursor: 'pointer',
    userSelect: 'none',
  }}
  $platform-native={{
    elevation: 5,
  }}
  $platform-ios={{
    shadowOpacity: 0.3,
  }}
  $platform-android={{
    elevation: 8,
  }}
/>
```

### Available Platform Selectors

- `$platform-web` - Web only
- `$platform-native` - React Native (iOS + Android)
- `$platform-ios` - iOS only
- `$platform-android` - Android only

### Conditional Rendering

```typescript
import { isWeb, isNative, isIos, isAndroid } from '@tamagui/core'

const MyComponent = () => (
  <View>
    {isWeb && <div>Web-specific content</div>}
    {isNative && <Text>Native-specific content</Text>}
  </View>
)
```

### In styled() Definitions

```typescript
const Button = styled(View, {
  padding: '$4',
  
  ...(isWeb && {
    cursor: 'pointer',
    userSelect: 'none',
  }),
  
  ...(isNative && {
    activeOpacity: 0.7,
  }),
})
```

---

## Quick Reference

### styled() Cheat Sheet

```typescript
// Basic usage
const Comp = styled(ParentComp, {
  // Base styles
  padding: '$4',
  
  // Variants
  variants: {
    variant: { primary: {}, secondary: {} },
  } as const,
  
  // Defaults
  defaultVariants: { variant: 'primary' },
  
  // Context
  context: MyContext,
  
  // Name
  name: 'MyComponent',
  
  // HTML element (web)
  render: 'button',
}, {
  // Static config
  acceptsClassName: true,
  accept: { fill: 'color' } as const,
})
```

### Variant Patterns

```typescript
// 1. Basic
variant: { value: { styles } }

// 2. Spread
size: { '...size': (val, extras) => ({ styles }) }

// 3. Font-sized
size: getFontSized

// 4. Boolean
prop: { ':boolean': (val, extras) => ({ styles }) }

// 5. Number
prop: { ':number': {} as any }
```

### Context Pattern

```typescript
// 1. Create
const Ctx = createStyledContext({ size: '$4' })

// 2. Use in styled
const Comp = styled(View, { context: Ctx })

// 3. Access in functional components
const value = Ctx.useStyledContext()
```

### Composition Pattern

```typescript
// Create parts
const Frame = styled(View, { context: Ctx })
const Header = styled(View, { context: Ctx })
const Title = styled(Text, { context: Ctx })

// Compose
export const Card = withStaticProperties(Frame, {
  Header,
  Title,
})

// Use
<Card size="$4">
  <Card.Header>
    <Card.Title>Title</Card.Title>
  </Card.Header>
</Card>
```

### TypeScript Helpers

```typescript
import { GetProps, GetRef, GetStyledVariants } from '@tamagui/core'

type Props = GetProps<typeof MyComp>
type Ref = GetRef<typeof MyComp>
type Variants = GetStyledVariants<typeof MyComp>
```

### Common Gotchas

1. **Always use `as const`** on variants object
2. **Order matters** for style props and variants
3. **Context pattern** doesn't work with compiler flattening (use for complex components only)
4. **Use `.styleable()`** when wrapping styled components in functional components
5. **Pass all Tamagui props** to a single child in styleable components

---

## Additional Resources

- **Official Docs**: https://tamagui.dev/docs/core/styled
- **Variants Guide**: https://tamagui.dev/docs/core/variants
- **Theme System**: https://tamagui.dev/docs/core/theme
- **Configuration**: https://tamagui.dev/docs/core/configuration
- **Source Code**: https://github.com/tamagui/tamagui/tree/master/code/core/web/src

**File Status**: Generated from tamagui/tamagui LLM documentation (llms-full.txt) and source code examples from core/web and bento repositories.
