# Bento Lists Components

## Overview

Bento provides a comprehensive collection of list components built on Tamagui and React Native's FlatList. These components demonstrate patterns for rendering lists efficiently across web and native platforms.

### When to Use Different List Types

- **Simple Lists**: Use `FlatList` with custom `renderItem` for basic vertical/horizontal lists with uniform items
- **Grid Lists**: Use `FlatList` with `numColumns` or `FlatGrid` for responsive multi-column layouts
- **Masonry Lists**: Use `MasonryList` component for Pinterest-style staggered grid layouts
- **Virtualized Lists**: Always use FlatList for large datasets (>50 items) to maintain performance
- **Animated Lists**: Combine `FlatList` with `AnimatePresence` and Reanimated for entry/exit animations
- **Horizontal Lists**: Use `ScrollView` with `horizontal` prop for simple horizontal carousels

### Performance Considerations

**Key optimization strategies in Bento:**

1. **Virtualization**: FlatList only renders visible items
2. **Window size control**: `windowSize={2}` (ChatList) reduces memory footprint
3. **Key extraction**: Always provide `keyExtractor` for stable item identity
4. **Memoization**: Use `memo()` on list item components to prevent unnecessary re-renders
5. **Responsive columns**: Calculate `numColumns` based on container width for optimal layout

## Basic Lists

### Simple Vertical List

The `List` component demonstrates a standard FlatList pattern with avatars, separators, and interaction:

```tsx
import { FlatList } from 'react-native'
import { View, Avatar, Button, Text, Separator } from 'tamagui'

const personsList = [
  { id: '1', name: 'John Doe', status: 'Available', image: 'url' },
  // ... more items
]

export function List() {
  const renderItem = ({ item: person }) => (
    <View
      flexDirection="row"
      py="$2"
      gap="$4"
      bg="$color1"
      items="center"
    >
      <Avatar circular size="$4">
        <Avatar.Image src={person.image} />
        <Avatar.Fallback bg="$background" />
      </Avatar>
      <View flex={1} flexDirection="column">
        <Text fontWeight="$6">{person.name}</Text>
        <Text theme="alt1">{person.status}</Text>
      </View>
      <Button circular size="$4">Action</Button>
    </View>
  )

  return (
    <FlatList
      data={personsList}
      renderItem={renderItem}
      ItemSeparatorComponent={() => <Separator pt={16} />}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ gap: 16 }}
      showsVerticalScrollIndicator={false}
    />
  )
}
```

**Source**: `List.tsx` - Demonstrates FlatList with status indicators and action buttons

## Virtualized Lists

### FlatList Integration

FlatList is React Native's performant list component used throughout Bento:

```tsx
import { FlatList } from 'react-native'
import { styled } from 'tamagui'

// Typed styled FlatList
const StyledList = styled(FlatList<MessageType>, {
  bg: '$background',
  gap: '$3',
})

<StyledList
  data={messages}
  renderItem={renderItem}
  windowSize={2}              // Render 2 viewports of content
  inverted                     // Reverse scroll (chat pattern)
  contentContainerStyle={{ gap: 16 }}
  showsVerticalScrollIndicator={false}
/>
```

**Performance tips:**
- Use `windowSize={2}` for memory-constrained environments
- Set `removeClippedSubviews={true}` on Android for better performance
- Provide stable `keyExtractor` functions

### Grid Layout with FlatList

```tsx
import { FlatList } from 'react-native'
import { useContainerDim } from '../../hooks/useContainerDim'

export function FlatGrid() {
  const { width: deviceWidth } = useContainerDim('window')
  const numberOfColumns = Math.round((deviceWidth - 20) / 300)

  return (
    <FlatList
      data={items}
      renderItem={renderItem}
      numColumns={numberOfColumns}
      key={numberOfColumns}  // Force re-render on column change
      columnWrapperStyle={{ gap: 22 }}  // For numColumns > 1
      contentContainerStyle={{ gap: 16 }}
    />
  )
}
```

**Key points:**
- `numColumns` creates responsive grids
- `key={numberOfColumns}` forces remount when columns change
- `columnWrapperStyle` applies to row wrapper when `numColumns > 1`

**Source**: `FlatGrid.tsx`

## ListItem Component Patterns

### Standard ListItem Usage

Tamagui's ListItem component provides consistent styling and sizing:

```tsx
import { ListItem, Separator, YGroup } from 'tamagui'
import { ChevronRight } from '@tamagui/lucide-icons'

export default () => (
  <YGroup separator={<Separator />}>
    <YGroup.Item>
      <ListItem title="Settings" icon={ChevronRight} />
    </YGroup.Item>
    <YGroup.Item>
      <ListItem
        title="Notifications"
        subtitle="Manage your alerts"
        icon={ChevronRight}
        iconAfter={<Badge>3</Badge>}
      />
    </YGroup.Item>
    <YGroup.Item>
      <ListItem>Custom children content</ListItem>
    </YGroup.Item>
  </YGroup>
)
```

### ListItem with Avatars

```tsx
import { ListItem, Avatar, XStack } from 'tamagui'

<ListItem
  title="John Doe"
  subtitle="Online"
  icon={
    <Avatar circular size="$4">
      <Avatar.Image src="avatar.jpg" />
      <Avatar.Fallback bg="$blue10" />
    </Avatar>
  }
  iconAfter={<Text color="$green10">●</Text>}
/>
```

### ListItem Sizing

The `size` prop controls all dimensions consistently:

```tsx
<YStack gap="$2">
  <ListItem size="$2" title="Small" />
  <ListItem size="$4" title="Default" />
  <ListItem size="$6" title="Large" />
</YStack>
```

### ListItem Variants

```tsx
<ListItem variant="outlined" title="Outlined Style" />
```

### ListItem.Apply (Context-based Styling)

Pass common props to multiple ListItems:

```tsx
import { ListItem, YGroup } from 'tamagui'

<YGroup>
  <ListItem.Apply color="$red10" size="$5">
    <YGroup.Item>
      <ListItem icon={Trash} title="Delete item" />
    </YGroup.Item>
    <YGroup.Item>
      <ListItem icon={Trash} title="Remove all" />
    </YGroup.Item>
  </ListItem.Apply>
</YGroup>
```

## Animated Lists

### Chat List with AnimatePresence

Staggered entry animations using AnimatePresence:

```tsx
import { FlatList } from 'react-native'
import { AnimatePresence, View, Text } from 'tamagui'

const ChatItem = ({ item, index }) => {
  const [showMessage, setShowMessage] = useState(false)
  const showDelay = index * 300

  useEffect(() => {
    const timeout = setTimeout(() => {
      setShowMessage(true)
    }, showDelay)
    return () => clearTimeout(timeout)
  }, [showDelay])

  return (
    <AnimatePresence>
      {showMessage && (
        <View
          flexDirection="row"
          gap="$4"
          transition="quick"
          enterStyle={{
            opacity: 0,
            scale: 0,
          }}
        >
          <Avatar circular size="$5">
            <Avatar.Image src={item.avatar} />
          </Avatar>
          <View bg="$color2" p="$4" rounded="$6">
            <Text>{item.message}</Text>
          </View>
        </View>
      )}
    </AnimatePresence>
  )
}

export function ChatList() {
  return (
    <FlatList
      inverted
      data={messages}
      renderItem={({ item, index }) => (
        <ChatItem item={item} index={index} />
      )}
      contentContainerStyle={{ gap: 16 }}
    />
  )
}
```

**Source**: `ChatList.tsx` - Full chat UI with animations and theming

### Wheel List with Reanimated

Advanced animated list using `react-native-reanimated`:

```tsx
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  interpolate,
  useSharedValue,
} from 'react-native-reanimated'

const AnimatedList = Animated.createAnimatedComponent(
  styled(Animated.FlatList<CardData>, { flex: 1 })
)

export function WheelList() {
  const scrollY = useSharedValue(0)
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y
    },
  })

  return (
    <AnimatedList
      onScroll={scrollHandler}
      data={data}
      renderItem={({ item, index }) => (
        <CardItem index={index} item={item} scrollY={scrollY} />
      )}
      snapToInterval={ITEM_SIZE + SPACING}
      decelerationRate="fast"
      contentContainerStyle={{
        paddingTop: 300,
        paddingBottom: 300,
      }}
    />
  )
}

const CardItem = ({ scrollY, index }) => {
  const inputRange = [
    (index - 1) * SIZE_RANGE,
    index * SIZE_RANGE,
    (index + 1) * SIZE_RANGE,
  ]

  const animatedStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      scrollY.value,
      inputRange,
      [45, 0, -45]
    )
    return {
      transform: [{ rotate: `${rotate}deg` }],
    }
  })

  return (
    <Animated.View style={animatedStyle}>
      {/* Card content */}
    </Animated.View>
  )
}
```

