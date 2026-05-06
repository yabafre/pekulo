# Generation Guide for Tamagui v2 References

## Required Source Repositories

1. **tamagui/tamagui** - v1.144.0 (main branch)
   - Location: ~/dev/tamagui-tamagui
   - Pull latest and checkout main

2. **tamagui/bento** - v1.138.0
   - Location: ~/dev/tamagui-bento
   - Pull latest and checkout main

3. **tamagui/takeout3** - latest
   - Location: ~/dev/tamagui-takeout3
   - Pull latest and checkout main/upstream

## Files to Generate

1. **README.md** - Navigation guide
2. **core-styling.md** - styled(), variants, context, composition
3. **components.md** - Button, Dialog, Input, Select, etc.
4. **animations.md** - CSS, Animated, Reanimated
5. **configuration.md** - createTamagui, tokens, media, fonts
6. **theming.md** - 12-step colors, createThemes
7. **compiler.md** - Static extraction, optimization
8. **bento-tables.md** - TanStack Table integration
9. **bento-forms.md** - React Hook Form + Zod
10. **bento-lists.md** - FlatList patterns, animations
11. **takeout-routing.md** - One.js file-based routing
12. **takeout-zero.md** - Real-time sync, queries, mutations
13. **takeout-auth.md** - Better Auth setup
14. **takeout-database.md** - Drizzle ORM
15. **breaking-changes-and-new-features.md** - Migration guide

## Generation Instructions

For each file:
1. Explore the relevant source directories
2. Extract real code examples
3. Document patterns and best practices
4. Include TypeScript types
5. Cross-reference related files
6. Target 15-20KB per file (comprehensive)
7. Use copy-paste ready examples

## Key Principles

- Based on REAL repository code, not synthetic examples
- TypeScript-first approach
- Production-ready patterns
- Cross-platform guidance (web/native)
- Performance tips included
- Accessibility notes where relevant
