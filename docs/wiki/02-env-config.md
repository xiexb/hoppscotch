# Environment Configuration
Hoppscotch provides a powerful environment configuration system that allows you to define, manage, and use variables across your API requests. Environments enable you to store reusable values, secrets, and dynamic data, making it easy to switch between different contexts (development, staging, production) without modifying your requests.

## Overview
The environment configuration system in Hoppscotch is designed to manage variables at multiple scopes with a clear precedence hierarchy. It supports personal environments, team-shared environments, global variables, request-level variables, collection variables, and built-in predefined dynamic variables.

### Key Concepts

- **Environment**: A named collection of variables that can be selected and applied to requests. Each environment has a unique ID, name, and a list of variables.
- **Variable**: A key-value pair with additional metadata including `initialValue`, `currentValue`, and a `secret` flag indicating whether the value should be encrypted in local storage.
- **Global Environment**: A special environment that applies universally across all requests, with variables that have lower priority than the selected environment but higher priority than nothing.
- **Variable Resolution Priority**: When resolving a variable reference (e.g., `<<base_url>>`), the system checks sources in the following order:

**Predefined Variables** (`$guid`, `$timestamp`, etc.) — highest priority
- **Request Variables** (defined per-request)
- **Collection Variables** (inherited from collections)
- **Selected Environment Variables** (the currently active personal or team environment)
- **Global Environment Variables** — lowest priority

### Environment Types
TypeScopePersistenceSyncPersonal (My Environments)Per-userServer & local storageVia GraphQL APITeam EnvironmentsPer-teamServer & local storageVia GraphQL API + subscriptionsGlobal EnvironmentPer-userServer & local storageVia GraphQL APIRequest VariablesPer-requestRequest document onlyLocalCollection VariablesPer-collectionInherited propertiesLocal/Backend
### Variable Syntax
Environment variables are referenced in request fields using the `<<variable_name>>` syntax. For example:

<<base_url>>/api/users

