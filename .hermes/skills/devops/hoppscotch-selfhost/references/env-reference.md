# Hoppscotch .env Reference

## Backend Config
| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/hoppscotch` |
| `DATA_ENCRYPTION_KEY` | Yes | 32-char hex key for InfraConfig encryption. **Must match existing data!** Changing it invalidates all encrypted fields. |
| `WHITELISTED_ORIGINS` | Yes | Comma-separated list of allowed origins (frontend URLs) |
| `TRUST_PROXY` | No | Set `true` if behind nginx/reverse proxy |

## Frontend Config (VITE_ prefix — injected at build/dev time)
| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_BASE_URL` | Yes | Public URL of the main frontend |
| `VITE_SHORTCODE_BASE_URL` | Yes | URL for short code resolution (usually same as VITE_BASE_URL) |
| `VITE_ADMIN_URL` | Yes | Public URL of the admin dashboard |
| `VITE_BACKEND_GQL_URL` | Yes | Public URL of the GraphQL endpoint |
| `VITE_BACKEND_WS_URL` | Yes | WebSocket URL for GraphQL subscriptions (ws:// or wss://) |
| `VITE_BACKEND_API_URL` | Yes | Public URL of the REST API (e.g. http://host:port/v1) |
| `VITE_APP_TOS_LINK` | No | Terms of service link |
| `VITE_APP_PRIVACY_POLICY_LINK` | No | Privacy policy link |

## SMTP Config
| Variable | Required | Description |
|----------|----------|-------------|
| `MAILER_SMTP_ENABLE` | Yes | `"true"` or `"false"` |
| `MAILER_USE_CUSTOM_CONFIGS` | Yes | `"true"` = use host/port/user/pass; `"false"` = use SMTP_URL only |
| `MAILER_SMTP_URL` | Conditional | SMTP URL format: `smtps://user:pass@host:465`. Required if USE_CUSTOM_CONFIGS=false. Must pass validateSMTPUrl regex. |
| `MAILER_SMTP_HOST` | Conditional | SMTP server hostname |
| `MAILER_SMTP_PORT` | Conditional | SMTP port (465 for SSL, 587 for STARTTLS) |
| `MAILER_SMTP_SECURE` | Conditional | `"true"` for SSL (port 465), `"false"` otherwise |
| `MAILER_SMTP_USER` | Conditional | SMTP auth username |
| `MAILER_SMTP_PASSWORD` | Conditional | SMTP auth password (quote if contains `#`) |
| `MAILER_ADDRESS_FROM` | Yes | Sender email address (must pass email regex) |
| `MAILER_SMTP_AUTH_TYPE` | Yes | `"login"` (lowercase!) or `"oauth2"` |
| `MAILER_SMTP_IGNORE_TLS` | No | `"true"` or `"false"` |
| `MAILER_TLS_REJECT_UNAUTHORIZED` | No | `"true"` or `"false"` |

## Important Notes

1. **Backend does NOT auto-load .env** — NestJS ConfigModule ignores VITE_ prefix vars.
   Export them explicitly in a wrapper script.
2. **SMTP_URL password encoding**: `#` must be URL-encoded as `%23`, `@` in username is fine.
3. **All boolean fields** must be string `"true"` or `"false"`, not actual booleans.
4. **MAILER_SMTP_AUTH_TYPE** must be lowercase: `"login"` not `"LOGIN"`.
