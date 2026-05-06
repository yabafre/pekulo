# Tamagui Component Library Reference

> Comprehensive guide to Tamagui UI components for React Native and Web

This document covers the core UI components from `@tamagui/tamagui`, focusing on production-ready patterns and real-world usage.

---

## Table of Contents

- [Button](#button)
- [Dialog](#dialog)
- [Sheet](#sheet)
- [Input](#input)
- [Select](#select)
- [Tabs](#tabs)
- [Switch & Checkbox](#switch--checkbox)
- [Popover](#popover)
- [Stacks (XStack, YStack, ZStack)](#stacks-xstack-ystack-zstack)
- [Adapt Pattern](#adapt-pattern)
- [Quick Reference](#quick-reference)

---

## Button

**Package:** `@tamagui/button` (included in `tamagui`)

A flexible button component with automatic theming, sizing, and icon support.

### Basic Usage

```tsx
import { Button } from 'tamagui'

export default () => (
  <>
    <Button>Default Button</Button>
    <Button size="$4">Medium Button</Button>
    <Button theme="blue">Themed Button</Button>
    <Button variant="outlined">Outlined Button</Button>
  </>
)
```

### Props

| Prop | Type | Description |
|------|------|-------------|
| `size` | `SizeTokens \| number` | Button size from theme tokens (e.g., `"$2"`, `"$5"`) |
| `variant` | `"outlined"` | Visual style variant |
| `theme` | `string` | Apply theme context to button |
| `themeInverse` | `boolean` | Flip between dark/light theme |
| `icon` | `JSX.Element \| Component` | Icon before text |
| `iconAfter` | `JSX.Element \| Component` | Icon after text |
| `iconSize` | `SizeTokens` | Explicit icon size (overrides `size`) |
| `scaleIcon` | `number` | Scale icon relative to computed size |
| `circular` | `boolean` | Force circular shape |
| `disabled` | `boolean` | Disable interactions |
| `unstyled` | `boolean` | Remove default styles |

### Icon Theming

Icons are automatically themed with `size` and `color`. The icon size is calculated as 50% of the button size by default, with automatic spacing (40% of icon size).

```tsx
import { Button, Star } from 'tamagui'

export default () => (
  <>
    {/* Icon sized by button */}
    <Button icon={Star} size="$5">
      Favorite
    </Button>
    
    {/* Explicit icon size */}
    <Button icon={Star} iconSize="$2" size="$5">
      Small Icon
    </Button>
    
    {/* Icon after text */}
    <Button iconAfter={Star}>
      Continue
    </Button>
  </>
)
```

### Group Theming with Button.Apply

Theme multiple buttons at once using shared context:

```tsx
import { Button, YStack } from 'tamagui'

export default () => (
  <YStack gap="$4">
    <Button.Apply size="$2" variant="outlined">
      <Button>Small Outlined 1</Button>
      <Button>Small Outlined 2</Button>
      <Button theme="blue">Small Blue</Button>
    </Button.Apply>

    <Button.Apply size="$5">
      <Button>Large 1</Button>
      <Button>Large 2</Button>
    </Button.Apply>
  </YStack>
)
```

### Web Form Integration

Button supports all standard HTML `<button>` attributes (web-only):

```tsx
import { Button, Form } from 'tamagui'

export default () => (
  <Form action="/submit">
    <Button type="submit">Submit Form</Button>
    <Button type="reset">Reset</Button>
    <Button type="button">Regular Button</Button>
    
    {/* Override form attributes */}
    <Button
      type="submit"
      formAction="/alternative"
      formMethod="post"
    >
      Submit to Different Endpoint
    </Button>
  </Form>
)
```

**Important:** Button defaults to `type="button"` to prevent unintended form submissions. Use `type="submit"` explicitly when needed.

---

## Dialog

**Package:** `@tamagui/dialog` (included in `tamagui`)

A modal dialog component with portal rendering, focus management, and mobile adaptation via Sheet.

### Anatomy

```tsx
import { Dialog } from 'tamagui'

export default () => (
  <Dialog>
    <Dialog.Trigger />
    <Dialog.Portal>
      <Dialog.Overlay />
      <Dialog.Content>
        <Dialog.Title />
        <Dialog.Description />
        <Dialog.Close />
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog>
)
```

### Basic Usage

```tsx
import { Dialog, Button, XStack, YStack, H2, Paragraph } from 'tamagui'

export default () => (
  <Dialog>
    <Dialog.Trigger asChild>
      <Button>Open Dialog</Button>
    </Dialog.Trigger>

    <Dialog.Portal>
      <Dialog.Overlay
        key="overlay"
        animation="quick"
        opacity={0.5}
        enterStyle={{ opacity: 0 }}
        exitStyle={{ opacity: 0 }}
      />

      <Dialog.Content
        bordered
        elevate
        key="content"
        animateOnly={['transform', 'opacity']}
        animation={[
          'quick',
          {
            opacity: {
              overshootClamping: true,
            },
          },
        ]}
        enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
        exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
        gap="$4"
      >
        <Dialog.Title>Edit Profile</Dialog.Title>
        <Dialog.Description>
          Make changes to your profile here. Click save when you're done.
        </Dialog.Description>

        {/* Your form content */}

        <XStack alignSelf="flex-end" gap="$4">
          <Dialog.Close displayWhenAdapted asChild>
            <Button theme="alt2" aria-label="Close">
              Cancel
            </Button>
          </Dialog.Close>
          <Dialog.Close asChild>
            <Button theme="active" aria-label="Save">
              Save changes
            </Button>
          </Dialog.Close>
        </XStack>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog>
)
```

### Props

**Dialog (Root)**

| Prop | Type | Description |
|------|------|-------------|
| `open` | `boolean` | Controlled open state |
| `defaultOpen` | `boolean` | Uncontrolled default state |
| `onOpenChange` | `(open: boolean) => void` | Callback on state change |
| `modal` | `boolean` | Modal behavior (default: `true`) |
| `disableRemoveScroll` | `boolean` | Disable scroll lock when open |

**Dialog.Content**

| Prop | Type | Description |
|------|------|-------------|
| `forceMount` | `boolean` | Force mounting for animation control |

**Dialog.Overlay**

| Prop | Type | Description |
|------|------|-------------|
| `forceMount` | `boolean` | Force mounting for animation control |

**Dialog.Close**

| Prop | Type | Description |
|------|------|-------------|
| `displayWhenAdapted` | `boolean` | Show when adapted (default: hidden) |

### Adapt Pattern (Dialog → Sheet on Mobile)

Automatically switch to Sheet on small screens:

```tsx
import { Dialog, Sheet, Adapt } from 'tamagui'

export default () => (
  <Dialog>
    <Dialog.Trigger asChild>
      <Button>Open</Button>
    </Dialog.Trigger>

    <Adapt when="sm" platform="touch">
      <Sheet animation="medium" zIndex={200000} modal dismissOnSnapToBottom>
        <Sheet.Frame padding="$4" gap="$4">
          <Adapt.Contents />
        </Sheet.Frame>
        <Sheet.Overlay
          animation="lazy"
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
        />
      </Sheet>
    </Adapt>

    <Dialog.Portal>
      <Dialog.Overlay />
      <Dialog.Content>
        <Dialog.Title>Title</Dialog.Title>
        <Dialog.Description>Description</Dialog.Description>
        {/* Content */}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog>
)
```

### Accessibility

- **Required:** `Dialog.Title` and `Dialog.Description` must be present (or wrapped in `VisuallyHidden`)
- Auto-focuses content on open
- Traps focus within dialog (modal mode)
- Restores focus to trigger on close
- Closes on Escape key

---

## Sheet

**Package:** `@tamagui/sheet` (included in `tamagui`)

A bottom sheet / modal drawer component with snap points, drag-to-dismiss, and native-like animations.

### Anatomy

```tsx
import { Sheet } from 'tamagui'

export default () => (
  <Sheet>
    <Sheet.Overlay />
    <Sheet.Frame>
      <Sheet.Handle />
      {/* Content */}
    </Sheet.Frame>
  </Sheet>
)
```

### Basic Usage

```tsx
import { Sheet, Button } from 'tamagui'
import { useState } from 'react'

export default () => {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState(0)

  return (
    <>
      <Button onPress={() => setOpen(true)}>
        Open Sheet
      </Button>

      <Sheet
        forceRemoveScrollEnabled={open}
        modal
        open={open}
        onOpenChange={setOpen}
        snapPoints={[85, 50, 25]}
        snapPointsMode="percent"
        dismissOnSnapToBottom
        position={position}
        onPositionChange={setPosition}
        zIndex={100_000}
        animation="medium"
      >
        <Sheet.Overlay
          animation="lazy"
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
        />

        <Sheet.Handle />

        <Sheet.Frame padding="$4" justifyContent="center" alignItems="center" gap="$5">
          <Button
            size="$6"
            circular
            icon={ChevronDown}
            onPress={() => setOpen(false)}
          />
          {/* Your content */}
        </Sheet.Frame>
      </Sheet>
    </>
  )
}
```

### Props

**Sheet (Root)**

| Prop | Type | Description |
|------|------|-------------|
| `open` | `boolean` | Controlled open state |
| `defaultOpen` | `boolean` | Uncontrolled default state |
| `onOpenChange` | `(open: boolean) => void` | Callback on state change |
| `position` | `number` | Current snap point index |
| `defaultPosition` | `number` | Default snap point index |
| `onPositionChange` | `(position: number) => void` | Callback on position change |
| `snapPoints` | `number[]` | Snap point values |
| `snapPointsMode` | `"percent" \| "fit" \| "constant" \| "mixed"` | How to interpret snap points |
| `dismissOnSnapToBottom` | `boolean` | Auto-dismiss when snapped to 0 |
| `modal` | `boolean` | Modal behavior with overlay |
| `animation` | `string` | Animation preset name |
| `zIndex` | `number` | Z-index for layering |

### Snap Points

```tsx
// Percent mode: [85%, 50%, 25%]
<Sheet snapPoints={[85, 50, 25]} snapPointsMode="percent">

// Constant mode: [500px, 300px, 100px]
<Sheet snapPoints={[500, 300, 100]} snapPointsMode="constant">

// Fit mode: height based on content
<Sheet snapPoints={[90]} snapPointsMode="fit">

// Mixed mode: combine different types
<Sheet snapPoints={[90, 300, 100]} snapPointsMode="mixed">
```

### Modal vs Inline

```tsx
// Modal: full-screen overlay, portal rendering
<Sheet modal dismissOnSnapToBottom>
  {/* ... */}
</Sheet>

// Inline: embedded in layout, no overlay
<Sheet modal={false}>
  {/* ... */}
</Sheet>
```

---

## Input

**Package:** `@tamagui/input` (included in `tamagui`)

Cross-platform text input with React Native and web alignment.

### Basic Usage

```tsx
import { Input, YStack } from 'tamagui'

export default () => (
  <YStack gap="$4">
    <Input placeholder="Enter your name" />
    <Input size="$4" placeholder="Medium input" />
    <Input secureTextEntry placeholder="Password" />
  </YStack>
)
```

### Cross-Platform Props

```tsx
import { Input } from 'tamagui'

export default () => (
  <>
    {/* Password input */}
    <Input secureTextEntry placeholder="Password" />
    {/* Equivalent to type="password" on web */}

    {/* Email keyboard on mobile */}
    <Input
      keyboardType="email-address"
      autoCapitalize="none"
      autoComplete="email"
      placeholder="Email"
    />

    {/* Numeric keyboard */}
    <Input keyboardType="number-pad" placeholder="Phone" />

    {/* Multi-line */}
    <Input multiline numberOfLines={4} placeholder="Comments" />
  </>
)
```

### Callbacks

```tsx
import { Input } from 'tamagui'

export default () => {
  const [value, setValue] = useState('')

  return (
    <Input
      value={value}
      onChangeText={setValue}
      onSubmitEditing={(e) => {
        console.log('Submitted:', e.nativeEvent.text)
      }}
      placeholder="Type and press Enter"
    />
  )
}
```

### Styling

```tsx
import { Input } from 'tamagui'

export default () => (
  <Input
    size="$4"
    borderWidth={2}
    borderColor="$blue10"
    placeholderTextColor="$gray10"
    selectionColor="$blue10"
    backgroundColor="$background"
  />
)
```

---

## Select

**Package:** `@tamagui/select` (included in `tamagui`)

A dropdown selection component with native adaptation and custom styling.

### Anatomy

```tsx
import { Select } from 'tamagui'

export default () => (
  <Select>
    <Select.Trigger>
      <Select.Value placeholder="Select..." />
    </Select.Trigger>

    <Select.Content>
      <Select.ScrollUpButton />
      <Select.Viewport>
        <Select.Group>
          <Select.Label>Group Label</Select.Label>
          <Select.Item index={0} value="value1">
            <Select.ItemText>Item 1</Select.ItemText>
            <Select.ItemIndicator />
          </Select.Item>
        </Select.Group>
      </Select.Viewport>
      <Select.ScrollDownButton />
    </Select.Content>
  </Select>
)
```

### Basic Usage

```tsx
import { Select, SelectProps, YStack } from 'tamagui'
import { Check, ChevronDown, ChevronUp } from '@tamagui/lucide-icons'

export default () => {
  const [val, setVal] = useState('apple')

  return (
    <Select value={val} onValueChange={setVal}>
      <Select.Trigger iconAfter={ChevronDown}>
        <Select.Value placeholder="Select a fruit..." />
      </Select.Trigger>

      <Select.Content zIndex={200000}>
        <Select.ScrollUpButton>
          <ChevronUp />
        </Select.ScrollUpButton>

        <Select.Viewport>
          <Select.Group>
            <Select.Label>Fruits</Select.Label>
            {items.map((item, i) => (
              <Select.Item key={item.value} index={i} value={item.value}>
                <Select.ItemText>{item.name}</Select.ItemText>
                <Select.ItemIndicator marginLeft="auto">
                  <Check size={16} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Group>
        </Select.Viewport>

        <Select.ScrollDownButton>
          <ChevronDown />
        </Select.ScrollDownButton>
      </Select.Content>
    </Select>
  )
}

const items = [
  { name: 'Apple', value: 'apple' },
  { name: 'Banana', value: 'banana' },
  { name: 'Cherry', value: 'cherry' },
]
```

### Native Adaptation

Render as native `<select>` on web:

```tsx
<Select native>
  {/* Simplified to native select element */}
</Select>

// Or platform-specific
<Select native={['web']}>
  {/* Native on web only */}
</Select>
```

### Custom Styling

```tsx
import { Select, styled } from 'tamagui'

const CustomSelectTrigger = styled(Select.Trigger, {
  borderRadius: '$4',
  backgroundColor: '$blue5',
  borderColor: '$blue10',
  hoverStyle: {
    backgroundColor: '$blue6',
  },
})

export default () => (
  <Select>
    <CustomSelectTrigger>
      <Select.Value />
    </CustomSelectTrigger>
    {/* ... */}
  </Select>
)
```

---

## Tabs

**Package:** `@tamagui/tabs` (included in `tamagui`)

Tabbed interface component with keyboard navigation and active state management.

### Anatomy

```tsx
import { Tabs } from 'tamagui'

export default () => (
  <Tabs defaultValue="tab1">
    <Tabs.List>
      <Tabs.Tab value="tab1">
        <Text>Tab 1</Text>
      </Tabs.Tab>
      <Tabs.Tab value="tab2">
        <Text>Tab 2</Text>
      </Tabs.Tab>
    </Tabs.List>

    <Tabs.Content value="tab1">
      {/* Tab 1 content */}
    </Tabs.Content>

    <Tabs.Content value="tab2">
      {/* Tab 2 content */}
    </Tabs.Content>
  </Tabs>
)
```

### Basic Usage

```tsx
import { Tabs, YStack, H5, Paragraph } from 'tamagui'

export default () => (
  <Tabs
    defaultValue="tab1"
    orientation="horizontal"
    flexDirection="column"
    width={400}
    height={250}
    borderRadius="$4"
    borderWidth="$0.25"
    overflow="hidden"
    borderColor="$borderColor"
  >
    <Tabs.List
      separator={<Separator />}
      disablePassBorderRadius="bottom"
      aria-label="Manage your account"
    >
      <Tabs.Tab flex={1} value="tab1">
        <SizableText fontFamily="$body">Profile</SizableText>
      </Tabs.Tab>
      <Tabs.Tab flex={1} value="tab2">
        <SizableText fontFamily="$body">Connections</SizableText>
      </Tabs.Tab>
      <Tabs.Tab flex={1} value="tab3">
        <SizableText fontFamily="$body">Notifications</SizableText>
      </Tabs.Tab>
    </Tabs.List>

    <Tabs.Content value="tab1" padding="$4">
      <H5>Profile Settings</H5>
      <Paragraph>Manage your public profile information.</Paragraph>
    </Tabs.Content>

    <Tabs.Content value="tab2" padding="$4">
      <H5>Connections</H5>
      <Paragraph>Manage your connected accounts.</Paragraph>
    </Tabs.Content>

    <Tabs.Content value="tab3" padding="$4">
      <H5>Notifications</H5>
      <Paragraph>Configure your notification preferences.</Paragraph>
    </Tabs.Content>
  </Tabs>
)
```

### Active State Management

```tsx
import { Tabs } from 'tamagui'
import { useState } from 'react'

export default () => {
  const [activeTab, setActiveTab] = useState('tab1')

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <Tabs.List>
        <Tabs.Tab value="tab1">
          <Text>Tab 1 {activeTab === 'tab1' && '✓'}</Text>
        </Tabs.Tab>
        <Tabs.Tab value="tab2">
          <Text>Tab 2 {activeTab === 'tab2' && '✓'}</Text>
        </Tabs.Tab>
      </Tabs.List>

      {/* Content */}
    </Tabs>
  )
}
```

---

## Switch & Checkbox

Form control components with accessible labels and state management.

### Switch

```tsx
import { Switch, Label, XStack } from 'tamagui'

export default () => {
  const [checked, setChecked] = useState(false)

  return (
    <XStack gap="$4" alignItems="center">
      <Switch
        id="airplane-mode"
        size="$4"
        checked={checked}
        onCheckedChange={setChecked}
      >
        <Switch.Thumb animation="quick" />
      </Switch>
      <Label htmlFor="airplane-mode">Airplane Mode</Label>
    </XStack>
  )
}
```

### Checkbox

```tsx
import { Checkbox, Label, XStack } from 'tamagui'
import { Check } from '@tamagui/lucide-icons'

export default () => {
  const [checked, setChecked] = useState<boolean | 'indeterminate'>(false)

  return (
    <XStack gap="$4" alignItems="center">
      <Checkbox
        id="accept-terms"
        size="$5"
        checked={checked}
        onCheckedChange={setChecked}
      >
        <Checkbox.Indicator>
          <Check />
        </Checkbox.Indicator>
      </Checkbox>
      <Label htmlFor="accept-terms">Accept terms and conditions</Label>
    </XStack>
  )
}
```

### Form Integration

```tsx
import { Checkbox, Switch, Label, YStack, Button } from 'tamagui'

export default () => {
  const [formData, setFormData] = useState({
    newsletter: false,
    notifications: false,
  })

  return (
    <YStack gap="$4">
      <XStack gap="$4" alignItems="center">
        <Checkbox
          id="newsletter"
          checked={formData.newsletter}
          onCheckedChange={(checked) =>
            setFormData({ ...formData, newsletter: checked === true })
          }
        >
          <Checkbox.Indicator>
            <Check />
          </Checkbox.Indicator>
        </Checkbox>
        <Label htmlFor="newsletter">Subscribe to newsletter</Label>
      </XStack>

      <XStack gap="$4" alignItems="center">
        <Switch
          id="notifications"
          checked={formData.notifications}
          onCheckedChange={(checked) =>
            setFormData({ ...formData, notifications: checked })
          }
        >
          <Switch.Thumb />
        </Switch>
        <Label htmlFor="notifications">Enable notifications</Label>
      </XStack>

      <Button onPress={() => console.log(formData)}>Submit</Button>
    </YStack>
  )
}
```

---

## Popover

**Package:** `@tamagui/popover` (included in `tamagui`)

A floating content component with positioning, arrow, and hover support.

### Anatomy

```tsx
import { Popover } from 'tamagui'

export default () => (
  <Popover>
    <Popover.Trigger />
    <Popover.Content>
      <Popover.Arrow />
      {/* Content */}
      <Popover.Close />
    </Popover.Content>
  </Popover>
)
```

### Basic Usage

```tsx
import { Popover, Button, XStack, YStack, H4, Paragraph } from 'tamagui'

export default () => (
  <Popover placement="bottom" allowFlip>
    <Popover.Trigger asChild>
      <Button>Open Popover</Button>
    </Popover.Trigger>

    <Popover.Content
      borderWidth={1}
      borderColor="$borderColor"
      enterStyle={{ y: -10, opacity: 0 }}
      exitStyle={{ y: -10, opacity: 0 }}
      elevate
      animation={[
        'quick',
        {
          opacity: {
            overshootClamping: true,
          },
        },
      ]}
    >
      <Popover.Arrow borderWidth={1} borderColor="$borderColor" />

      <YStack gap="$3">
        <H4>Dimensions</H4>
        <Paragraph size="$2">Set the dimensions for the element.</Paragraph>
        {/* Your content */}
        
        <Popover.Close asChild>
          <Button size="$3">Close</Button>
        </Popover.Close>
      </YStack>
    </Popover.Content>
  </Popover>
)
```

### Positioning

```tsx
<Popover placement="top">
  {/* Above trigger */}
</Popover>

<Popover placement="bottom-start">
  {/* Below trigger, aligned to start */}
</Popover>

<Popover placement="right" allowFlip>
  {/* Right of trigger, flips if no space */}
</Popover>
```

### Hoverable Popover

```tsx
import { Popover } from 'tamagui'

export default () => (
  <Popover hoverable restMs={25}>
    <Popover.Trigger asChild>
      <Button>Hover me</Button>
    </Popover.Trigger>

    <Popover.Content>
      <Popover.Arrow />
      <Paragraph>Stays open while hovering</Paragraph>
    </Popover.Content>
  </Popover>
)
```

### Custom Anchor

```tsx
import { Popover, View } from 'tamagui'

export default () => {
  const [anchorRect, setAnchorRect] = useState(null)

  return (
    <>
      <View
        onLayout={(e) => {
          const { x, y, width, height } = e.nativeEvent.layout
          setAnchorRect({ x, y, width, height })
        }}
      >
        Custom anchor element
      </View>

      <Popover>
        <Popover.Anchor virtualRef={{ current: anchorRect }} />
        <Popover.Content>
          {/* Anchored to custom element */}
        </Popover.Content>
      </Popover>
    </>
  )
}
```

---

## Stacks (XStack, YStack, ZStack)

**Package:** `@tamagui/stacks` (included in `tamagui`)

Layout primitives for arranging children in different directions.

### XStack (Horizontal)

```tsx
import { XStack, Circle } from 'tamagui'

export default () => (
  <XStack gap="$4" padding="$4" alignItems="center">
    <Circle size={50} backgroundColor="$blue10" />
    <Circle size={50} backgroundColor="$green10" />
    <Circle size={50} backgroundColor="$red10" />
  </XStack>
)
```

### YStack (Vertical)

```tsx
import { YStack, Button } from 'tamagui'

export default () => (
  <YStack gap="$3" padding="$4">
    <Button>First</Button>
    <Button>Second</Button>
    <Button>Third</Button>
  </YStack>
)
```

### ZStack (Layered)

```tsx
import { ZStack, Circle, H3 } from 'tamagui'

export default () => (
  <ZStack width={200} height={200}>
    <Circle size={200} backgroundColor="$blue10" />
    <H3 color="white" zIndex={1}>
      Overlaid Text
    </H3>
  </ZStack>
)
```

### Common Props

```tsx
import { YStack } from 'tamagui'

export default () => (
  <YStack
    gap="$4"              // Spacing between children
    padding="$4"          // Internal padding
    backgroundColor="$background"
    borderRadius="$4"
    borderWidth={1}
    borderColor="$borderColor"
    fullscreen            // position: absolute; inset: 0
    elevation="$2"        // Add elevation/shadow
  >
    {/* Children */}
  </YStack>
)
```

### ThemeableStack

Stacks with automatic theme support:

```tsx
import { ThemeableStack } from '@tamagui/stacks'

export default () => (
  <ThemeableStack theme="blue" padding="$4">
    {/* Inherits blue theme */}
  </ThemeableStack>
)
```

---

## Adapt Pattern

Automatically adapt components based on screen size or platform.

### Dialog to Sheet

```tsx
import { Dialog, Sheet, Adapt, Button } from 'tamagui'

export default () => (
  <Dialog>
    <Dialog.Trigger asChild>
      <Button>Open</Button>
    </Dialog.Trigger>

    <Adapt when="sm" platform="touch">
      <Sheet animation="medium" zIndex={200000} modal dismissOnSnapToBottom>
        <Sheet.Frame padding="$4" gap="$4">
          <Adapt.Contents />
        </Sheet.Frame>
        <Sheet.Overlay />
      </Sheet>
    </Adapt>

    <Dialog.Portal>
      <Dialog.Overlay />
      <Dialog.Content>
        {/* Desktop: Dialog */}
        {/* Mobile: Sheet */}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog>
)
```

### Popover to Sheet

```tsx
import { Popover, Sheet, Adapt, Button } from 'tamagui'

export default () => (
  <Popover>
    <Popover.Trigger asChild>
      <Button>Open</Button>
    </Popover.Trigger>

    <Adapt when="sm" platform="touch">
      <Sheet modal dismissOnSnapToBottom>
        <Sheet.Frame>
          <Adapt.Contents />
        </Sheet.Frame>
        <Sheet.Overlay />
      </Sheet>
    </Adapt>

    <Popover.Content>
      {/* Desktop: Popover */}
      {/* Mobile: Sheet */}
    </Popover.Content>
  </Popover>
)
```

### Conditions

```tsx
// Breakpoint-based
<Adapt when="sm">  // sm and below
<Adapt when="$gtSm">  // greater than sm

// Platform-based
<Adapt platform="touch">  // touch devices
<Adapt platform="web">  // web only

// Combined
<Adapt when="sm" platform="touch">  // small touch screens
```

---

## Quick Reference

### Component Checklist

**Button:**
- ✓ `icon` / `iconAfter` for icons
- ✓ `size` for consistent sizing
- ✓ `variant="outlined"` for outlined style
- ✓ `Button.Apply` for group theming

**Dialog:**
- ✓ Always include `Dialog.Title` and `Dialog.Description`
- ✓ Use `Dialog.Portal` for proper rendering
- ✓ Add `Adapt` for mobile support
- ✓ `displayWhenAdapted` on `Dialog.Close` if needed

**Sheet:**
- ✓ Set `snapPoints` and `snapPointsMode`
- ✓ Use `dismissOnSnapToBottom` for auto-dismiss
- ✓ Add `Sheet.Handle` for visual affordance
- ✓ Wrap in `Adapt` when used with Dialog/Popover

**Input:**
- ✓ Use `onChangeText` instead of `onChange`
- ✓ `secureTextEntry` for password fields
- ✓ `keyboardType` for mobile keyboards

**Select:**
- ✓ Wrap items in `Select.Group` with `Select.Label`
- ✓ Each item needs unique `index` and `value`
- ✓ Use `Select.ItemIndicator` for checkmarks
- ✓ Add `native` prop for native `<select>` on web

**Tabs:**
- ✓ Set `defaultValue` or control with `value`/`onValueChange`
- ✓ Match `Tabs.Tab` `value` to `Tabs.Content` `value`
- ✓ Use `Tabs.List` to wrap triggers

**Popover:**
- ✓ Use `placement` for positioning
- ✓ Add `allowFlip` to prevent overflow
- ✓ Use `hoverable` for hover-to-open behavior
- ✓ `Popover.Arrow` for visual connection

### Import Patterns

```tsx
// From main package
import { 
  Button, 
  Dialog, 
  Sheet, 
  Input, 
  Select, 
  Tabs,
  Switch,
  Checkbox,
  Popover,
  XStack,
  YStack,
  ZStack,
} from 'tamagui'

// Individual packages
import { Button } from '@tamagui/button'
import { Dialog } from '@tamagui/dialog'
import { Sheet } from '@tamagui/sheet'
```

### Common Patterns

**Controlled Components:**
```tsx
const [value, setValue] = useState('')
<Input value={value} onChangeText={setValue} />
```

**Uncontrolled Components:**
```tsx
<Input defaultValue="Initial value" />
```

**Theming:**
```tsx
<Button theme="blue">Blue Button</Button>
<YStack theme="dark">Dark content</YStack>
```

**Animations:**
```tsx
<Dialog.Content
  animation="quick"
  enterStyle={{ opacity: 0, scale: 0.9 }}
  exitStyle={{ opacity: 0, scale: 0.95 }}
>
```

**Responsive:**
```tsx
<YStack
  $sm={{ flexDirection: 'column' }}
  $gtSm={{ flexDirection: 'row' }}
>
```

---

## Additional Resources

- **Official Docs:** https://tamagui.dev/ui/intro
- **GitHub:** https://github.com/tamagui/tamagui
- **Community:** https://discord.gg/tamagui
- **Bento (Premium Components):** https://tamagui.dev/bento

---

**Last Updated:** 2024-01-24  
**Tamagui Version:** 1.144.0+