**Source**: `WheelList.tsx` - Carousel with 3D rotation effects

## Grouped Lists

### Section Lists with YGroup

```tsx
import { YGroup, ListItem, Separator } from 'tamagui'

export function GroupedList() {
  return (
    <>
      <YGroup separator={<Separator />}>
        <YGroup.Item>
          <ListItem title="Profile Settings" />
        </YGroup.Item>
        <YGroup.Item>
          <ListItem title="Privacy" />
        </YGroup.Item>
      </YGroup>

      <YGroup separator={<Separator />} mt="$4">
        <YGroup.Item>
          <ListItem title="Notifications" />
        </YGroup.Item>
        <YGroup.Item>
          <ListItem title="Sound & Haptics" />
        </YGroup.Item>
      </YGroup>
    </>
  )
}
```

### Masonry List (Pinterest-style)

Custom masonry implementation for staggered grids:

```tsx
import { MasonryList } from './components/MasonryList'

export function MasonryExample() {
  const { width: deviceWidth } = useContainerDim('window')
  const numberOfColumns = Math.max(Math.round(deviceWidth / 300), 2)

  return (
    <MasonryList
      data={products}
      renderItem={({ item }) => <ProductCard item={item} />}
      numColumns={numberOfColumns}
      key={numberOfColumns}
      keyExtractor={(item) => item.id}
      gap="$4"
    />
  )
}
```

**MasonryList features:**
- Distributes items across columns evenly
- Supports pull-to-refresh
- Infinite scroll via `onEndReached`
- Empty state with `ListEmptyComponent`

**Source**: `MasonryList.tsx`, `MasonryListExample.tsx`

## Interactive Lists

### Pull to Refresh

```tsx
import { FlatList, RefreshControl } from 'react-native'

const [refreshing, setRefreshing] = useState(false)

const onRefresh = async () => {
  setRefreshing(true)
  await fetchNewData()
  setRefreshing(false)
}

<FlatList
  data={data}
  renderItem={renderItem}
  refreshControl={
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
  }
/>
```

MasonryList built-in support:

```tsx
<MasonryList
  data={data}
  renderItem={renderItem}
  refreshing={refreshing}
  onRefresh={onRefresh}
  refreshControl={true}
/>
```

### Infinite Scroll / Pagination

```tsx
const [loading, setLoading] = useState(false)

const loadMore = () => {
  if (loading) return
  setLoading(true)
  fetchMoreItems().then(() => setLoading(false))
}

<FlatList
  data={items}
  renderItem={renderItem}
  onEndReached={loadMore}
  onEndReachedThreshold={0.5}  // Trigger at 50% from bottom
  ListFooterComponent={loading ? <Spinner /> : null}
/>
```

### Item Value List Pattern

Key-value list for displaying structured data:

```tsx
import { View, Text, Separator } from 'tamagui'

const data = [
  { title: 'Amount', value: '10000 USDT' },
  { title: 'Fee', value: '10 USDT' },
  { title: 'Total', value: '10010 USDT' },
]

export function ItemValueList() {
  return (
    <View gap="$4">
      {data.map((item, index) => (
        <>
          <View
            key={index}
            flexDirection="row"
            justify="space-between"
            items="center"
          >
            <Text size="$4">{item.title}</Text>
            <Text size="$4" color="$color11">{item.value}</Text>
          </View>
          {index < data.length - 1 && <Separator />}
        </>
      ))}
    </View>
  )
}
```

**Source**: `ItemValueList.tsx` - Payment summaries, transaction details

## Horizontal Lists

### Simple Horizontal ScrollView

```tsx
import { ScrollView, View, Image, Text } from 'tamagui'

const data = [
  { uri: 'image1.jpg', title: 'Item 1' },
  { uri: 'image2.jpg', title: 'Item 2' },
]

export function HList() {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 24 }}
    >
      {data.map(({ uri, title }) => (
        <View key={uri} width={200} height={200}>
          <Image src={uri} width="100%" height="100%" />
          <Text>{title}</Text>
        </View>
      ))}
    </ScrollView>
  )
}
```

**Source**: `HList.tsx` - Horizontal image carousel with hover effects

### Horizontal FlatList

For virtualization in horizontal lists:

```tsx
<FlatList
  horizontal
  data={items}
  renderItem={renderItem}
  showsHorizontalScrollIndicator={false}
  snapToInterval={ITEM_WIDTH}
  decelerationRate="fast"
/>
```

