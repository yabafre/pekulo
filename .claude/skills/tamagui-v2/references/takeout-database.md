# Drizzle ORM Database Integration in Tamagui Takeout

## Overview

Tamagui Takeout uses **Drizzle ORM** as its database layer, providing type-safe database operations with PostgreSQL. Drizzle ORM is a lightweight, performant TypeScript ORM that emphasizes developer experience through excellent type inference and minimal runtime overhead.

### Why Takeout Uses Drizzle

- **Type Safety**: Full TypeScript support with automatic type inference from schema definitions
- **Zero Sync Integration**: Schema definitions work seamlessly with Zero Sync for real-time data synchronization
- **Performance**: Minimal runtime overhead with query generation at build time
- **Developer Experience**: SQL-like query builder that feels natural to TypeScript developers
- **Migration Support**: Built-in migration generation and management via `drizzle-kit`

### Core Concepts

1. **Schemas**: Table definitions using `pgTable` that define structure, columns, and constraints
2. **Queries**: Type-safe query builder for CRUD operations
3. **Migrations**: SQL migration files generated from schema changes
4. **Relations**: Explicit relationship definitions for joins and nested queries
5. **Connection Management**: Singleton database instance with connection pooling

## Setup & Configuration

### Installation

Takeout includes these Drizzle-related packages:

```json
{
  "dependencies": {
    "drizzle-orm": "^0.x.x",
    "pg": "^8.x.x"
  },
  "devDependencies": {
    "drizzle-kit": "^0.x.x",
    "@types/pg": "^8.x.x"
  }
}
```

### Database Connection

The database connection is configured in `src/database/index.ts`:

```typescript
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { ZERO_UPSTREAM_DB } from '~/server/env-server'
import * as schemaPrivate from './schema-private'
import * as schemaPublic from './schema-public'

const schema = {
  ...schemaPublic,
  ...schemaPrivate,
}

export const createPool = (connectionString?: string) => {
  const connStr = connectionString || ZERO_UPSTREAM_DB
  return new Pool({
    connectionString: connStr,
    // Handle self-signed certificates in production
    ssl: connStr?.includes('sslmode=require') 
      ? { rejectUnauthorized: false } 
      : undefined,
  })
}

export const createDb = () => {
  const pool = createPool()
  return drizzle(pool, {
    schema,
    logger: false, // Set to true for query logging during development
  })
}

// Singleton pattern for database instance
let db: ReturnType<typeof createDb>

export const getDb = () => {
  if (!db) {
    db = createDb()
  }
  return db
}
```

### Drizzle Config File

Configuration for `drizzle-kit` CLI is in `src/database/drizzle.config.ts`:

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/database/schema.ts',
  out: './src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.ZERO_UPSTREAM_DB!,
  },
  strict: true, // Enable strict mode for safer migrations
})
```

### Environment Variables

Required environment variables:

```bash
# PostgreSQL connection string
ZERO_UPSTREAM_DB=postgresql://user:password@localhost:5432/dbname

# For production with SSL
ZERO_UPSTREAM_DB=postgresql://user:password@host:5432/dbname?sslmode=require
```

## Schema Definition

Takeout uses a **dual-schema architecture** separating public and private data:

### Public Schema (`schema-public.ts`)

Public data synchronized with Zero Sync for real-time updates:

```typescript
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'

export const userPublic = pgTable('userPublic', {
  id: text('id').primaryKey(),
  name: text('name'),
  username: text('username'),
  image: text('image'),
  joinedAt: timestamp('joinedAt', { mode: 'string' }).defaultNow().notNull(),
  hasOnboarded: boolean('hasOnboarded').notNull().default(false),
  whitelisted: boolean('whitelisted').notNull().default(false),
  migrationVersion: integer('migrationVersion').notNull().default(0),
  postsCount: integer('postsCount').notNull().default(0),
})

export const userState = pgTable('userState', {
  userId: text('userId').primaryKey(),
  darkMode: boolean('darkMode').notNull().default(false),
  locale: text('locale').notNull().default('en'),
  timeZone: text('timeZone').notNull().default('UTC'),
  onlineStatus: text('onlineStatus').notNull().default('online'),
  lastNotificationReadAt: timestamp('lastNotificationReadAt', { mode: 'string' }),
})

