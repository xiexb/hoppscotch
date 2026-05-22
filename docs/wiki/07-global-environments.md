# Global Environments
Global Environments in Hoppscotch provide a single, always-available set of environment variables that are accessible across all workspaces and requests, serving as the lowest-priority fallback in the environment variable resolution chain.

## Overview
Global Environments represent a special, singleton environment that exists per user account. Unlike personal or team environments that are scoped to specific contexts, the Global Environment is universally available — its variables are always injected into requests regardless of which environment is currently selected. This makes it ideal for storing shared configuration values like base URLs, API keys, or default headers that should apply across all your work in Hoppscotch.

**Key characteristics:**

- **Singleton per user**: Each user has exactly one global environment (enforced at the database level)
- **Always active**: Global variables are always included in the variable resolution, even when "No Environment" is selected
- **Lowest priority**: Global variables are resolved after predefined variables and the selected environment's variables, ensuring they serve as fallback defaults
- **Not deletable**: Unlike personal environments, the global environment itself cannot be deleted — only its variables can be cleared
- **Versioned data structure**: Uses a versioned entity schema (currently v2) to ensure backward compatibility

## Architecture
The Global Environment system spans multiple architectural layers — from data model definitions, through state management and services, to backend API and database persistence.

加载图表中...
### Data Flow
加载图表中...
## Versioned Data Structure
The Global Environment uses a versioned entity approach via the `verzod` library, enabling backward-compatible schema migrations. The current latest version is **v2**.

