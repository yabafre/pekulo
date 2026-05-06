# Better Auth Integration in Tamagui Takeout

## Overview

Better Auth is a modern, flexible authentication library for TypeScript/JavaScript applications that powers authentication in Tamagui Takeout. It provides a unified authentication experience across web and React Native platforms with support for multiple authentication methods, secure session management, and extensive customization.

### Why Better Auth in Takeout?

- **Universal Support**: Works seamlessly on web and React Native (via `@better-auth/expo`)
- **Type-Safe**: Full TypeScript support with type inference
- **Flexible**: Plugin-based architecture allows easy feature additions
- **Modern**: Built-in JWT support for Zero sync and distributed systems
- **Battle-Tested**: Production-ready with proper security defaults

### Core Concepts

1. **Sessions**: Managed server-side with configurable expiration and storage
2. **Providers**: Email/password, OTP (email/phone), magic links, and OAuth
3. **Plugins**: Modular features (JWT, admin, bearer tokens, etc.)
4. **State Management**: Client-side reactive state with automatic persistence
5. **JWT Tokens**: For native apps, Zero sync, and service-to-service auth

---

## Architecture

### Client-Server Flow

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Client    │◄───────►│  Auth API    │◄───────►│   Database  │
│  (React)    │  HTTP   │  /api/auth   │   SQL   │  (sessions) │
└─────────────┘         └──────────────┘         └─────────────┘
       │
       ├── authClient (better-auth/client)
       ├── useAuth() hook
       ├── Session storage (localStorage/MMKV)
       └── JWT tokens (native/Tauri)
```

### File Structure

```
src/features/auth/
├── client/
│   ├── authClient.ts           # Main auth client setup
│   ├── authFetch.ts            # Authenticated fetch wrapper
│   ├── otpLogin.ts             # OTP authentication logic
│   ├── passwordLogin.ts        # Email/password auth
│   ├── plugins.ts              # Client plugins configuration
│   ├── platformClient.ts       # Web platform (no-op)
│   └── platformClient.native.ts # React Native Expo client
├── server/
│   ├── authServer.ts           # Better Auth server config
│   ├── apiHandler.ts           # Request handler for /api/auth
│   └── afterCreateUser.ts      # Post-registration hook
└── constants.ts                # Auth-related constants

app/api/auth/[...sub]+api.ts    # Catch-all API route

packages/better-auth-utils/
└── src/
    └── createAuthClient.ts     # Reusable client wrapper
```

---

## Setup & Configuration

### Installation

Better Auth is already installed in Takeout. Core dependencies:

```json
{
  "better-auth": "^1.x",
  "@better-auth/expo": "^1.x",
  "@take-out/better-auth-utils": "workspace:*"
}
```

### Server Configuration

Location: `src/features/auth/server/authServer.ts`

```typescript
import { betterAuth } from 'better-auth'
import { admin, bearer, emailOTP, jwt, magicLink, phoneNumber } from 'better-auth/plugins'
import { expo } from '@better-auth/expo'
import { database } from '~/database/database'
import { BETTER_AUTH_SECRET, BETTER_AUTH_URL } from '~/server/env-server'