export const post = pgTable(
  'post',
  {
    id: text('id').primaryKey(),
    userId: text('userId').notNull(),
    image: text('image').notNull(),
    caption: text('caption'),
    hiddenByAdmin: boolean('hiddenByAdmin').notNull().default(false),
    commentCount: integer('commentCount').notNull().default(0),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updatedAt', { mode: 'string' }),
  },
  (table) => [
    index('post_userId_idx').on(table.userId),
    index('post_createdAt_idx').on(table.createdAt),
  ]
)

export const comment = pgTable(
  'comment',
  {
    id: text('id').primaryKey(),
    postId: text('postId').notNull(),
    userId: text('userId').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    index('comment_postId_idx').on(table.postId),
    index('comment_userId_idx').on(table.userId),
  ]
)

export const block = pgTable(
  'block',
  {
    id: text('id').primaryKey(),
    blockerId: text('blockerId').notNull(),
    blockedId: text('blockedId').notNull(),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    unique('block_blocker_blocked_unique').on(table.blockerId, table.blockedId),
    index('block_blockerId_idx').on(table.blockerId),
    index('block_blockedId_idx').on(table.blockedId),
  ]
)
```

### Private Schema (`schema-private.ts`)

Authentication and sensitive data NOT synchronized with Zero Sync:

```typescript
import { pgTable } from 'drizzle-orm/pg-core'
import type { InferSelectModel } from 'drizzle-orm'

export const user = pgTable('user', (t) => ({
  id: t.varchar('id').primaryKey(),
  username: t.varchar('username', { length: 200 }),
  name: t.varchar('name', { length: 200 }),
  email: t.varchar('email', { length: 200 }).notNull().unique(),
  normalizedEmail: t.varchar('normalizedEmail', { length: 200 }).unique(),
  updatedAt: t.timestamp('updatedAt', { mode: 'string' }).defaultNow(),
  emailVerified: t.boolean('emailVerified').default(false).notNull(),
  image: t.text('image'),
  createdAt: t.timestamp('createdAt', { mode: 'string' }).defaultNow(),
  role: t.varchar('role').default('user').notNull(),
  banned: t.boolean('banned').default(false).notNull(),
  banReason: t.varchar('banReason'),
  banExpires: t.bigint('banExpires', { mode: 'number' }),
}))

export type UserPrivate = InferSelectModel<typeof user>

export const account = pgTable('account', (t) => ({
  id: t.text('id').primaryKey().notNull(),
  accountId: t.text('accountId').notNull(),
  providerId: t.text('providerId').notNull(),
  userId: t
    .text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: t.text('accessToken'),
  refreshToken: t.text('refreshToken'),
  idToken: t.text('idToken'),
  accessTokenExpiresAt: t.timestamp('accessTokenExpiresAt', { mode: 'string' }),
  refreshTokenExpiresAt: t.timestamp('refreshTokenExpiresAt', { mode: 'string' }),
  scope: t.text('scope'),
  password: t.text('password'),
  createdAt: t.timestamp('createdAt', { mode: 'string' }).notNull(),
  updatedAt: t.timestamp('updatedAt', { mode: 'string' }).notNull(),
}))

export const session = pgTable('session', (t) => ({
  id: t.text('id').primaryKey().notNull(),
  expiresAt: t.timestamp('expiresAt', { mode: 'string' }).notNull(),
  token: t.text('token').notNull(),
  createdAt: t.timestamp('createdAt', { mode: 'string' }).notNull(),
  updatedAt: t.timestamp('updatedAt', { mode: 'string' }).notNull(),
  ipAddress: t.text('ipAddress'),
  userAgent: t.text('userAgent'),
  userId: t
    .text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  impersonatedBy: t.varchar('impersonatedBy'),
}))
```

### Column Types

Common column types in Takeout:

| Type | Usage | Example |
|------|-------|---------|
| `text()` | Unlimited text, IDs | `id: text('id').primaryKey()` |
| `varchar(length)` | Limited text | `email: t.varchar('email', { length: 200 })` |
| `boolean()` | True/false | `emailVerified: t.boolean('emailVerified')` |
| `integer()` | Whole numbers | `postsCount: integer('postsCount')` |
| `bigint()` | Large numbers | `banExpires: t.bigint('banExpires', { mode: 'number' })` |
| `timestamp()` | Dates/times | `createdAt: timestamp('createdAt', { mode: 'string' })` |

### Default Values and Constraints

```typescript
// NOT NULL constraint
email: t.varchar('email').notNull()

// DEFAULT value
hasOnboarded: boolean('hasOnboarded').notNull().default(false)

// UNIQUE constraint
email: t.varchar('email').unique()

// DEFAULT NOW for timestamps
createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull()

