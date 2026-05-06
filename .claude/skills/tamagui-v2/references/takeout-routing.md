# One.js Routing (Takeout)

> File-based routing for web and native with server-side data loading

## Overview

One.js (from [onestack.dev](https://onestack.dev)) is the routing framework used in Tamagui Takeout. It provides file-system routing with SSG/SSR/SPA modes, type-safe navigation, and server-side data loading that works seamlessly across web and native platforms.

## File-Based Routing

All routes live in the `app/` directory. Files export a React component (prefer named exports for better hot reloading).

### Route Structure

```
app/
  _layout.tsx              # Root layout
  index.tsx                # / (home page)
  about.tsx                # /about
  blog/
    index.tsx              # /blog
    [slug].tsx             # /blog/my-post (dynamic)
  catalog/
    [...rest].tsx          # /catalog/a/b/c (catch-all)
  (legal)/                 # Route group (invisible in URL)
    privacy-policy.tsx     # /privacy-policy
    terms.tsx              # /terms
  +not-found.tsx           # Custom 404 page
```

**Important:** Avoid intermediate imports in route files. Use inline re-export syntax:

```tsx
// ❌ Bad
import { ComponentName } from '~/features/...'
export default ComponentName

// ✅ Good
export { ComponentName as default } from '~/features/...'
```

### Route Types

#### Simple Routes

```tsx
// app/index.tsx → /
// app/about.tsx → /about
// app/blog/index.tsx → /blog

export default function AboutPage() {
  return <Text>About Us</Text>
}
```

#### Dynamic Routes

Use `[param]` syntax for dynamic segments:

```tsx
// app/blog/[slug].tsx → /blog/hello-world

import { useParams } from 'one'

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>()
  return <Text>Post: {slug}</Text>
}
```

#### Catch-All Routes

Use `[...rest]` for catch-all segments:

```tsx
// app/catalog/[...rest].tsx → /catalog/a/b/c

import { useParams } from 'one'

export default function CatalogPage() {
  const { rest } = useParams<{ rest: string[] }>()
  // rest = ['a', 'b', 'c']
  return <Text>Path: {rest.join('/')}</Text>
}
```

#### Route Groups

Use `(groupName)` to organize routes without affecting URLs:

```tsx
// app/(legal)/privacy-policy.tsx → /privacy-policy
// app/(legal)/terms.tsx → /terms
// Useful for shared layouts without URL nesting
```

#### Platform-Specific Routes

Use platform extensions to create platform-specific routes:

```tsx
// app/login.native.tsx     # Native only
// app/login.web.tsx        # Web only
// app/login.ios.tsx        # iOS only
// app/login.android.tsx    # Android only
```

**Example:**

```tsx
// app/(app)/auth/login.native.tsx
export default function NativeLogin() {
  return <BiometricAuth />
}

// app/(app)/auth/login.tsx (fallback for web)
export default function WebLogin() {
  return <PasswordForm />
}
```

## Layouts

Layouts frame routes in a directory and can nest inside each other. Must render one of: `Slot`, `Stack`, `Tabs`, or `Drawer`.

### Root Layout

```tsx
// app/_layout.tsx
import { Slot } from 'one'

export default function Layout() {
  return (
    <html lang="en-US">
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.svg" />
      </head>
      <body>
        <Slot />
      </body>
    </html>
  )
}
```

### Slot

Renders children directly without frame. Simplest layout option:

```tsx
// app/(app)/_layout.tsx
import { Slot } from 'one'

export default function AppLayout() {
  return (
    <>
      <Header />
      <Slot />
      <Footer />
    </>
  )
}
```

### Stack Navigation

React Navigation native stack for iOS/Android with configurable screens:

```tsx
// app/home/_layout.tsx
import { Stack } from 'one'

export default function HomeLayout() {
  return (
    <Stack screenOptions={{ headerRight: () => <SettingsButton /> }}>
      <Stack.Screen name="index" options={{ title: 'Feed' }} />
      <Stack.Screen name="[id]" options={{ title: 'Post' }} />
      <Stack.Screen
        name="sheet"
        options={{
          presentation: 'formSheet',
          animation: 'slide_from_bottom',
          headerShown: false,
        }}
      />
    </Stack>
  )
}
```

**Common Stack Options:**

```tsx
type StackOptions = {
  presentation?: 'card' | 'modal' | 'transparentModal' | 'containedModal' 
    | 'containedTransparentModal' | 'fullScreenModal' | 'formSheet'
  animation?: 'default' | 'fade' | 'fade_from_bottom' | 'flip' 
    | 'simple_push' | 'slide_from_bottom' | 'slide_from_right' 
    | 'slide_from_left' | 'none'
  headerShown?: boolean
  title?: string
  headerRight?: () => ReactElement
  headerLeft?: () => ReactElement
  headerStyle?: object
  headerTintColor?: string
}
```

### Tab Navigation (Native)

React Navigation bottom tabs for native. Must set `href` on each screen:

```tsx
// app/(app)/home/(tabs)/_layout.native.tsx
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { withLayoutContext } from 'one'

const Tab = createBottomTabNavigator()
const Tabs = withLayoutContext(Tab.Navigator)

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="feed"
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="ai" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="profile" />
    </Tabs>
  )
}
```

**Web alternative (using Slot):**

```tsx
// app/(app)/home/(tabs)/_layout.tsx
import { Slot } from 'one'

export default function TabsLayout() {
  return (
    <>
      <Header />
      <Slot />
      <BottomTabBar />
    </>
  )
}
```

### Nested Layouts

Layouts can nest for complex navigation patterns (e.g., tabs with stacks):

```tsx
// app/_layout.tsx (Root: Tabs)
import { Tabs } from 'one'

export default function RootLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home" options={{ title: 'Feed', href: '/' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', href: '/profile' }} />
    </Tabs>
  )
}

// app/home/_layout.tsx (Nested: Stack inside Feed tab)
import { Stack, Slot } from 'one'

export default function FeedLayout() {
  return typeof window !== 'undefined' ? (
    <Slot /> // Web: use browser navigation
  ) : (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Feed' }} />
      <Stack.Screen name="post-[id]" options={{ title: 'Post' }} />
    </Stack>
  )
}
```

### Platform-Specific Layouts

Create separate layouts for web and native:

```tsx
// app/settings/_layout.native.tsx
import { Stack } from 'one'

export default function SettingsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
      <Stack.Screen name="edit-profile" />
    </Stack>
  )
}

// app/settings/_layout.tsx (web fallback)
import { Slot } from 'one'

export default function SettingsLayout() {
  return <Slot /> // Use browser back button
}
```

### Custom Layouts with withLayoutContext

Wrap any React Navigation navigator:

```tsx
import { createNativeBottomTabNavigator } from '@bottom-tabs/react-navigation'
import { withLayoutContext } from 'one'

const NativeTabsNavigator = createNativeBottomTabNavigator().Navigator
export const NativeTabs = withLayoutContext(NativeTabsNavigator)

// Use in layout
export default function Layout() {
  return (
    <NativeTabs>
      <NativeTabs.Screen name="home" />
    </NativeTabs>
  )
}
```

### Layout Limitations

- Layouts don't support loaders (yet)
- `useParams()` won't work in layouts
- Use `useActiveParams()` instead for accessing URL params in layouts

## Navigation

### Link Component

Type-safe navigation component for web and native:

```tsx
import { Link } from 'one'

// Basic navigation
<Link href="/blog">Go to Blog</Link>

// Dynamic routes (type-safe)
<Link href={`/user/${userId}`}>User Profile</Link>

// Replace history
<Link href="/login" replace>Login</Link>

// External link
<Link href="https://example.com" target="_blank" rel="noopener">
  External Site
</Link>

// Forward to custom component
<Link href="/about" asChild>
  <CustomButton>About Us</CustomButton>
</Link>
```

**Link Props:**

```tsx
type LinkProps = {
  href: Href                    // Type-safe route path
  asChild?: boolean             // Forward props to child
  replace?: boolean             // Replace history instead of push
  push?: boolean                // Explicitly push to history
  className?: string            // Web class, native CSS interop
  target?: string               // Web-only (_blank, _self, etc.)
  rel?: string                  // Web-only (nofollow, noopener, etc.)
  download?: boolean | string   // Web-only download attribute
}
```

### useRouter Hook

Programmatic navigation:

```tsx
import { useRouter } from 'one'

export default function Component() {
  const router = useRouter()

  return (
    <>
      <Button onPress={() => router.push('/profile')}>
        Go to Profile
      </Button>
      <Button onPress={() => router.back()}>
        Go Back
      </Button>
      <Button onPress={() => router.replace('/home')}>
        Replace with Home
      </Button>
      <Button onPress={() => router.setParams({ tab: 'settings' })}>
        Update Params
      </Button>
      {/* Native only */}
      <Button onPress={() => router.dismiss()}>
        Dismiss Modal
      </Button>
    </>
  )
}
```

**Router API:**

```tsx
type Router = {
  back: () => void
  canGoBack: () => boolean
  push: (href: Href, options?: LinkToOptions) => void
  navigate: (href: Href, options?: LinkToOptions) => void
  replace: (href: Href, options?: LinkToOptions) => void
  dismiss: (count?: number) => void              // Native only
  dismissAll: () => void                          // Native only
  canDismiss: () => boolean                       // Native only
  setParams: (params?: Record<string, string | undefined | null>) => void
  subscribe: (listener: RootStateListener) => () => void
  onLoadState: (listener: LoadingStateListener) => () => void
}
```

### useParams Hook

Access route parameters:

```tsx
import { useParams } from 'one'

export default function PostPage() {
  const { slug } = useParams<{ slug: string }>()
  return <Text>Post: {slug}</Text>
}
```

### Type-Safe href() Helper

Type-level validation for routes:

```tsx
import { href } from 'one'

const postLink = href('/blog/hello-world')     // ✅ Type-checked
const invalidLink = href('/invalid/route')     // ❌ Type error
```

## Loaders (Server-Side Data Loading)

Server-side data loading that runs at build-time (SSG), request-time (SSR), or load-time (SPA). Tree-shaken from client bundles.

### Basic Usage

```tsx
import { useLoader } from 'one'

export async function loader({ params, path, request }) {
  // Server-only code - can access secrets
  const user = await getUser(params.id)
  return { greet: `Hello ${user.name}` }
}

export default function Page() {
  const data = useLoader(loader) // Automatically type-safe
  return <Text>{data.greet}</Text>
}
```

### Loader Arguments

```tsx
type LoaderArgs = {
  params: Record<string, string>  // Dynamic route segments
  path: string                    // Full pathname
  request: Request                // Web Request object (SSR only)
}
```

### Return Types

- JSON-serializable objects
- Response objects
- Can throw Response for early exit

### Loader Patterns

**Redirect if not found:**

```tsx
import { redirect } from 'one'

export async function loader({ params: { id } }) {
  const user = await db.users.findOne({ id })
  if (!user) {
    throw redirect('/login')
  }
  return { user }
}
```

**Custom Response:**

```tsx
export async function loader() {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  })
}
```

**Multiple data sources:**

```tsx
export async function loader({ params }) {
  const [user, posts] = await Promise.all([
    getUser(params.id),
    getUserPosts(params.id),
  ])
  return { user, posts }
}
```

## Render Modes

Four main modes controlled by filename suffix:

### SSG (Static Site Generation)

**Suffix:** `route+ssg.tsx`

Pre-renders HTML/CSS at build time, served from CDN.

```tsx
// app/blog/[slug]+ssg.tsx
export async function generateStaticParams() {
  const posts = await getAllBlogPosts()
  return posts.map((post) => ({ slug: post.slug }))
}

export async function loader({ params }) {
  const post = await getPost(params.slug)
  return { post }
}

export default function BlogPost() {
  const { post } = useLoader(loader)
  return (
    <>
      <H1>{post.title}</H1>
      <Paragraph>{post.content}</Paragraph>
    </>
  )
}
```

**Best for:** Marketing pages, blogs, documentation

**Note:** Can still add dynamic content after hydration

### SPA (Single Page App)

**Suffix:** `route+spa.tsx`

No server rendering, client-only JavaScript.

```tsx
// app/dashboard+spa.tsx
export async function loader() {
  const data = await fetchDashboardData()
  return { data }
}

export default function Dashboard() {
  const { data } = useLoader(loader)
  return <DashboardUI data={data} />
}
```

**Best for:** Dashboards, highly dynamic apps (Linear, Figma-style)

**Note:** Simpler to build, slower initial load, worse SEO

### SSR (Server Side Rendered)

**Suffix:** `route+ssr.tsx`

Renders on each request.

```tsx
// app/issues/[id]+ssr.tsx
export async function loader({ params, request }) {
  const session = await getSession(request)
  const issue = await getIssue(params.id, session.userId)
  return { issue }
}

export default function IssuePage() {
  const { issue } = useLoader(loader)
  return <IssueView issue={issue} />
}
```

**Best for:** Dynamic content needing SEO (GitHub issues-style)

**Note:** Most complex and expensive, can cache on CDN with invalidation

## API Routes

Create API endpoints using Web Standard Request/Response:

**Suffix:** `route+api.ts` or `route+api.tsx`

### HTTP Method Exports

```tsx
// app/api/users+api.ts
import type { Endpoint } from 'one'

export const GET: Endpoint = async (request) => {
  const users = await db.users.findAll()
  return Response.json(users)
}

export const POST: Endpoint = async (request) => {
  const data = await request.json()
  const user = await db.users.create(data)
  return Response.json(user, { status: 201 })
}

export const DELETE: Endpoint = async (request) => {
  const { id } = await request.json()
  await db.users.delete(id)
  return new Response(null, { status: 204 })
}
```

### Default Export (Catch-All)

```tsx
// app/api/health+api.ts
export default (request: Request): Response => {
  return Response.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
}
```

### Dynamic API Routes

```tsx
// app/api/users/[id]+api.ts
export const GET: Endpoint = async (request, { params }) => {
  const user = await db.users.find(params.id)
  if (!user) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  return Response.json(user)
}
```

## Middlewares

**Status:** Developing

Place `_middleware.ts` anywhere in `app/`. Middlewares nest and run top to bottom.

```tsx
// app/_middleware.ts
import { createMiddleware } from 'one'

export default createMiddleware(async ({ request, next, context }) => {
  // Before route
  if (request.url.includes('test')) {
    return Response.json({ middleware: 'works' })
  }

  const response = await next() // Run rest of middlewares + route

  // After route
  if (!response && request.url.endsWith('/missing')) {
    return Response.json({ notFound: true })
  }

  return response
})
```

**Middleware Args:**

```tsx
type MiddlewareArgs = {
  request: Request            // Web Request object
  next: () => Promise<Response | null>  // Continue chain
  context: Record<string, any>          // Mutable context object
}
```

## Helper Functions

### redirect

Server: returns Response.redirect | Client: calls router.navigate

```tsx
import { redirect } from 'one'

export function redirectToLogin() {
  return redirect('/login')
}

// In loader
export async function loader({ params }) {
  const user = await db.users.findOne({ id: params.id })
  if (!user) throw redirect('/login')
}
```

### getURL

Returns current app URL, uses `ONE_SERVER_URL` in production:

```tsx
import { getURL } from 'one'

const url = getURL() // http://127.0.0.1:8081 (dev) or https://app.com (prod)
```

### Protected

Guard routes based on auth state (native only, use Redirect for web):

```tsx
import { Protected, Stack } from 'one'

export default function Layout() {
  const isLoggedIn = useAuth()
  
  return (
    <Stack>
      <Protected guard={!isLoggedIn}>
        <Stack.Screen name="auth" />
      </Protected>
      <Protected guard={isLoggedIn}>
        <Stack.Screen name="home" />
      </Protected>
    </Stack>
  )
}
```

## Quick Reference

### File Naming Conventions

| Pattern | Route |
|---------|-------|
| `index.tsx` | `/` |
| `about.tsx` | `/about` |
| `blog/index.tsx` | `/blog` |
| `blog/[slug].tsx` | `/blog/:slug` |
| `catalog/[...rest].tsx` | `/catalog/*` |
| `(legal)/privacy.tsx` | `/privacy` (group invisible) |
| `+not-found.tsx` | Custom 404 |
| `page.native.tsx` | Native only |
| `page.web.tsx` | Web only |
| `page+ssg.tsx` | Static generation |
| `page+ssr.tsx` | Server-side render |
| `page+spa.tsx` | Single page app |
| `api/users+api.ts` | API endpoint |

### Import Patterns

```tsx
// Navigation
import { Link, useRouter, useParams } from 'one'

// Layouts
import { Slot, Stack, Tabs } from 'one'

// Data loading
import { useLoader, redirect } from 'one'

// Utilities
import { getURL, href } from 'one'

// Components
import { Head, LoadProgressBar, ScrollBehavior, SafeAreaView } from 'one'

// Advanced
import { Protected, withLayoutContext } from 'one'
```

### Common Patterns

**Modal presentation:**

```tsx
<Stack>
  <Stack.Screen name="index" />
  <Stack.Screen
    name="modal"
    options={{
      presentation: 'modal',
      headerShown: false,
    }}
  />
</Stack>
```

**Bottom sheet:**

```tsx
<Stack.Screen
  name="sheet"
  options={{
    presentation: 'formSheet',
    sheetAllowedDetents: [0.5, 1],
    sheetGrabberVisible: true,
  }}
/>
```

**Type-safe navigation:**

```tsx
const router = useRouter()
router.push(`/post/${id}`) // Type-checked against app/ structure
```

**SSG with params:**

```tsx
export async function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }))
}
```

**API with CORS:**

```tsx
export const GET: Endpoint = async () => {
  return Response.json(data, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST',
    },
  })
}
```

## Related Documentation

- [One.js Components](./takeout-components.md) - Built-in UI components
- [Tamagui Configuration](./tamagui-setup.md) - Integration with Tamagui
- [Official One.js Docs](https://onestack.dev) - Full framework documentation