### Schema Evolution
加载图表中...
>
Source: [global-environment/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/global-environment/index.ts#L13-L31)

The version resolver auto-detects which version a data payload conforms to:

typescript1getVersion(data) {
2  const versionCheck = versionedObject.safeParse(data)
3  if (versionCheck.success) return versionCheck.data.v
4
5  // For V0 we have to check the schema
6  const result = V0_VERSION.schema.safeParse(data)
7  return result.success ? 0 : null
8}
>
Source: [global-environment/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/global-environment/index.ts#L20-L28)

### V2 Variable Schema (Current)
Each global environment variable in the current version consists of:

FieldTypeDescription`key``string`Variable name (used with `<<variable_name>>` syntax)`initialValue``string`The initial/default value of the variable`currentValue``string`The current/live value (may differ from initial)`secret``boolean`Whether the value is secret (hidden from UI, not synced to server)
typescript1// V2 schema definition
2export const V2_SCHEMA = V1_SCHEMA.extend({
3  v: z.literal(2),
4  variables: z.array(
5    z.object({
6      key: z.string(),
7      initialValue: z.string(),
8      currentValue: z.string(),
9      secret: z.boolean(),
10    })
11  ),
12})
>
Source: [global-environment/v/2.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/global-environment/v/2.ts#L5-L15)

## State Management
### Environment Store
The global environment state is managed through a `DispatchingStore` in the frontend, alongside personal environments. The store holds a dedicated `globals` property that maintains the `GlobalEnvironment` object.

typescript1const defaultGlobalEnvironmentState: GlobalEnvironment = {
2  v: 2,
3  variables: [],
4}
5
6const defaultEnvironmentsState = {
7  environments: [
8    {
9      v: 2,
10      id: uniqueID(),
11      name: "My Environment Variables",
12      variables: [],
13    },
14  ] as Environment[],
15  globalEnvID: undefined as string | undefined,
16  globals: defaultGlobalEnvironmentState,
17  selectedEnvironmentIndex: { type: "NO_ENV_SELECTED" } as SelectedEnvironmentIndex,
18}
>
Source: [newstore/environments.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/environments.ts#L28-L50)

### Reactive Streams
The store exposes several RxJS observable streams for reactive consumption:

typescript1// Stream of global environment changes
2export const globalEnv$ = environmentsStore.subject$.pipe(
3  pluck("globals"),
4  distinctUntilChanged()
5)
>
Source: [newstore/environments.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/environments.ts#L388-L391)

### Store Dispatchers for Global Environment
The store provides dedicated dispatchers for managing global environment state:

DispatcherDescription`setGlobalVariables`Replace all global variables with a new set`clearGlobalVariables`Clear all global variables (reset to empty)`addGlobalVariable`Append a single variable to the global environment`removeGlobalVariable`Remove a variable by its index`updateGlobalVariable`Update a variable at a specific index`setGlobalEnvID`Store the server-side ID of the global environment (for sync)
## Variable Resolution Priority
One of the most important concepts is how environment variables are resolved when making requests. Global Environment variables have the **lowest priority**, meaning they are only used if the variable name is not already defined by a higher-priority source.

加载图表中...
This resolution is implemented in the `aggregateEnvs$` stream:

typescript1export const aggregateEnvs$: Observable<AggregateEnvironment[]> = combineLatest(
2  [currentEnvironment$, globalEnv$]
3).pipe(
4  map(([selectedEnv, globalEnv]) => {
5    const effectiveAggregateEnvs: AggregateEnvironment[] = []
6
7    // 1. Pre-defined variables (highest priority)
8    HOPP_SUPPORTED_PREDEFINED_VARIABLES.forEach(({ key, getValue }) => {
9      effectiveAggregateEnvs.push({ key, currentValue: getValue(), ... })
10    })
11
12    const aggregateEnvKeys = effectiveAggregateEnvs.map(({ key }) => key)
13
14    // 2. Selected environment variables (medium priority)
15    selectedEnv?.variables.forEach((variable) => {
16      if (!aggregateEnvKeys.includes(key)) {
17        effectiveAggregateEnvs.push({ ...variable, sourceEnv: selectedEnv.name })
18      }
19    })
20
21    // 3. Global environment variables (lowest priority)
22    globalEnv.variables.forEach((variable) => {
23      if (!aggregateEnvKeys.includes(key)) {
24        effectiveAggregateEnvs.push({ ...variable, sourceEnv: "Global" })
25      }
26    })
27
28    return effectiveAggregateEnvs
29  })
30)
>
Source: [newstore/environments.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/environments.ts#L436-L494)

## Secret Variables in Global Environment
The global environment supports **secret variables** whose actual values are not synced to the server. Instead, they are stored locally in the browser using `SecretEnvironmentService`. The global environment's secret values are keyed under the `"Global"` environment ID.

When resolving variables with current values, the system checks both the `CurrentValueService` (for runtime values) and the `SecretEnvironmentService` (for secret values that should not be transmitted):

typescript1globalEnv.variables.map((x, index) => {
2  let currentValue = x.currentValue
3  let initialValue = x.initialValue
4  if (x.secret) {
5    currentValue =
6      secretEnvironmentService.getSecretEnvironmentVariableValue("Global", index)?.value ?? ""
7    initialValue =
8      secretEnvironmentService.getSecretEnvironmentVariableValue("Global", index)?.initialValue ?? ""
9  }
10  // ...
11})
>
Source: [newstore/environments.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/environments.ts#L586-L613)

## Backend API
### GraphQL Mutations
The backend provides GraphQL mutations through the `UserEnvironmentsResolver`:

#### `createUserGlobalEnvironment`
Creates a new global environment for the authenticated user. Only one global environment per user is allowed; attempting to create a second will return a `USER_ENVIRONMENT_GLOBAL_ENV_EXISTS` error.

graphql1mutation CreateUserGlobalEnvironment($variables: String!) {
2  createUserGlobalEnvironment(variables: $variables) {
3    id
4  }
5}
>
Source: [CreateUserGlobalEnvironment.graphql](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-selfhost-web/src/api/mutations/CreateUserGlobalEnvironment.graphql)

#### `clearGlobalEnvironments`
Removes all variables inside a user's global environment (sets `variables` to an empty array).

graphql1mutation ClearGlobalEnvironments($id: ID!) {
2  clearGlobalEnvironments(id: $id) {
3    id
4  }
5}
>
Source: [ClearGlobalEnvironments.graphql](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-selfhost-web/src/api/mutations/ClearGlobalEnvironments.graphql)

### GraphQL Queries
graphql1query GetGlobalEnvironments {
2  me {
3    globalEnvironments {
4      id
5      isGlobal
6      name
7      userUid
8      variables
9    }
10  }
11}
>
Source: [GetGlobalEnvironments.graphql](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-selfhost-web/src/api/queries/GetGlobalEnvironments.graphql)

### GraphQL Subscriptions
The backend publishes real-time updates when the global environment changes:

SubscriptionTopicDescription`userEnvironmentCreated``user_environment/{uid}/created`When a global environment is created`userEnvironmentUpdated``user_environment/{uid}/updated`When a global environment is updated`userEnvironmentDeleted``user_environment/{uid}/deleted`When a global environment is deleted
### Service Layer - Error Handling
The `UserEnvironmentsService` uses functional error handling with `fp-ts` `Either` and `Option` types. Global environment-specific errors include:

Error ConstantDescription`USER_ENVIRONMENT_GLOBAL_ENV_DOES_NOT_EXISTS`Attempted operation on non-existent global environment`USER_ENVIRONMENT_GLOBAL_ENV_EXISTS`Attempted to create a second global environment`USER_ENVIRONMENT_GLOBAL_ENV_DELETION_FAILED`Attempted to delete the global environment itself (not allowed)`USER_ENVIRONMENT_IS_NOT_GLOBAL`Attempted to clear variables on a non-global environment`USER_ENVIRONMENT_UPDATE_FAILED`Database update failure
>
Source: [errors.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/errors.ts#L427-L449)

## Usage Examples
### Accessing Global Variables in the Application
The global environment variables are accessed reactively through the `globalEnv$` stream:

typescript1import { useReadonlyStream } from "@composables/stream"
2import { globalEnv$ } from "~/newstore/environments"
3import { GlobalEnvironment } from "@hoppscotch/data"
4
5// In a Vue component
6const globalEnv = useReadonlyStream(globalEnv$, {} as GlobalEnvironment)
7
8// Compute an Environment-shaped object from the global env
9const globalEnvironment = computed<Environment>(() => ({
10  v: 2 as const,
11  id: "Global",
12  name: "Global",
13  variables: globalEnv.value.variables,
14}))
>
Source: [environments/index.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/environments/index.vue#L104-L111)

### Programmatically Manipulating Global Variables
typescript1import {
2  addGlobalEnvVariable,
3  removeGlobalEnvVariable,
4  updateGlobalEnvVariable,
5  clearGlobalEnvVariables,
6  getGlobalVariables,
7} from "~/newstore/environments"
8
9// Add a new variable
10addGlobalEnvVariable({
11  key: "BASE_URL",
12  initialValue: "https://api.example.com",
13  currentValue: "https://api.example.com",
14  secret: false,
15})
16
17// Update an existing variable (at index 0)
18updateGlobalEnvVariable(0, {
19  key: "BASE_URL",
20  initialValue: "https://api.example.com",
21  currentValue: "https://staging-api.example.com",
22  secret: false,
23})
24
25// Remove a variable by index
26removeGlobalEnvVariable(0)
27
28// Clear all global variables (reset to empty array)
29clearGlobalEnvVariables()
30
31// Get all global variables synchronously
32const vars = getGlobalVariables()
>
Source: [newstore/environments.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/environments.ts#L778-L823)

### Duplicating Global Environment to a Team Environment
When working in a team workspace, users can duplicate the global environment's variables into a team environment:

typescript1const duplicateGlobalEnvironment = async () => {
2  if (workspace.value.type === "team") {
3    duplicateGlobalEnvironmentLoading.value = true
4
5    await pipe(
6      createTeamEnvironment(
7        JSON.stringify(globalEnvironment.value.variables),
8        workspace.value.teamID,
9        `Global - ${t("action.duplicate")}`
10      ),
11      TE.match(
12        (err: GQLError<string>) => {
13          console.error(err)
14          toast.error(t(getEnvActionErrorMessage(err)))
15        },
16        () => {
17          toast.success(t("environment.duplicated"))
18        }
19      )
20    )()
21
22    duplicateGlobalEnvironmentLoading.value = false
23    return
24  }
25
26  createEnvironment(
27    `Global - ${t("action.duplicate")}`,
28    cloneDeep(getGlobalVariables())
29  )
30  toast.success(`${t("environment.duplicated")}`)
31}
>
Source: [environments/index.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/environments/index.vue#L262-L295)

### Using Environment Variables in Requests
Environment variables in Hoppscotch are referenced using the `<<variable_name>>` syntax:

typescript// Regex pattern used to identify environment variable references
const ENV_VAR_NAME_PATTERN = "[a-zA-Z0-9_.-]+"
const HOPP_ENVIRONMENT_REGEX = new RegExp(`(<<${ENV_VAR_NAME_PATTERN}>>)`, "g")
>
Source: [environment-regex.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/environment-regex.ts#L1-L8)

## Configuration & Data Model
### Backend Model (Prisma)
The global environment is stored in the `UserEnvironment` table with the `isGlobal` flag set to `true`:

FieldTypeDescription`id``ID` (string)Unique identifier`userUid``ID` (string)Owner's user UID`name``String` (nullable)Environment name (null for global envs)`variables``String` (JSON)JSON string of variables array`isGlobal``Boolean`Always `true` for global environments
>
Source: [user-environments.model.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/user-environment/user-environments.model.ts#L4-L29)

### Frontend Type Definitions
typescript1// GlobalEnvironment type (versioned entity)
2export type GlobalEnvironment = InferredEntity<typeof GlobalEnvironment>
3
4// Individual variable type
5export type GlobalEnvironmentVariable = InferredEntity<
6  typeof GlobalEnvironment
7>["variables"][number]
>
Source: [global-environment/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/global-environment/index.ts#L31-L35)

### Aggregate Environment Type (Runtime)
When variables from all sources are combined for request execution, they take this shape:

typescript1export type AggregateEnvironment = {
2  key: string
3  initialValue: string
4  currentValue: string
5  secret: boolean
6  sourceEnv: string       // "Global" or the selected environment's name
7  sourceEnvID?: string
8}
>
Source: [newstore/environments.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/environments.ts#L417-L424)

## Related Links

- [Environments Overview](./7-collections-and-environments.1-environments-overview)
- [Personal Environments](./7-collections-and-environments.2-personal-environments)
- [Team Environments](./7-collections-and-environments.4-team-environments)
- [Environment Variables in Requests](./7-collections-and-environments.5-using-environment-variables)

**Source Files:**

- [Global Environment Type Definition](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/global-environment/index.ts) — Versioned entity definition and type exports
- [Environment Store](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/environments.ts) — Frontend state management, dispatchers, and variable resolution logic
- [User Environments Service](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/user-environment/user-environments.service.ts) — Backend service with global environment CRUD operations
- [User Environments Resolver](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/user-environment/user-environments.resolver.ts) — GraphQL mutations and subscriptions
- [User Resolver](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/user-environment/user.resolver.ts) — GraphQL `globalEnvironments` field resolver on User type
- [Secret Environment Service](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/secret-environment.service.ts) — Local storage of secret variable values
- [Current Value Service](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/current-environment-value.service.ts) — Runtime variable value management
- [Environment Regex](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/environment-regex.ts) — Pattern for `<<variable_name>>` syntax