export const authServer = betterAuth({
  database,  // Drizzle ORM instance

  session: {
    freshAge: time.minute.days(2),  // Sessions older than 2 days are refreshed
    storeSessionInDatabase: true,    // Persist sessions in DB
  },

  emailAndPassword: {
    enabled: true,
  },

  trustedOrigins: [
    `https://${DOMAIN}`,
    'http://localhost:8081',
    `${APP_SCHEME}://`,  // For React Native deep links
  ],

  databaseHooks: {
    user: {
      create: {
        async after(user) {
          await afterCreateUser(user)  // Custom post-registration logic
        },
      },
    },
  },

  plugins: [
    // JWT for Zero sync and React Native
    jwt({
      jwt: { expirationTime: '3y' },
      jwks: {
        keyPairConfig: { alg: 'EdDSA', crv: 'Ed25519' },  // Zero-compatible
      },
    }),

    bearer(),      // Bearer token authentication
    expo(),        // React Native support
    
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // Implement email sending logic
      },
    }),

    admin(),       // Admin role management

    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        console.info(`📧 OTP CODE for ${email}: ${otp}`)
        storeOTP(email, otp)  // Dev mode storage
      },
    }),

    phoneNumber({
      sendOTP: async ({ phoneNumber, code }) => {
        // Implement SMS sending logic
      },
      signUpOnVerification: {
        getTempEmail: (phoneNumber) => `${phoneNumber}@phone.local`,
        getTempName: (phoneNumber) => '',
      },
    }),
  ],

  logger: {
    level: 'debug',
    log(level, message, ...args) {
      console.info(level, message, ...args)
    },
  },

  account: {
    accountLinking: {
      allowDifferentEmails: true,  // Link accounts with different emails
    },
  },
})
```

### Environment Variables

Required in `.env`:

```bash
BETTER_AUTH_SECRET=<random-secret-key>  # Generate with: openssl rand -base64 32
BETTER_AUTH_URL=http://localhost:8081   # Base URL for auth endpoints
```

### Client Configuration

Location: `src/features/auth/client/authClient.ts`

```typescript
import { createBetterAuthClient } from '@take-out/better-auth-utils'
import { SERVER_URL } from '~/constants/urls'
import { setUser } from '~/features/user/getUser'
import { showToast } from '~/interface/toast/Toast'
import { plugins } from './plugins'

type AppUser = User & { role?: 'admin' }

const betterAuthClient = createBetterAuthClient({
  baseURL: SERVER_URL,
  plugins,
  
  // Transform user object with app-specific fields
  createUser: (user) => user as AppUser,
  
  // React to auth state changes
  onAuthStateChange: (state) => {
    setUser(state.user)
  },
  
  // Handle auth errors
  onAuthError: (error: any) => {
    showToast(`Auth error: ${error.message || JSON.stringify(error)}`, {
      type: 'error',
    })
  },
})

export const useAuth = () => {
  const auth = betterAuthClient.useAuth()
  return {
    ...auth,
    loginText: auth.state === 'logged-in' ? 'Account' : 'Login',
    loginLink: href(auth.state === 'logged-in' ? '/home/feed' : '/auth/login'),
  }
}

export const { setAuthClientToken, clearAuthClientToken, authState, authClient } =
  betterAuthClient
```

### API Route Setup

Location: `app/api/auth/[...sub]+api.ts`

```typescript
import { authAPIHandler } from '~/features/auth/server/apiHandler'
import type { Endpoint } from 'one'

export const GET: Endpoint = authAPIHandler('GET')
export const POST: Endpoint = authAPIHandler('POST')
```

The `authAPIHandler` bridges One.js routes to Better Auth:

```typescript
// src/features/auth/server/apiHandler.ts
import { authServer } from './authServer'

export function authAPIHandler(method: 'GET' | 'POST') {
  return async (request: Request) => {
    // Better Auth handles all /api/auth/* endpoints
    return authServer.handler(request)
  }
}
```

---

## Authentication Providers

### Email/Password

**Server Setup** (already configured):
```typescript
emailAndPassword: {
  enabled: true,
}
```

**Client Usage**:
```typescript
import { authClient } from '~/features/auth/client/authClient'

// Sign up
const { data, error } = await authClient.signUp.email({
  email: 'user@example.com',
  password: 'secure-password',
  name: 'John Doe',
})

// Sign in
const { data, error } = await authClient.signIn.email({
  email: 'user@example.com',
  password: 'secure-password',
})
```

### Email OTP

**Server Plugin**:
```typescript
emailOTP({
  async sendVerificationOTP({ email, otp, type }) {
    // Send OTP via email service
    await emailService.send({
      to: email,
      subject: 'Your verification code',
      body: `Your code is: ${otp}`,
    })
  },
})
```

**Client Flow**:
```typescript
import { authClient } from '~/features/auth/client/authClient'

