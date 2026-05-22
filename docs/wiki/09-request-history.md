# Request History
The Request History feature in Hoppscotch automatically tracks all REST and GraphQL API requests executed by a user, providing a browsable, searchable, and synced record of past requests with their response metadata. It supports starring favorites, clearing history, and real-time synchronization across sessions via GraphQL subscriptions.

## Overview
Hoppscotch's Request History system is designed to give users a persistent log of every API call they make, organized by request type (REST or GraphQL). This enables developers to revisit, reuse, and manage past requests without needing to reconstruct them.

The system operates on two independent tracks — one for REST requests and one for GraphQL requests — each with its own in-memory store, synchronization logic, and server-side persistence. History entries are automatically created whenever a request is executed, stored locally in a reactive store, and optionally synced to the backend for persistence across sessions and devices.

Key capabilities include:

- **Automatic capture** — History entries are created automatically when a request completes execution.
- **Dual-track storage** — REST and GraphQL histories are stored and managed independently.
- **Search and filter** — Entries can be filtered by text, starred status, and grouped by time or URL.
- **Star/bookmark** — Users can star important entries for quick access.
- **Cross-session sync** — History entries sync to a backend database (when enabled) and are synchronized in real time via GraphQL subscriptions.
- **Spotlight search** — History entries are searchable from the Hoppscotch Spotlight (command palette).
- **Configurable storage** — Administrators can enable or disable history storage through infrastructure configuration.

## Architecture
The Request History system spans the frontend state management layer, a platform abstraction layer for synchronization, and a backend GraphQL API with database persistence.

加载图表中...
### Architecture Layers Explained

-
**Frontend Stores** — Two `DispatchingStore` instances (`restHistoryStore` and `graphqlHistoryStore`) hold history entries as reactive state, capped at `HISTORY_LIMIT = 50` entries each. All UI components read from these stores via observables.

-
**Platform Sync Layer** — This abstraction defines how history entries are synchronized with the backend. The sync definitions map store dispatchers (`addEntry`, `deleteEntry`, `toggleStar`, `clearHistory`) to GraphQL mutations. The syncer uses a pattern that avoids double-insertion from subscription echoes.

-
**Backend Service** — The `UserHistoryService` provides all CRUD operations against a PostgreSQL `user_history` table via Prisma ORM. Each mutation publishes events via `PubSubService` for real-time propagation.

-
**Feature Flag Guard** — The `UserHistoryFeatureFlagGuard` checks the `USER_HISTORY_STORE_ENABLED` infrastructure configuration before allowing any history mutation. This lets administrators disable history storage entirely.

-
**Admin Configuration** — The admin panel exposes a toggle to enable/disable the history store and a button to clear all user history globally.

## Data Model
### Prisma Schema (Database)
History entries are stored in a `UserHistory` table with the following structure:

