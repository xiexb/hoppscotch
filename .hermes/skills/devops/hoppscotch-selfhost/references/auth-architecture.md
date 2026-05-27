# Hoppscotch Auth Architecture Reference

Complete map of the authentication system as of 2026-05. Hoppscotch uses **magic link (email) + OAuth (Google/GitHub/Microsoft)** — no password-based auth by default. This reference covers the full auth stack (backend + frontend) for anyone extending auth features.

## Backend Auth Stack

### Key Files
| File | Purpose |
|------|---------|
| `packages/hoppscotch-backend/src/auth/auth.service.ts` | Core auth logic: magic link, token generation, OAuth verification |
| `packages/hoppscotch-backend/src/auth/auth.controller.ts` | REST endpoints: `/auth/signin`, `/auth/verify`, `/auth/refresh`, SSO routes |
| `packages/hoppscotch-backend/src/auth/auth.module.ts` | Module registration, dynamic provider loading |
| `packages/hoppscotch-backend/src/auth/helper.ts` | `AuthProvider` enum, `authCookieHandler()`, `authProviderCheck()` |
| `packages/hoppscotch-backend/src/auth/strategies/` | Passport strategies: `jwt.strategy.ts`, `rt-jwt.strategy.ts`, `google.strategy.ts`, `github.strategy.ts`, `microsoft.strategy.ts` |
| `packages/hoppscotch-backend/src/auth/guards/` | NestJS guards: `jwt-auth.guard.ts`, `rt-jwt-auth.guard.ts`, SSO guards |
| `packages/hoppscotch-backend/src/auth/dto/` | DTOs: `signin-magic.dto.ts`, `verify-magic.dto.ts` |
| `packages/hoppscotch-backend/src/user/user.service.ts` | User CRUD: `findUserByEmail()`, `findUserById()`, `createUserViaMagicLink()`, `createProviderAccount()` |
| `packages/hoppscotch-backend/src/errors.ts` | Error constants (all auth errors prefixed `auth/`) |

### Prisma Schema (Auth Models)
```prisma
model User {
  uid          String   @id @default(cuid())
  email        String?  @unique
  refreshToken String?  // argon2 hash of refresh token
  // ... no passwordHash field by default
  providerAccounts Account[]
  VerificationToken VerificationToken[]
}

model Account {
  provider          String
  providerAccountId String
  // @@unique([provider, providerAccountId])
}

model VerificationToken {
  deviceIdentifier String   // bcrypt salt
  token            String   @unique @default(cuid())
  userUid          String
  expiresOn        DateTime
  // @@unique([deviceIdentifier, token])
}
```

### AuthProvider Enum
```typescript
export enum AuthProvider {
  GOOGLE = 'GOOGLE',
  GITHUB = 'GITHUB',
  MICROSOFT = 'MICROSOFT',
  EMAIL = 'EMAIL',  // magic link
}
```

To add a new provider (e.g., `EMAIL_PASSWORD`): add to enum, check with `authProviderCheck()`, register in `AuthModule.register()`.

### Auth Flow: Magic Link
1. `POST /auth/signin` → `signInMagicLink(email, origin)` → creates `VerificationToken` → sends email with magic link
2. User clicks link → lands on `/enter?token=xxx`
3. Frontend calls `POST /auth/verify` with `{token, deviceIdentifier}` → `verifyMagicLinkTokens()` → generates JWT pair → sets cookies
4. Cookies: `access_token` + `refresh_token` (httpOnly, secure if configured)

### Auth Flow: OAuth (SSO)
1. `GET /auth/google` → `GoogleSSOGuard` → redirects to Google consent
2. `GET /auth/google/callback` → generates JWT pair → `authCookieHandler()` → redirect to app
3. Same pattern for GitHub and Microsoft

### Token Management
- **Access token**: JWT, short-lived (configurable, default 1 day)
- **Refresh token**: JWT, longer-lived (default 7 days), stored as argon2 hash in `User.refreshToken`
- **Refresh endpoint**: `GET /auth/refresh` (requires `RTJwtAuthGuard`) → generates new token pair
- `authCookieHandler(res, tokens, redirect, redirectUrl, configService)` — sets both cookies and optionally redirects

### Pattern: fp-ts Either for Auth Results
All auth service methods return `E.Either<RESTError, T>`:
```typescript
async signInMagicLink(email, origin) {
  if (!validateEmail(email))
    return E.left({ message: INVALID_EMAIL, statusCode: HttpStatus.BAD_REQUEST });
  // ... success path
  return E.right(<DeviceIdentifierToken>{ deviceIdentifier: ... });
}
```
Controllers check with `E.isLeft(result)` and call `throwHTTPErr(result.left)`.

## Frontend Auth Stack