// Step 1: Request OTP
const { data, error } = await authClient.emailOtp.sendVerificationOtp({
  email: 'user@example.com',
  type: 'sign-in',
})

// Step 2: Verify OTP
const { data, error } = await authClient.signIn.emailOtp({
  email: 'user@example.com',
  otp: '123456',
})
```

**Helper Function** (from `otpLogin.ts`):
```typescript
import { validateLoginOtpCode, otpLogin } from '~/features/auth/client/otpLogin'

// Send OTP
const { success, error } = await validateLoginOtpCode('email', 'user@example.com')

// Verify and login
const { success, error } = await otpLogin('email', 'user@example.com', '123456')
```

### Phone Number OTP

**Server Plugin**:
```typescript
phoneNumber({
  sendOTP: async ({ phoneNumber, code }) => {
    // Send SMS via service (Twilio, AWS SNS, etc.)
    await smsService.send({
      to: phoneNumber,
      message: `Your verification code is: ${code}`,
    })
  },
  signUpOnVerification: {
    getTempEmail: (phoneNumber) => `${phoneNumber}@phone.local`,
    getTempName: (phoneNumber) => '',
  },
})
```

**Client Usage**:
```typescript
// Request OTP
const { data, error } = await authClient.phoneNumber.sendOtp({
  phoneNumber: '+14155551234',
})

// Verify (automatically creates session)
const { data, error } = await authClient.phoneNumber.verify({
  phoneNumber: '+14155551234',
  code: '123456',
})
```

### Magic Link

**Server Plugin**:
```typescript
magicLink({
  sendMagicLink: async ({ email, url }) => {
    await emailService.send({
      to: email,
      subject: 'Sign in to your account',
      body: `Click here to sign in: ${url}`,
    })
  },
})
```

**Client Usage**:
```typescript
// Request magic link
const { data, error } = await authClient.signIn.magicLink({
  email: 'user@example.com',
  callbackURL: '/auth/verify',
})

// User clicks link, Better Auth handles verification automatically
```

### OAuth Providers (Google, GitHub, Apple)

**Configuration** (add to server plugins):
```typescript
import { google, github, apple } from 'better-auth/plugins'

plugins: [
  google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }),
  github({
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  }),
  apple({
    clientId: process.env.APPLE_CLIENT_ID,
    clientSecret: process.env.APPLE_CLIENT_SECRET,
  }),
]
```

**Client Usage**:
```typescript
// Initiate OAuth flow
await authClient.signIn.social({
  provider: 'google',
  callbackURL: '/auth/callback',
})
```

---

## Session Management

### Session Storage

Sessions are stored in the database with the following configuration:

```typescript
session: {
  freshAge: time.minute.days(2),  // 2 days
  storeSessionInDatabase: true,
}
```

- **Sessions older than `freshAge`**: Automatically refreshed on next request
- **Database persistence**: Enables session management across devices and server restarts

### Session Hooks

#### `useAuth()`

Primary hook for accessing auth state in React components:

```typescript
import { useAuth } from '~/features/auth/client/authClient'

function UserProfile() {
  const { state, user, session } = useAuth()

  if (state === 'loading') return <Spinner />
  if (state === 'logged-out') return <Navigate to="/auth/login" />

  return (
    <YStack>
      <Text>Welcome, {user?.name}!</Text>
      <Text>Email: {user?.email}</Text>
      <Text>Session expires: {new Date(session.expiresAt).toLocaleString()}</Text>
    </YStack>
  )
}
```

**Auth State Values**:
- `state`: `'loading' | 'logged-in' | 'logged-out'`
- `user`: User object or `null`
- `session`: Session object or `null`
- `token`: JWT token (for native apps) or `null`

#### `getAuth()`

Non-reactive auth state access (for non-component code):

```typescript
import { betterAuthClient } from '~/features/auth/client/authClient'

