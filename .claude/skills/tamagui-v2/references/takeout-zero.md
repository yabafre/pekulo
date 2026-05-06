# Zero Sync Integration in Tamagui Takeout

> **Complete guide to Zero-based data sync, offline-first architecture, and real-time updates in Tamagui Takeout**

## Overview

### What is Zero Sync?

[Zero](https://zero.rocicorp.dev) is a client-first sync engine developed by Rocicorp that maintains a partial replica of your Postgres database on the client. It enables:

- **Instant queries** with 0 network latency (queries run against local replica)
- **Optimistic mutations** that apply immediately and sync to server
- **Real-time updates** streamed automatically from other clients
- **Offline support** with automatic sync when reconnected
- **Type-safe queries** with full TypeScript support

### Why Takeout Uses Zero

Takeout wraps Zero with [over-zero](https://github.com/tamagui/over-zero), a helper library that provides:

- Streamlined developer experience with auto-generated CRUD operations
- Integration with Valibot for runtime type validation
- Permission helpers that work on both client and server
- Code generation from schema definitions
- Server action integration for async tasks

### Core Concepts

| Concept | Description |
|---------|-------------|
| **Local Replica** | Partial slice of Postgres data synced to client (IndexedDB/SQLite/memory) |
| **Queries** | Plain functions using `zql` builder, run against local replica |
| **Mutations** | Convergent operations that run on both client and server |
| **Permissions** | Declarative rules enforced server-side, auto-pass client-side |
| **Relationships** | One-to-many/many-to-one definitions for joins |
| **Server Actions** | Server-only code for emails, webhooks, analytics |

---

## Setup & Configuration

### Directory Structure

```
src/
├── data/
│   ├── models/              # Table schemas + write permissions + mutations
│   │   ├── post.ts
│   │   ├── user.ts
│   │   └── comment.ts
│   ├── queries/             # Query functions + read permissions
│   │   ├── post.ts
│   │   ├── user.ts
│   │   └── comment.ts
│   ├── server/              # Server-only code
│   │   ├── createServerActions.ts
│   │   └── actions/
│   ├── generated/           # Auto-generated (don't edit)
│   │   ├── types.ts
│   │   ├── tables.ts
│   │   ├── models.ts
│   │   ├── groupedQueries.ts
│   │   └── syncedQueries.ts
│   ├── relationships.ts     # Table relationships
│   ├── schema.ts            # Schema assembly
│   └── types.ts             # Type exports
└── zero/
    ├── client.tsx           # Client setup
    ├── server.ts            # Server setup
    └── types.ts             # Type augmentation
```

### Client Setup

```tsx
// src/zero/client.tsx
import { createZeroClient } from 'over-zero'
import { schema } from '~/data/schema'
import { models } from '~/data/generated/models'
import * as groupedQueries from '~/data/generated/groupedQueries'

export const {
  useQuery,
  usePermission,
  zero,
  ProvideZero: ProvideZeroWithoutAuth,
  zeroEvents,
  preload,
} = createZeroClient({
  models,
  schema,
  groupedQueries,
})

// Wrap your app
export const ProvideZero = ({ children }) => {
  const auth = useAuth()
  const userId = auth?.user?.id || 'anon'
  const jwtToken = auth?.token || ''

  const authData = useMemo(() => {
    if (userId === 'anon') return null
    return { id: userId, role: auth.user?.role }
  }, [userId, auth.user?.role])

  // Storage: 'idb' (web), 'sqlite' (native), 'mem' (anonymous/SSR)
  const kvStore = isWeb && isClient && userId ? 'idb' : 'mem'

  return (
    <ProvideZeroWithoutAuth
      server={ZERO_SERVER_URL}
      userID={userId}
      auth={jwtToken}
      authData={authData}
      kvStore={kvStore}
    >
      {children}
    </ProvideZeroWithoutAuth>
  )
}
```

**Storage backends:**
- `'idb'` - IndexedDB for web (persistent, ~50MB quota)
- `'sqlite'` - SQLite for native (persistent, faster than IDB)
- `'mem'` - In-memory for anonymous users or server-side rendering

### Server Setup

```ts
// src/zero/server.ts
import { createZeroServer } from 'over-zero/server'
import { schema } from '~/data/schema'
import { models } from '~/data/generated/models'
import { queries } from '~/data/generated/syncedQueries'
import { createServerActions } from '~/data/server/createServerActions'

export const zeroServer = createZeroServer({
  schema,
  models,
  createServerActions,
  queries,
  database: process.env.ZERO_UPSTREAM_DB, // Postgres connection string
})
```

Zero requires two API routes (already set up in Takeout):
- `/api/zero/push` - Client sends mutations
- `/api/zero/pull` - Client receives updates

### Type Augmentation

```ts
// src/zero/types.ts
import type { schema } from '~/data/schema'
import type { AuthData } from '~/features/auth/types'
import type { ServerActions } from '~/data/server/createServerActions'

declare module 'over-zero' {
  interface Config {
    schema: typeof schema
    authData: AuthData
    serverActions: ServerActions
  }
}
```

This enables full type inference across the entire data layer.

---

## Queries

### Defining Queries

Queries are plain exported functions in `src/data/queries/` that use the global `zql` builder:

```ts
// src/data/queries/post.ts
import { serverWhere, zql } from 'over-zero'

// Read permission (server-only enforcement)
const permission = serverWhere('post', () => true)

// Simple query
export const postById = (props: { postId: string }) => {
  return zql.post
    .where(permission)
    .where('id', props.postId)
    .one()
}

// Query with ordering and limits
export const postsByUserId = (props: { userId: string; limit?: number }) => {
  return zql.post
    .where(permission)
    .where('userId', props.userId)
    .orderBy('createdAt', 'desc')
    .orderBy('id', 'desc') // Tie-breaker for pagination
    .limit(props.limit || 20)
}
```

### Using Queries in Components

```tsx
import { useQuery } from '~/zero/client'
import { postById, postsByUserId } from '~/data/queries/post'

function PostDetail({ postId }) {
  const [post, status] = useQuery(postById, { postId })

  if (status.type === 'loading') return <Spinner />
  if (status.type === 'error') return <Text>Error: {status.error}</Text>
  if (!post) return <Text>Not found</Text>

  return <Text>{post.caption}</Text>
}

function UserPosts({ userId }) {
  const [posts] = useQuery(postsByUserId, { userId, limit: 20 })
  return posts.map(post => <PostCard key={post.id} post={post} />)
}
```

### Query Options

Three patterns for calling `useQuery`:

```tsx
// 1. With params only
useQuery(queryFn, { param1, param2 })

// 2. With params + options
useQuery(queryFn, { param1 }, { enabled: Boolean(param1) })

// 3. No params + options
useQuery(queryFn, { enabled: isReady })
```

**Conditional queries:**

```tsx
// Only run query when userId is available
const [user] = useQuery(
  userById,
  { userId },
  { enabled: Boolean(userId) }
)
```

### Advanced Filtering

Use the expression builder for complex conditions:

```ts
// Complex WHERE clauses
export const postsWithBlocks = (props: {
  blockedUserIds: string[]
  pageSize: number
}) => {
  return zql.post
    .where(permission)
    .where((eb) => {
      if (props.blockedUserIds.length > 0) {
        // NOT IN operator
        return eb.not(eb.cmp('userId', 'IN', props.blockedUserIds))
      }
      return eb.cmp('id', '!=', '') // Always true condition
    })
    .orderBy('createdAt', 'desc')
    .limit(props.pageSize)
}

// Text search with LIKE
export const searchPosts = (props: { searchText: string }) => {
  return zql.post
    .where(permission)
    .where((eb) => eb.cmp('caption', 'LIKE', `%${props.searchText}%`))
    .orderBy('createdAt', 'desc')
    .limit(20)
}

// Multiple conditions with AND
export const complexSearch = (props: {
  searchText: string
  blockedUserIds: string[]
}) => {
  return zql.post
    .where(permission)
    .where((eb) => {
      const captionMatch = eb.cmp('caption', 'LIKE', `%${props.searchText}%`)
      const notBlocked = eb.not(eb.cmp('userId', 'IN', props.blockedUserIds))
      return eb.and(captionMatch, notBlocked)
    })
}
```

**Available operators:**
- `=`, `!=`, `<`, `>`, `<=`, `>=`
- `IN`, `NOT IN`
- `LIKE`, `ILIKE` (case-insensitive)
- `IS`, `IS NOT`

### Pagination

Cursor-based pagination with `.start()`:

```ts
export const postsPaginated = (props: {
  pageSize: number
  cursor?: { id: string; createdAt: number } | null
}) => {
  let query = zql.post
    .where(permission)
    .orderBy('createdAt', 'desc')
    .orderBy('id', 'desc') // Tie-breaker ensures stable cursor
    .limit(props.pageSize)

  if (props.cursor) {
    query = query.start(props.cursor)
  }

  return query
}
```

**Usage in component:**

```tsx
function PostList() {
  const [posts] = useQuery(postsPaginated, { pageSize: 20, cursor: null })

  const loadMore = () => {
    const lastPost = posts[posts.length - 1]
    const cursor = { id: lastPost.id, createdAt: lastPost.createdAt }
    // Fetch next page with cursor...
  }
}
```

The cursor must include values for all `orderBy` fields.

### Code Generation

When you add/modify queries, the watcher auto-generates `src/data/generated/syncedQueries.ts`:

```ts
// Auto-generated - wraps queries with valibot validators
import * as v from 'valibot'
import { syncedQuery } from '@rocicorp/zero'
import * as postQueries from '../queries/post'

export const allPosts = syncedQuery(
  'allPosts',
  v.parser(v.tuple([
    v.object({ limit: v.optional(v.number()) })
  ])),
  (arg) => postQueries.allPosts(arg)
)
```

Run `bun dev` to watch, or manually with `bun zero:generate`.

---

## Mutations

### Model Schema & Permissions

Models in `src/data/models/` define table schemas, write permissions, and mutations:

```ts
// src/data/models/post.ts
import { boolean, number, string, table } from '@rocicorp/zero'
import { mutations, serverWhere } from 'over-zero'
import type { Post } from '../types'

// Schema definition
export const schema = table('post')
  .columns({
    id: string(),
    userId: string(),
    image: string(),
    caption: string().optional(),
    hiddenByAdmin: boolean(),
    commentCount: number(),
    createdAt: number(),
    updatedAt: number().optional(),
  })
  .primaryKey('id')

// Write permissions (enforced server-side only)
const permissions = serverWhere('post', (_, auth) => {
  return _.cmp('userId', auth?.id || '')
})

// Generate mutations
export const mutate = mutations(schema, permissions, {
  // Custom mutations go here...
})
```

### Auto-Generated CRUD

The `mutations()` function auto-generates CRUD operations:

```tsx
import { zero } from '~/zero/client'

// Create
await zero.mutate.post.insert({
  id: randomId(),
  userId: user.id,
  image: imageUrl,
  caption: 'Hello world',
  hiddenByAdmin: false,
  commentCount: 0,
  createdAt: Date.now(),
})

// Update
await zero.mutate.post.update({
  id: postId,
  caption: 'Updated caption',
  updatedAt: Date.now(),
})

// Delete
await zero.mutate.post.delete({ id: postId })

// Upsert
await zero.mutate.post.upsert(post)
```

Permissions are automatically checked on the server.

### Custom Mutations

Add custom mutations to the third argument:

```ts
export const mutate = mutations(schema, permissions, {
  // Override default insert with custom logic
  insert: async ({ tx, environment, server, authData }, post: Post) => {
    await tx.mutate.post.insert(post)

    // Server-only async task
    if (environment === 'server' && server && authData) {
      server.asyncTasks.push(() =>
        server.actions.analyticsActions().logEvent(
          authData.id,
          'post_created',
          { postId: post.id, hasImage: Boolean(post.image) }
        )
      )
    }
  },

  // Custom mutation
  async archive(ctx, props: { id: string }) {
    await ctx.can(permissions, props.id) // Check permission
    await ctx.tx.mutate.post.update({
      id: props.id,
      archived: true,
      updatedAt: Date.now(),
    })
  },
})
```

**Call custom mutations:**

```tsx
await zero.mutate.post.archive({ id: postId })
```

### Mutation Context

Every mutation receives `MutatorContext`:

```ts
type MutatorContext = {
  tx: Transaction              // Database transaction
  authData: AuthData | null    // Current user ({ id, role })
  environment: 'server' | 'client'
  can: (where, obj) => Promise<void>  // Permission checker
  server?: {
    actions: ServerActions     // Server-only functions
    asyncTasks: AsyncAction[]  // Run after transaction commits
  }
}
```

**Example usage:**

```ts
async customAction(ctx, props) {
  // Check permission
  await ctx.can(permissions, props.postId)

  // Update in transaction
  await ctx.tx.mutate.post.update({ id: props.postId, updated: true })

  // Queue async work (only on server)
  if (ctx.server) {
    ctx.server.asyncTasks.push(async () => {
      await ctx.server.actions.sendEmail(...)
      await ctx.server.actions.updateSearchIndex(...)
    })
  }
}
```

### Convergent Mutations

**Critical rule:** Mutations run on both client and server and must produce identical database state.

❌ **BAD (non-convergent):**

```ts
async insert(ctx, post) {
  await ctx.tx.mutate.post.insert({
    ...post,
    id: randomId(),        // Different on each run!
    createdAt: Date.now()  // Different timing!
  })
}
```

✅ **GOOD (convergent):**

```ts
async insert(ctx, post) {
  // Client generates values BEFORE calling mutation
  await ctx.tx.mutate.post.insert(post)

  // Server-only code doesn't affect data
  if (ctx.server) {
    ctx.server.asyncTasks.push(() => {
      // These CAN use Date.now(), randomId(), etc.
      ctx.server.actions.analytics.log({
        id: randomId(),
        timestamp: Date.now(),
        event: 'post_created',
      })
    })
  }
}
```

**Pattern 1: Pass IDs and timestamps from caller**

```tsx
// Caller generates values
await zero.mutate.post.insert({
  id: randomId(),           // Pre-generated
  createdAt: Date.now(),    // Pre-captured
  userId: currentUser.id,
  content: 'Hello',
})
```

**Pattern 2: Derive IDs deterministically**

```ts
async insertServer(ctx, server) {
  await ctx.tx.mutate.server.insert(server)

  // Derive child IDs from parent ID (same on client and server)
  const adminRoleId = `${server.id}-role-admin`
  const teamRoleId = `${server.id}-role-team`

  await ctx.tx.mutate.role.insert({
    id: adminRoleId,
    serverId: server.id,
    name: 'Admin',
    createdAt: server.createdAt, // Reuse parent timestamp
  })

  await ctx.tx.mutate.role.insert({
    id: teamRoleId,
    serverId: server.id,
    name: 'Team',
    createdAt: server.createdAt,
  })
}
```

**Pattern 3: Pass "next" IDs for follow-up entities**

```ts
// Caller pre-generates both IDs
await zero.mutate.message.send({
  id: randomId(),
  nextDraftId: randomId(), // For follow-up draft
  content: 'Hello',
  createdAt: Date.now(),
})

// Mutation uses pre-generated ID
async send(ctx, props: SendMessage) {
  const { nextDraftId, ...message } = props
  await ctx.tx.mutate.message.update(message)

  // Create next draft with pre-generated ID
  await ctx.tx.mutate.message.insert({
    id: nextDraftId, // Not generated here!
    channelId: message.channelId,
    creatorId: message.creatorId,
    ...
  })
}
```

### Optimistic vs Server-Confirmed

```tsx
// Optimistic: returns immediately
await zero.mutate.post.update(post)

// Server-confirmed: waits for server response
const result = await zero.mutate.post.update(post).server
```

---

## Permissions & Authorization

### Permission Model

Zero permissions use the `serverWhere()` helper:
- **Server-side:** Enforced as SQL WHERE clauses
- **Client-side:** Always pass (assume optimistic trust)

### Read Permissions (in Queries)

```ts
// src/data/queries/post.ts
import { serverWhere, zql } from 'over-zero'

// Public access
const permission = serverWhere('post', () => true)

// Authenticated users only
const permission = serverWhere('post', (q, auth) => {
  if (!auth) return false
  return true
})

// User's own posts
const permission = serverWhere('post', (q, auth) => {
  return q.cmp('userId', auth?.id || '')
})

// Admin or own posts
const permission = serverWhere('post', (q, auth) => {
  if (auth?.role === 'admin') return true
  return q.cmp('userId', auth?.id || '')
})

// Complex: published OR own posts
const permission = serverWhere('post', (q, auth) => {
  return q.or(
    q.cmp('published', '=', true),
    q.cmp('userId', '=', auth?.id || '')
  )
})

export const allPosts = () => zql.post.where(permission)
```

### Write Permissions (in Models)

```ts
// src/data/models/post.ts
const permissions = serverWhere('post', (q, auth) => {
  if (auth?.role === 'admin') return true
  return q.cmp('userId', auth?.id || '')
})

export const mutate = mutations(schema, permissions, {
  // Permissions auto-checked for generated CRUD
  // ...
})
```

### Permission Checks in Mutations

```ts
export const mutate = mutations(schema, permissions, {
  async customAction(ctx, props: { postId: string }) {
    // Explicit permission check
    await ctx.can(permissions, props.postId)

    // Proceeds only if user has permission
    await ctx.tx.mutate.post.update({ ... })
  },
})
```

### Permission Checks in React

```tsx
import { usePermission } from '~/zero/client'

function PostActions({ post }) {
  const canEdit = usePermission('post', post.id)

  if (!canEdit) return null

  return (
    <Button onPress={() => editPost(post)}>
      Edit
    </Button>
  )
}
```

### Reusable Permission Helpers

Extract common patterns to `src/data/where/`:

```ts
// src/data/where/isUsersOwn.ts
import { serverWhere } from 'over-zero'

export const isUsersOwn = serverWhere<'userPublic'>((q, auth) =>
  q.cmp('id', '=', auth?.id || '')
)

export const isAdminOrOwn = serverWhere<'post'>((q, auth) => {
  if (auth?.role === 'admin') return true
  return q.cmp('userId', '=', auth?.id || '')
})
```

**Use in queries:**

```ts
import { isUsersOwn } from '~/data/where/isUsersOwn'

export const currentUser = (props: { userId: string }) => {
  return zql.userPublic
    .where(isUsersOwn)
    .where('id', props.userId)
    .one()
}
```

---

## Schema Design

### Table Definitions

```ts
// src/data/models/comment.ts
import { number, string, table } from '@rocicorp/zero'

export const schema = table('comment')
  .columns({
    id: string(),
    postId: string(),
    userId: string(),
    text: string(),
    createdAt: number(),
    updatedAt: number().optional(),
  })
  .primaryKey('id')
```

**Column types:**
- `string()`, `number()`, `boolean()`
- `.optional()` - nullable column
- `.default(value)` - default value

### Relationships

Define in `src/data/relationships.ts`:

```ts
import { relationships } from '@rocicorp/zero'
import * as tables from './generated/tables'

// One-to-many: user has many posts
export const userRelationships = relationships(
  tables.userPublic,
  ({ one, many }) => ({
    posts: many({
      sourceField: ['id'],
      destSchema: tables.post,
      destField: ['userId'],
    }),
    state: one({
      sourceField: ['id'],
      destSchema: tables.userState,
      destField: ['userId'],
    }),
  })
)

// Many-to-one: post belongs to user
export const postRelationships = relationships(
  tables.post,
  ({ one, many }) => ({
    user: one({
      sourceField: ['userId'],
      destSchema: tables.userPublic,
      destField: ['id'],
    }),
    comments: many({
      sourceField: ['id'],
      destSchema: tables.comment,
      destField: ['postId'],
    }),
  })
)

export const allRelationships = [
  userRelationships,
  postRelationships,
]
```

### Querying Related Data

```ts
// Single level
export const postWithUser = (props: { postId: string }) => {
  return zql.post
    .where('id', props.postId)
    .one()
    .related('user')
}

// Nested relations
export const postWithComments = (props: { postId: string }) => {
  return zql.post
    .where('id', props.postId)
    .one()
    .related('user')
    .related('comments', (q) =>
      q.orderBy('createdAt', 'desc')
       .limit(50)
       .related('user')
    )
}
```

### Schema Assembly

```ts
// src/data/schema.ts
import { createSchema } from '@rocicorp/zero'
import * as tables from './generated/tables'
import { allRelationships } from './relationships'

export const schema = createSchema({
  tables: Object.values(tables),
  relationships: allRelationships,
  enableLegacyQueries: false,
})
```

### Indexes

Add to Postgres schema for frequently queried fields:

```sql
CREATE INDEX idx_post_user_id ON post(user_id);
CREATE INDEX idx_post_created_at ON post(created_at DESC);
CREATE INDEX idx_comment_post_id ON comment(post_id);
```

### Migration Patterns

Schema changes auto-migrate in development. For production:

```bash
bun migrate
```

This runs Drizzle migrations and updates Zero's CVR database.

---

## Offline Support

### Local Storage

Zero maintains a local replica using:
- **Web:** IndexedDB (`kvStore: 'idb'`)
- **Native:** SQLite (`kvStore: 'sqlite'`)
- **Anonymous/SSR:** Memory (`kvStore: 'mem'`)

### Sync Strategies

1. **Initial sync:** Client pulls initial data slice on connect
2. **Real-time updates:** Server pushes changes via WebSocket
3. **Optimistic mutations:** Apply locally, then sync to server
4. **Offline queue:** Mutations queue when offline, flush when reconnected

### Conflict Handling

Zero uses **last-write-wins** by default:
- Client applies mutation optimistically
- Server processes mutation and broadcasts result
- If conflict, server version wins and client rebases

**Avoid conflicts with convergent mutations:**
- Pass IDs/timestamps from caller
- Derive IDs deterministically
- Use server-only code for non-deterministic work

---

## Integration Patterns

### With React Components

```tsx
function PostDetail({ postId }) {
  const [post, status] = useQuery(postById, { postId })

  const handleLike = async () => {
    await zero.mutate.post.update({
      id: postId,
      likeCount: (post?.likeCount || 0) + 1,
    })
  }

  if (status.type === 'loading') return <Spinner />
  if (!post) return <Text>Not found</Text>

  return (
    <YStack>
      <Image src={post.image} />
      <Text>{post.caption}</Text>
      <Button onPress={handleLike}>
        Like ({post.likeCount})
      </Button>
    </YStack>
  )
}
```

### With Tamagui Forms

```tsx
import { useForm } from '@tamagui/form'
import { zero } from '~/zero/client'

function PostEditor({ postId }) {
  const [post] = useQuery(postById, { postId })

  const form = useForm({
    defaultValues: {
      caption: post?.caption || '',
    },
  })

  const handleSubmit = form.handleSubmit(async (values) => {
    await zero.mutate.post.update({
      id: postId,
      caption: values.caption,
      updatedAt: Date.now(),
    })
  })

  return (
    <Form onSubmit={handleSubmit}>
      <Input {...form.register('caption')} />
      <Button type="submit">Save</Button>
    </Form>
  )
}
```

### With Authentication

```tsx
// Client passes auth data to provider
<ProvideZero
  userID={user.id}
  auth={jwtToken}
  authData={{ id: user.id, role: user.role }}
>
  <App />
</ProvideZero>

// Permissions automatically use authData
const permission = serverWhere('post', (q, auth) => {
  // auth is typed as AuthData | null
  return q.cmp('userId', auth?.id || '')
})
```

---

## Server Actions

Server actions run **only server-side** for emails, webhooks, analytics, external APIs.

### Defining Actions

```ts
// src/data/server/createServerActions.ts
export const createServerActions = () => ({
  // Grouped actions
  analyticsActions: () => ({
    async logEvent(userId: string, event: string, data: any) {
      await fetch('https://analytics.example.com/event', {
        method: 'POST',
        body: JSON.stringify({ userId, event, data }),
      })
    },
  }),

  // Top-level actions
  async sendEmail(to: string, subject: string, body: string) {
    await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: { 'X-Postmark-Server-Token': process.env.POSTMARK_TOKEN },
      body: JSON.stringify({ to, subject, body }),
    })
  },

  async sendPushNotification(userId: string, message: string) {
    // Push notification logic...
  },
})
```

### Using in Mutations

```ts
export const mutate = mutations(schema, permissions, {
  insert: async ({ tx, server, authData }, post: Post) => {
    await tx.mutate.post.insert(post)

    if (server && authData) {
      // Async tasks run AFTER transaction commits
      server.asyncTasks.push(async () => {
        // Grouped action
        await server.actions.analyticsActions().logEvent(
          authData.id,
          'post_created',
          { postId: post.id }
        )

        // Top-level action
        await server.actions.sendEmail(
          authData.email,
          'Post created',
          `Your post ${post.id} was created`
        )
      })
    }
  },
})
```

### Async Tasks

**Critical:** Zero keeps the transaction open until your mutator resolves. Always use async tasks for long-running work:

```ts
if (ctx.server) {
  // ✅ GOOD: Non-blocking
  ctx.server.asyncTasks.push(async () => {
    await slowExternalAPI()
  })

  // ❌ BAD: Blocks transaction
  await slowExternalAPI()
}
```

Tasks run in parallel after the transaction commits.

---

## Performance

### Query Optimization

```ts
// ❌ BAD: N+1 query
function PostList({ posts }) {
  return posts.map(post => {
    const [user] = useQuery(userById, { userId: post.userId })
    return <PostCard post={post} user={user} />
  })
}

// ✅ GOOD: Single query with relation
function PostList() {
  const [posts] = useQuery(postsWithUsers)
  return posts.map(post => <PostCard post={post} user={post.user} />)
}
```

### Caching Strategies

Zero automatically caches queries. Use React memoization for expensive derivations:

```tsx
function PostStats({ post }) {
  // Zero recreates objects on updates
  const stats = useMemo(() => ({
    engagement: post.likeCount + post.commentCount,
    score: calculateComplexScore(post),
  }), [post.likeCount, post.commentCount, post.createdAt])

  return <Text>{stats.engagement}</Text>
}
```

### Bundle Considerations

Zero bundles the entire schema to the client. For large schemas:
- Split into multiple apps if needed
- Use code splitting for rarely-used tables
- Keep generated types in separate file

**Current Takeout bundle:**
- Models: ~15KB gzipped
- Generated types: ~8KB gzipped
- Runtime: ~120KB gzipped (shared across queries)

---

## Quick Reference

### Common Query Patterns

| Pattern | Code |
|---------|------|
| Get one | `zql.post.where('id', id).one()` |
| Get many | `zql.post.where(permission).limit(20)` |
| Order by | `.orderBy('createdAt', 'desc')` |
| Filter | `.where('userId', userId)` |
| Complex filter | `.where((eb) => eb.cmp('count', '>', 10))` |
| With relation | `.related('user')` |
| Paginate | `.start({ id, createdAt })` |

### Mutation Patterns

| Pattern | Code |
|---------|------|
| Create | `zero.mutate.post.insert(post)` |
| Update | `zero.mutate.post.update({ id, ...changes })` |
| Delete | `zero.mutate.post.delete({ id })` |
| Upsert | `zero.mutate.post.upsert(post)` |
| Custom | `zero.mutate.post.customAction({ ... })` |
| Server-confirmed | `await zero.mutate.post.update(post).server` |

### Permission Patterns

| Pattern | Code |
|---------|------|
| Public | `serverWhere('post', () => true)` |
| Authenticated | `serverWhere('post', (q, auth) => Boolean(auth))` |
| Own data | `serverWhere('post', (q, auth) => q.cmp('userId', auth?.id))` |
| Admin | `serverWhere('post', (q, auth) => auth?.role === 'admin')` |
| Admin or own | `serverWhere('post', (q, auth) => auth?.role === 'admin' \|\| q.cmp('userId', auth?.id))` |

### Status Types

```ts
type QueryStatus =
  | { type: 'loading' }
  | { type: 'error'; error: string }
  | { type: 'complete' }
```

### Debugging Commands

```bash
# Add to URL for detailed logs
?debug=2

# Drop all local databases (reset)
window.dropAllDatabases()

# Inspect Zero instance
window.zero

# Manual generation
bun zero:generate

# Database migrations
bun migrate
```

---

## Resources

- **Zero Docs:** https://zero.rocicorp.dev
- **over-zero:** https://github.com/tamagui/over-zero
- **Takeout examples:**
  - Models: `src/data/models/`
  - Queries: `src/data/queries/`
  - Schema: `src/data/schema.ts`
  - Client: `src/zero/client.tsx`
  - Server: `src/zero/server.ts`
