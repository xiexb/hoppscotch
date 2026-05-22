# Authentication Helpers
A comprehensive set of helper functions for generating authentication headers and query parameters across various authentication schemes (Basic, Bearer, API Key, Digest, AWS Signature, HAWK, JWT, and OAuth 2.0) used by the REST API client in Hoppscotch.

## Overview
The Authentication Helpers module provides a centralized, extensible framework for handling HTTP request authentication. It sits between the UI layer (where users configure auth settings) and the request execution pipeline, transforming user-configured authentication parameters into actual HTTP headers and query parameters that get sent with API requests.

**Key design goals:**

- **Unified interface** — A single `generateAuthHeaders()` / `generateAuthParams()` entry point dispatches to the correct auth type handler
- **Template variable resolution** — All auth field values support environment variable and request variable interpolation via `parseTemplateString`
- **Extensibility** — Adding a new auth type requires only creating a new handler file and registering it in the dispatch switch
- **Multi-target support** — Many auth types can target either HTTP headers **or** query parameters (e.g., API Key, JWT, AWS Signature, OAuth 2.0)

## Architecture
The authentication helper system follows a **dispatch pattern** where a central routing function delegates to type-specific handler modules:

加载图表中...
### Component Responsibilities
ModuleRole`auth-types.ts`Central dispatcher — routes auth generation requests to the correct type handler`index.ts`Template string resolver for environment/request variables`types/basic.ts`HTTP Basic Authentication (RFC 7617) — base64-encoded username:password`types/bearer.ts`Bearer Token Authentication (RFC 6750)`types/api-key.ts`API Key Authentication — supports headers or query params`types/digest.ts` + `digest.ts`Digest Access Authentication (RFC 7616) — challenge-response flow`types/aws-signature.ts`AWS Signature V4 — for signing AWS API requests`types/hawk.ts`HAWK Authentication — partial HTTP request verification`types/jwt.ts`JSON Web Token (JWT) — generates signed JWT tokens`types/oauth2.ts`OAuth 2.0 Bearer Token — supports multiple grant types`digest.ts`Core Digest math (MD5 hashing, header parsing, challenge fetching)
## Supported Authentication Types
The system currently supports **9 authentication types** (plus "None" and "Inherit"):

Auth Type KeyDisplay NameCan Target Params?Implementation`none`None—No-op`inherit`Inherit—Inherits from parent collection`basic`Basic AuthNo`types/basic.ts``bearer`BearerNo`types/bearer.ts``api-key`API KeyYes (headers/params)`types/api-key.ts``digest`Digest AuthNo`types/digest.ts` + `digest.ts``aws-signature`AWS SignatureYes (headers/params)`types/aws-signature.ts``hawk`HAWKNo`types/hawk.ts``jwt`JWTYes (headers/params)`types/jwt.ts``oauth-2`OAuth 2.0Yes (headers/params)`types/oauth2.ts`
## Core Flow
### Auth Header/Parameter Generation Flow
加载图表中...
### Digest Auth Detailed Flow
Digest Authentication requires a **two-step handshake**:

加载图表中...
## Usage Examples
### Basic Usage — Generating Auth Headers
The primary entry point is the `generateAuthHeaders()` function. It accepts the auth configuration, the full request object, environment variables, and an optional flag for revealing secret values:

typescript1import {
2  generateAuthHeaders,
3  generateAuthParams,
4} from "~/helpers/auth/auth-types"
5import { HoppRESTAuth, HoppRESTRequest, Environment } from "@hoppscotch/data"
6
7// Given an auth configuration (e.g., "Basic Auth")
8const auth: HoppRESTAuth = {
9  authType: "basic",
10  authActive: true,
11  username: "admin",
12  password: "{{my_secret_password}}",  // Template variable
13}
14
15const request: HoppRESTRequest = { /* ... full request object ... */ }
16const envVars: Environment["variables"] = [
17  { key: "my_secret_password", value: "s3cr3t", secret: true },
18]
19
20// Generate the authorization headers
21const headers = await generateAuthHeaders(auth, request, envVars)
22// Result: [{ active: true, key: "Authorization", value: "Basic YWRtaW46czNjcjN0", description: "" }]
>
Source: [auth-types.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/auth/auth-types.ts#L29-L57)

### Bearer Token
typescript1const auth: HoppRESTAuth = {
2  authType: "bearer",
3  authActive: true,
4  token: "sk_live_abc123xyz789",
5}
6
7const headers = await generateAuthHeaders(auth, request, envVars)
8// Result: [{ active: true, key: "Authorization", value: "Bearer sk_live_abc123xyz789", description: "" }]
>
Source: [types/bearer.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/auth/types/bearer.ts#L8-L23)

### API Key (as Header)
typescript1const auth: HoppRESTAuth = {
2  authType: "api-key",
3  authActive: true,
4  key: "X-API-Key",
5  value: "my-api-key-123",
6  addTo: "HEADERS", // Can also be "QUERY_PARAMS"
7}
8
9const headers = await generateAuthHeaders(auth, request, envVars)
10// Result: [{ active: true, key: "X-API-Key", value: "my-api-key-123", description: "" }]
>
Source: [types/api-key.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/auth/types/api-key.ts#L9-L29)

### Generating Auth Parameters
Some auth types support adding credentials as query parameters instead of headers:

typescript1const auth: HoppRESTAuth = {
2  authType: "api-key",
3  authActive: true,
4  key: "api_key",
5  value: "abc123",
6  addTo: "QUERY_PARAMS",
7}
8
9const params = await generateAuthParams(auth, request, envVars)
10// Result: [{ active: true, key: "api_key", value: "abc123", description: "" }]
>
Source: [auth-types.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/auth/auth-types.ts#L62-L82)

### JWT Authentication
JWT auth generates a signed token using the configured algorithm (HS256, HS384, HS512, RS256, RS384, RS512, ES256, ES384, ES512, EdDSA, PS256, PS384, PS512):

typescript1const auth: HoppRESTAuth = {
2  authType: "jwt",
3  authActive: true,
4  algorithm: "HS256",
5  secret: "my-secret-key",
6  payload: '{"sub":"1234567890","name":"John Doe"}',
7  addTo: "HEADERS",
8  headerPrefix: "Bearer ",  // Customizable prefix
9  isSecretBase64Encoded: false,
10}
11
12const headers = await generateAuthHeaders(auth, request, envVars)
13// Result: [{ active: true, key: "Authorization", value: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", description: "" }]
>
Source: [types/jwt.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/auth/types/jwt.ts#L10-L44)

### Template String Resolution
All auth helpers use `replaceTemplateStringsInObjectValues()` from the index module to resolve `{{variable}}` template references against the combined set of environment variables (selected → global → request variables):

typescript1import { replaceTemplateStringsInObjectValues } from "~/helpers/auth"
2import { getCombinedEnvVariables } from "~/helpers/utils/environments"
3
4// This merges selected env vars, global env vars, and request variables
5// with request variables taking highest priority
6const envs = getCombinedEnvVariables()
7const resolved = replaceTemplateStringsInObjectValues({
8  value: "Bearer {{my_token}}",
9})
>
Source: [index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/auth/index.ts#L7-L58)

## Configuration Options
Auth configuration is defined through the `HoppRESTAuth` discriminated union type (Zod schema). Each auth type has its own specific fields:

Auth TypeFieldTypeDefaultDescription**All Types**`authActive``boolean``true`Whether auth is enabled for this request**Basic**`username``string``""`Username for Basic Auth`password``string``""`Password for Basic Auth**Bearer**`token``string``""`Bearer token value**API Key**`key``string``""`Header/param name`value``string``""`Header/param value`addTo``"HEADERS" | "QUERY_PARAMS"``"HEADERS"`Where to place the key**Digest**`username``string``""`Username`password``string``""`Password`realm``string`(from server)Authentication realm`nonce``string`(from server)Server nonce`algorithm``string``"MD5"`Hash algorithm`qop``string`(from server)Quality of protection`opaque``string`(from server)Opaque value from server**AWS Signature**`accessKey``string``""`AWS access key ID`secretKey``string``""`AWS secret access key`region``string``"us-east-1"`AWS region`serviceName``string``""`AWS service name`serviceToken``string`—Session token (optional)`addTo``"HEADERS" | "QUERY_PARAMS"``"HEADERS"`Signing target**HAWK**`authId``string``""`Hawk authentication ID`authKey``string``""`Hawk authentication key`algorithm``"sha256" | "sha1"``"sha256"`Hash algorithm`includePayloadHash``boolean`—Include payload hash`nonce``string`—Client nonce (optional)**JWT**`algorithm``string``"HS256"`JWT signing algorithm`secret``string``""`HMAC secret / RSA private key`payload``string``"{}"`JSON payload as string`addTo``"HEADERS" | "QUERY_PARAMS"``"HEADERS"`Where to place token`headerPrefix``string``"Bearer "`Prefix in Authorization header`paramName``string``"token"`Query param name`isSecretBase64Encoded``boolean``false`Whether secret is base64`jwtHeaders``string``"{}"`Custom JWT header JSON**OAuth 2.0**`grantTypeInfo`*See below*—Grant type configuration`addTo``"HEADERS" | "QUERY_PARAMS"``"HEADERS"`Where to place token
### OAuth 2.0 Grant Types
OAuth 2.0 supports four grant types, each with its own parameter set:

加载图表中...
## API Reference
### `generateAuthHeaders(auth, request, envVars, showKeyIfSecret?): Promise<HoppRESTHeader[]>`
The main entry point for generating authentication headers based on the configured auth type.

>
Source: [auth-types.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/auth/auth-types.ts#L29-L57)

**Parameters:**

- `auth` (`HoppRESTAuth`): The authentication configuration object, including `authType`, `authActive`, and type-specific fields
- `request` (`HoppRESTRequest`): The full REST request object (needed by Digest, AWS Signature, HAWK for body/endpoint data)
- `envVars` (`Environment["variables"]`): Array of environment variables for template string resolution
- `showKeyIfSecret` (`boolean`, default `false`): When `true`, secret values will be included in output (for display); when `false`, secrets are masked

**Returns:** `Promise<HoppRESTHeader[]>` — Array of header objects with `active`, `key`, `value`, and `description` fields

**Throws:** May throw errors from `fetchInitialDigestAuthInfo()` if the initial Digest Auth challenge request fails

### `generateAuthParams(auth, request, envVars, showKeyIfSecret?): Promise<HoppRESTParam[]>`
Generates query parameters for auth types that support parameter-based authentication (API Key, OAuth 2.0, AWS Signature, JWT).

>
Source: [auth-types.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/auth/auth-types.ts#L62-L82)

**Parameters:** Same as `generateAuthHeaders`

**Returns:** `Promise<HoppRESTParam[]>` — Array of parameter objects with `active`, `key`, `value`, and `description` fields

### `generateDigestAuthHeader(params: DigestAuthParams): Promise<string>`
Computes the HTTP Digest Access Authentication header value using MD5 hashing.

>
Source: [digest.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/auth/digest.ts#L24-L71)

**Parameters:**

- `params.username` (`string`): Authentication username
- `params.password` (`string`): Authentication password
- `params.realm` (`string`): Authentication realm from server
- `params.nonce` (`string`): Server nonce
- `params.endpoint` (`string`): Full request URL
- `params.method` (`string`): HTTP method (GET, POST, etc.)
- `params.algorithm` (`string`, default `"MD5"`): Hash algorithm (`"MD5"` or `"MD5-sess"`)
- `params.qop` (`string`): Quality of Protection
- `params.nc` (`string`, default `"00000001"`): Nonce count
- `params.opaque` (`string`, optional): Server opaque value
- `params.cnonce` (`string`, optional): Client nonce
- `params.reqBody` (`string`, default `" "`): Request body for `auth-int` QOP

**Returns:** `Promise<string>` — The full `Digest` Authorization header value

### `fetchInitialDigestAuthInfo(url, method): Promise<DigestAuthInfo>`
Performs the initial unauthenticated request to obtain Digest Authentication challenge parameters from the server's `WWW-Authenticate` header.

>
Source: [digest.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/auth/digest.ts#L81-L148)

**Parameters:**

- `url` (`string`): The request URL
- `method` (`string`): HTTP method for the initial request

**Returns:** `Promise<DigestAuthInfo>` — Object with `realm`, `nonce`, `qop`, `opaque`, and `algorithm`

**Throws:**

- `Error`: If the initial request fails, or response status is not 401
- `Error`: If the `WWW-Authenticate` header cannot be parsed

### `replaceTemplateStringsInObjectValues<T>(obj, source?): T`
Resolves template variables (`{{variable}}`) in all string values of an object against the combined environment (selected + global + request variables).

>
Source: [index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/auth/index.ts#L7-L58)

**Parameters:**

- `obj` (`T extends Record<string, unknown>`): An object whose string values may contain template references
- `source` (`"REST" | "GQL"`, default `"REST"`): Context to determine whether to include REST request variables

**Returns:** The object with all template strings resolved

## Kernel Integration — Auth Transformation
Beyond direct header generation, the authentication helpers integrate with Hoppscotch's kernel system through a transformation pipeline. The `transformAuth()` function in `helpers/kernel/common/auth.ts` converts the Hoppscotch auth configuration into the kernel's internal `AuthType` format, enabling auth to work across different execution environments (browser, CLI, etc.):

typescript1import { transformAuth } from "~/helpers/kernel/common/auth"
2import * as TE from "fp-ts/TaskEither"
3
4// Transforms HoppRESTAuth into kernel AuthType
5const result = await transformAuth(hoppRESTAuth)()
6// On success: E.right({ kind: "basic", username: "admin", password: "..." })
7// On error: E.left(Error("Invalid basic auth"))
>
Source: [kernel/common/auth.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/kernel/common/auth.ts#L278-L286)

## Curl Import Integration
The `getAuthObject()` function in `helpers/curl/sub_helpers/auth.ts` parses authentication from curl command arguments. It checks three sources in priority order:

- **Authorization header** — Detects `Bearer` and `Basic` auth schemes
- **`--user` / `-u` argument** — Parses `username:password` format
- **URL credentials** — Extracts `user:password@host` from the URL

typescript1import { getAuthObject } from "~/helpers/curl/sub_helpers/auth"
2
3const parsedArgs = { u: "admin:password123" }
4const headers = { Authorization: "Bearer my_token" }
5const url = new URL("https://user:pass@api.example.com/data")
6
7const auth = getAuthObject(parsedArgs, headers, url)
8// auth.authType will be "bearer" (highest priority match)
>
Source: [curl/sub_helpers/auth.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/curl/sub_helpers/auth.ts#L106-L116)

## Related Links

- [REST API Client Overview](./4-rest-api-client.1-overview)
- [REST API Client — Environment Variables](./4-rest-api-client.2-environment-variables)
- [HoppRESTAuth Data Schema](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/rest/v/15/auth.ts)
- [Authorization UI Component](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/Authorization.vue)
- [OAuth 2.0 Service](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/oauth/oauth.service.ts)
- [OAuth 2.0 Auth Code Flow](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/oauth/flows/authCode.ts)
- [Auth Composables](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/composables/auth.ts)
- [Retry Auth Guard](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/retryAuthGuard.ts)
- [Auth Tests](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/auth/types/__tests__)