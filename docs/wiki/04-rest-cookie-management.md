# Cookie Management
Hoppscotch provides a comprehensive cookie management system that allows you to view, create, edit, delete, and persist cookies across requests. Cookies are stored in a domain-keyed cookie jar and are automatically attached to outgoing requests when using compatible interceptors (Agent or Native).

## Overview
Cookie management in Hoppscotch is designed to simulate browser-like cookie behavior within the API client environment. The system consists of three main layers:

- **Data Layer** — A schema-defined `Cookie` type with standard cookie attributes (name, value, domain, path, expiry, security flags)
- **Service Layer** — The `CookieJarService` that stores and retrieves cookies organized by domain
- **UI Layer** — Modal components for managing cookies interactively
- **Integration Layer** — Interceptors (Agent and Native) that attach relevant cookies to outgoing requests and capture `Set-Cookie` headers from responses

### Key Concepts

- **Cookie Jar**: An in-memory `Map<string, Cookie[]>` where keys are domain names and values are arrays of cookies belonging to that domain
- **Domain-based Scoping**: Cookies are stored and retrieved based on domain matching (using `hostname.endsWith()`)
- **Cookie Validation**: When retrieving cookies for a request, the system validates path, expiry, and secure attributes
- **Platform Feature Flag**: Cookie management is exclusive to platforms with `cookiesEnabled: true` (Desktop App, Self-hosted Web) and is not available in the standard web app
- **Interceptor Capabilities**: Only interceptors declaring the `"cookies"` advanced capability (Agent and Native) will include cookies in requests

## Architecture
加载图表中...
The architecture follows a layered approach where the `CookieJarService` acts as the central state manager. The UI components read from and write to the cookie jar via the service, while interceptors query the service for relevant cookies before executing requests. The scripting runtime (`hopp.cookies` API) provides programmatic access to cookies within pre-request and test scripts.

### Component Responsibilities
ComponentFileResponsibility`CookieJarService`[cookie-jar.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/cookie-jar.service.ts)Stores cookies by domain, parses `Set-Cookie` strings, retrieves cookies matching a URL`AllModal.vue`[AllModal.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/cookies/AllModal.vue)Main cookie manager UI — lists domains and cookies, allows add/edit/delete`EditCookie.vue`[EditCookie.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/cookies/EditCookie.vue)Inline code editor for creating/editing cookie values`CookieSchema`[cookies.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/cookies.ts)Zod schema defining the Cookie data model
## Cookie Data Model
The `Cookie` type is defined using a Zod schema in the `@hoppscotch/data` package:

>
Source: [cookies.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/cookies.ts#L1-L16)

typescript1import { z } from "zod"
2
3export const CookieSchema = z.object({
4  name: z.string(),        // Cookie name
5  value: z.string(),       // Cookie value
6  domain: z.string(),      // Domain the cookie belongs to
7  path: z.string(),        // Path scope of the cookie (default: "/")
8  expires: z.string().optional(),   // Expiration date in ISO format
9  maxAge: z.number().optional(),    // Maximum age in seconds
10  httpOnly: z.boolean(),   // Whether cookie is HTTP-only
11  secure: z.boolean(),     // Whether cookie should only be sent over HTTPS
12  sameSite: z.enum(["None", "Lax", "Strict"]),  // SameSite attribute
13})
14
15export type Cookie = z.infer<typeof CookieSchema>
### Field Descriptions
FieldTypeRequiredDescription`name``string`YesThe cookie name (e.g., `"session_id"`)`value``string`YesThe cookie value (e.g., `"abc123"`)`domain``string`YesDomain scope (e.g., `"example.com"`)`path``string`YesURL path scope, typically `"/"``expires``string`OptionalExpiration date in ISO format. Absent for session cookies`maxAge``number`OptionalMaximum age in seconds. Absent if not set`httpOnly``boolean`Yes`true` if cookie is inaccessible to JavaScript`secure``boolean`Yes`true` if cookie should only be sent over HTTPS`sameSite``"None"` | `"Lax"` | `"Strict"`YesSameSite attribute for CSRF protection
## CookieJarService — Core Implementation
The `CookieJarService` is the central service that manages all cookie state. It extends the DIOC `Service` class and provides methods for storing, retrieving, and parsing cookies.

>
Source: [cookie-jar.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/cookie-jar.service.ts#L1-L57)

typescript1import { Service } from "dioc"
2import { ref } from "vue"
3import { parseString as setCookieParse } from "set-cookie-parser-es"
4import { Cookie } from "@hoppscotch/data"
5
6export class CookieJarService extends Service {
7  public static readonly ID = "COOKIE_JAR_SERVICE"
8
9  /**
10   * The cookie jar that stores all relevant cookie info.
11   * The keys correspond to the domain of the cookie.
12   * The cookie strings are stored as an array of strings corresponding to the domain
13   */
14  public cookieJar = ref(new Map<string, Cookie[]>())
15
16  public parseSetCookieString(setCookieString: string) {
17    return setCookieParse(setCookieString)
18  }
19
20  public bulkApplyCookiesToDomain(cookies: Cookie[], domain: string) {
21    const existingDomainEntries = this.cookieJar.value.get(domain) ?? []
22    existingDomainEntries.push(...cookies)
23    this.cookieJar.value.set(domain, existingDomainEntries)
24  }
25
26  public getCookiesForURL(url: URL) {
27    const relevantDomains = Array.from(this.cookieJar.value.keys()).filter(
28      (domain) => url.hostname.endsWith(domain)
29    )
30
31    return relevantDomains
32      .flatMap((domain) => {
33        const cookieStrings = this.cookieJar.value.get(domain)!
34        return cookieStrings.map((cookieString) =>
35          this.parseSetCookieString(cookieString.value)
36        )
37      })
38      .filter((cookie) => {
39        const passesPathCheck = url.pathname.startsWith(cookie.path ?? "/")
40        const passesExpiresCheck = !cookie.expires
41          ? true
42          : cookie.expires.getTime() >= new Date().getTime()
43        const passesSecureCheck = !cookie.secure
44          ? true
45          : url.protocol === "https:"
46        return passesPathCheck && passesExpiresCheck && passesSecureCheck
47      })
48  }
49}
### Key Design Decisions

- **Reactive State**: `cookieJar` is a Vue `ref`, making the cookie state reactive and automatically updating the UI when cookies change
- **Domain-keyed Storage**: Cookies are organized by domain in a `Map`, enabling efficient domain lookups
- **URL-based Retrieval**: `getCookiesForURL()` matches cookies by checking if the URL's hostname ends with the cookie's domain, supporting subdomain matching
- **Cookie Validation on Retrieval**: Before returning cookies, the service validates:

**Path check**: The request URL's path must start with the cookie's path
- **Expiry check**: Expired cookies are excluded
- **Secure check**: Secure cookies are only sent over HTTPS connections

## Request Flow — How Cookies Are Attached to Requests
加载图表中...
### Step-by-step Flow

- **Cookie Management**: Users add/edit/delete cookies through the `AllModal` UI, which creates a working copy of the cookie jar
- **Save Changes**: On save, the working copy replaces the actual cookie jar state in `CookieJarService`
- **Request Execution**: When a request is executed through the Agent or Native interceptor:

The interceptor calls `cookieJar.getCookiesForURL(requestURL)`
- The service filters cookies by domain matching, path, expiry, and secure flag
- Matched cookies are serialized into a `Cookie: name=value; name2=value2` header string
- The header is attached to the outgoing relay request

- **Response Processing**: After receiving the response, if it contains `Set-Cookie` headers, the interceptor (via the RequestRunner) parses them and applies them to the cookie jar

## Interceptor Integration
Both the Agent and Native interceptors declare `"cookies"` in their advanced capabilities and integrate with `CookieJarService`:

>
Source: [agent/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/agent/index.ts#L27-L36)

typescript1import { CookieJarService } from "~/services/cookie-jar.service"
2
3export class AgentKernelInterceptorService
4  extends Service
5  implements KernelInterceptor
6{
7  // ...
8  private readonly cookieJar = this.bind(CookieJarService)
9
10  public readonly capabilities: RelayCapabilities = {
11    // ...
12    advanced: new Set(["redirects", "cookies", "localaccess"]),
13  }
>
Source: [agent/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/agent/index.ts#L126-L137)

typescript1const relevantCookies = this.cookieJar.getCookiesForURL(
2  new URL(effectiveRequest.url!)
3)
4
5if (relevantCookies.length > 0) {
6  effectiveRequest.headers!["Cookie"] = relevantCookies
7    .map((cookie) => `${cookie.name!}=${cookie.value!}`)
8    .join(";")
9}
The `AdvancedCapability` type in the kernel relay definition lists `"cookies"` as a recognized advanced feature:

>
Source: [kernel/src/relay/v/1.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/relay/v/1.ts#L298-L308)

typescript1export type AdvancedCapability =
2  | "retry"
3  | "redirects"
4  | "timeout"
5  | "cookies"
6  | "keepalive"
7  | "tcpoptions"
8  | "ipv6"
9  | "http2"
10  | "http3"
11  | "localaccess"
## Platform Feature Flags
Cookie management behavior is controlled by platform feature flags defined in `PlatformDef`:

>
Source: [platform/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/index.ts#L40-L71)

typescript1platformFeatureFlags: {
2  exportAsGIST: boolean
3  hasTelemetry: boolean
4
5  /**
6   * Whether the platform supports cookies (affects whether the cookies footer item is shown)
7   * If a value is not given, then the value is assumed to be false
8   */
9  cookiesEnabled?: boolean
10
11  /**
12   * Whether the platform should prompt the user that cookies are being used.
13   */
14  promptAsUsingCookies?: boolean
15
16  /**
17   * Whether the platform uses cookie-based authentication.
18   * This affects CSRF security warnings for same-origin fetch calls in scripts.
19   * Self-hosted web instances use cookies, while cloud/desktop use bearer tokens.
20   */
21  hasCookieBasedAuth?: boolean
22}
The `getCookieJarEntries()` function in the RequestRunner checks the `cookiesEnabled` flag and returns `null` if cookies are not supported, making cookie operations exclusive to platforms that enable them:

>
Source: [RequestRunner.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/RequestRunner.ts#L794-L805)

typescript1const getCookieJarEntries = () => {
2  // Exclusive to the Desktop App
3  if (!platform.platformFeatureFlags.cookiesEnabled) {
4    return null
5  }
6
7  const cookieJarEntries = Array.from(
8    cookieJarService.cookieJar.value.values()
9  ).flatMap((cookies) => cookies)
10
11  return cookieJarEntries
12}
## Scripting API — `hopp.cookies`
The scripting sandbox exposes a `hopp.cookies` API for programmatic cookie management within pre-request and test scripts. This API is provided by the `getSharedCookieMethods` function:

>
Source: [shared.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/utils/shared.ts#L499-L589)

typescript1export const getSharedCookieMethods = (cookies: Cookie[] | null) => {
2  // Incoming `cookies` specified as `null` indicates unsupported platform
3  const cookiesSupported = cookies !== null
4  let updatedCookies: Cookie[] = cookies ?? []
5
6  const throwIfCookiesUnsupported = () => {
7    if (cookies === null) {
8      throw new Error(
9        "Cookies are not supported in the current platform and are exclusive to the Desktop App."
10      )
11    }
12  }
13
14  // Returns a specific cookie by domain and name, or null if not found
15  const cookieGetFn = (domain: unknown, name: unknown): Cookie | null => {
16    throwIfCookiesUnsupported()
17    if (typeof domain !== "string" || typeof name !== "string") {
18      throw new Error("Expected domain and cookieName to be strings")
19    }
20    return (
21      updatedCookies.find((c) => c.domain === domain && c.name === name) ?? null
22    )
23  }
24
25  // Sets a cookie for a domain (validates schema, replaces existing with same domain+name)
26  const cookieSetFn = (domain: string, cookie: Cookie): void => {
27    throwIfCookiesUnsupported()
28    if (typeof domain !== "string") {
29      throw new Error("Expected domain to be a string")
30    }
31    const result = CookieSchema.safeParse(cookie)
32    if (!result.success) {
33      throw new Error("Invalid cookie")
34    }
35    updatedCookies = updatedCookies.filter(
36      (c) => !(c.domain === domain && c.name === cookie.name)
37    )
38    updatedCookies.push(cookie)
39  }
40
41  // Checks if a cookie exists for a domain
42  const cookieHasFn = (domain: string, name: string): boolean => {
43    throwIfCookiesUnsupported()
44    if (typeof domain !== "string" || typeof name !== "string") {
45      throw new Error("Expected domain and cookieName to be strings")
46    }
47    return updatedCookies.some((c) => c.domain === domain && c.name === name)
48  }
49
50  // Returns all cookies for a domain
51  const cookieGetAllFn = (domain: string): Cookie[] => {
52    throwIfCookiesUnsupported()
53    if (typeof domain !== "string") {
54      throw new Error("Expected domain to be a string")
55    }
56    return updatedCookies.filter((c) => c.domain === domain)
57  }
58
59  // Deletes a specific cookie by domain and name
60  const cookieDeleteFn = (domain: string, name: string): void => {
61    throwIfCookiesUnsupported()
62    if (typeof domain !== "string" || typeof name !== "string") {
63      throw new Error("Expected domain and cookieName to be strings")
64    }
65    updatedCookies = updatedCookies.filter(
66      (c) => !(c.domain === domain && c.name === name)
67    )
68  }
69
70  // Clears all cookies for a domain
71  const cookieClearFn = (domain: string): void => {
72    throwIfCookiesUnsupported()
73    if (typeof domain !== "string") {
74      throw new Error("Expected domain to be a string")
75    }
76    updatedCookies = updatedCookies.filter((c) => c.domain !== domain)
77  }
78
79  return {
80    methods: {
81      get: cookieGetFn,
82      set: cookieSetFn,
83      has: cookieHasFn,
84      getAll: cookieGetAllFn,
85      delete: cookieDeleteFn,
86      clear: cookieClearFn,
87    },
88    updatedCookies,
89  }
90}
### `hopp.cookies` API Reference
MethodSignatureDescription`get``(domain: string, name: string) => Cookie | null`Returns a specific cookie by domain and name, or `null` if not found`set``(domain: string, cookie: Cookie) => void`Sets a cookie for the domain. Replaces existing cookie with same domain+name combination. Validates against `CookieSchema``has``(domain: string, name: string) => boolean`Returns `true` if a cookie with the given name exists for the domain`getAll``(domain: string) => Cookie[]`Returns all cookies for a given domain`delete``(domain: string, name: string) => void`Deletes a specific cookie by domain and name`clear``(domain: string) => void`Clears all cookies for a domain
**Error Handling:**

- All methods throw `"Cookies are not supported in the current platform"` when `cookies` is `null` (unsupported platform)
- `get`, `has`, and `delete` throw `"Expected domain and cookieName to be strings"` if non-string arguments are passed
- `set` throws `"Invalid cookie"` if the cookie object does not conform to `CookieSchema`
- `set` and `clear` throw `"Expected domain to be a string"` if domain is not a string

## CLI Cookie Handling
The CLI implementation uses the `tough-cookie` library's `CookieJar` with `axios-cookiejar-support` to handle cookies transparently:

>
Source: [hopp-fetch.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-cli/src/utils/hopp-fetch.ts#L1-L15)

typescript1import axios, { Method } from "axios";
2import type { HoppFetchHook } from "@hoppscotch/js-sandbox";
3import { wrapper as axiosCookieJarSupport } from "axios-cookiejar-support";
4import { CookieJar } from "tough-cookie";
5
6export const createHoppFetchHook = (): HoppFetchHook => {
7  // Cookie jar maintains cookies across redirects (matches Postman behavior)
8  const jar = new CookieJar();
9  const axiosWithCookies = axiosCookieJarSupport(axios.create());
10  // ...
11}
The CLI uses the `tough-cookie` `CookieJar` for automatic cookie management across redirects, with `withCredentials: true` to ensure cookies are included in requests.

## UI Components
### AllModal — Cookie Manager
The `AllModal.vue` component provides the full cookie management interface:

- Lists all domains that have cookies stored
- For each domain, shows all cookies with their `name => value` pairs
- Allows adding new domains, adding cookies to domains, editing cookie values, and deleting cookies
- Only shows when the current interceptor supports cookies (`interceptorService.current.value?.capabilities?.advanced?.has("cookies")`)
- Uses a **working copy** pattern: copies the cookie jar on open, applies changes only on save

### EditCookie — Cookie Editor
The `EditCookie.vue` component provides a CodeMirror-based editor for editing cookie values:

- Supports both **create** and **edit** modes
- In create mode: starts with an empty editor
- In edit mode: pre-fills with the existing `name=value` string
- Supports paste, copy, download, and line wrapping

### Curl Cookie Parsing
The cURL import helper can parse cookies from cURL command arguments, supporting both the `-b` flag and `--cookie` parameter:

>
Source: [cookies.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/curl/sub_helpers/cookies.ts#L1-L64)

typescript1import { pipe } from "fp-ts/function"
2import * as O from "fp-ts/Option"
3import {
4  objHasArrayProperty,
5  objHasProperty,
6} from "~/helpers/functional/object"
7
8export const getCookies = (parsedArguments: any): Record<string, string> => {
9  return pipe(
10    parsedArguments,
11    O.fromPredicate(objHasArrayProperty("b", "string")),
12    O.map((args) => parseCookieStrings(args.b)),
13    O.altW(() =>
14      pipe(
15        parsedArguments,
16        O.fromPredicate(objHasProperty("b", "string")),
17        O.map((args) => parseCookieString(args.b))
18      )
19    ),
20    O.altW(() =>
21      pipe(
22        parsedArguments,
23        O.fromPredicate(objHasArrayProperty("cookie", "string")),
24        O.map((args) => parseCookieStrings(args.cookie))
25      )
26    ),
27    O.altW(() =>
28      pipe(
29        parsedArguments,
30        O.fromPredicate(objHasProperty("cookie", "string")),
31        O.map((args) => parseCookieString(args.cookie))
32      )
33    ),
34    O.getOrElseW(() => ({}))
35  )
36}
## Inspections — Cookie Header Warning
The request inspector checks for `Cookie` headers in requests and warns users when they manually set a Cookie header without using an interceptor that supports cookies:

>
Source: [request.inspector.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/inspection/inspectors/request.inspector.ts#L96-L119)

typescript1{
2  matcher: (req) => {
3    const index = req.headers.findIndex((h) =>
4      h.key.toLowerCase().includes("cookie")
5    )
6    return index !== -1 ? { index, key: req.headers[index].key } : null
7  },
8  requires: { type: "advanced", name: "cookies" },
9  createInspection: (match) => ({
10    id: "cookie-header",
11    icon: markRaw(IconAlertTriangle),
12    text: { type: "text", text: this.t("inspections.header.cookie") },
13    severity: 2,
14    isApplicable: true,
15    locations: {
16      type: "header",
17      position: "key",
18      ...match,
19    },
20  }),
21},
## Configuration & Platform Setup
Cookie management is enabled at the platform level. Example from the self-hosted web configuration:

>
Source: [selfhost-web/src/main.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-selfhost-web/src/main.ts#L188-L194)

typescript1platformFeatureFlags: {
2  exportAsGIST: false,
3  hasTelemetry: false,
4  cookiesEnabled: config.cookiesEnabled,
5  promptAsUsingCookies: false,
6  hasCookieBasedAuth: platform === "web",
7},
## Related Links

- **Source: Cookie Data Model**: [packages/hoppscotch-data/src/cookies.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/cookies.ts)
- **Source: CookieJarService**: [packages/hoppscotch-common/src/services/cookie-jar.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/cookie-jar.service.ts)
- **Source: Cookie Manager UI**: [packages/hoppscotch-common/src/components/cookies/AllModal.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/cookies/AllModal.vue)
- **Source: Cookie Editor UI**: [packages/hoppscotch-common/src/components/cookies/EditCookie.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/cookies/EditCookie.vue)
- **Source: Scripting Cookie API**: [packages/hoppscotch-js-sandbox/src/utils/shared.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/utils/shared.ts)
- **Source: Agent Interceptor**: [packages/hoppscotch-common/src/platform/std/kernel-interceptors/agent/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/agent/index.ts)
- **Source: Native Interceptor**: [packages/hoppscotch-common/src/platform/std/kernel-interceptors/native/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/std/kernel-interceptors/native/index.ts)
- **Source: RequestRunner**: [packages/hoppscotch-common/src/helpers/RequestRunner.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/RequestRunner.ts)
- **Source: CLI Cookie Handling**: [packages/hoppscotch-cli/src/utils/hopp-fetch.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-cli/src/utils/hopp-fetch.ts)
- **Source: cURL Cookie Parsing**: [packages/hoppscotch-common/src/helpers/curl/sub_helpers/cookies.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/curl/sub_helpers/cookies.ts)
- **Source: Platform Feature Flags**: [packages/hoppscotch-common/src/platform/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/index.ts)
- **Source: Kernel Relay Capabilities**: [packages/hoppscotch-kernel/src/relay/v/1.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-kernel/src/relay/v/1.ts)
- **Source: Cookie Tests**: [packages/hoppscotch-js-sandbox/src/**tests**/hopp-namespace/cookies.spec.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-js-sandbox/src/__tests__/hopp-namespace/cookies.spec.ts)
- **Related: Request Inspector**: [packages/hoppscotch-common/src/services/inspection/inspectors/request.inspector.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/inspection/inspectors/request.inspector.ts)