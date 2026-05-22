# GraphQL API
Hoppscotch provides a comprehensive GraphQL API subsystem for querying, mutating, and subscribing to GraphQL endpoints. It includes a feature-rich GraphQL client interface with schema introspection, a visual schema explorer, real-time subscription support, and integration with the Hoppscotch backend via urql.

## Overview
The GraphQL API subsystem in Hoppscotch is designed as a full-featured GraphQL client within the application. It enables users to:

- **Execute GraphQL queries and mutations** against any GraphQL endpoint
- **Subscribe to real-time data** via WebSocket-based GraphQL subscriptions
- **Explore GraphQL schemas** visually with introspection and documentation browsing
- **Build queries visually** using a point-and-click schema explorer
- **Manage authentication** with support for multiple auth types (Basic, Bearer, OAuth 2.0, API Key, AWS Signature)
- **Save and organize requests** in collections with tab-based editing
- **Interact with the Hoppscotch backend** through a built-in backend GraphQL client for syncing collections, teams, and settings

The system consists of two primary GraphQL client contexts:

- **The Hoppscotch Backend GQL Client** — An internal client powered by [urql](https://formidable.com/open-source/urql/) that communicates with the Hoppscotch backend API (`api.hoppscotch.io/graphql`) for features like team collaboration, collections sync, and user management.
- **The User-Facing GQL Connection** — The interactive GraphQL client that users use to query external GraphQL APIs directly from the Hoppscotch interface, with schema introspection, subscription support, and a visual query builder.

## Architecture
The GraphQL API subsystem follows a layered architecture with clear separation between the user-facing interactive client, the kernel-based HTTP execution layer, and the internal backend client.

加载图表中...
### Key Components Explained

- **`GQLTabService`** (`services/tab/graphql.ts`): Manages multiple open GraphQL request tabs. Each tab contains a `HoppGQLDocument` with the request configuration, dirty state tracking, cursor position, and save context.
- **`GQL Connection`** (`helpers/graphql/connection.ts`): The core connection manager that handles schema polling via HTTP introspection, query/mutation execution through the kernel interceptor, and WebSocket-based subscriptions.
- **`GQLRequest.toRequest()`** (`helpers/kernel/gql/request.ts`): Transforms a `HoppGQLRequest` into a kernel-compatible `RelayRequest` for execution, handling auth, headers, and variable serialization.
- **`GQLResponse.toResponse()`** (`helpers/kernel/gql/response.ts`): Parses the raw kernel response into a structured GraphQL response with operation type detection and validation.
- **`Backend GQLClient`** (`helpers/backend/GQLClient.ts`): An urql-based client connecting to the Hoppscotch backend, with auth exchange, subscription support, and error reporting.

## Data Model
The core data structure for a GraphQL request is `HoppGQLRequest`, which is a versioned schema entity defined in `@hoppscotch/data`.

加载图表中...
### Schema Versions
The `HoppGQLRequest` schema is versioned (v1 through v9) using the `verzod` library. The current version is **v9**, which introduced enhanced OAuth 2.0 support with advanced parameters for authorization, token, and refresh requests.

>
Source: [packages/hoppscotch-data/src/graphql/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/graphql/index.ts#L31-L49)

## Core Flow
### Query/Mutation Execution Flow
When a user executes a GraphQL query or mutation, the system follows this execution path:

加载图表中...
### Subscription Flow (WebSocket)
加载图表中...
## Schema Explorer and Visual Query Builder
One of the most powerful features of the GraphQL API client is the visual schema explorer and query builder. When connected to a GraphQL endpoint, the system introspects the schema and enables point-and-click query construction.

### Schema Polling
The schema is fetched via introspection query using `buildClientSchema()` from the `graphql` package and is polled every **7 seconds** (`GQL_SCHEMA_POLL_INTERVAL`) to keep the explorer in sync with the server.

>
Source: [helpers/graphql/connection.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/graphql/connection.ts#L35)

### Explorer Navigation State
The `useExplorer` composable maintains a navigation stack that tracks the user's traversal through the schema tree:

>
Source: [helpers/graphql/explorer.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/graphql/explorer.ts#L34-L44)

typescript1// Each item in the navigation stack
2export type ExplorerNavStackItem = {
3  readonly?: boolean
4  name: string
5  def?: GraphQLNamedType | ExplorerFieldDef
6}
### Query Building
The `useQuery` composable provides functions to programmatically build GraphQL queries by adding fields and arguments via the explorer:

>
Source: [helpers/graphql/query.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/graphql/query.ts#L34-L51)

typescript1export function useQuery() {
2  const tabs = useService(GQLTabService)
3  const { navStack } = useExplorer()
4
5  // Adds a field to the current operation
6  const handleAddField = (field: ExplorerFieldDef) => handleOperation(field)
7
8  // Adds an argument to the current field
9  const handleAddArgument = (arg: ExplorerFieldDef) => handleOperation(arg, true)
10
11  // Checks if a field already exists in the current operation
12  const isFieldInOperation = (item: ExplorerFieldDef): boolean => { ... }
13
14  // Checks if an argument already exists in the current field
15  const isArgumentInOperation = (item: ExplorerFieldDef): boolean => { ... }
16
17  return {
18    handleAddField,
19    handleAddArgument,
20    updatedQuery,
21    cursorPosition,
22    operationDefinitions: operations,
23    isFieldInOperation,
24    isArgumentInOperation,
25  }
26}
The `processOperation` function handles complex query manipulation including:

- Creating new operations from scratch (queries, mutations, subscriptions)
- Adding fields to existing operations
- Removing fields from existing operations
- Adding/removing arguments from fields
- Appending new operations when the operation type differs from the existing one

## Backend GQL Client
The Hoppscotch backend client (`GQLClient.ts`) uses the [urql](https://formidable.com/open-source/urql/) GraphQL client library to communicate with the Hoppscotch backend API. It provides three core operations:

>
Source: [helpers/backend/GQLClient.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/backend/GQLClient.ts#L210-L270)

### `runGQLQuery`
Executes a GraphQL query against the backend and returns a `Promise<Either<GQLError, DocType>>`. Uses the `network-only` request policy to always fetch fresh data.

typescriptexport const runGQLQuery = <DocType, DocVarType, DocErrorType>(
  args: { query: TypedDocumentNode<DocType, DocVarType>; variables: DocVarType }
): Promise<E.Either<GQLError<DocErrorType>, DocType>>
### `runMutation`
Executes a GraphQL mutation against the backend. Returns a `TaskEither<GQLError, DocType>` for functional error handling.

typescript1export const runMutation = <DocType, DocVariables, DocErrors>(
2  mutation: TypedDocumentNode<DocType, DocVariables>,
3  variables: DocVariables,
4  additionalConfig?: Partial<OperationContext>
5): TE.TaskEither<GQLError<DocErrors>, DocType>
### `runGQLSubscription`
Executes a GraphQL subscription and returns an RxJS `Subject` stream along with an unsubscribe handle.

typescriptexport const runGQLSubscription = <DocType, DocVarType, DocErrorType>(
  args: { query: TypedDocumentNode<DocType, DocVarType>; variables: DocVarType }
): readonly [Subject<E.Either<GQLError<DocErrorType>, DocType>>, Subscription]
### Auth Exchange
The backend GQL client includes a full authentication exchange that:

- Adds authentication headers from the platform's auth system to every request
- Detects auth errors by checking for `auth/fail`, `jwt expired`, or `UNAUTHENTICATED` codes
- Automatically refreshes tokens using `platform.auth.refreshAuthToken()`
- Retries failed auth operations with a retry guard mechanism

## Usage Examples
### Basic Usage — Making a GraphQL Query
The following example shows how the `useGQLQuery` composable is used to execute a backend query with polling support:

>
Source: [composables/graphql.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/composables/graphql.ts#L47-L60)

typescript1import { useGQLQuery } from "@composables/graphql"
2import { MeDocument } from "~/helpers/backend/gql/queries/Me.graphql"
3
4// Execute a query with reactive variables
5const { loading, data, execute, pause, unpause } = useGQLQuery({
6  query: MeDocument,
7  variables: {},
8  // Optional: Poll the query every 30 seconds
9  pollDuration: 30000,
10  pollLoadingEnabled: false,
11})
12
13// Watch for loading state changes
14watch(loading, (isLoading) => {
15  if (isLoading) {
16    // Show loading indicator
17  }
18})
19
20// Access response data (fp-ts Either type)
21watch(data, (result) => {
22  if (result.type === "right") {
23    // Success — result.right contains the data
24    console.log("User:", result.right.me.displayName)
25  } else {
26    // Error — result.left is a GQLError
27    console.error("Error:", result.left.error)
28  }
29})
30
31// Manually re-execute the query
32execute()
### Executing a GraphQL Mutation
This example from the backend mutation helpers shows how mutations are executed:

>
Source: [helpers/backend/GQLClient.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/backend/GQLClient.ts#L364-L418)

typescript1import { pipe } from "fp-ts/function"
2import * as TE from "fp-ts/TaskEither"
3import { runMutation } from "~/helpers/backend/GQLClient"
4import { CreateTeamDocument } from "~/helpers/backend/gql/mutations/CreateTeam.graphql"
5
6// Execute a mutation and handle the result
7const result = await pipe(
8  runMutation(CreateTeamDocument, { name: "My Team" }),
9  TE.match(
10    (error) => {
11      // Handle error
12      if (error.type === "network_error") {
13        toast.error("Network error occurred")
14      } else {
15        toast.error(`GraphQL error: ${error.error}`)
16      }
17    },
18    (data) => {
19      // Success — data contains the mutation result
20      const teamId = data.createTeam.id
21      toast.success(`Team created: ${data.createTeam.name}`)
22    }
23  )
24)()
### GraphQL Query Document Example
The `.graphql` files use standard GraphQL syntax and are compiled into typed documents using GraphQL Code Generator:

>
Source: [helpers/backend/gql/queries/Me.graphql](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/backend/gql/queries/Me.graphql#L1-L7)

graphql1query Me {
2  me {
3    uid
4    displayName
5    photoURL
6  }
7}
>
Source: [helpers/backend/gql/mutations/CreateTeam.graphql](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/backend/gql/mutations/CreateTeam.graphql#L1-L20)

graphql1mutation CreateTeam($name: String!) {
2  createTeam(name: $name) {
3    id
4    name
5    members {
6      membershipID
7      role
8      user {
9        uid
10        displayName
11        email
12        photoURL
13      }
14    }
15    myRole
16    ownersCount
17    editorsCount
18    viewersCount
19  }
20}
>
Source: [helpers/backend/gql/subscriptions/TeamCollectionAdded.graphql](https://github.com/xiebs/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/backend/gql/subscriptions/TeamCollectionAdded.graphql#L1-L10)

graphql1subscription TeamCollectionAdded($teamID: ID!) {
2  teamCollectionAdded(teamID: $teamID) {
3    id
4    title
5    data
6    parent {
7      id
8    }
9  }
10}
### Running a GraphQL Subscription (WebSocket)
The subscription system uses the GraphQL over WebSocket protocol. Here's how subscriptions are managed:

>
Source: [helpers/graphql/connection.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/graphql/connection.ts#L573-L644)

typescript1import { runSubscription, socketDisconnect } from "~/helpers/graphql/connection"
2
3// Connect and subscribe
4const socket = runSubscription(
5  {
6    url: "https://api.example.com/graphql",
7    query: `subscription OnPostAdded { postAdded { id title } }`,
8    operationName: "OnPostAdded",
9    // ... other options
10  },
11  { Authorization: "Bearer my-token" }
12)
13
14// The socket emits events via gqlMessageEvent ref
15// which is reactive and can be watched:
16watch(gqlMessageEvent, (event) => {
17  if (event === "reset") {
18    // Subscription started
19  } else if (event.type === "response") {
20    // New data received
21    console.log(event.data)
22  }
23})
24
25// Disconnect when done
26socketDisconnect()
### Creating a Default GQL Request Programmatically
>
Source: [helpers/graphql/default.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/graphql/default.ts#L20-L33)

typescript1import { getDefaultGQLRequest } from "~/helpers/graphql/default"
2
3// Creates a new request with sensible defaults
4const request = getDefaultGQLRequest()
5// Result:
6// {
7//   v: 9,
8//   name: "Untitled",
9//   url: "https://echo.hoppscotch.io/graphql",
10//   headers: [],
11//   variables: '{\n  "id": "1"\n}',
12//   query: 'query Request {\n  method\n  url\n  headers {\n    key\n    value\n  }\n}',
13//   auth: { authType: "inherit", authActive: true }
14// }
## Configuration Options
### Backend GQL Client Configuration
The backend GQL client's URL and WebSocket URL are configurable via environment variables:

Environment VariableDefaultDescription`VITE_BACKEND_GQL_URL``https://api.hoppscotch.io/graphql`The URL for the Hoppscotch backend GraphQL API`VITE_BACKEND_WS_URL``wss://api.hoppscotch.io/graphql`The WebSocket URL for backend subscriptions
>
Source: [helpers/backend/GQLClient.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/backend/GQLClient.ts#L30-L33)

### GQL Connection Configuration
SettingDefaultDescriptionSchema Poll Interval7000msHow often the schema is re-fetched via introspectionSubscriptions Protocol`graphql-ws`The WebSocket sub-protocol for subscriptions
### Default GQL Request
PropertyDefault ValueDescription`url``https://echo.hoppscotch.io/graphql`Default target URL`name``"Untitled"`Request name`headers``[]`No default headers`auth.authType``"inherit"`Inherits auth from collection context`auth.authActive``true`Auth is active by default
## API Reference
### `useGQLQuery(options)`
A Vue composable for executing and managing GraphQL queries with reactive state.

**Parameters:**

ParameterTypeDescription`options.query``TypedDocumentNode<T, V>`The GraphQL query document (typed)`options.variables``MaybeRef<V>`Reactive query variables (optional)`options.updateSubs``MaybeRef<GraphQLRequest[]>`Subscriptions that trigger re-execution on data change`options.defer``boolean`If true, delays execution until `execute()` is called`options.pollDuration``number | undefined`Polling interval in milliseconds`options.pollLoadingEnabled``boolean`Controls loading state behavior during polling
**Returns:**

PropertyTypeDescription`loading``Ref<boolean>`Whether the query is currently loading`data``Ref<Either<GQLError, DocType>>`The query result (fp-ts Either)`isStale``Ref<boolean>`Whether the data might be stale`execute``(updatedVars?) => void`Re-executes the query, optionally with new variables`pause``() => void`Pauses automatic query execution`unpause``() => void`Resumes automatic query execution
>
Source: [composables/graphql.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/composables/graphql.ts#L47-L236)

### `GQLRequest.toRequest(request)`
Transforms a `HoppGQLRequest` into a kernel-compatible relay request for HTTP execution.

**Parameters:**

ParameterTypeDescription`request``HoppGQLRequest`The GraphQL request object
**Returns:** `Promise<RelayRequest>` — A kernel relay request with:

- `method`: Always `"POST"` per GraphQL specs
- `headers`: Merged user headers + `content-type: application/json`
- `auth`: Transformed authentication configuration
- `content`: JSON body with `{ query, variables }`

>
Source: [helpers/kernel/gql/request.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/kernel/gql/request.ts#L21-L48)

### `GQLResponse.toResponse(response, options)`
Parses a raw kernel relay response into a structured GraphQL response.

**Parameters:**

ParameterTypeDescription`response``RelayResponse`The raw relay response from the kernel`options``RunQueryOptions`Original query options (for operation metadata)
**Returns:** `Promise<HoppGQLSuccessResponse | GQLTransformError>` — The parsed response containing:

- `type`: Either `"response"` (success) or `"error"` (transform error)
- `data`: Pretty-printed JSON string of the response body
- `operationType`: Detected as `"query"`, `"mutation"`, or `"subscription"`
- `time`: Request timing information

>
Source: [helpers/kernel/gql/response.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/kernel/gql/response.ts#L59-L88)

### `runGQLSubscription(args)`
Creates a reactive subscription stream to the backend.

**Parameters:**

ParameterTypeDescription`args.query``TypedDocumentNode<T, V>`The subscription document`args.variables``V`Subscription variables
**Returns:** `[Subject<Either<GQLError, DocType>>, Subscription]` — A tuple of:

- An RxJS `Subject` that emits each new subscription event
- A subscription handle for unsubscribing

>
Source: [helpers/backend/GQLClient.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/backend/GQLClient.ts#L274-L333)

## Related Links

- **Source: GraphQL Page Component** — [packages/hoppscotch-common/src/pages/graphql.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/pages/graphql.vue)
- **Source: GQL Connection Manager** — [packages/hoppscotch-common/src/helpers/graphql/connection.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/graphql/connection.ts)
- **Source: Backend GQL Client** — [packages/hoppscotch-common/src/helpers/backend/GQLClient.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/backend/GQLClient.ts)
- **Source: GQL Data Models** — [packages/hoppscotch-data/src/graphql/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/graphql/index.ts)
- **Source: GQL Tab Service** — [packages/hoppscotch-common/src/services/tab/graphql.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/tab/graphql.ts)
- **Source: GraphQL Document Types** — [packages/hoppscotch-common/src/helpers/graphql/document.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/graphql/document.ts)
- **Source: GraphQL Query Builder** — [packages/hoppscotch-common/src/helpers/graphql/query.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/graphql/query.ts)
- **Source: Schema Explorer** — [packages/hoppscotch-common/src/helpers/graphql/explorer.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/graphql/explorer.ts)
- **Source: Kernel GQL Request** — [packages/hoppscotch-common/src/helpers/kernel/gql/request.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/kernel/gql/request.ts)
- **Source: Kernel GQL Response** — [packages/hoppscotch-common/src/helpers/kernel/gql/response.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/kernel/gql/response.ts)
- **Source: GraphQL Vue Composables** — [packages/hoppscotch-common/src/composables/graphql.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/composables/graphql.ts)
- **Related: REST API** — [./12-backend-api.0-rest-api](./12-backend-api.0-rest-api)
- **Related: Backend API Overview** — [./13-backend-api](./13-backend-api)