// FOREIGN KEY with cascade delete
userId: t.text('userId')
  .notNull()
  .references(() => user.id, { onDelete: 'cascade' })
```

## Relationships

Drizzle uses explicit relationship definitions in separate files:

### Public Relations (`relations-public.ts`)

```typescript
import { relations } from 'drizzle-orm/relations'
import { userPublic, userState, post, block, report, device } from './schema-public'

export const userPublicRelations = relations(userPublic, ({ one, many }) => ({
  // One-to-one
  state: one(userState, {
    fields: [userPublic.id],
    references: [userState.userId],
  }),
  
  // One-to-many
  posts: many(post),
  devices: many(device),
  
  // Self-referential many-to-many (blocking)
  blocking: many(block, {
    relationName: 'blocker',
  }),
  blockedBy: many(block, {
    relationName: 'blocked',
  }),
}))

export const postRelations = relations(post, ({ one, many }) => ({
  user: one(userPublic, {
    fields: [post.userId],
    references: [userPublic.id],
  }),
  reports: many(report),
}))

export const blockRelations = relations(block, ({ one }) => ({
  blocker: one(userPublic, {
    fields: [block.blockerId],
    references: [userPublic.id],
    relationName: 'blocker',
  }),
  blocked: one(userPublic, {
    fields: [block.blockedId],
    references: [userPublic.id],
    relationName: 'blocked',
  }),
}))
```

### Private Relations (`relations-private.ts`)

```typescript
import { relations } from 'drizzle-orm/relations'
import { account, session, user } from './schema-private'

export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
  sessions: many(session),
}))

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}))
```

## Queries

### Select Queries

Basic select operations:

```typescript
import { eq, and, or, gt, lt, like, isNull } from 'drizzle-orm'
import { getDb } from '~/database'
import { userPublic, post } from '~/database/schema-public'

const db = getDb()

// Select all columns
const allUsers = await db.select().from(userPublic)

// Select specific columns
const usernames = await db
  .select({
    id: userPublic.id,
    username: userPublic.username,
  })
  .from(userPublic)

// Where clause with single condition
const user = await db
  .select()
  .from(userPublic)
  .where(eq(userPublic.id, userId))
  .limit(1)

// Where clause with AND conditions
const activeWhitelistedUsers = await db
  .select()
  .from(userPublic)
  .where(
    and(
      eq(userPublic.whitelisted, true),
      eq(userPublic.hasOnboarded, true)
    )
  )

// Where clause with OR conditions
const moderators = await db
  .select()
  .from(user)
  .where(
    or(
      eq(user.role, 'admin'),
      eq(user.role, 'moderator')
    )
  )

// Complex conditions
const recentPosts = await db
  .select()
  .from(post)
  .where(
    and(
      eq(post.hiddenByAdmin, false),
      gt(post.createdAt, '2024-01-01'),
      isNull(post.updatedAt)
    )
  )

// LIKE pattern matching
const searchUsers = await db
  .select()
  .from(userPublic)
  .where(like(userPublic.username, '%search%'))
```

### Insert Operations

```typescript
// Insert single record
await db.insert(userPublic).values({
  id: userId,
  name: 'John Doe',
  username: 'johndoe',
  image: 'https://example.com/avatar.jpg',
  joinedAt: new Date().toISOString(),
  hasOnboarded: false,
  whitelisted: false,
  migrationVersion: 0,
  postsCount: 0,
})

// Insert multiple records
const whitelistEntries = emails.map((email) => ({
  id: crypto.randomUUID(),
  email,
}))

await db
  .insert(whitelist)
  .values(whitelistEntries)

// Insert with conflict handling
await db
  .insert(whitelist)
  .values(whitelistEntries)
  .onConflictDoNothing() // Ignore duplicates

// Insert and return inserted data
const inserted = await db
  .insert(whitelist)
  .values(whitelistEntries)
  .onConflictDoNothing()
  .returning()

// Insert with conditional default
await db.insert(userState).values({
  userId,
  darkMode: false,
  locale: 'en',
  timeZone: 'UTC',
  onlineStatus: 'online',
})
```

### Update Operations

```typescript
// Simple update
await db
  .update(userPublic)
  .set({ hasOnboarded: true })
  .where(eq(userPublic.id, userId))

// Update multiple fields
await db
  .update(userTable)
  .set({
    role: 'admin',
    username: 'admin',
    image: 'https://example.com/admin.jpg',
  })
  .where(eq(userTable.id, userId))

