# Tamagui v2 Reference Documentation

> Comprehensive documentation for Tamagui v1.144.0+, including core framework, Bento premium components, and Takeout starter kit

This collection provides production-ready reference material for building cross-platform React Native and Web applications with Tamagui. All references are based on official Tamagui documentation and battle-tested patterns.

---

## Quick Start

### Decision Tree: Which File Do I Need?

**Setting up a new project?**
- Start with [`configuration.md`](#configuration--build) → Define tokens, themes, fonts, media queries
- Then read [`compiler.md`](#configuration--build) → Enable static extraction for production builds

**Building UI components?**
- Basic buttons, inputs, dialogs → [`components.md`](#core-tamagui)
- Styling patterns, variants, composition → [`core-styling.md`](#core-tamagui)
- Color themes and light/dark mode → [`theming.md`](#core-tamagui)
- Smooth animations and transitions → [`animations.md`](#core-tamagui)

**Using Bento premium components?**
- Forms with React Hook Form + Zod validation → [`bento-forms.md`](#bento-components)
- Data tables with TanStack Table → [`bento-tables.md`](#bento-components)
- Efficient lists (virtualized, masonry, grids) → [`bento-lists.md`](#bento-components)

**Working with Takeout starter kit?**
- File-based routing and navigation → [`takeout-routing.md`](#takeout-starter-kit)
- User authentication (email, OAuth, OTP) → [`takeout-auth.md`](#takeout-starter-kit)
- Database queries with Drizzle ORM → [`takeout-database.md`](#takeout-starter-kit)
- Real-time sync and offline support → [`takeout-zero.md`](#takeout-starter-kit)

**Migrating or troubleshooting?**
- Breaking changes from older versions → [`breaking-changes-and-new-features.md`](#migration--reference)

---

## Reference Files

### Core Tamagui

| File | Description | When to Use |
|------|-------------|-------------|
| [`core-styling.md`](./core-styling.md) | `styled()` API, variant systems, `createStyledContext`, composition patterns, TypeScript integration | Creating custom styled components, implementing design system patterns, building reusable component primitives |
| [`components.md`](./components.md) | Button, Dialog, Sheet, Input, Select, Tabs, Switch, Popover, Stacks (XStack/YStack/ZStack), Adapt pattern | Building UI with Tamagui's built-in components, understanding component APIs and prop patterns |
| [`theming.md`](./theming.md) | 12-step color scale system, theme creation, theme tokens, dynamic theme switching, `useTheme` hook | Setting up color palettes, implementing light/dark mode, creating contextual sub-themes |
| [`animations.md`](./animations.md) | Animation drivers (CSS, React Native, Reanimated, Motion), `enterStyle`/`exitStyle`, `AnimatePresence`, spring physics | Adding smooth transitions, implementing enter/exit animations, optimizing animation performance per platform |

### Configuration & Build

| File | Description | When to Use |
|------|-------------|-------------|
| [`configuration.md`](./configuration.md) | `createTamagui` function, tokens (colors, sizes, space, radius, zIndex), themes, fonts, media queries, shorthands | Initial project setup, defining your design system foundation, configuring responsive breakpoints |
| [`compiler.md`](./compiler.md) | Static extraction, Babel optimization, atomic CSS generation, Next.js/Vite/Expo setup, debugging extraction | Production builds, optimizing bundle size, troubleshooting compiler issues, platform-specific optimizations |

### Bento Components

Premium components from `@tamagui/bento` (requires Bento license for production use).

| File | Description | When to Use |
|------|-------------|-------------|
| [`bento-forms.md`](./bento-forms.md) | React Hook Form integration, Zod validation, composable input system (`Input.Label`, `Input.Box`, `Input.Section`), error handling, accessibility | Building production forms with validation, implementing complex input layouts with icons/buttons, ensuring WCAG compliance |
| [`bento-tables.md`](./bento-tables.md) | TanStack Table v8 integration, sorting, pagination, filtering, responsive layouts, custom cell renderers | Displaying tabular data with sorting/filtering, building data grids, implementing responsive tables |
| [`bento-lists.md`](./bento-lists.md) | FlatList patterns, virtualized lists, masonry layouts, grid layouts, horizontal carousels, performance optimization | Rendering large datasets efficiently, creating Pinterest-style grids, building chat/feed UIs with optimal scroll performance |

### Takeout Starter Kit

Full-stack patterns from Tamagui Takeout (requires Takeout license).

| File | Description | When to Use |
|------|-------------|-------------|
| [`takeout-routing.md`](./takeout-routing.md) | One.js file-based routing, SSG/SSR/SPA modes, dynamic routes, route groups, type-safe navigation, server-side data loading (`loader` functions) | Implementing navigation, creating page layouts, understanding routing conventions, loading data before render |
| [`takeout-auth.md`](./takeout-auth.md) | Better Auth integration, session management, email/password auth, OTP (email/phone), magic links, OAuth, JWT tokens for native, auth state hooks | Adding user authentication, protecting routes, implementing signup/login flows, managing user sessions |
| [`takeout-database.md`](./takeout-database.md) | Drizzle ORM setup, schema definitions (`pgTable`), type-safe queries, migrations with `drizzle-kit`, relations, connection management | Defining database schemas, writing type-safe queries, managing migrations, integrating with PostgreSQL |
| [`takeout-zero.md`](./takeout-zero.md) | Zero Sync for real-time data, offline-first architecture, client-side replicas, optimistic mutations, over-zero helpers, Valibot integration, permissions | Building offline-capable apps, implementing real-time collaboration, syncing data across devices, 0-latency local queries |

### Migration & Reference

| File | Description | When to Use |
|------|-------------|-------------|
| [`breaking-changes-and-new-features.md`](./breaking-changes-and-new-features.md) | Migration guide from v1.x to v1.144+, media query realignment (v4 config), deprecated patterns, new features | Upgrading from older Tamagui versions, fixing breaking changes, understanding config v4/v5 differences |

---

## Version Information

- **Tamagui Version:** 1.144.0+
- **Compatible With:** React 19, React Native, Expo
- **Last Updated:** January 2026
- **Generated From:** Official Tamagui documentation at [tamagui.dev](https://tamagui.dev)

---

## Usage Tips for AI Assistants

### Before Starting Implementation

1. **Load the skill trigger first** – If using the `tamagui-v2` skill system, ensure the skill is loaded before reading references
2. **Start with configuration** – For new projects, always read `configuration.md` before other files
3. **Check version compatibility** – These docs assume v1.144.0+; older versions may have different APIs

### During Development

1. **Search within files** – Each reference has a detailed table of contents for quick navigation
2. **Cross-reference related topics** – Styling references themes, themes reference tokens, animations reference drivers
3. **Verify code examples** – All examples are production-tested patterns from official docs
4. **Check platform support** – Some features are web-only (CSS driver) or native-only (certain animations)

### Common Workflows

**Creating a themed component:**
1. Read `configuration.md` (tokens) → `theming.md` (color scales) → `core-styling.md` (variants)

**Building a form:**
1. Read `components.md` (Input basics) → `bento-forms.md` (React Hook Form + validation)

**Setting up Takeout app:**
1. Read `configuration.md` → `takeout-routing.md` → `takeout-auth.md` → `takeout-database.md` → `takeout-zero.md`

**Optimizing for production:**
1. Read `compiler.md` → `animations.md` (choose optimal driver) → `breaking-changes-and-new-features.md` (ensure latest patterns)

---

## File Metadata

| File | Size | Last Modified |
|------|------|---------------|
| `animations.md` | ~15 KB | 2026-01-24 |
| `bento-forms.md` | ~18 KB | 2026-01-24 |
| `bento-lists.md` | ~14 KB | 2026-01-24 |
| `bento-tables.md` | ~16 KB | 2026-01-24 |
| `breaking-changes-and-new-features.md` | ~12 KB | 2026-01-24 |
| `compiler.md` | ~13 KB | 2026-01-24 |
| `components.md` | ~22 KB | 2026-01-24 |
| `configuration.md` | ~17 KB | 2026-01-24 |
| `core-styling.md` | ~19 KB | 2026-01-24 |
| `takeout-auth.md` | ~20 KB | 2026-01-24 |
| `takeout-database.md` | ~18 KB | 2026-01-24 |
| `takeout-routing.md` | ~16 KB | 2026-01-24 |
| `takeout-zero.md` | ~21 KB | 2026-01-24 |
| `theming.md` | ~15 KB | 2026-01-24 |

---

## Contributing

These references are auto-generated from official Tamagui documentation. To request updates or corrections:

1. Check the generation guide: [`_generation-guide.md`](./_generation-guide.md)
2. Submit issues to the Tamagui repository: [github.com/tamagui/tamagui](https://github.com/tamagui/tamagui)
3. For skill-specific improvements, refer to the toolbox repository

---

**Quick Links:**
- [Tamagui Official Docs](https://tamagui.dev)
- [Bento Components](https://tamagui.dev/bento)
- [Takeout Starter](https://tamagui.dev/takeout)
- [GitHub Repository](https://github.com/tamagui/tamagui)
