# Bento Tables (TanStack Table Integration)

> Premium table components from @tamagui/bento integrating with TanStack Table for powerful data display

Bento provides production-ready table components that seamlessly integrate with TanStack Table v8, offering sorting, pagination, filtering, and responsive layouts out of the box.

## Table Architecture

Bento Tables are built using Tamagui's `createStyledContext` pattern to provide a unified configuration system across all table components.

### Core Components

```tsx
import { Table } from '@tamagui/bento/elements/tables'

<Table cellWidth="$15" cellHeight="$5" alignCells={{ x: 'center', y: 'center' }}>
  <Table.Head>
    <Table.Row>
      <Table.HeaderCell>Name</Table.HeaderCell>
    </Table.Row>
  </Table.Head>
  <Table.Body>
    <Table.Row>
      <Table.Cell>Content</Table.Cell>
    </Table.Row>
  </Table.Body>
  <Table.Foot>
    {/* Optional footer */}
  </Table.Foot>
</Table>
```

### Component Hierarchy

- **Table** - Root container (renders as `<table>`)
- **Table.Head** - Header section (renders as `<thead>`)
- **Table.Body** - Body section (renders as `<tbody>`)
- **Table.Foot** - Footer section (renders as `<tfoot>`)
- **Table.Row** - Row container (renders as `<tr>`)
- **Table.HeaderCell** - Header cell (renders as `<th>`)
- **Table.Cell** - Data cell (renders as `<td>`)

### Context Configuration

The table context provides shared configuration across all child components:

```tsx
type TableContext = {
  cellWidth: SizeTokens | number      // Width for all cells
  cellHeight: SizeTokens | number     // Min height for cells
  alignHeaderCells: {                 // Header alignment
    x: 'center' | 'start' | 'end'
    y: 'center' | 'start' | 'end'
  }
  alignCells: {                       // Body cell alignment
    x: 'center' | 'start' | 'end'
    y: 'center' | 'start' | 'end'
  }
  borderColor: string                 // Border color token
}
```

**Defaults:**
```tsx
{
  cellWidth: '$8',
  cellHeight: '$8',
  alignHeaderCells: { x: 'start', y: 'center' },
  alignCells: { x: 'center', y: 'center' },
  borderColor: '$borderColor'
}
```

### Cell Sizing

Cell sizing uses Tamagui size tokens with spread variants:

```tsx
// TableParts definition
variants: {
  cellWidth: {
    '...size': (name, { tokens }) => ({
      width: tokens.size[name]
    })
  },
  cellHeight: {
    '...size': (name, { tokens }) => ({
      minHeight: tokens.size[name]
    })
  }
}
```

Use size tokens like `$8`, `$10`, `$15`, `$18` for consistent spacing.

### Row and Cell Variants

**Row Locations:**
- `first` - Top row (no bottom border on last)
- `middle` - Middle rows (bottom border)
- `last` - Bottom row (no bottom border)

**Cell Locations:**
- `first` - First column (no left border)
- `middle` - Middle columns (left border)
- `last` - Last column (left border)

## TanStack Table Integration

### Installation

```bash
npm install @tanstack/react-table
```

### Type Definition

```tsx
type Person = {
  avatar: string
  firstName: string
  lastName: string
  age: number
  visits: number
  status: string
  progress: number
}
```

### Column Helper Pattern

TanStack Table provides a type-safe `createColumnHelper` for defining columns:

```tsx
import { createColumnHelper } from '@tanstack/react-table'

const columnHelper = createColumnHelper<Person>()

const columns = [
  columnHelper.accessor('avatar', {
    cell: (info) => (
      <Avatar circular size="$3">
        <Avatar.Image src={info.getValue()} />
        <Avatar.Fallback bg="$color6" />
      </Avatar>
    ),
    header: () => 'Avatar',
    footer: (info) => info.column.id,
  }),
  columnHelper.accessor('firstName', {
    cell: (info) => info.getValue(),
    header: () => 'First Name',
    footer: (info) => info.column.id,
  }),
  // More columns...
]
```