// Update with computed values
await db
  .update(userPublic)
  .set({ whitelisted: true })
  .where(eq(userPublic.id, user.id))

// Conditional update
const whereCondition = excludeUserId
  ? and(eq(userPublic.username, username), ne(userPublic.id, excludeUserId))
  : eq(userPublic.username, username)

await db
  .update(userPublic)
  .set({ username: newUsername })
  .where(whereCondition)
```

### Delete Operations

```typescript
// Simple delete
await db
  .delete(post)
  .where(eq(post.userId, userId))

// Delete with cascade (handled by foreign key constraints)
await db
  .delete(userTable)
  .where(eq(userTable.id, userId))
// This cascades to account and session tables

// Bulk delete
await db
  .delete(userState)
  .where(eq(userState.userId, userId))
```

### Raw SQL

For complex queries not easily expressed in the query builder:

```typescript
import { sql } from 'drizzle-orm'

// Raw SQL query
const result = await db.execute(
  sql`SELECT COUNT(*) FROM "post" WHERE "userId" = ${userId}`
)

// Use sql template in where clauses
const users = await db
  .select()
  .from(userPublic)
  .where(sql`LOWER(${userPublic.email}) = LOWER(${email})`)
```

## Query Builder

### Where Clauses

Available operators:

```typescript
import { eq, ne, gt, gte, lt, lte, isNull, isNotNull, like, ilike, inArray, notInArray, between, and, or, not } from 'drizzle-orm'

// Equality
eq(userPublic.id, userId)
ne(userPublic.id, excludeId)

// Comparison
gt(post.createdAt, startDate)
gte(user.banExpires, Date.now())
lt(post.commentCount, 100)
lte(userPublic.migrationVersion, 5)

// Null checks
isNull(post.updatedAt)
isNotNull(userPublic.username)

// Pattern matching
like(userPublic.username, '%search%')
ilike(userPublic.email, '%@gmail.com') // Case-insensitive

// Array operations
inArray(userPublic.id, [id1, id2, id3])
notInArray(post.userId, blockedUserIds)

// Range
between(post.createdAt, startDate, endDate)

// Logical operators
and(condition1, condition2, condition3)
or(condition1, condition2)
not(condition)
```

### Joins

```typescript
// Inner join (using relations)
const postsWithUsers = await db.query.post.findMany({
  with: {
    user: true,
  },
})

// Manual join
const results = await db
  .select({
    postId: post.id,
    caption: post.caption,
    userName: userPublic.name,
    username: userPublic.username,
  })
  .from(post)
  .innerJoin(userPublic, eq(post.userId, userPublic.id))

// Left join
const allPosts = await db
  .select()
  .from(post)
  .leftJoin(userPublic, eq(post.userId, userPublic.id))
```

### Aggregations

```typescript
import { count, sum, avg, min, max } from 'drizzle-orm'

// Count
const userCount = await db
  .select({ count: count() })
  .from(userPublic)

// Count with condition
const activeUsers = await db
  .select({ count: count() })
  .from(userPublic)
  .where(eq(userPublic.hasOnboarded, true))

// Sum
const totalPosts = await db
  .select({ total: sum(userPublic.postsCount) })
  .from(userPublic)

// Average
const avgComments = await db
  .select({ average: avg(post.commentCount) })
  .from(post)

// Group by
const postsByUser = await db
  .select({
    userId: post.userId,
    count: count(),
  })
  .from(post)
  .groupBy(post.userId)
```

### Subqueries

```typescript
// Subquery in WHERE clause
const topPosters = db
  .select({ userId: post.userId })
  .from(post)
  .groupBy(post.userId)
  .having(gt(count(), 10))

const activeUsers = await db
  .select()
  .from(userPublic)
  .where(inArray(userPublic.id, topPosters))
```

### Ordering and Pagination

```typescript
// Order by single column
const recentPosts = await db
  .select()
  .from(post)
  .orderBy(post.createdAt) // ASC by default

// Order descending
import { desc } from 'drizzle-orm'

const recentPosts = await db
  .select()
  .from(post)
  .orderBy(desc(post.createdAt))

// Multiple order columns
import { asc } from 'drizzle-orm'

const sortedUsers = await db
  .select()
  .from(userPublic)
  .orderBy(asc(userPublic.username), desc(userPublic.joinedAt))

// Pagination with limit/offset
const pageSize = 20
const pageNumber = 2

const paginatedPosts = await db
  .select()
  .from(post)
  .orderBy(desc(post.createdAt))
  .limit(pageSize)
  .offset(pageSize * (pageNumber - 1))