## Styling Patterns

### List Container Styling

```tsx
import { styled } from 'tamagui'
import { FlatList } from 'react-native'

const StyledList = styled(FlatList, {
  bg: '$background',
  flex: 1,
  px: '$4',
  $gtMd: {
    maxH: 800,
    px: '$4',
  },
})

<StyledList
  contentContainerStyle={{
    gap: 16,
    paddingVertical: 16,
  }}
/>
```

### Item Spacing and Dividers

**Option 1: ItemSeparatorComponent**
```tsx
<FlatList
  ItemSeparatorComponent={() => <Separator pt={16} />}
/>
```

**Option 2: contentContainerStyle gap**
```tsx
<FlatList
  contentContainerStyle={{ gap: 16 }}
/>
```

**Option 3: Built-in item spacing**
```tsx
const renderItem = ({ item }) => (
  <View mb="$4">
    <ItemContent item={item} />
  </View>
)
```

### Themed List Variations

```tsx
import { Theme, View } from 'tamagui'

// Theme per item
const renderItem = ({ item }) => (
  <Theme name={item.itsMe ? 'green' : undefined}>
    <View bg="$color2" p="$4">
      <Text>{item.message}</Text>
    </View>
  </Theme>
)

// Theme entire list
<Theme name="dark">
  <FlatList data={data} renderItem={renderItem} />
</Theme>
```

**Source**: ChatList uses conditional theming for sent/received messages

### Platform-Specific Adjustments

```tsx
<View
  p="$2"
  gap="$4"
  $group-window-gtXs={{
    p: '$4',
    gap: '$4',
  }}
  $group-window-xs={{
    flexDirection: 'column',
  }}
>
  {/* Responsive list item */}
</View>
```

## Accessibility

### Screen Reader Support

```tsx
import { ListItem } from 'tamagui'

<ListItem
  title="Settings"
  subtitle="Manage app preferences"
  accessible={true}
  accessibilityLabel="Open settings"
  accessibilityHint="Double tap to open settings screen"
  accessibilityRole="button"
/>
```

### Focus Management

```tsx
import { useRef } from 'react'
import { FlatList } from 'react-native'

const listRef = useRef<FlatList>(null)

// Scroll to item programmatically
listRef.current?.scrollToIndex({ index: 0, animated: true })

<FlatList
  ref={listRef}
  data={data}
  renderItem={renderItem}
/>
```

### Keyboard Navigation

For web, ensure interactive list items are keyboard accessible:

```tsx
<ListItem
  onPress={handlePress}
  focusable={true}
  pressStyle={{ bg: '$color3' }}
  focusStyle={{ bg: '$color4', borderColor: '$blue10' }}
/>
```

## Integration Examples

### Lists with Forms (Checkbox/Radio Lists)

```tsx
import { Checkbox, YStack } from 'tamagui'

const options = ['Option 1', 'Option 2', 'Option 3']

export function CheckboxList() {
  const [selected, setSelected] = useState<string[]>([])

  return (
    <YStack gap="$3">
      {options.map((option) => (
        <Checkbox
          key={option}
          size="$5"
          checked={selected.includes(option)}
          onCheckedChange={(checked) => {
            setSelected(prev =>
              checked
                ? [...prev, option]
                : prev.filter(v => v !== option)
            )
          }}
        >
          <Checkbox.Indicator />
          <Text>{option}</Text>
        </Checkbox>
      ))}
    </YStack>
  )
}
```

**Sources**: `CheckboxList.tsx`, `RadioList.tsx`

### Lists with Navigation

```tsx
import { useRouter } from 'solito/router'
import { ListItem } from 'tamagui'

export function NavigationList() {
  const router = useRouter()

  return (
    <YGroup separator={<Separator />}>
      <YGroup.Item>
        <ListItem
          title="Profile"
          onPress={() => router.push('/profile')}
          icon={User}
          iconAfter={ChevronRight}
        />
      </YGroup.Item>
    </YGroup>
  )
}
```

### Product Lists with Data Fetching

```tsx
import { useEffect, useState } from 'react'
import { FlatList } from 'react-native'

export function ProductList() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <Spinner />
  }

  return (
    <FlatList
      data={products}
      renderItem={({ item }) => <ProductCard item={item} />}
      keyExtractor={(item) => item.id}
    />
  )
}
```