const { getAuth } = betterAuthClient

// In utilities, middleware, etc.
function requireAuth() {
  const { loggedIn, user } = getAuth()
  if (!loggedIn) throw new Error('Unauthorized')
  return user
}
```

### Session Refresh

Sessions are automatically refreshed by the `@take-out/better-auth-utils` wrapper:

1. **Automatic Retry**: On auth errors, retries connection after 4 seconds
2. **Token Validation**: Validates JWT tokens before use
3. **State Persistence**: Saves session state to localStorage/MMKV

```typescript
// Configured in createBetterAuthClient
const betterAuthClient = createBetterAuthClient({
  retryDelay: 4000,  // Retry after 4 seconds on error
  onAuthError: (error) => {
    // Handle errors, display toasts, etc.
  },
})
```

### Server-Side Session Access

Access sessions in API routes:

```typescript
import { authServer } from '~/features/auth/server/authServer'
import type { Endpoint } from 'one'

export const GET: Endpoint = async (request) => {
  const session = await authServer.api.getSession({
    headers: request.headers,
  })

  if (!session) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return Response.json({
    user: session.user,
    message: `Hello, ${session.user.name}!`,
  })
}
```

---

## Auth Components

### Login Form

Location: `app/(app)/auth/login.tsx`

```typescript
import { useAuth } from '~/features/auth/client/authClient'
import { Link } from '~/interface/app/Link'
import { ButtonAction } from '~/interface/buttons/ButtonAction'

export const LoginPage = () => {
  return (
    <YStack gap="$4">
      <H2>Login to {APP_NAME}</H2>
      
      {/* Email/OTP Login */}
      <Link href="/auth/signup/email">
        <ButtonAction theme="accent" size="large">
          Continue with Email
        </ButtonAction>
      </Link>

      {/* OAuth Buttons */}
      <XStack gap="$3">
        <ButtonSimple icon={<GoogleIcon />} onPress={() => handleSocialLogin('google')} />
        <ButtonSimple icon={<AppleIcon />} onPress={() => handleSocialLogin('apple')} />
      </XStack>
    </YStack>
  )
}
```

### Signup Flow

Location: `app/(app)/auth/signup/[method].tsx`

Multi-step signup with OTP verification:

```typescript
export const SignupPage = () => {
  const { method } = useParams<{ method?: 'phone' | 'email' }>()
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)

  const handleContinue = async () => {
    setLoading(true)
    
    // Step 1: Send OTP
    const { success, error } = await validateLoginOtpCode(method, inputValue)
    
    if (success) {
      // Redirect to OTP verification page
      router.push(`/auth/signup/otp?method=${method}&value=${encodeURIComponent(inputValue)}`)
    } else {
      showError(error)
    }
    
    setLoading(false)
  }

  return (
    <YStack gap="$4">
      <Input
        placeholder={isPhone ? '(202) 555-2813' : 'Enter email address'}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        type={isPhone ? 'tel' : 'email'}
      />
      
      <ButtonAction onPress={handleContinue} disabled={!inputValue.trim()}>
        {loading ? 'Processing...' : 'Next'}
      </ButtonAction>
    </YStack>
  )
}
```

### OTP Verification

```typescript
// app/(app)/auth/signup/otp.tsx
import { otpLogin } from '~/features/auth/client/otpLogin'

export const OTPPage = () => {
  const { method, value } = useParams()
  const [otp, setOtp] = useState('')

  const handleVerify = async () => {
    const { success, error } = await otpLogin(method, value, otp)
    
    if (success) {
      router.replace('/home/feed')  // Redirect to app
    } else {
      showError(error)
    }
  }

  return (
    <YStack gap="$4">
      <Input
        placeholder="Enter 6-digit code"
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
        maxLength={6}
        inputMode="numeric"
      />
      <ButtonAction onPress={handleVerify}>Verify</ButtonAction>
    </YStack>
  )
}
```

### Password Reset Flow

```typescript
// Request reset
await authClient.forgetPassword({
  email: 'user@example.com',
  redirectTo: '/auth/reset-password',
})