// Single result
const user = await db
  .select()
  .from(userPublic)
  .where(eq(userPublic.id, userId))
  .limit(1)
```

## Migrations

### Creating Migrations

Takeout uses automated migration generation:

```bash
# Generate migration from schema changes
bun run scripts/db/generate-drizzle.ts
# or
bunx drizzle-kit generate
```

This creates SQL files in `src/database/migrations/`:

```sql
-- Example: 0002_add_comments.sql
ALTER TABLE "post" ADD COLUMN "commentCount" integer NOT NULL DEFAULT 0;

CREATE TABLE "comment" (
  "id" text PRIMARY KEY,
  "postId" text NOT NULL REFERENCES "post"("id") ON DELETE CASCADE,
  "userId" text NOT NULL REFERENCES "userPublic"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "comment_postId_idx" ON "comment"("postId");
CREATE INDEX "comment_userId_idx" ON "comment"("userId");
```

### Running Migrations

```bash
# Apply pending migrations
bun run scripts/db/migrate-drizzle.ts

# Dry run (see what would be executed)
bun run scripts/db/migrate-drizzle.ts --dry-run
```

### Migration Best Practices

1. **Review Generated SQL**: Always check the generated migration before applying
2. **Add Indexes**: Include indexes for foreign keys and frequently queried columns
3. **Use Transactions**: Drizzle migrations run in transactions by default
4. **Test Rollbacks**: Have a rollback plan for each migration
5. **Avoid Breaking Changes**: Use multi-step migrations for schema changes:
   - Step 1: Add new column (nullable)
   - Step 2: Backfill data
   - Step 3: Make column NOT NULL

### Advanced Migrations with Triggers

Takeout uses PostgreSQL triggers for computed columns:

```sql
-- Trigger function for commentCount
CREATE OR REPLACE FUNCTION update_post_comment_count()
RETURNS TRIGGER AS $$
DECLARE
  target_post_id text;
  new_count integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_post_id := OLD."postId";
  ELSE
    target_post_id := NEW."postId";
  END IF;

  -- Check post exists (cascade delete safety)
  IF NOT EXISTS (SELECT 1 FROM "post" WHERE "id" = target_post_id) THEN
    RETURN NULL;
  END IF;

  -- Calculate new count
  SELECT COUNT(*) INTO new_count
  FROM "comment"
  WHERE "postId" = target_post_id;

  -- Update post
  UPDATE "post"
  SET "commentCount" = new_count
  WHERE "id" = target_post_id;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER post_comment_count_trigger
AFTER INSERT OR DELETE ON "comment"
FOR EACH ROW
EXECUTE FUNCTION update_post_comment_count();
```

## Integration with Zero Sync

Takeout integrates Drizzle with Zero Sync for real-time data synchronization.

### Schema Separation Strategy

- **Public Schema**: Tables in `schema-public.ts` are synchronized via Zero Sync
- **Private Schema**: Tables in `schema-private.ts` remain server-side only

### Type Consistency

Both systems share the same table definitions:

```typescript
// Drizzle schema definition
export const userPublic = pgTable('userPublic', {
  id: text('id').primaryKey(),
  name: text('name'),
  username: text('username'),
  // ...
})

// Type inference for use across the app
export type UserPublic = InferSelectModel<typeof userPublic>
```

### Sync Considerations

1. **No Foreign Keys in Public Schema**: Zero Sync tables use application-level relationships
2. **String Timestamps**: Use `{ mode: 'string' }` for Zero Sync compatibility
3. **Explicit IDs**: Always use explicit ID generation (UUIDs, nanoid)
4. **Denormalization**: Public schema often denormalizes for sync efficiency (e.g., `postsCount`)

## Performance

### Query Optimization

1. **Use Indexes**: Add indexes to foreign keys and frequently queried columns

```typescript
export const post = pgTable(
  'post',
  {
    // columns...
  },
  (table) => [
    index('post_userId_idx').on(table.userId),
    index('post_createdAt_idx').on(table.createdAt),
  ]
)
```

2. **Limit Result Sets**: Always use `.limit()` for potentially large queries

```typescript
const recentPosts = await db
  .select()
  .from(post)
  .orderBy(desc(post.createdAt))
  .limit(50) // Prevent fetching entire table
```

3. **Select Only Needed Columns**: Don't select `*` when you only need specific fields

```typescript
// Bad
const users = await db.select().from(userPublic)

// Good
const usernames = await db
  .select({
    id: userPublic.id,
    username: userPublic.username,
  })
  .from(userPublic)
```

4. **Use Relations for Joins**: Let Drizzle optimize join queries

```typescript
// Use the query API with relations
const postsWithUsers = await db.query.post.findMany({
  with: {
    user: true,
  },
  where: eq(post.hiddenByAdmin, false),
  limit: 20,
})
```

### Connection Pooling

Takeout uses `pg.Pool` for connection management:

```typescript
export const createPool = (connectionString?: string) => {
  return new Pool({
    connectionString,
    // Default pool size is 10
    // Customize as needed:
    // max: 20,
    // idleTimeoutMillis: 30000,
    // connectionTimeoutMillis: 2000,
  })
}
```

### Prepared Statements

Drizzle automatically uses prepared statements for parameterized queries:

```typescript
// This creates a prepared statement
const getUser = db
  .select()
  .from(userPublic)
  .where(eq(userPublic.id, userId))
  .prepare('get_user')

// Reuse the prepared statement
const user1 = await getUser.execute()
const user2 = await getUser.execute()
```

### Indexing Strategies

1. **Primary Keys**: Automatically indexed
2. **Foreign Keys**: Always add indexes for foreign key columns
3. **Unique Constraints**: Create unique indexes for uniqueness checks
4. **Composite Indexes**: For queries filtering on multiple columns

```typescript
export const block = pgTable(
  'block',
  {
    id: text('id').primaryKey(),
    blockerId: text('blockerId').notNull(),
    blockedId: text('blockedId').notNull(),
    createdAt: timestamp('createdAt', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [
    // Composite unique constraint
    unique('block_blocker_blocked_unique').on(table.blockerId, table.blockedId),
    // Individual indexes for foreign keys
    index('block_blockerId_idx').on(table.blockerId),
    index('block_blockedId_idx').on(table.blockedId),
  ]
)
```

## Quick Reference

### Column Types Reference

| Drizzle Type | PostgreSQL | TypeScript | Use Case |
|--------------|------------|------------|----------|
| `text()` | TEXT | string | IDs, unlimited text |
| `varchar(n)` | VARCHAR(n) | string | Limited text (emails, names) |
| `boolean()` | BOOLEAN | boolean | Flags, status |
| `integer()` | INTEGER | number | Counts, small numbers |
| `bigint()` | BIGINT | number/bigint | Large numbers, timestamps |
| `timestamp()` | TIMESTAMP | Date/string | Dates and times |
| `serial()` | SERIAL | number | Auto-increment IDs |
| `uuid()` | UUID | string | UUID primary keys |
| `json()` | JSON | any | JSON data |
| `jsonb()` | JSONB | any | Queryable JSON |

### Common Query Patterns

```typescript
// Find by ID
const user = await db.query.userPublic.findFirst({
  where: eq(userPublic.id, userId),
})

// Find many with conditions
const posts = await db.query.post.findMany({
  where: and(
    eq(post.userId, userId),
    eq(post.hiddenByAdmin, false)
  ),
  orderBy: desc(post.createdAt),
  limit: 20,
})

// Count records
const count = await db
  .select({ count: sql<number>`count(*)` })
  .from(post)
  .where(eq(post.userId, userId))

// Exists check
const exists = await db
  .select({ exists: sql<boolean>`exists(select 1)` })
  .from(userPublic)
  .where(eq(userPublic.username, username))

// Transaction
await db.transaction(async (tx) => {
  await tx.insert(userPublic).values(userData)
  await tx.insert(userState).values(stateData)
})
```

### Migration Commands

```bash
# Generate migration from schema changes
bunx drizzle-kit generate

# Apply migrations
bun run scripts/db/migrate-drizzle.ts

# Push schema directly (development only, skips migrations)
bunx drizzle-kit push

# Open Drizzle Studio (database GUI)
bunx drizzle-kit studio

# Drop all tables (destructive!)
bunx drizzle-kit drop
```

### Import Cheatsheet

```typescript
// Schema definition
import { pgTable, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core'

// Query operators
import { eq, ne, gt, gte, lt, lte, and, or, not, isNull, like, inArray } from 'drizzle-orm'

// Ordering and aggregation
import { asc, desc, count, sum, avg, min, max } from 'drizzle-orm'

// Relations
import { relations } from 'drizzle-orm/relations'

// Type inference
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'

// SQL template
import { sql } from 'drizzle-orm'

// Database connection
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
```

---

**Last Updated**: January 2026  
**Drizzle ORM Version**: 0.x  
**Takeout Version**: 2.0