### Key Files
| File | Purpose |
|------|---------|
| `packages/hoppscotch-common/src/components/firebase/Login.vue` | Login Modal — mode state machine: `sign-in` → `email` → `email-sent` |
| `packages/hoppscotch-common/src/platform/auth/index.ts` | `AuthPlatformDef` interface — platform-agnostic auth contract |
| `packages/hoppscotch-selfhost-web/src/platform/auth/web/index.ts` | Self-host web implementation of `AuthPlatformDef` |
| `packages/hoppscotch-selfhost-web/src/platform/auth/web/api.ts` | API calls: `getAllowedAuthProviders()`, `updateUserDisplayName()` |
| `packages/hoppscotch-selfhost-web/src/pages/device-login.vue` | Desktop device login flow |

### AuthPlatformDef Interface
The platform abstraction that all shells must implement:
```typescript
interface AuthPlatformDef {
  getCurrentUserStream(): BehaviorSubject<HoppUser | null>
  getAuthEventsStream(): Subject<AuthEvent>
  getCurrentUser(): HoppUser | null
  signInWithEmail(email: string): Promise<void>
  signInWithEmailLink(email: string, url: string): Promise<void>
  signInUserWithGoogle(): Promise<void>
  signInUserWithGithub(): Promise<{type: string} | undefined>
  signInUserWithMicrosoft(): Promise<void>
  signOutUser(): Promise<void>
  setDisplayName(name: string): Promise<E.Either<string, void>>
  getAllowedAuthProviders(): Promise<E.Either<string, string[]>>
  // ... more methods
}
```

**Adding a new auth method to the interface**: Add as optional method (`?`) to avoid breaking desktop/other implementations.

### Login.vue Mode State Machine
```
'sign-in' → provider list (Google, GitHub, Microsoft, Email)
  ├→ click Email → 'email' (email input form)
  │    └→ submit → 'email-sent' (waiting for magic link)
  │         └→ click "re-enter email" → 'email'
  │         └→ click "dismiss" → close modal
  ├→ click Google/GitHub/Microsoft → OAuth redirect
  └→ click "back" from any sub-mode → 'sign-in'
```

**Adding a new login mode** (e.g., password):
1. Add to `authProvidersAvailable` array with id matching backend provider name
2. Add new mode (e.g., `'password'`) with form template
3. Add footer back-button for the new mode
4. Ensure mode reset in `hideModal()`

### Auth Provider Discovery
Frontend calls `GET /auth/providers` → backend returns `VITE_ALLOWED_AUTH_PROVIDERS` split by comma. Frontend filters `authProvidersAvailable` to only show enabled providers. The `EMAIL_PASSWORD` provider would need to be in the allowed list.

### User State Management
- `currentUser$`: BehaviorSubject<HoppUser | null> — the logged-in user
- `probableUser$`: BehaviorSubject from localStorage — assumed user before API confirms
- `authEvents$`: Subject emitting `{event: 'login'|'logout'|'token_refresh', user?}`
- `setInitialUser()`: calls GraphQL `me` query → sets user or null
- Token refresh: `GET /auth/refresh` (cookie-based, no explicit token passing)

### Magic Link Email Flow (Frontend)
1. `signInWithEmail(email)` → `POST /auth/signin` → saves `deviceIdentifier` to localStorage
2. User receives email, clicks link → lands on `/enter?token=xxx`
3. `processMagicLink()` detects `token` query param → calls `POST /auth/verify` with `{token, deviceIdentifier}`
4. On success → redirects to `/` → `setInitialUser()` populates user state

## Adding a New Auth Provider (Checklist)

### Backend
1. Add enum value to `AuthProvider` in `helper.ts`
2. Add new DTOs in `auth/dto/`
3. Add service methods in `auth.service.ts` (follow fp-ts Either pattern)
4. Add controller endpoints in `auth.controller.ts` (with `authProviderCheck`)
5. Update Prisma schema if new DB fields/models needed
6. Add email templates in `mailer/templates/` (if email-based)
7. Add error constants in `errors.ts`
8. Ensure `InfraConfigService` recognizes the new provider

### Frontend
1. Add optional method(s) to `AuthPlatformDef` interface
2. Implement in `selfhost-web/platform/auth/web/index.ts`
3. Add provider to `authProvidersAvailable` in `Login.vue`
4. Add new mode(s) to Login.vue state machine
5. Add i18n keys to `en.json` and `cn.json`
6. Consider desktop platform — add no-op or fallback implementations
7. Add any new pages (e.g., `/reset-password`) to router

### InfraConfig
Ensure `VITE_ALLOWED_AUTH_PROVIDERS` includes the new provider value. The onboarding API at `POST /v1/onboarding/config` accepts this as a comma-separated string.