// Reset password (after clicking email link)
await authClient.resetPassword({
  newPassword: 'new-secure-password',
})
```

---

## Protected Routes

### Route Protection Pattern

Use `useAuth()` in layout components:

```typescript
// app/(app)/_layout.tsx
import { useAuth } from '~/features/auth/client/authClient'
import { Redirect } from 'one'

export default function AppLayout() {
  const { state } = useAuth()

  if (state === 'loading') {
    return <LoadingScreen />
  }

  if (state === 'logged-out') {
    return <Redirect href="/auth/login" />
  }

  return <Slot />  // Render protected routes
}
```

### Middleware Setup

For server-side route protection:

```typescript
// middleware.ts
import { authServer } from '~/features/auth/server/authServer'

export async function middleware(request: Request) {
  const session = await authServer.api.getSession({
    headers: request.headers,
  })

  const isProtectedRoute = request.url.startsWith('/app/')
  
  if (isProtectedRoute && !session) {
    return Response.redirect('/auth/login')
  }

  return NextResponse.next()
}
```

### Redirect Handling

Preserve intended destination after login:

```typescript
// Save redirect URL before login
const returnTo = router.query.returnTo || '/home/feed'

// After successful auth
router.replace(returnTo)
```

Example login flow:

```typescript
// User tries to access /app/settings
// Not logged in → redirect to /auth/login?returnTo=/app/settings
// After login → redirect to /app/settings
```

---

## User Management

### User Creation

Handled automatically by Better Auth, with post-creation hook:

```typescript
// src/features/auth/server/afterCreateUser.ts
export async function afterCreateUser(user: User) {
  // Initialize user data, send welcome email, etc.
  await db.insert(userProfiles).values({
    userId: user.id,
    createdAt: new Date(),
  })
}
```

### Profile Updates

```typescript
import { authClient } from '~/features/auth/client/authClient'

// Update user profile
const { data, error } = await authClient.updateUser({
  name: 'New Name',
  image: 'https://example.com/avatar.jpg',
})
```

### Password Changes

```typescript
// Change password (requires current password)
const { data, error } = await authClient.changePassword({
  currentPassword: 'old-password',
  newPassword: 'new-password',
})
```

### Account Deletion

```typescript
// Delete user account
const { data, error } = await authClient.deleteUser()

// Clear local state
clearAuthClientToken()
router.replace('/auth/login')
```

---

## Plugins & Extensions

### Available Plugins

Takeout uses the following Better Auth plugins:

| Plugin | Purpose | Import |
|--------|---------|--------|
| `jwt` | Generate JWT tokens for native/Zero | `better-auth/plugins` |
| `bearer` | Bearer token authentication | `better-auth/plugins` |
| `admin` | Admin role management | `better-auth/plugins` |
| `emailOTP` | Email-based OTP | `better-auth/plugins` |
| `phoneNumber` | Phone-based OTP | `better-auth/plugins` |
| `magicLink` | Passwordless email links | `better-auth/plugins` |
| `expo` | React Native support | `@better-auth/expo` |

### Plugin Configuration

**Server** (`src/features/auth/server/authServer.ts`):
```typescript
import { jwt, bearer, admin, emailOTP, phoneNumber, magicLink } from 'better-auth/plugins'
import { expo } from '@better-auth/expo'

plugins: [
  jwt({ /* config */ }),
  bearer(),
  admin(),
  emailOTP({ /* config */ }),
  phoneNumber({ /* config */ }),
  magicLink({ /* config */ }),
  expo(),
]
```

**Client** (`src/features/auth/client/plugins.ts`):
```typescript
import {
  adminClient,
  emailOTPClient,
  magicLinkClient,
  phoneNumberClient,
} from 'better-auth/client/plugins'
import { platformClient } from './platformClient'

