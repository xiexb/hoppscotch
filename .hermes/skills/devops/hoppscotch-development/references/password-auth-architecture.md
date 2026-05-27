# Password Authentication Architecture

> Added 2026-05. Email+password auth system alongside existing Magic Link + OAuth (Google/GitHub/Microsoft).

## Overview

Users can authenticate via:
1. **Magic Link** (existing) — email → receive link → click to login
2. **OAuth SSO** (existing) — Google, GitHub, Microsoft
3. **Email + Password** (new) — email + password form login

Password features:
- **Set password** — first-time setup (user registered via magic link, wants to add password login)
- **Change password** — authenticated user updates password (requires old password)
- **Forgot password** — unauthenticated user requests email reset link → click link → set new password

## Prisma Schema

```prisma
model User {
  // ... existing fields ...
  passwordHash  String?  // nullable: not all users have passwords
}

model PasswordResetToken {
  id         String    @id @default(cuid())
  userUid    String
  token      String    @unique  // SHA-256 hash of the actual token (never store plaintext)
  expiresOn  DateTime  @db.Timestamptz(3)
  usedAt     DateTime? @db.Timestamptz(3)  // null = unused, set when consumed
  user       User      @relation(fields: [userUid], references: [uid], onDelete: Cascade)
}
```

Migration: `packages/hoppscotch-backend/prisma/migrations/XXXX_add_password_auth/`

## Backend API Endpoints

All under `packages/hoppscotch-backend/src/auth/`:

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/v1/auth/password/signin` | POST | None | Email+password login → sets JWT cookies |
| `/api/v1/auth/password/set` | POST | JWT | First-time password setup |
| `/api/v1/auth/password/change` | POST | JWT | Change password (old+new) |
| `/api/v1/auth/password/reset-request` | POST | None | Send password reset email |
| `/api/v1/auth/password/reset-verify` | POST | None | Verify reset token + set new password |
| `/api/v1/auth/password/status` | GET | JWT | Check if user has password (`{ hasPassword: bool }`) |

### Key files
- `auth.controller.ts` — REST endpoints with DTOs and guards
- `auth.service.ts` — Business logic (signInWithPassword, setPassword, changePassword, requestPasswordReset, verifyPasswordReset, getPasswordStatus)
- `auth/dto/signin-password.dto.ts` — `{ email, password }` with class-validator
- `auth/dto/set-password.dto.ts` — `{ password }` with @MinLength(8)
- `auth/dto/change-password.dto.ts` — `{ oldPassword, newPassword }`
- `auth/dto/request-password-reset.dto.ts` — `{ email }`
- `auth/dto/verify-password-reset.dto.ts` — `{ token, newPassword }`
- `helper.ts` — `AuthProvider.EMAIL_PASSWORD` enum value
- `errors.ts` — INVALID_CREDENTIALS, PASSWORD_NOT_SET, PASSWORD_TOO_SHORT, INVALID_OLD_PASSWORD, RESET_TOKEN_EXPIRED, RESET_TOKEN_INVALID, PASSWORD_ALREADY_SET

### Security measures
- Password hashing: **argon2** (consistent with refresh token hashing)
- Reset token generation: `crypto.randomBytes(32).toString('hex')` — stored as SHA-256 hash
- Reset token: one-time use (usedAt field), 1-hour expiry
- Password reset request: always returns success (prevents email enumeration)
- Rate limiting: `ThrottlerBehindProxyGuard` on auth controller
- DTO validation: class-validator decorators on all inputs

### Email template
- `src/mailer/templates/password-reset.hbs` — password reset email with link
- Reset URL format: `{VITE_BASE_URL}/reset-password?token={token}`

## Frontend Components

### Login Modal (`hoppscotch-common/src/components/firebase/Login.vue`)
Mode state machine: `sign-in` → `password` → (login) OR `forgot-password` → `reset-sent`

New provider entry in `authProvidersAvailable`:
```typescript
{
  id: "EMAIL_PASSWORD",
  icon: IconEmail,
  label: t("auth.continue_with_password"),
  action: () => { mode.value = "password" },
  isLoading: signingInWithPassword,
}
```

### Password Manager (`hoppscotch-common/src/components/profile/PasswordManager.vue`)
Two modes based on `hasPassword` ref (fetched via `getPasswordStatus` on mount):
- **hasPassword=false**: Shows "Set Password" button → modal with password + confirm fields
- **hasPassword=true**: Shows "Change Password" button → modal with old password + new password + confirm fields

### Reset Password Page (`hoppscotch-selfhost-web/src/pages/reset-password.vue`)
Standalone page at `/reset-password?token=xxx`. Reads token from URL, shows new password form, calls `verifyPasswordReset`.

## Platform Auth Interface

### AuthPlatformDef additions (all optional methods)
```typescript
signInWithPassword?(email: string, password: string): Promise<void>
setPassword?(password: string): Promise<E.Either<string, void>>
changePassword?(old: string, new: string): Promise<E.Either<string, void>>
requestPasswordReset?(email: string): Promise<void>
verifyPasswordReset?(token: string, newPassword: string): Promise<void>
getPasswordStatus?(): Promise<{ hasPassword: boolean }>
```

### selfhost-web implementation (`src/platform/auth/web/index.ts`)
All methods call the corresponding REST endpoints with `withCredentials: true`.
`signInWithPassword` does NOT call `setInitialUser()` — the Login.vue component calls `window.location.reload()` after success, which triggers `performAuthInit()` → `setInitialUser()` in the normal app bootstrap. Calling `setInitialUser()` directly causes a state sync bug where `currentUser$` updates but reactive watchers don't re-evaluate.

## i18n Keys

In `auth` section of `locales/en.json` and `locales/cn.json`:
- `continue_with_password`, `password`, `sign_in`, `forgot_password`
- `send_reset_link`, `reset_link_sent`, `reset_link_sent_description`
- `reset_password`, `new_password`, `confirm_password`, `old_password`
- `set_password`, `change_password`
- `password_set_success`, `password_change_success`, `password_reset_success`
- `password_min_length`, `password_already_set`

In `error` section:
- `invalid_credentials`, `password_not_set`, `password_too_short`
- `invalid_old_password`, `reset_token_expired`, `reset_token_invalid`
- `password_mismatch`

## Known Issues

- **Admin panel**: `isServiceConfigured` in sh-admin lacks `EMAIL_PASSWORD` branch — admin UI cannot enable/disable password auth via toggle. Low priority, needs fix in `hoppscotch-sh-admin`.
- **Desktop platform**: `desktop/index.ts` doesn't implement the new optional methods — desktop app ignores password auth features gracefully (optional method pattern).