### Table Hook Setup

```tsx
import { useReactTable, getCoreRowModel } from '@tanstack/react-table'

function MyTable() {
  const [data, setData] = React.useState<Person[]>([])
  
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })
  
  const headerGroups = table.getHeaderGroups()
  const tableRows = table.getRowModel().rows
  const footerGroups = table.getFooterGroups()
  
  return <Table>...</Table>
}
```

### Rendering with flexRender

Use TanStack's `flexRender` utility to render dynamic cell content:

```tsx
import { flexRender } from '@tanstack/react-table'

{headerGroup.headers.map((header) => (
  <Table.HeaderCell key={header.id}>
    <Text>
      {flexRender(header.column.columnDef.header, header.getContext())}
    </Text>
  </Table.HeaderCell>
))}
```

## Basic Table Example

Complete working example with avatar cells:

```tsx
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import * as React from 'react'
import { Avatar, Text, getTokenValue } from 'tamagui'
import { Table } from '@tamagui/bento/elements/tables'

type Person = {
  avatar: string
  firstName: string
  lastName: string
  age: number
  visits: number
  status: string
  progress: number
}

const columnHelper = createColumnHelper<Person>()

const columns = [
  columnHelper.accessor('avatar', {
    cell: (info) => (
      <Avatar circular size="$3">
        <Avatar.Image src={info.getValue()} />
        <Avatar.Fallback bg="$color6" />
      </Avatar>
    ),
    header: () => 'Avatar',
  }),
  columnHelper.accessor('firstName', {
    cell: (info) => info.getValue(),
    header: () => 'First Name',
  }),
  columnHelper.accessor('age', {
    header: () => 'Age',
    cell: (info) => info.renderValue(),
  }),
]

const CELL_WIDTH = '$15'

export function BasicTable() {
  const [data] = React.useState<Person[]>([
    {
      avatar: 'https://i.pravatar.cc/150?img=1',
      firstName: 'Robert',
      lastName: 'Smith',
      age: 24,
      visits: 100,
      status: 'Active',
      progress: 50,
    },
  ])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <Table
      cellWidth={CELL_WIDTH}
      cellHeight="$5"
      alignCells={{ x: 'center', y: 'center' }}
      alignHeaderCells={{ x: 'center', y: 'center' }}
      borderWidth={0.5}
      maxW={getTokenValue(CELL_WIDTH) * columns.length}
    >
      <Table.Head>
        {table.getHeaderGroups().map((headerGroup) => (
          <Table.Row key={headerGroup.id} bg="$color2">
            {headerGroup.headers.map((header) => (
              <Table.HeaderCell key={header.id}>
                <Text fontSize="$4">
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </Text>
              </Table.HeaderCell>
            ))}
          </Table.Row>
        ))}
      </Table.Head>
      <Table.Body>
        {table.getRowModel().rows.map((row) => (
          <Table.Row key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <Table.Cell key={cell.id}>
                {cell.column.id === 'avatar' ? (
                  flexRender(cell.column.columnDef.cell, cell.getContext())
                ) : (
                  <Text fontSize="$4" color="$color11">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </Text>
                )}
              </Table.Cell>
            ))}
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  )
}
```

## Sortable Table

Add sorting capabilities with TanStack Table's sorting features:

```tsx
import {
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ChevronUp, ChevronDown, ChevronsUpDown } from '@tamagui/lucide-icons'
import { View, Text } from 'tamagui'

export function SortableTable() {
  const [data, setData] = React.useState<Person[]>([])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <Table>
      <Table.Head>
        {table.getHeaderGroups().map((headerGroup) => (
          <Table.Row key={headerGroup.id} bg="$color2">
            {headerGroup.headers.map((header) => {
              const canSort = header.column.getCanSort()
              return (
                <Table.HeaderCell key={header.id}>
                  <View
                    flexDirection="row"
                    cursor={canSort ? 'pointer' : 'default'}
                    onPress={canSort ? header.column.getToggleSortingHandler() : undefined}
                    gap="$2"
                    items="center"
                  >
                    <Text fontSize="$4" selectable={false}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </Text>
                    {{
                      asc: <ChevronUp size="$1" color="$color10" />,
                      desc: <ChevronDown size="$1" color="$color10" />,
                      noSort: canSort ? <ChevronsUpDown size="$1" color="$color10" /> : null,
                    }[header.column.getIsSorted() || 'noSort']}
                  </View>
                </Table.HeaderCell>
              )
            })}
          </Table.Row>
        ))}
      </Table.Head>
      <Table.Body>
        {/* Row rendering */}
      </Table.Body>
    </Table>
  )
}
```