export const plugins = [
  adminClient(),
  magicLinkClient(),
  emailOTPClient(),
  phoneNumberClient(),
  platformClient(),  // Expo client for React Native
]
```

### Custom Plugin Creation

Create a server plugin:

```typescript
// src/features/auth/plugins/customPlugin.ts
import type { BetterAuthPlugin } from 'better-auth'

export const myCustomPlugin = (): BetterAuthPlugin => ({
  id: 'my-plugin',
  endpoints: {
    '/custom-endpoint': {
      method: 'POST',
      handler: async (request) => {
        // Custom logic
        return { success: true }
      },
    },
  },
  hooks: {
    after: [
      {
        matcher: (context) => context.path === '/sign-in/email',
        handler: async (context) => {
          // Run after email sign-in
        },
      },
    ],
  },
})
```

Add to server:

```typescript
import { myCustomPlugin } from './plugins/customPlugin'

plugins: [
  // ... existing plugins
  myCustomPlugin(),
]
```

---

## Security

### CSRF Protection

Better Auth includes built-in CSRF protection:

- **Automatic token generation**: Each session gets a unique CSRF token
- **Request validation**: Validated on state-changing requests (POST, PUT, DELETE)
- **Configuration**: Enabled by default, no additional setup needed

### Rate Limiting

Implement rate limiting for auth endpoints:

```typescript
// Example with better-auth hooks
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '1 m'),  // 5 requests per minute
})

export const authServer = betterAuth({
  // ... config
  hooks: {
    before: [
      {
        matcher: (ctx) => ctx.path.startsWith('/sign-in'),
        handler: async (ctx) => {
          const { success } = await ratelimit.limit(ctx.request.headers.get('x-forwarded-for'))
          if (!success) {
            throw new Error('Rate limit exceeded')
          }
        },
      },
    ],
  },
})
```

### Secure Cookie Configuration

Sessions use secure cookies by default:

```typescript
session: {
  freshAge: time.minute.days(2),
  storeSessionInDatabase: true,
  // Cookies are automatically configured with:
  // - httpOnly: true
  // - secure: true (in production)
  // - sameSite: 'lax'
}
```

### Best Practices

1. **Use environment variables** for secrets:
   ```bash
   BETTER_AUTH_SECRET=<random-secret-key>
   ```

2. **Validate user input** before passing to Better Auth:
   ```typescript
   import { z } from 'zod'
   
   const emailSchema = z.string().email()
   const email = emailSchema.parse(userInput)
   ```

3. **Implement proper CORS** for trusted origins:
   ```typescript
   trustedOrigins: [
     'https://yourdomain.com',
     'http://localhost:8081',  // Dev only
   ]
   ```

4. **Use HTTPS in production** (enforced by Better Auth)

5. **Store JWT tokens securely**:
   - Web: `localStorage` (XSS protection via CSP)
   - Native: MMKV (encrypted storage via `@take-out/helpers`)

6. **Never log sensitive data**:
   ```typescript
   logger: {
     level: process.env.NODE_ENV === 'production' ? 'error' : 'debug',
   }
   ```

---

## Integration with Zero

Zero (the local-first database sync) requires JWT tokens for authentication. Better Auth provides these via the `jwt` plugin.

### Server Configuration

```typescript
import { jwt } from 'better-auth/plugins'

plugins: [
  jwt({
    jwt: {
      expirationTime: '3y',  // Long-lived for offline-first apps
    },
    jwks: {
      // EdDSA with Ed25519 is required for Zero compatibility
      keyPairConfig: { alg: 'EdDSA', crv: 'Ed25519' },
    },
  }),
]
```

### Client Integration

Get JWT token for Zero:

```typescript
import { betterAuthClient } from '~/features/auth/client/authClient'

// Get valid token (cached, auto-refreshed)
const token = await betterAuthClient.getValidToken()