>
Source: [environment-regex.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/helpers/environment-regex.ts#L1-L8)

## Architecture
The environment configuration system follows a layered architecture with a client-side reactive store, services for secret management and current values, and backend services for persistence and team collaboration.

加载图表中...
### Component Relationships
The architecture separates concerns into clear layers:

-
**Reactive Store** (`environmentsStore`): A dispensing store that manages the state of all environments, globals, and the current selection. It exposes RxJS observables for reactive updates.

-
**Value Services**: Two services handle variable values that are not synced to the server:

`CurrentValueService` - Manages non-persisted current values (useful for temporary overrides)
- `SecretEnvironmentService` - Manages encrypted secret variable values stored in local storage

-
**Aggregation Layer**: The `aggregateEnvs$` observable combines variables from all sources according to the priority hierarchy, producing a unified list for use in request execution and inspection.

-
**Backend Services**: Both personal and team environments are persisted via GraphQL mutations and kept in sync through real-time subscriptions.

## Core Environment State Management
### Environment Data Model
The `Environment` type is a versioned entity using the `verzod` library, supporting schema migration across versions:

typescript1// Current schema (v2)
2const V2_SCHEMA = V1_SCHEMA.extend({
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
Source: [packages/hoppscotch-data/src/environment/v/2.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-data/src/environment/v/2.ts#L5-L15)

Each variable has:

- **`key`** — The variable name used in `<<key>>` references
- **`initialValue`** — The value when the environment was created/loaded
- **`currentValue`** — The current runtime value (can differ from initial)
- **`secret`** — If `true`, the value is encrypted and stored locally rather than synced

### Dispatching Store
The environments store is built on a custom `DispatchingStore` pattern that provides a centralized state with dispatch functions for mutations:

typescript1const defaultEnvironmentsState = {
2  environments: [
3    {
4      v: 2,
5      id: uniqueID(),
6      name: "My Environment Variables",
7      variables: [],
8    },
9  ] as Environment[],
10  globalEnvID: undefined as string | undefined,
11  globals: defaultGlobalEnvironmentState,
12  selectedEnvironmentIndex: {
13    type: "NO_ENV_SELECTED",
14  } as SelectedEnvironmentIndex,
15}
16
17export const environmentsStore = new DispatchingStore(
18  defaultEnvironmentsState,
19  dispatchers
20)
>
Source: [environments.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/newstore/environments.ts#L28-L51)

The store supports these dispatch operations:

DispatcherDescription`setSelectedEnvironmentIndex`Switch the active environment`createEnvironment`Add a new environment`duplicateEnvironment`Clone an existing environment`deleteEnvironment`Remove an environment (with selection index correction)`renameEnvironment`Change an environment's name`updateEnvironment`Replace an entire environment`addEnvironmentVariable`Add a new variable to an environment`removeEnvironmentVariable`Remove a variable by index`setEnvironmentVariables`Replace all variables in an environment`updateEnvironmentVariable`Modify a specific variable's key/values`setGlobalVariables`Replace all global variables`addGlobalVariable`Add a variable to globals`removeGlobalVariable`Remove a global variable`updateGlobalVariable`Update a global variable`clearGlobalVariables`Remove all global variables
### Selecting an Environment
The selected environment type is defined as a discriminated union:

typescript1export type SelectedEnvironmentIndex =
2  | { type: "NO_ENV_SELECTED" }
3  | { type: "MY_ENV"; index: number }
4  | {
5      type: "TEAM_ENV"
6      teamID: string
7      teamEnvID: string
8      environment: Environment
9    }
>
Source: [environments.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/newstore/environments.ts#L18-L26)

The selection logic handles edge cases such as:

- Deleting the currently selected environment (resets to `NO_ENV_SELECTED`)
- Deleting an environment before the selected one (adjusts index)

typescript1function setSelectedEnvironmentIndex(store, { selectedEnvironmentIndex }) {
2  if (selectedEnvironmentIndex.type === "MY_ENV") {
3    if (store.environments[selectedEnvironmentIndex.index]) {
4      return { selectedEnvironmentIndex }
5    }
6    return { selectedEnvironmentIndex: { type: "NO_ENV_SELECTED" } }
7  }
8  return { selectedEnvironmentIndex }
9}
>
Source: [environments.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/newstore/environments.ts#L55-L76)

## Core Flow: Variable Resolution and Aggregation
The most critical process is how environment variables are resolved at request execution time. The system aggregates variables from multiple sources according to a strict priority order.

加载图表中...
### Aggregate Environment Resolution
The `aggregateEnvsWithCurrentValue$` observable produces the merged variable list used by requests, inspections, and the code editor plugin:

typescript1export const aggregateEnvsWithCurrentValue$: Observable<AggregateEnvironment[]> =
2  (() => {
3    const secretEnvironmentService = getService(SecretEnvironmentService)
4    const currentEnvironmentValueService = getService(CurrentValueService)
5
6    return combineLatest([currentEnvironment$, globalEnv$]).pipe(
7      map(([selectedEnv, globalEnv]) => {
8        const results: AggregateEnvironment[] = []
9
10        // Step 1: Pre-defined variables (highest priority)
11        HOPP_SUPPORTED_PREDEFINED_VARIABLES.forEach(({ key, getValue }) => {
12          results.push({
13            key,
14            currentValue: getValue(),
15            initialValue: getValue(),
16            secret: false,
17            sourceEnv: selectedEnv?.name ?? "Global",
18          })
19        })
20
21        // Step 2: Selected environment variables
22        selectedEnv?.variables.map((x, index) => {
23          let currentValue = x.currentValue
24          let initialValue = x.initialValue
25          if (x.secret) {
26            currentValue =
27              secretEnvironmentService.getSecretEnvironmentVariableValue(
28                selectedEnv.id, index
29              )?.value ?? ""
30            initialValue =
31              secretEnvironmentService.getSecretEnvironmentVariableValue(
32                selectedEnv.id, index
33              )?.initialValue ?? ""
34          }
35          results.push({
36            key: x.key,
37            currentValue:
38              currentEnvironmentValueService.getEnvironmentVariableValue(
39                selectedEnv.id, index
40              ) ?? currentValue,
41            initialValue: x.initialValue ?? initialValue,
42            secret: x.secret,
43            sourceEnv: selectedEnv.name,
44          })
45        })
46
47        // Step 3: Global variables (lowest priority - only if key not already present)
48        globalEnv.variables.map((x, index) => {
49          // ... same pattern with secret resolution ...
50        })
51
52        return results
53      }),
54      distinctUntilChanged(isEqual)
55    )
56  })()
>
Source: [environments.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/newstore/environments.ts#L617-L700)

### AggregateEnvironment Type
typescript1export type AggregateEnvironment = {
2  key: string
3  initialValue: string
4  currentValue: string
5  secret: boolean
6  sourceEnv: string       // Origin environment name (e.g., "Global", env name)
7  sourceEnvID?: string    // Origin environment ID
8}
>
Source: [environments.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/newstore/environments.ts#L417-L424)

## Usage Examples
### Creating and Managing Environments
**Create a personal environment:**

typescript1import { createEnvironment } from "~/newstore/environments"
2
3// Create a new environment with variables
4createEnvironment(
5  "Development",                                   // name
6  [                                                // variables
7    {
8      key: "base_url",
9      initialValue: "http://localhost:3000",
10      currentValue: "http://localhost:3000",
11      secret: false,
12    },
13    {
14      key: "api_key",
15      initialValue: "",
16      currentValue: "",
17      secret: true,                                // Marked as secret
18    },
19  ]
20)
>
Source: [environments.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/newstore/environments.ts#L843-L856)

**Duplicate an environment:**

typescript1import { duplicateEnvironment } from "~/newstore/environments"
2
3// Duplicate the environment at index 0
4duplicateEnvironment(0)
5// The new environment will be named "Original - Duplicate"
>
Source: [environments.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/newstore/environments.ts#L120-L141)

**Select an environment:**

typescript1import { setSelectedEnvironmentIndex } from "~/newstore/environments"
2
3// Select a personal environment by index
4setSelectedEnvironmentIndex({ type: "MY_ENV", index: 0 })
5
6// Deselect all environments
7setSelectedEnvironmentIndex({ type: "NO_ENV_SELECTED" })
8
9// Select a team environment
10setSelectedEnvironmentIndex({
11  type: "TEAM_ENV",
12  teamID: "team-123",
13  teamEnvID: "env-456",
14  environment: { v: 2, id: "env-456", name: "Production", variables: [...] }
15})
>
Source: [environments.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/newstore/environments.ts#L730-L739)

### Managing Variables
**Add a variable to an environment:**

typescript1import { addEnvironmentVariable } from "~/newstore/environments"
2
3addEnvironmentVariable(
4  0,                    // environment index
5  {
6    key: "auth_token",
7    currentValue: "abc123",
8    initialValue: "abc123",
9    secret: true,       // stored encrypted in local storage
10  }
11)
>
Source: [environments.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/newstore/environments.ts#L915-L939)

**Get the currently resolved variables (for use in request execution):**

typescript1import { getAggregateEnvsWithCurrentValue } from "~/newstore/environments"
2
3const resolvedVars = getAggregateEnvsWithCurrentValue()
4// Returns AggregateEnvironment[] with all variables merged
5// from predefined, selected env, and global sources
6// Secret values are decrypted, current values applied
>
Source: [environments.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/newstore/environments.ts#L540-L615)

### Creating a Team Environment (Backend via GraphQL)
**GraphQL mutation to create a team environment:**

graphql1mutation CreateTeamEnvironment(
2  $variables: String!
3  $teamID: ID!
4  $name: String!
5) {
6  createTeamEnvironment(variables: $variables, teamID: $teamID, name: $name) {
7    variables
8    name
9    teamID
10    id
11  }
12}
>
Source: [CreateTeamEnvironment.graphql](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/helpers/backend/gql/mutations/CreateTeamEnvironment.graphql#L1-L11)

**Backend service handling the creation:**

typescript1async createTeamEnvironment(name: string, teamID: string, variables: string) {
2  const isTitleValid = isValidLength(name, this.TITLE_LENGTH)
3  if (!isTitleValid) return E.left(TEAM_ENVIRONMENT_SHORT_NAME)
4
5  const result = await this.prisma.teamEnvironment.create({
6    data: {
7      name,
8      teamID,
9      variables: JSON.parse(variables),
10    },
11  })
12
13  const createdTeamEnvironment = this.cast(result)
14
15  this.pubsub.publish(
16    `team_environment/${createdTeamEnvironment.teamID}/created`,
17    createdTeamEnvironment,
18  )
19
20  return E.right(createdTeamEnvironment)
21}
>
Source: [team-environments.service.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/team-environments/team-environments.service.ts#L74-L94)

### Exporting an Environment
typescript1import { exportAsJSON } from "~/helpers/import-export/export/environment"
2
3// Export a personal environment
4const env = { v: 2, id: "abc", name: "Dev", variables: [...] }
5const result = await exportAsJSON(env)
6
7// The export strips secret currentValues for security:
8// transformEnvironmentVariables eliminates currentValue
9// for secret variables, replacing with ""
>
Source: [environment.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/helpers/import-export/export/environment.ts#L31-L54)

### Using Environment Variables in Request Fields
Variables are referenced with `<<variable_name>>` syntax in any request field:

- **URL**: `<<base_url>>/api/users`
- **Headers**: `Authorization: Bearer <<auth_token>>`
- **Query Parameters**: `?page=<<page_number>>`
- **Request Body**: `{ "user_id": "<<user_id>>" }`

The `HOPP_ENVIRONMENT_REGEX` (`/<<[a-zA-Z0-9_.-]+>>/g`) detects these references and the system resolves them using the aggregation pipeline.

## Configuration Options
### Environment Variable Fields
FieldTypeDefaultDescription`key``string`RequiredThe variable name used in `<<key>>` references`initialValue``string``""`The original value when the environment was created/loaded`currentValue``string``""`The current runtime value, can be overridden locally`secret``boolean``false`If `true`, value is encrypted in browser local storage and never synced to server
### Environment Model Fields
FieldTypeDescription`v``number` (literal `2`)Schema version for migration support`id``string`Unique identifier for the environment`name``string`Human-readable environment name`variables``EnvironmentVariable[]`Array of variable definitions
### Predefined Variables
Hoppscotch includes built-in dynamic variables prefixed with `$` for generating test data:

VariableDescriptionExample Output`$guid`A v4 style GUID`"550e8400-e29b-41d4-a716-446655440000"``$timestamp`Current UNIX timestamp (seconds)`"1699000000"``$isoTimestamp`Current ISO timestamp at zero UTC`"2024-11-03T12:00:00.000Z"``$randomUUID`Random 36-character UUID`"a1b2c3d4-e5f6-7890-abcd-ef1234567890"``$randomAlphaNumeric`Random alphanumeric character`"a"`, `"Z"`, `"7"``$randomBoolean`Random boolean value`"true"` or `"false"``$randomInt`Random integer (0-1000)`"742"``$randomColor`Random color name`"red"`, `"blue"`, `"green"``$randomHexColor`Random hex color`"#a3f0b1"``$randomAbbreviation`Random abbreviation`"API"`, `"JSON"`, `"HTML"``$randomIP`Random IPv4 address`"192.168.1.1"``$randomIPV6`Random IPv6 address`"2001:db8::1"``$randomMACAddress`Random MAC address`"00:1a:2b:3c:4d:5e"``$randomPassword`Random 15-char alphanumeric`"Ab3$k9LmN8pQrX"``$randomFirstName`Random first name`"Ethan"`, `"Alice"``$randomLastName`Random last name`"Doe"`, `"Smith"``$randomFullName`Random full name`"Jane Doe"``$randomCity`Random city name`"New York"`, `"Chicago"``$randomCompanyName`Random company name`"Nexora"`, `"CodeLoom"``$randomJobTitle`Random job title`"Dynamic Data Specialist"``$randomSemver`Random semantic version`"3.7.1"``$randomProtocol`Random protocol`"http"` or `"https"``$randomUserAgent`Random user agent`"Mozilla/5.0 (Macintosh; ...)"`
>
Source: [predefinedVariables.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-data/src/predefinedVariables.ts#L24-L383)

## API Reference
### Frontend Store API (`~/newstore/environments`)
#### `getCurrentEnvironment(): Environment`
Returns the currently selected environment object. If no environment is selected, returns a stub environment named `"No environment"` with empty variables.

#### `getAggregateEnvs(): AggregateEnvironment[]`
Returns the merged list of all available variables (predefined + selected + global) without resolving current values from services.

#### `getAggregateEnvsWithCurrentValue(): AggregateEnvironment[]`
Returns the merged list with current values resolved from `CurrentValueService` and secret values decrypted from `SecretEnvironmentService`.

#### `setSelectedEnvironmentIndex(index: SelectedEnvironmentIndex): void`
Sets the active environment selection. Accepts `"NO_ENV_SELECTED"`, `{ type: "MY_ENV", index }`, or `{ type: "TEAM_ENV", ... }`.

#### `createEnvironment(envName: string, variables?, envID?): void`
Creates a new personal environment. Optionally accepts an array of variables and a pre-assigned ID (for sync operations).

#### `deleteEnvironment(envIndex: number, envID?: string): void`
Removes an environment and corrects the selected index if needed.

#### `addEnvironmentVariable(envIndex, { key, currentValue, initialValue, secret }): void`
Adds a new variable to the specified environment.

#### `setGlobalEnvVariables(entries: GlobalEnvironment): void`
Replaces all global environment variables with the given entries.

#### `clearGlobalEnvVariables(): void`
Removes all global environment variables.

### Backend GraphQL Mutations
#### `createUserEnvironment(name: String!, variables: String!): UserEnvironment`
Creates a new personal environment. Variables must be a JSON string.

#### `updateUserEnvironment(id: ID!, name: String!, variables: String!): UserEnvironment`
Updates a personal environment's name and variables.

#### `deleteUserEnvironment(id: ID!): Boolean`
Deletes a personal environment.

#### `createTeamEnvironment(name: String!, teamID: ID!, variables: String!): TeamEnvironment`
Creates a new team environment (requires Owner/Editor role).

#### `updateTeamEnvironment(id: ID!, name: String!, variables: String!): TeamEnvironment`
Updates a team environment (requires Owner/Editor role).

#### `deleteTeamEnvironment(id: ID!): Boolean`
Deletes a team environment (requires Owner/Editor role).

#### `createDuplicateEnvironment(id: ID!): TeamEnvironment`
Duplicates a team environment (requires Owner/Editor role).

### Backend Services
#### `UserEnvironmentsService`
MethodDescription`fetchUserEnvironments(uid)`Get all personal (non-global) environments for a user`fetchUserGlobalEnvironment(uid)`Get the user's global environment`createUserEnvironment(uid, name, variables, isGlobal)`Create personal or global environment`updateUserEnvironment(id, name, variables, user)`Update an environment with auth check`deleteUserEnvironment(uid, id)`Delete an environment (not global)`deleteUserEnvironments(uid)`Delete all personal environments`clearGlobalEnvironments(uid, id)`Clear all variables from global environment
#### `TeamEnvironmentsService`
MethodDescription`getTeamEnvironment(id)`Get details of a team environment`createTeamEnvironment(name, teamID, variables)`Create a new team environment`updateTeamEnvironment(id, name, variables)`Update a team environment`deleteTeamEnvironment(id)`Delete a team environment`fetchAllTeamEnvironments(teamID)`Get all environments for a team`createDuplicateEnvironment(id)`Duplicate a team environment`deleteAllVariablesFromTeamEnvironment(id)`Clear all variables from a team environment
## Environment Inspector
Hoppscotch includes a built-in inspection system that validates environment variable usage in real-time:

加载图表中...
The `EnvironmentInspectorService` scans request URLs, headers, and parameters for `<<variable>>` references and reports two types of issues:

- **Variable Not Found** — A `<<var>>` reference exists but no variable with that key is defined in any source (predefined, request, collection, environment, or global).
- **Variable Empty** — A variable is defined but has no current value or secret value stored.

Each issue provides an actionable fix: users can click to add the missing variable or navigate to the environment editor to set a value.

>
Source: [environment.inspector.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/services/inspection/inspectors/environment.inspector.ts#L38-L164)

## Code Editor Integration
The `HoppEnvironmentPlugin` provides real-time environment variable highlighting and tooltips within the code editor. Variables are color-coded based on their source:

- **`<<var>>`** — Environment variable (from selected environment)
- **`<<var>>`** — Global variable
- **`<<var>>`** — Request variable
- **`<<var>>`** — Collection variable
- **`<<var>>`** — Not found (highlighted as error)

Hovering over a variable shows a tooltip with:

- Source environment name with icon
- Initial value (masked as `******` for secrets)
- Current value (masked as `******` for secrets)
- Edit button to quickly modify the variable

>
Source: [HoppEnvironment.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/helpers/editor/extensions/HoppEnvironment.ts#L401-L485)

## Related Links

- [Getting Started with Hoppscotch](./2-getting-started.1-getting-started)
- [Environment Variable Syntax Reference](https://docs.hoppscotch.io/documentation/features/environments)
- [Environment Model Definition](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-data/src/environment/index.ts)
- [Global Environment Model Definition](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-data/src/global-environment/index.ts)
- [Predefined Variables Source](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-data/src/predefinedVariables.ts)
- [Frontend Environment Store](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/newstore/environments.ts)
- [Backend User Environments Service](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/user-environment/user-environments.service.ts)
- [Backend Team Environments Service](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-backend/src/team-environments/team-environments.service.ts)
- [Secret Environment Service](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/services/secret-environment.service.ts)
- [Current Value Service](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/services/current-environment-value.service.ts)
- [Environment Inspector](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/services/inspection/inspectors/environment.inspector.ts)
- [Team Environment Adapter](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/helpers/teams/TeamEnvironmentAdapter.ts)
- [Environment Regex Definition](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/helpers/environment-regex.ts)