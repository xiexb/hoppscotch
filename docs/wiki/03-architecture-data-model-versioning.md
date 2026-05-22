# Data Model Versioning
Hoppscotch employs a formal versioning system for all its core data models (REST requests, GraphQL requests, collections, environments) using the `verzod` library, enabling backward-compatible schema migration and automatic data transformation across versions.

## Overview
The Hoppscotch data model versioning system is built to address a fundamental challenge: user data persisted in one version of the application must continue to work in future versions, even as the data schema evolves. The system uses the **`verzod`** library (built on top of **`zod`** schema validation) to define versioned entities where each version knows how to migrate data from the previous version.

### Key Design Principles

- **Forward Compatibility**: Old data files (`JSON` collections, environments) can be loaded by new versions of the application
- **Automatic Migration**: Data is transparently migrated to the latest schema version when parsed
- **Type Safety**: Every schema version produces fully-typed TypeScript interfaces
- **Incremental Evolution**: Each version only defines the delta from the previous version, minimizing duplication
- **Recursive Migration**: Nested structures (collection folders containing requests) are migrated recursively

### Versioned Data Entities
The system defines five primary versioned entities:

EntityPackage PathLatest VersionDescription`HoppRESTRequest``@hoppscotch/data/rest`17REST API request definition`HoppGQLRequest``@hoppscotch/data/graphql`9GraphQL request definition`HoppCollection``@hoppscotch/data/collection`12Collection (folder) of requests`Environment``@hoppscotch/data/environment`2Workspace environment variables`GlobalEnvironment``@hoppscotch/data/global-environment`2Global environment variables`HoppRESTRequestResponse``@hoppscotch/data/rest-request-response`0Stored REST response data
### Core Dependencies
The versioning system is built on top of two foundational libraries:

- **[zod](https://zod.dev)** (`^3.25.32`): Runtime schema validation and type inference
- **[verzod](https://npmjs.com/package/verzod)** (`^0.4.0`): Versioned entity framework enabling schema migration chains

>
Source: [package.json](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/package.json#L42-L51)

## Architecture
### Versioning System Architecture
The following diagram illustrates how the versioned entities relate to each other and how data flows through the migration pipeline:

加载图表中...
### Version Schema Directory Structure
Each versioned entity follows a consistent directory layout. For example, REST requests:

1src/rest/
2├── index.ts           # Entity definition (createVersionedEntity)
3├── content-types.ts   # Shared content type definitions
4├── v/
5│   ├── 0.ts           # Initial version schema (initial: true, no migration)
6│   ├── 1.ts           # V1 schema + migration from V0
7│   ├── 2.ts           # V2 schema + migration from V1
8│   ├── ...
9│   ├── 14.ts          # V14 schema + migration from V13
10│   ├── 15/
11│   │   ├── index.ts   # V15 schema + migration from V14
12│   │   └── auth.ts    # OAuth2 auth definitions for V15
13│   ├── 16.ts          # V16 schema + migration from V15
14│   └── 17.ts          # V17 schema + migration from V16 (latest)
>
Sources:

- [rest/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/rest/index.ts)
- [rest/v/ directory](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/rest/v/)

## Core Flow
### Schema Migration Process
The following sequence diagram shows what happens when a legacy data file is loaded:

加载图表中...
### Version Detection Strategies
Different entities use slightly different version detection strategies based on how the `v` field is stored:

**For `HoppRESTRequest` (v stored as stringified number):**

typescript1const versionedObject = z.object({
2  v: z.string().regex(/^\d+$/).transform(Number),
3})
4
5getVersion(data) {
6  const versionCheck = versionedObject.safeParse(data)
7  if (versionCheck.success) return versionCheck.data.v
8
9  // Fallback: try V0 schema
10  const result = V0_VERSION.schema.safeParse(data)
11  return result.success ? 0 : null
12}
>
Source: [rest/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/rest/index.ts#L75-L112)

**For `HoppCollection`, `HoppGQLRequest`, `Environment`, `GlobalEnvironment` (v stored as number):**

typescript1const versionedObject = z.object({
2  v: z.number(),
3})
4
5getVersion(data) {
6  const versionCheck = versionedObject.safeParse(data)
7  if (versionCheck.success) return versionCheck.data.v
8
9  // Fallback: try initial schema
10  const result = V1_VERSION.schema.safeParse(data)
11  return result.success ? 1 : null
12}
>
Source: [collection/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/collection/index.ts#L23-L53)

## Version Schema Definitions
### Anatomy of a Version Definition
Each version is defined using `defineVersion()` from `verzod`. A version consists of:

- **Schema**: A zod schema describing the data shape for this version
- **Initial flag**: Whether this is the initial version (no migration needed)
- **Up function**: A migration function that transforms data from the previous version

#### Initial Version (no migration)
The initial version defines the schema starting point. It has no `up` function:

typescript1import { defineVersion } from "verzod"
2import { z } from "zod"
3
4export const V0_SCHEMA = z.object({
5  id: z.optional(z.string()),
6  url: z.string(),
7  path: z.string(),
8  headers: z.array(
9    z.object({
10      key: z.string(),
11      value: z.string(),
12      active: z.boolean()
13    })
14  ),
15  params: z.array(
16    z.object({
17      key: z.string(),
18      value: z.string(),
19      active: z.boolean()
20    })
21  ),
22  name: z.string(),
23  method: z.string(),
24  preRequestScript: z.string(),
25  testScript: z.string(),
26  contentType: z.string(),
27  body: z.string(),
28  rawParams: z.optional(z.string()),
29  auth: z.optional(z.string()),
30  httpUser: z.optional(z.string()),
31  httpPassword: z.optional(z.string()),
32  bearerToken: z.optional(z.string()),
33})
34
35export default defineVersion({
36  initial: true,
37  schema: V0_SCHEMA
38})
>
Source: [rest/v/0.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/rest/v/0.ts)

#### Migration Version (with up function)
Subsequent versions extend the previous schema and provide an `up()` function for migration:

typescript1import { defineVersion } from "verzod"
2import { z } from "zod"
3import { V1_SCHEMA } from "./1"
4
5export const HoppRESTRequestVariables = z.array(
6  z.object({
7    key: z.string().catch(""),
8    value: z.string().catch(""),
9    active: z.boolean().catch(true),
10  })
11)
12
13export const V2_SCHEMA = V1_SCHEMA.extend({
14  v: z.literal("2"),
15  requestVariables: HoppRESTRequestVariables,
16})
17
18export default defineVersion({
19  initial: false,
20  schema: V2_SCHEMA,
21  up(old: z.infer<typeof V1_SCHEMA>) {
22    return {
23      ...old,
24      v: "2",
25      requestVariables: [],
26    } as z.infer<typeof V2_SCHEMA>
27  },
28})
>
Source: [rest/v/2.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/rest/v/2.ts)

### Complex Migration Example
Some migrations require data transformation logic. Here is an example from the OAuth2 migration (V14 → V15 for REST, V8 → V9 for GraphQL) that adds advanced OAuth2 parameters:

typescript1export default defineVersion({
2  schema: V15_SCHEMA,
3  initial: false,
4  up(old: z.infer<typeof V14_SCHEMA>) {
5    let newAuth: z.infer<typeof HoppRESTAuth>
6    if (old.auth.authType === "oauth-2") {
7      const oldGrantTypeInfo = old.auth.grantTypeInfo
8      let newGrantTypeInfo
9
10      // Add advanced parameters based on grant type
11      if (oldGrantTypeInfo.grantType === "AUTHORIZATION_CODE") {
12        newGrantTypeInfo = {
13          ...oldGrantTypeInfo,
14          authRequestParams: [],
15          tokenRequestParams: [],
16          refreshRequestParams: [],
17        }
18      } else if (oldGrantTypeInfo.grantType === "CLIENT_CREDENTIALS") {
19        newGrantTypeInfo = {
20          ...oldGrantTypeInfo,
21          tokenRequestParams: [],
22          refreshRequestParams: [],
23        }
24      }
25      // ... other grant types
26      else {
27        newGrantTypeInfo = oldGrantTypeInfo
28      }
29
30      newAuth = {
31        ...old.auth,
32        grantTypeInfo: newGrantTypeInfo,
33      } as z.infer<typeof HoppRESTAuth>
34    } else {
35      newAuth = old.auth
36    }
37
38    return {
39      ...old,
40      v: "15" as const,
41      auth: newAuth,
42    }
43  },
44})
>
Source: [rest/v/15/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/rest/v/15/index.ts#L13-L67)

## Entity Creation
### Creating a Versioned Entity
An entity is created by calling `createVersionedEntity()` with the version map and a version detection function:

typescript1import { InferredEntity, createVersionedEntity } from "verzod"
2import { z } from "zod"
3
4// Import all version schemas
5import V1_VERSION from "./v/1"
6import V2_VERSION from "./v/2"
7// ... up to latest
8
9const versionedObject = z.object({
10  v: z.number(),
11})
12
13export const HoppCollection = createVersionedEntity({
14  latestVersion: 12,
15  versionMap: {
16    1: V1_VERSION,
17    2: V2_VERSION,
18    3: V3_VERSION,
19    4: V4_VERSION,
20    5: V5_VERSION,
21    6: V6_VERSION,
22    7: V7_VERSION,
23    8: V8_VERSION,
24    9: V9_VERSION,
25    10: V10_VERSION,
26    11: V11_VERSION,
27    12: V12_VERSION,
28  },
29  getVersion(data) {
30    const versionCheck = versionedObject.safeParse(data)
31    if (versionCheck.success) return versionCheck.data.v
32
33    // Fallback: try initial schema
34    const result = V1_VERSION.schema.safeParse(data)
35    return result.success ? 1 : null
36  },
37})
38
39export type HoppCollection = InferredEntity<typeof HoppCollection>
40export const CollectionSchemaVersion = 12
>
Source: [collection/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/collection/index.ts#L1-L61)

### Entity API
A versioned entity exposes the following methods:

MethodDescription`safeParse(data)`Parses and migrates data to the latest version. Returns `Either<Error, LatestType>``is(data)`Checks if data conforms to the latest schema version`isLatest(data)`Same as `is()` — checks if data is at the latest version`isOfVersion(data, v)`Checks if data conforms to a specific version`safeParseUpToVersion(data, v)`Parses and migrates data up to a specified version (used in recursive migrations)
### Creating New Data at Latest Version
Helper functions ensure new data is always created at the latest schema version:

typescript1export function makeRESTRequest(
2  x: Omit<HoppRESTRequest, "v">
3): HoppRESTRequest {
4  return {
5    v: RESTReqSchemaVersion,  // Always "17"
6    _ref_id: x._ref_id ?? generateUniqueRefId("req"),
7    ...x,
8  }
9}
10
11export function getDefaultRESTRequest(): HoppRESTRequest {
12  const ref_id = generateUniqueRefId("req")
13  return {
14    v: RESTReqSchemaVersion,
15    endpoint: "https://echo.hoppscotch.io",
16    name: "Untitled",
17    params: [],
18    headers: [],
19    method: "GET",
20    auth: {
21      authType: "inherit",
22      authActive: true,
23    },
24    preRequestScript: "",
25    testScript: "",
26    body: {
27      contentType: null,
28      body: null,
29    },
30    requestVariables: [],
31    responses: {},
32    _ref_id: ref_id,
33    description: null,
34  }
35}
>
Source: [rest/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/rest/index.ts#L242-L276)

### Schema Version Constants
Each entity exports a constant representing the current schema version:

typescript1// REST
2export const RESTReqSchemaVersion = "17"
3
4// GraphQL
5export const GQL_REQ_SCHEMA_VERSION = 9
6
7// Collection
8export const CollectionSchemaVersion = 12
9
10// Environment
11export const EnvironmentSchemaVersion = 2
## Usage Examples
### Basic Usage: Loading and Migrating Legacy Data
The primary entry point for loading data is `safeParse()`, which automatically migrates data across all versions:

typescript1import { HoppRESTRequest } from "@hoppscotch/data"
2
3// Legacy V0 data (no version field, old schema)
4const legacyData = {
5  url: "https://echo.hoppscotch.io",
6  path: "/api",
7  name: "My Request",
8  method: "GET",
9  headers: [{ key: "Accept", value: "application/json", active: true }],
10  params: [],
11  preRequestScript: "",
12  testScript: "",
13  contentType: "application/json",
14  body: "",
15}
16
17// Automatically detected as V0, migrated through V1-V17
18const result = HoppRESTRequest.safeParse(legacyData)
19
20if (result.type === "ok") {
21  const migratedRequest = result.value
22  console.log(migratedRequest.v) // "17"
23  console.log(migratedRequest.endpoint) // "https://echo.hoppscotch.io/api"
24  console.log(migratedRequest.body) // { contentType: "application/json", body: "" }
25}
### Loading a Collection from File (CLI)
The CLI's `parseCollectionData` function demonstrates real-world usage with `entityReference`:

typescript1import { HoppCollection, HoppRESTRequest } from "@hoppscotch/data"
2import { entityReference } from "verzod"
3import { z } from "zod"
4
5export async function parseCollectionData(
6  pathOrId: string,
7  options: TestCmdCollectionOptions
8): Promise<HoppCollection[]> {
9  const contents = await getResourceContents({
10    pathOrId,
11    accessToken: options.token,
12    serverUrl: options.server,
13    resourceType: "collection",
14  })
15
16  const maybeArrayOfCollections: unknown[] = Array.isArray(contents)
17    ? contents
18    : [contents]
19
20  // entityReference triggers auto-migration through the version chain
21  const collectionSchemaParsedResult = z
22    .array(entityReference(HoppCollection))
23    .safeParse(maybeArrayOfCollections)
24
25  if (!collectionSchemaParsedResult.success) {
26    throw error({
27      code: "MALFORMED_COLLECTION",
28      path: pathOrId,
29      data: "Please check the collection data.",
30    })
31  }
32
33  return getValidRequests(collectionSchemaParsedResult.data, pathOrId)
34}
>
Source: [mutators.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-cli/src/utils/mutators.ts#L130-L159)

### Checking Data Version Validity
typescript1import { HoppRESTRequest, HoppCollection } from "@hoppscotch/data"
2
3function validateRequestData(data: unknown): data is HoppRESTRequest {
4  return HoppRESTRequest.isLatest(data)
5}
6
7// Example: validating version compatibility
8function checkVersionCompatibility(data: unknown): string {
9  if (HoppRESTRequest.isLatest(data)) {
10    return `Data is at latest version (${data.v})`
11  }
12  // safeParse will migrate it automatically
13  const result = HoppRESTRequest.safeParse(data)
14  if (result.type === "ok") {
15    return `Migrated from legacy to version ${result.value.v}`
16  }
17  return "Invalid data format"
18}
### Legacy Compatibility Helpers
The system provides legacy helper functions for backward compatibility:

typescript1import { translateToNewRequest, isHoppRESTRequest } from "@hoppscotch/data"
2
3// Legacy: safely extract request data with defaults
4const safelyExtracted = safelyExtractRESTRequest(someUnknownData, defaultRequest)
5
6// Legacy: translate old data to new format
7const translated = translateToNewRequest(oldRequestData)
8// Equivalent to: HoppRESTRequest.safeParse(oldRequestData)
9
10// Legacy: check if value is a valid request
11const isValid = isHoppRESTRequest(someData)
12// Equivalent to: HoppRESTRequest.isLatest(someData)
>
Source: [rest/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/rest/index.ts#L163-L299)

## Recursive Nested Migration
Collections can contain nested folders, each containing requests. The versioning system handles this recursively using `z.lazy()` and `entityRefUptoVersion()`:

typescript1import { defineVersion, entityRefUptoVersion } from "verzod"
2import { z } from "zod"
3
4const v12_baseCollectionSchema = v11_baseCollectionSchema.extend({
5  v: z.literal(12),
6  preRequestScript: z.string().catch(""),
7  testScript: z.string().catch(""),
8})
9
10type Input = z.input<typeof v12_baseCollectionSchema> & {
11  folders: Input[]
12}
13
14type Output = z.output<typeof v12_baseCollectionSchema> & {
15  folders: Output[]
16}
17
18export const V12_SCHEMA = v12_baseCollectionSchema.extend({
19  folders: z.lazy(() => z.array(entityRefUptoVersion(HoppCollection, 12))),
20}) as z.ZodType<Output, z.ZodTypeDef, Input>
21
22export default defineVersion({
23  initial: false,
24  schema: V12_SCHEMA,
25  up(old: z.infer<typeof V11_SCHEMA>) {
26    const result: z.infer<typeof V12_SCHEMA> = {
27      ...old,
28      v: 12 as const,
29      preRequestScript: "",
30      testScript: "",
31      folders: old.folders.map((folder) => {
32        const result = HoppCollection.safeParseUpToVersion(folder, 12)
33        if (result.type !== "ok") {
34          throw new Error("Failed to migrate child collections")
35        }
36        return result.value
37      }),
38    }
39    return result
40  },
41})
>
Source: [collection/v/12.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/collection/v/12.ts)

## Version History Summary
### REST Request (`HoppRESTRequest`) — 18 versions (V0–V17)
VersionKey ChangesV0Initial schema: `url`, `path`, `headers`, `params`, `name`, `method`, `contentType`, `body`, `auth` (string-based)V1Structured auth object (discriminated union), `endpoint` replaces `url+path`, structured `body` with `contentType`V2Added `requestVariables` arrayV3Added implicit OAuth flow paramsV4Added API Key auth typeV5Added OAuth2 PKCE supportV6Schema refinementV7Added AWS Signature auth type; exported `HoppRESTHeaders`, `HoppRESTParams`V8Added Digest auth typeV9Enhanced body handling with form-data supportV10Body schema refactored into separate `body.ts`V11Added Client Credentials grant typeV12Added HAWK and Akamai EdgeGrid auth typesV13Added JWT auth typeV14Added stored responses supportV15OAuth2 advanced parameters (auth/token/refresh request params)V16Added `_ref_id` for offline sync referenceV17Added `description` field (nullable string)
### GraphQL Request (`HoppGQLRequest`) — 9 versions (V1–V9)
VersionKey ChangesV1Initial schema: basic query, headers, variablesV2Structured auth with discriminated union typesV3OAuth2 supportV4API Key auth typeV5PKCE supportV6AWS Signature auth, `GQLHeader` exportV7–V8Schema refinementV9OAuth2 advanced parameters (aligned with REST V15)
### Collection (`HoppCollection`) — 12 versions (V1–V12)
VersionKey ChangesV1Initial schema: name, requests (REST + GQL), foldersV2–V9Incremental evolution aligned with request schemasV10Added Collection VariablesV11Schema refinementV12Added `preRequestScript` and `testScript` at collection level
### Environment — 3 versions (V0–V2)
VersionKey ChangesV0Initial: `id`, `name`, simple `variables` (key-value pairs)V1Added `secret` flag supportV2Split value into `initialValue` and `currentValue` with secret handling
## Configuration Options
The data model versioning system is implicitly configured through the entity definition and has no external configuration. However, the schema version constants are tunable at build time:

ConstantModuleDefaultDescription`RESTReqSchemaVersion``@hoppscotch/data``"17"`Current REST request schema version`GQL_REQ_SCHEMA_VERSION``@hoppscotch/data``9`Current GraphQL request schema version`CollectionSchemaVersion``@hoppscotch/data``12`Current collection schema version`EnvironmentSchemaVersion``@hoppscotch/data``2`Current environment schema version
## API Reference
### `createVersionedEntity(config): VersionedEntity`
Creates a versioned entity with automatic migration support.

**Parameters:**

- `config.latestVersion` (number): The current/latest version number
- `config.versionMap` (Record<number, Version>): Map of version numbers to their schema definitions
- `config.getVersion` (Function): Function that detects the version from raw data

**Returns:** A `VersionedEntity` instance with methods:

- `safeParse(data)`: `Either<Errors, LatestType>` — validates and migrates to latest
- `isLatest(data)`: `boolean` — checks if data is at the latest version
- `isOfVersion(data, v)`: `boolean` — checks version
- `safeParseUpToVersion(data, v)`: `Either<Errors, VersionType>` — migrates to a specific version

### `defineVersion(config): Version`
Defines a single version in the version chain.

**Parameters:**

- `config.initial` (boolean): Whether this is the first version
- `config.schema` (z.ZodType): The zod schema for this version
- `config.up` (Function, optional): Migration function `(oldData) => newData` for non-initial versions

### `entityReference(entity)`
Creates a zod schema that references a versioned entity by reference, enabling recursive parsing and migration.

### `entityRefUptoVersion(entity, version)`
Creates a zod schema that references a versioned entity and migrates it up to a specific version number (used for recursive folder migration).

### `InferredEntity<T>`
Type utility that extracts the TypeScript type from a versioned entity.

## Related Links

- [Source: @hoppscotch/data package](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data)
- [REST Request Data Model — Index & Entity Definition](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/rest/index.ts)
- [GraphQL Request Data Model — Index & Entity Definition](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/graphql/index.ts)
- [Collection Data Model — Index & Entity Definition](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/collection/index.ts)
- [Environment Data Model — Index & Entity Definition](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/environment/index.ts)
- [Global Environment Data Model](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/global-environment/index.ts)
- [CLI Collection Parser & Migrator](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-cli/src/utils/mutators.ts)
- [CLI Workspace Access (Version Handling)](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-cli/src/utils/workspace-access.ts)
- [verzod Library (npm)](https://www.npmjs.com/package/verzod)
- [zod Schema Validation Library](https://zod.dev)
- [Architecture Overview](../3-architecture.0-overview)
- [REST API Data Flow](./3-architecture.3-rest-api-data-flow)