// Use token for Zero sync
const zero = new Zero({
  server: ZERO_SERVER_URL,
  auth: token,
})
```

### User Context in Zero Queries

Pass user ID to Zero for row-level security:

```typescript
import { useAuth } from '~/features/auth/client/authClient'

function MyComponent() {
  const { user } = useAuth()
  
  const posts = useZero(
    (zero) => zero.query.posts.where('authorId', user.id),
    [user.id]
  )
  
  return <PostList posts={posts} />
}
```

### Token Passing

The `authFetch` wrapper automatically includes the JWT:

```typescript
// src/features/auth/client/authFetch.ts
import { createFetch } from '@better-fetch/fetch'
import { authState } from './authClient'

export const authFetch = createFetch({
  baseURL: SERVER_URL,
  auth: {
    type: 'Bearer',
    token: () => authState.value?.session?.token,
  },
})

// Usage
const response = await authFetch('/api/protected-endpoint')
```

---

## Quick Reference

### Auth Hooks

| Hook | Purpose | Returns |
|------|---------|---------|
| `useAuth()` | Get auth state in React | `{ state, user, session, token }` |
| `getAuth()` | Get auth state (non-reactive) | `{ state, user, session, token, loggedIn }` |

### Auth Client Methods

| Method | Purpose | Example |
|--------|---------|---------|
| `signUp.email()` | Register with email/password | `authClient.signUp.email({ email, password, name })` |
| `signIn.email()` | Login with email/password | `authClient.signIn.email({ email, password })` |
| `signIn.emailOtp()` | Login with email OTP | `authClient.signIn.emailOtp({ email, otp })` |
| `signIn.social()` | OAuth login | `authClient.signIn.social({ provider: 'google' })` |
| `signOut()` | Logout | `authClient.signOut()` |
| `updateUser()` | Update profile | `authClient.updateUser({ name, image })` |
| `changePassword()` | Change password | `authClient.changePassword({ currentPassword, newPassword })` |
| `forgetPassword()` | Request password reset | `authClient.forgetPassword({ email })` |
| `$fetch()` | Make authenticated request | `authClient.$fetch('/endpoint')` |

### Provider Configuration

| Provider | Server Plugin | Client Plugin | Usage |
|----------|--------------|---------------|-------|
| Email/Password | Built-in | Built-in | `signIn.email()` |
| Email OTP | `emailOTP()` | `emailOTPClient()` | `emailOtp.sendVerificationOtp()` |
| Phone OTP | `phoneNumber()` | `phoneNumberClient()` | `phoneNumber.sendOtp()` |
| Magic Link | `magicLink()` | `magicLinkClient()` | `signIn.magicLink()` |
| Google OAuth | `google()` | N/A | `signIn.social({ provider: 'google' })` |
| GitHub OAuth | `github()` | N/A | `signIn.social({ provider: 'github' })` |
| Apple OAuth | `apple()` | N/A | `signIn.social({ provider: 'apple' })` |

### Common Patterns

**Check if logged in**:
```typescript
const { state } = useAuth()
const isLoggedIn = state === 'logged-in'
```

**Get current user**:
```typescript
const { user } = useAuth()
console.log(user?.id, user?.email, user?.name)
```

**Protect a route**:
```typescript
const { state } = useAuth()
if (state === 'logged-out') return <Redirect href="/auth/login" />
```

**Make authenticated API call**:
```typescript
import { authFetch } from '~/features/auth/client/authFetch'
const data = await authFetch('/api/user/posts').then(r => r.json())
```

**Sign out**:
```typescript
import { authClient } from '~/features/auth/client/authClient'
await authClient.signOut()
```

**Handle auth errors**:
```typescript
const betterAuthClient = createBetterAuthClient({
  onAuthError: (error) => {
    if (error.status === 401) {
      showToast('Session expired. Please log in again.')
      router.push('/auth/login')
    }
  },
})
```

---

## Platform-Specific Notes

### Web

- **Storage**: `localStorage` for session persistence
- **Platform Client**: No-op (web works out of the box)
- **Deep Links**: Not applicable

### React Native (Expo)

- **Storage**: MMKV via `@take-out/helpers` (encrypted)
- **Platform Client**: `@better-auth/expo/client` (`expoClient`)
- **Deep Links**: Configured via `APP_SCHEME` constant
- **Polyfills**: Crypto polyfill required (`~/helpers/crypto/polyfill.native`)

**Native Setup**:

```typescript
// src/features/auth/client/platformClient.native.ts
import { expoClient } from '@better-auth/expo/client'
import { createStorage } from '@take-out/helpers'
import { APP_SCHEME } from '../constants'