### Sort Indicators

- **Ascending:** `<ChevronUp />` - Indicates A→Z or 0→9 sort
- **Descending:** `<ChevronDown />` - Indicates Z→A or 9→0 sort  
- **Unsorted:** `<ChevronsUpDown />` - Shows column is sortable but not currently sorted

## Pagination

Implement pagination with `getPaginationRowModel`:

```tsx
import { getPaginationRowModel } from '@tanstack/react-table'
import { Button, Input, Text, View, XGroup } from 'tamagui'
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from '@tamagui/lucide-icons'

export function PaginatedTable() {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    // Optional: Set custom page size
    state: {
      pagination: {
        pageSize: 10,
        pageIndex: 0,
      },
    },
  })

  return (
    <>
      <Table>{/* Table content */}</Table>
      
      {/* Pagination Controls */}
      <View flexDirection="row" items="center" justify="space-between" px="$4">
        {/* Navigation Buttons */}
        <XGroup>
          <XGroup.Item>
            <Button
              onPress={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <Button.Icon>
                <ChevronFirst />
              </Button.Icon>
            </Button>
          </XGroup.Item>
          <XGroup.Item>
            <Button
              onPress={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <Button.Icon>
                <ChevronLeft />
              </Button.Icon>
            </Button>
          </XGroup.Item>
          <XGroup.Item>
            <Button
              onPress={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <Button.Icon>
                <ChevronRight />
              </Button.Icon>
            </Button>
          </XGroup.Item>
          <XGroup.Item>
            <Button
              onPress={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <Button.Icon>
                <ChevronLast />
              </Button.Icon>
            </Button>
          </XGroup.Item>
        </XGroup>

        {/* Page Indicator */}
        <View
          flexDirection="row"
          rounded={1000_000_000}
          p="$2"
          px="$6"
          theme="accent"
          bg="$background"
          gap="$3"
        >
          <Text fontWeight="$5">Page</Text>
          <Text fontWeight="$5">
            {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
          </Text>
        </View>

        {/* Go to Page Input */}
        <View flexDirection="row" gap="$4" items="center">
          <Text fontSize="$5" fontWeight="$5">Go to page</Text>
          <Input
            inputMode="numeric"
            type="number"
            defaultValue={String(table.getState().pagination.pageIndex + 1)}
            onChange={(e: any) => {
              const text = e.target?.value ?? e.nativeEvent?.text ?? ''
              const page = text ? Number(text) - 1 : 0
              table.setPageIndex(page)
            }}
            textAlign="center"
            maxW={45}
            minW={45}
          />
        </View>
      </View>
    </>
  )
}
```

### Pagination API

```tsx
table.setPageIndex(0)                          // Go to first page
table.previousPage()                           // Go to previous page
table.nextPage()                               // Go to next page
table.setPageIndex(table.getPageCount() - 1)   // Go to last page
table.getCanPreviousPage()                     // Can go back?
table.getCanNextPage()                         // Can go forward?
table.getPageCount()                           // Total page count
table.getState().pagination.pageIndex          // Current page (0-indexed)
table.setPageSize(20)                          // Change page size
```

## Responsive Tables

Use `useGroupMedia` to switch between table and card views:

```tsx
import { useGroupMedia } from '@tamagui/bento/hooks'
import { View, YStack, Separator, Text, Avatar } from 'tamagui'

export function ResponsiveTable() {
  const [data] = React.useState<Person[]>([/* ... */])
  const { sm } = useGroupMedia('window')
  
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  // Mobile Card View
  if (sm) {
    return (
      <YStack gap="$5" width="100%" py="$6">
        {data.map((row, i) => (
          <View
            key={i}
            rounded="$4"
            borderWidth="$1"
            borderColor="$borderColor"
            flex={1}
            gap="$3"
          >
            <View gap="$3" mx="$3" my="$3">
              {Object.entries(row).map(([name, value], idx) => (
                <View key={idx}>
                  <View flexDirection="row" items="center" justify="space-between">
                    <Text>{name.charAt(0).toUpperCase() + name.slice(1)}</Text>
                    {name === 'avatar' ? (
                      <Avatar circular size="$3">
                        <Avatar.Image src={value as string} />
                        <Avatar.Fallback bg="$color6" />
                      </Avatar>
                    ) : (
                      <Text color="$color10">{value}</Text>
                    )}
                  </View>
                  {idx !== Object.entries(row).length - 1 && <Separator mt="$3" />}
                </View>
              ))}
            </View>
          </View>
        ))}
      </YStack>
    )
  }

  // Desktop Table View
  return (
    <Table>
      {/* Standard table rendering */}
    </Table>
  )
}
```

### Media Breakpoints

The `useGroupMedia` hook from Bento provides responsive utilities:

```tsx
const { xs, sm, md, lg, xl } = useGroupMedia('window')

// xs: < 660px (extra small - phones)
// sm: < 860px (small - tablets portrait)
// md: < 1020px (medium - tablets landscape)
// lg: < 1280px (large - laptops)
// xl: >= 1280px (extra large - desktops)
```

## Advanced Features

### Sticky Headers

Create sticky table headers with `position: absolute`:

```tsx
<Table>
  <Table.Head position="absolute" z="$1" maxW={TABLE_WIDTH}>
    {/* Headers */}
  </Table.Head>
  <Table.Body mt="$8">
    {/* Body rows - margin-top offsets the sticky header */}
  </Table.Body>
</Table>
```

### Row Hover States

Add hover effects using the `hoverStyle` prop:

```tsx
<Table.Row
  hoverStyle={{
    bg: '$color2',
  }}
  key={row.id}
>
  {/* Cells */}
</Table.Row>
```

### Custom Cell Renderers

#### Avatar Cell

```tsx
columnHelper.accessor('avatar', {
  cell: (info) => (
    <Avatar circular size="$3">
      <Avatar.Image accessibilityLabel="Profile image" src={info.getValue()} />
      <Avatar.Fallback bg="$color6" />
    </Avatar>
  ),
  header: () => 'Avatar',
})
```

#### Badge/Status Cell

```tsx
import { Circle, View, Text } from 'tamagui'

const StatusBadge = ({ status }: { status: string }) => (
  <View
    flexDirection="row"
    items="center"
    gap="$2"
    theme={status.toLowerCase() === 'active' ? 'green' : 'orange'}
    bg="$color6"
    rounded={1000_000_000}
    px="$2"
    py="$1"
  >
    <Circle size={10} bg="$color10" />
    <Text color="$color10" fontWeight="$2">
      {status}
    </Text>
  </View>
)

columnHelper.accessor('status', {
  header: 'Status',
  cell: (info) => <StatusBadge status={info.getValue()} />,
})
```

#### Composite Cell (Multiple Values)

```tsx
columnHelper.accessor(
  (row) => ({
    fullName: row.fullName,
    username: row.username,
    image: row.avatar,
  }),
  {
    id: 'user_base',
    cell: (info) => {
      const { fullName, username, image } = info.getValue()
      return (
        <View flexDirection="row" items="center" gap="$3" ml="$2">
          <Avatar circular size="$4">
            <Avatar.Image src={image} />
            <Avatar.Fallback bg="$color6" />
          </Avatar>
          <View flexDirection="column">
            <Text>{fullName}</Text>
            <Text fontSize="$2" fontWeight="$2" theme="alt2">
              {username}
            </Text>
          </View>
        </View>
      )
    },
    header: () => 'User',
  }
)
```