prisma1model UserHistory {
2  id               String   @id @default(cuid())
3  userUid          String
4  reqType          ReqType
5  request          Json
6  responseMetadata Json
7  isStarred        Boolean
8  executedOn       DateTime @default(now()) @db.Timestamptz(3)
9  user             User     @relation(fields: [userUid], references: [uid], onDelete: Cascade)
10}
>
Source: [schema.prisma](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/prisma/schema.prisma#L152-L161)

### Frontend Type Definitions
**REST History Entry:**

typescript1export type RESTHistoryEntry = {
2  v: number
3  request: HoppRESTRequest
4  responseMeta: {
5    duration: number | null
6    statusCode: number | null
7  }
8  star: boolean
9  id?: string // For when Firebase Firestore is set
10  updatedOn?: Date
11}
>
Source: [history.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/history.ts#L13-L28)

**GraphQL History Entry:**

typescript1export type GQLHistoryEntry = {
2  v: number
3  request: HoppGQLRequest
4  response: string
5  star: boolean
6  id?: string // For when Firestore ID is set
7  updatedOn?: Date
8}
>
Source: [history.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/history.ts#L30-L41)

### Entity Relationship Diagram
加载图表中...
## Core Flow
### Request Execution → History Entry Flow
When a user executes an API request in Hoppscotch, the following sequence occurs:

加载图表中...
### Design Intent
The subscription listener pattern prevents race conditions. When a user's own mutation completes, the syncer assigns the server-generated `id` to the local entry. The subscription handler checks if an entry with the same `id` already exists before inserting, preventing the "echo" of the user's own action from creating a duplicate entry.

## Usage Examples
### Creating History Entries (Automatic)
History entries are created automatically when a request completes. This is wired up at module load time by subscribing to the `executedResponses$` observable:

typescript1// Listen to completed responses to add to history
2executedResponses$.subscribe((res) => {
3  // Spread to auto-capture any future fields, but omit _ref_id and id
4  // since history entries are snapshots and shouldn't carry collection/firestore references
5  const { _ref_id, id, ...request } = res.req
6
7  addRESTHistoryEntry(
8    makeRESTHistoryEntry({
9      request,
10      responseMeta: {
11        duration: res.meta.responseDuration,
12        statusCode: res.statusCode,
13      },
14      star: false,
15      updatedOn: new Date(),
16    })
17  )
18})
>
Source: [history.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/history.ts#L354-L372)

### Programmatic Store Operations
The history store provides a clean API for CRUD operations:

typescript1// Set all entries (used when loading from backend)
2setRESTHistoryEntries(entries: RESTHistoryEntry[])
3
4// Add a single entry (prepends, caps at HISTORY_LIMIT=50)
5addRESTHistoryEntry(entry: RESTHistoryEntry)
6
7// Delete a specific entry (uses deep equality check)
8deleteRESTHistoryEntry(entry: RESTHistoryEntry)
9
10// Clear all entries for a type
11clearRESTHistory()
12
13// Toggle star status for an entry
14toggleRESTHistoryEntryStar(entry: RESTHistoryEntry)
15
16// Remove duplicate entry by server ID (used by sync layer)
17removeDuplicateRestHistoryEntry(id: string)
>
Source: [history.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/history.ts#L270-L352)

### Sync Definition Example
The synchronization layer maps store dispatches to GraphQL mutations:

typescript1export const restHistoryStoreSyncDefinition: StoreSyncDefinitionOf<
2  typeof restHistoryStore
3> = {
4  async addEntry({ entry }) {
5    if (!isHistoryStoreEnabled.value) {
6      return
7    }
8
9    const res = await createUserHistory(
10      JSON.stringify(entry.request),
11      JSON.stringify(entry.responseMeta),
12      ReqType.Rest
13    )
14
15    if (E.isRight(res)) {
16      entry.id = res.right.createUserHistory.id
17
18      // preventing double insertion from here and subscription
19      removeDuplicateRestHistoryEntry(entry.id)
20    }
21  },
22  deleteEntry({ entry }) {
23    if (entry.id) {
24      removeRequestFromHistory(entry.id)
25    }
26  },
27  toggleStar({ entry }) {
28    if (entry.id) {
29      toggleHistoryStarStatus(entry.id)
30    }
31  },
32  clearHistory() {
33    deleteAllUserHistory(ReqType.Rest)
34  },
35}
>
Source: [sync.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-selfhost-web/src/platform/history/web/sync.ts#L26-L60)

### History UI Provider Service
The `HistoryUIProviderService` allows platform-level customization of the history UI, enabling custom sidebar headers and full history component replacement:

typescript1export class HistoryUIProviderService extends Service {
2  public static readonly ID = "HISTORY_UI_PROVIDER_SERVICE"
3
4  public readonly isEnabled = ref<boolean>(false)
5
6  public readonly historyUIProviderTitle = ref<HistoryUIProviderTitle>((t) =>
7    t("tab.history")
8  )
9}
>
Source: [history-ui-provider.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/history-ui-provider.service.ts#L10-L17)

## Configuration Options
### Infrastructure Configuration
The history store feature can be enabled/disabled through infrastructure configuration:

OptionTypeDefaultDescription`USER_HISTORY_STORE_ENABLED``ENABLE` / `DISABLE`Platform-dependentControls whether user history is persisted to the server database`syncHistory` (user setting)`boolean`User preferenceIndividual user toggle for history synchronization
### Admin Configuration UI
The admin panel provides a `HistoryConfiguration.vue` component with:

- **Enable/Disable History Store** — A toggle to globally enable or disable history storage
- **Clear All History** — A button to revoke/delete all user history entries across all users

>
Source: [HistoryConfiguration.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-sh-admin/src/components/settings/HistoryConfiguration.vue)

### Constants
ConstantValueDescription`HISTORY_LIMIT``50`Maximum number of entries stored per request type (REST/GQL) in the frontend store
## API Reference
The backend exposes a GraphQL API for history management.

### GraphQL Mutations
#### `createUserHistory(reqData: String!, resMetadata: String!, reqType: ReqType!): UserHistory`
Creates a new history entry.

**Parameters:**

- `reqData` (String!): JSON string of the request data
- `resMetadata` (String!): JSON string of the response metadata
- `reqType` (ReqType!): `REST` or `GQL`

**Returns:** `UserHistory` object with generated `id`

**Throws:**

- `user_history/feature_flag_disabled`: When the history store feature flag is disabled
- `user_history/req_type_invalid`: When an invalid request type is provided

>
Source: [resolver.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/user-history/user-history.resolver.ts#L26-L57)

#### `toggleHistoryStarStatus(id: ID!): UserHistory`
Stars or unstars a history entry.

**Parameters:**

- `id` (ID!): The ID of the history entry

**Returns:** Updated `UserHistory` object

**Throws:**

- `user_history/history_not_found`: When the history entry doesn't exist

>
Source: [resolver.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/user-history/user-history.resolver.ts#L59-L76)

#### `removeRequestFromHistory(id: ID!): UserHistory`
Removes a single history entry.

**Parameters:**

- `id` (ID!): The ID of the history entry

**Throws:**

- `user_history/history_not_found`: When the history entry doesn't exist

>
Source: [resolver.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/user-history/user-history.resolver.ts#L78-L95)

#### `deleteAllUserHistory(reqType: ReqType!): UserHistoryDeletedManyData`
Deletes all history entries for a request type.

**Parameters:**

- `reqType` (ReqType!): `REST` or `GQL`

**Returns:** `{ count: Number, reqType: ReqType }`

>
Source: [resolver.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/user-history/user-history.resolver.ts#L97-L117)

### GraphQL Subscriptions
SubscriptionChannelPayloadDescription`userHistoryCreated``user_history/{uid}/created``UserHistory`Published when a new history entry is created`userHistoryUpdated``user_history/{uid}/updated``UserHistory`Published when a history entry is updated (e.g., star toggled)`userHistoryDeleted``user_history/{uid}/deleted``UserHistory`Published when a single entry is deleted`userHistoryDeletedMany``user_history/{uid}/deleted_many``UserHistoryDeletedManyData`Published when all entries for a type are deleted`userHistoryAllDeleted``user_history/all/deleted``Boolean`Published when an admin clears all history globally`userHistoryStoreStatusChanged`(infra config)`ServiceStatus`Published when admin toggles the history store
>
Source: [resolver.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/user-history/user-history.resolver.ts#L119-L169)

### GraphQL Queries
#### `me.RESTHistory` and `me.GQLHistory` (Field Resolvers on User)
graphql1query GetRESTUserHistory {
2  me {
3    RESTHistory {
4      id
5      userUid
6      reqType
7      request
8      responseMetadata
9      isStarred
10      executedOn
11    }
12    GQLHistory {
13      id
14      userUid
15      reqType
16      request
17      responseMetadata
18      isStarred
19      executedOn
20    }
21  }
22}
>
Source: [GetRestUserHistory.graphql](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-selfhost-web/src/api/queries/GetRestUserHistory.graphql)

## Related Links

- [History Store Implementation (Frontend)](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/history.ts) — Core types, store definitions, and dispatchers
- [History Platform Definition](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/platform/history.ts) — Platform abstraction interface
- [History UI Provider Service](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/history-ui-provider.service.ts) — Service for customizing history UI
- [Backend UserHistory Service](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/user-history/user-history.service.ts) — Server-side CRUD operations
- [Backend UserHistory Resolver](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/user-history/user-history.resolver.ts) — GraphQL mutations and subscriptions
- [Web Platform History Sync](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-selfhost-web/src/platform/history/web/index.ts) — Web platform initialization and subscription setup
- [Web Platform History Sync Definition](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-selfhost-web/src/platform/history/web/sync.ts) — Store-to-API sync definitions
- [Desktop Platform History Sync](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-selfhost-web/src/platform/history/desktop/index.ts) — Desktop platform initialization
- [History Spotlight Searcher](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/spotlight/searchers/history.searcher.ts) — Spotlight integration for history search
- [History UI Component](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/history/Personal.vue) — Main history listing UI with filtering and grouping
- [REST History Card](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/history/rest/Card.vue) — Individual REST history entry display
- [GraphQL History Card](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/history/graphql/Card.vue) — Individual GraphQL history entry display
- [Admin History Configuration](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-sh-admin/src/components/settings/HistoryConfiguration.vue) — Admin panel for history store toggle
- [Prisma Schema](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/prisma/schema.prisma#L152-L161) — Database schema for UserHistory model
- [Feature Flag Guard](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/user-history/user-history-feature-flag.guard.ts) — Guard that checks if history store is enabled