const expoStorage = createStorage('expo-auth-client')

export function platformClient(): BetterAuthClientPlugin {
  return expoClient({
    scheme: APP_SCHEME,           // e.g., 'myapp://'
    storagePrefix: APP_SCHEME,
    storage: expoStorage,          // MMKV-backed storage
  })
}
```

**Storage Driver Setup**:

CRITICAL: Must be initialized before auth code runs:

```typescript
// src/setupClient.ts (imported in vite.config.ts)
import '~/features/storage/setupStorage'  // Sets up MMKV driver
import '~/helpers/crypto/polyfill'        // Polyfills crypto API
```

Without this, auth tokens won't persist on React Native. See test file: `src/test/unit/auth-initialization.test.ts`.

---

## Troubleshooting

### Sessions not persisting (React Native)

**Symptom**: User logged out after app restart

**Cause**: Storage driver not initialized before auth client

**Fix**: Ensure `setupClient.ts` runs first:

```typescript
// vite.config.ts
test: {
  setupFiles: {
    native: './src/setupClient.ts',  // ✅ Required
    web: './src/setupClient.web.ts',
  },
}
```

### JWT validation errors

**Symptom**: `Invalid token` errors in Zero sync

**Cause**: Mismatched signing algorithm

**Fix**: Use EdDSA with Ed25519:

```typescript
jwt({
  jwks: {
    keyPairConfig: { alg: 'EdDSA', crv: 'Ed25519' },
  },
})
```

### CORS errors

**Symptom**: `blocked by CORS policy` in browser console

**Fix**: Add origin to `trustedOrigins`:

```typescript
trustedOrigins: [
  'https://yourdomain.com',
  'http://localhost:8081',
]
```

### Rate limit issues

**Symptom**: `Too many requests` errors

**Fix**: Implement server-side rate limiting (see Security section)

### OTP not received

**Symptom**: Users not receiving OTP emails/SMS

**Fix**: 
1. Check server logs for OTP codes (dev mode)
2. Implement actual email/SMS service in production
3. Verify email/phone number is valid

---

## Migration Guide

### From Custom Auth

1. **Install Better Auth**:
   ```bash
   bun add better-auth @better-auth/expo @take-out/better-auth-utils
   ```

2. **Set up server** (`authServer.ts`):
   - Configure database connection
   - Add desired plugins
   - Set up trusted origins

3. **Set up client** (`authClient.ts`):
   - Create auth client with `createBetterAuthClient`
   - Configure plugins
   - Add callbacks

4. **Update routes**:
   - Add `/api/auth/[...sub]+api.ts` catch-all
   - Update login/signup pages to use Better Auth methods

5. **Migrate user data**:
   - Export existing users
   - Hash passwords (if needed)
   - Import to Better Auth schema

6. **Test thoroughly**:
   - Login flows
   - Session persistence
   - Protected routes
   - Mobile app (if applicable)

---

## Resources

- **Better Auth Docs**: https://www.better-auth.com/docs
- **Better Auth GitHub**: https://github.com/better-auth/better-auth
- **Takeout Auth Source**: `src/features/auth/`
- **Better Auth Utils**: `packages/better-auth-utils/`

---

**Last Updated**: 2024-01-24  
**Better Auth Version**: 1.x  
**Takeout Version**: Latest