**Source**: `ProductList.tsx` - E-commerce product grid with flexbox

## Quick Reference

### List Component Props

| Prop | Type | Description |
|------|------|-------------|
| `data` | `T[]` | Array of items to render |
| `renderItem` | `({ item, index }) => ReactElement` | Function that renders each item |
| `keyExtractor` | `(item, index) => string` | Extract unique key for each item |
| `numColumns` | `number` | Number of columns for grid layout |
| `horizontal` | `boolean` | Horizontal scrolling direction |
| `inverted` | `boolean` | Reverse scroll direction (for chats) |
| `windowSize` | `number` | Number of viewports to render (default: 21) |
| `onEndReached` | `() => void` | Callback when scrolled near end |
| `onEndReachedThreshold` | `number` | Distance from end to trigger callback (0-1) |
| `ItemSeparatorComponent` | `ComponentType` | Component between items |
| `ListHeaderComponent` | `ComponentType` | Component at list start |
| `ListFooterComponent` | `ComponentType` | Component at list end |
| `ListEmptyComponent` | `ComponentType` | Component when data is empty |
| `refreshControl` | `ReactElement` | Pull-to-refresh control |
| `contentContainerStyle` | `StyleProp` | Style for scroll content |

### ListItem Props

| Prop | Type | Description |
|------|------|-------------|
| `title` | `string` | Main text content |
| `subtitle` | `string` | Secondary text below title |
| `icon` | `ReactElement` | Icon before content |
| `iconAfter` | `ReactElement` | Icon after content |
| `size` | `SizeTokens` | Size variant ($2, $3, $4, etc.) |
| `iconSize` | `number` | Override icon size |
| `variant` | `'outlined'` | Visual style variant |
| `color` | `ColorTokens` | Text color |
| `onPress` | `() => void` | Press handler |
| `disabled` | `boolean` | Disable interaction |

### MasonryList Props

| Prop | Type | Description |
|------|------|-------------|
| `data` | `T[]` | Array of items |
| `renderItem` | `({ item, i }) => ReactElement` | Render function |
| `numColumns` | `number` | Number of columns (default: 2) |
| `gap` | `SpaceTokens` | Gap between items |
| `refreshing` | `boolean` | Pull-to-refresh state |
| `onRefresh` | `() => void` | Refresh callback |
| `onEndReached` | `() => void` | Infinite scroll callback |
| `onEndReachedThreshold` | `number` | Trigger distance (0-1) |
| `ListEmptyComponent` | `ComponentType` | Empty state component |
| `LoadingView` | `ComponentType` | Loading indicator |

### Common List Patterns Cheatsheet

```tsx
// Basic list
<FlatList data={items} renderItem={renderItem} />

// Grid
<FlatList data={items} numColumns={3} renderItem={renderItem} />

// Horizontal
<ScrollView horizontal>{items.map(renderItem)}</ScrollView>

// With separators
<FlatList ItemSeparatorComponent={() => <Separator />} />

// With gap
<FlatList contentContainerStyle={{ gap: 16 }} />

// Animated items
<AnimatePresence>
  {show && <View enterStyle={{ opacity: 0 }} />}
</AnimatePresence>

// Grouped
<YGroup separator={<Separator />}>
  <YGroup.Item><ListItem title="Item" /></YGroup.Item>
</YGroup>

// Infinite scroll
<FlatList
  onEndReached={loadMore}
  onEndReachedThreshold={0.5}
  ListFooterComponent={<Spinner />}
/>

// Masonry
<MasonryList
  numColumns={2}
  data={items}
  renderItem={renderItem}
/>

// Chat (inverted)
<FlatList inverted data={messages} renderItem={renderItem} />
```

---

**Related Bento Components:**
- `List.tsx` - Basic FlatList with avatars
- `HList.tsx` - Horizontal image carousel
- `ChatList.tsx` - Inverted animated chat
- `ItemValueList.tsx` - Key-value pairs
- `FlatGrid.tsx` - Responsive grid
- `MasonryList.tsx` - Pinterest layout
- `WheelList.tsx` - 3D carousel with Reanimated
- `ProductList.tsx` - Flexbox product grid
- `CheckboxList.tsx`, `RadioList.tsx` - Form lists

**Tamagui Core:**
- [ListItem Documentation](https://tamagui.dev/ui/list-item)
- [YGroup Component](https://tamagui.dev/ui/group)
- [Separator Component](https://tamagui.dev/ui/separator)