### Horizontal Scrolling

For wide tables, wrap in `ScrollView`:

```tsx
import { ScrollView, View } from 'tamagui'

<ScrollView horizontal maxW="100%">
  <View minW={TABLE_WIDTH} width="100%" px="$4" py="$6">
    <Table maxW={TABLE_WIDTH}>
      {/* Table content */}
    </Table>
  </View>
</ScrollView>
```

## Performance

### Large Datasets

For tables with 1000+ rows, TanStack Table handles virtualization efficiently. Use pagination to limit rendered rows:

```tsx
const table = useReactTable({
  data: largeDataset, // 10,000+ rows
  columns,
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  state: {
    pagination: {
      pageSize: 50, // Only render 50 rows at a time
      pageIndex: 0,
    },
  },
})
```

### Memoization Patterns

Memoize columns and data to prevent unnecessary re-renders:

```tsx
const columns = React.useMemo(
  () => [
    columnHelper.accessor('firstName', {
      cell: (info) => info.getValue(),
      header: () => 'First Name',
    }),
    // More columns...
  ],
  []
)

const data = React.useMemo(() => makeData(1000), [])

const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
})
```

### Generating Test Data

Use the Bento `makeData` utility for testing:

```tsx
import { makeData } from '@tamagui/bento/elements/tables/utils'

// Generate 100 rows
const data = makeData(100)

// Generate nested data (100 parent rows, each with 10 children)
const nestedData = makeData(100, 10)
```

Alternatively, use `@ngneat/falso` directly:

```tsx
import { randFirstName, randLastName, randNumber } from '@ngneat/falso'

const generatePerson = (): Person => ({
  avatar: `https://i.pravatar.cc/150?img=${randNumber({ max: 70 })}`,
  firstName: randFirstName(),
  lastName: randLastName(),
  age: randNumber({ max: 40 }),
  visits: randNumber({ max: 1000 }),
  progress: randNumber({ max: 100 }),
  status: ['Active', 'Offline', 'Pending'][Math.floor(Math.random() * 3)],
})
```

## Quick Reference

### Table Props
```tsx
cellWidth: SizeTokens | number        // Cell width (default: '$8')
cellHeight: SizeTokens | number       // Cell min-height (default: '$8')
alignCells: AlignCells                // Body cell alignment
alignHeaderCells: AlignHeaderCells    // Header cell alignment
borderColor: string                   // Border color token
```

### Row Variants
```tsx
rowLocation: 'first' | 'middle' | 'last'   // Controls bottom borders
```

### Cell Variants
```tsx
cellLocation: 'first' | 'middle' | 'last'  // Controls left borders
cellWidth: SizeTokens                       // Override width
cellHeight: SizeTokens                      // Override height
alignCells: AlignCells                      // Override alignment
```

### TanStack Table Core Models
```tsx
getCoreRowModel()          // Required - basic row model
getSortedRowModel()        // Sorting functionality
getPaginationRowModel()    // Pagination functionality
getFilteredRowModel()      // Filtering functionality
getGroupedRowModel()       // Grouping functionality
```

### Common Patterns

**Basic Setup:**
```tsx
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
})
```

**With Sorting + Pagination:**
```tsx
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
})
```

**Render Pattern:**
```tsx
{table.getHeaderGroups().map(headerGroup => (
  <Table.Row key={headerGroup.id}>
    {headerGroup.headers.map(header => (
      <Table.HeaderCell key={header.id}>
        {flexRender(header.column.columnDef.header, header.getContext())}
      </Table.HeaderCell>
    ))}
  </Table.Row>
))}
```

### Related Documentation

- [TanStack Table Docs](https://tanstack.com/table/latest)
- [Tamagui Theme System](/docs/core/theme)
- [Tamagui Tokens](/docs/core/tokens)
- [Avatar Component](/ui/avatar)
- [Button Component](/ui/button)
