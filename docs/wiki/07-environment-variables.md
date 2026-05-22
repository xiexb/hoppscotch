# Environment Variables
Environment variables in Hoppscotch provide a powerful way to manage dynamic values across your API requests, enabling you to reuse values, keep sensitive data secure, and switch between different configurations (development, staging, production) seamlessly.

## Overview
Hoppscotch's environment variable system allows you to define named variables that can be referenced in your API requests using the `<<variable_name>>` syntax. When a request is executed, Hoppscotch resolves these placeholders with the corresponding variable values from the currently active environment.

The system supports several types of environments and variables:

- **Personal Environments**: Private environments scoped to your user account
- **Team Environments**: Shared environments for team collaboration
- **Global Environment**: Always-active variables available across all environments
- **Pre-defined Variables**: Built-in dynamic variables (e.g., `$timestamp`, `$randomUUID`)
- **Secret Variables**: Variables whose values are encrypted and stored locally
- **Request Variables**: Variables scoped to a single request execution
- **Collection Variables**: Inherited variables from parent collections

The environment variable resolution follows a strict priority chain:

- **Pre-defined Variables** (`$guid`, `$timestamp`, etc.) — Highest priority
- **Request Variables** — Scoped to the current request
- **Collection Variables** — Inherited from collections
- **Selected Environment Variables** — The currently active personal or team environment
- **Global Environment Variables** — Always active, lowest priority

## Architecture
The environment variable system is composed of several layers, from the data model definitions through the frontend store, services, and UI components, to the backend API for syncing with the server.

加载图表中...
The architecture follows a layered design. The **Data Layer** defines the schema and parsing logic, the **Store Layer** manages the application state using a dispatching store pattern, the **Service Layer** provides additional functionality like secret storage and inspection, and the **Backend Layer** handles persistence and team sharing via GraphQL APIs.

## Variable Resolution & Priority
When Hoppscotch resolves `<<variable_name>>` in a request, it follows a strict priority chain. Variables from higher-priority sources override those from lower-priority sources when they share the same key name.

加载图表中...
This priority is implemented in the `aggregateEnvs$` observable, which merges variables in this exact order:

>
Source: [environments.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/environments.ts#L436-L494)

typescript1export const aggregateEnvs$: Observable<AggregateEnvironment[]> = combineLatest(
2  [currentEnvironment$, globalEnv$]
3).pipe(
4  map(([selectedEnv, globalEnv]) => {
5    const effectiveAggregateEnvs: AggregateEnvironment[] = []
6
7    // Step 1: Pre-defined variables (highest priority)
8    HOPP_SUPPORTED_PREDEFINED_VARIABLES.forEach(({ key, getValue }) => {
9      effectiveAggregateEnvs.push({
10        key,
11        currentValue: getValue(),
12        initialValue: getValue(),
13        secret: false,
14        sourceEnv: selectedEnv?.name ?? "Global",
15      })
16    })
17
18    const aggregateEnvKeys = effectiveAggregateEnvs.map(({ key }) => key)
19
20    // Step 2: Selected environment variables
21    selectedEnv?.variables.forEach((variable) => {
22      if (!aggregateEnvKeys.includes(key)) {
23        effectiveAggregateEnvs.push({ ... })
24      }
25    })
26
27    // Step 3: Global environment variables (lowest priority)
28    globalEnv.variables.forEach((variable) => {
29      if (!aggregateEnvKeys.includes(key)) {
30        effectiveAggregateEnvs.push({ ... })
31      }
32    })
33
34    return effectiveAggregateEnvs
35  }),
36  distinctUntilChanged(isEqual)
37)
## Data Model
### Environment Variable Structure
Each environment variable (version 2 schema) contains four fields:

>
Source: [v/2.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/environment/v/2.ts#L1-L15)

typescript1const V2_SCHEMA = V1_SCHEMA.extend({
2  v: z.literal(2),
3  variables: z.array(
4    z.object({
5      key: z.string(),           // Variable name used in <<key>>
6      initialValue: z.string(),  // Initial value when environment is created
7      currentValue: z.string(),  // Current value (can be modified locally)
8      secret: z.boolean(),       // Whether this is a secret variable
9    })
10  ),
11})
### Aggregate Environment Type
The combined environment type used throughout the application includes a source tracking field:

>
Source: [environments.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/environments.ts#L417-L424)

typescript1export type AggregateEnvironment = {
2  key: string
3  initialValue: string
4  currentValue: string
5  secret: boolean
6  sourceEnv: string       // "Global" | environment name | "RequestVariable" | "CollectionVariable"
7  sourceEnvID?: string
8}
## Environment Store (State Management)
The environment state is managed using a `DispatchingStore` pattern with a set of dispatchers that handle all mutations:

>
Source: [environments.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/environments.ts#L28-L50)

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
### Selected Environment Index Types
The `selectedEnvironmentIndex` follows a discriminated union type that determines which environment is currently active:

>
Source: [environments.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/environments.ts#L18-L26)

typescript1export type SelectedEnvironmentIndex =
2  | { type: "NO_ENV_SELECTED" }
3  | { type: "MY_ENV"; index: number }
4  | {
5      type: "TEAM_ENV"
6      teamID: string
7      teamEnvID: string
8      environment: Environment
9    }
## Core Services
### Secret Environment Service
Secret variables are stored locally in the browser's memory and are never sent to the server. The `SecretEnvironmentService` manages these values using a reactive `Map<string, SecretVariable[]>`.

>
Source: [secret-environment.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/secret-environment.service.ts#L1-L15)

typescript1export type SecretVariable = {
2  key: string
3  value: string
4  varIndex: number
5  initialValue?: string
6}
7
8/**
9 * This service is used to store and manage secret environments.
10 * The secret environments are not synced with the server.
11 * hence they are not persisted in the database. They are stored
12 * in the local storage of the browser.
13 */
14export class SecretEnvironmentService extends Service {
15  public static readonly ID = "SECRET_ENVIRONMENT_SERVICE"
16
17  public secretEnvironments = reactive(new Map<string, SecretVariable[]>())
18  // ...
19}
### Current Value Service
The `CurrentValueService` manages the current (runtime) values of environment variables. These values are also local-only and not synced to the server. This service is distinct from the secret service because even non-secret variables can have locally-modified current values that shouldn't be persisted.

>
Source: [current-environment-value.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/current-environment-value.service.ts#L8-L13)

typescript1export type Variable = {
2  key: string
3  currentValue: string
4  varIndex: number
5  isSecret: boolean
6}
7
8/**
9 * This service is used to store and manage current value of environment variables.
10 * The current value are not synced with the server.
11 * hence they are not persisted in the database. They are stored
12 * in the local storage of the browser.
13 */
14export class CurrentValueService extends Service {
15  public static readonly ID = "CURRENT_VALUE_SERVICE"
16
17  public environments = reactive(new Map<string, Variable[]>())
18  // ...
19}
### Environment Inspector Service
The `EnvironmentInspectorService` inspects API requests for environment variable usage. It detects:

- **Undefined variables**: `<<var>>` is used but `var` is not defined in any active environment
- **Empty variables**: `<<var>>` is used but the variable has no value assigned

>
Source: [environment.inspector.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/inspection/inspectors/environment.inspector.ts#L113-L161)

typescript1// Scanning each input string for <<VAR>> patterns
2target.forEach((element, index) => {
3  if (!isENVInString(element)) return
4  const matches = element.match(HOPP_ENVIRONMENT_REGEX)
5  matches?.forEach((exEnv) => {
6    const formattedExEnv = exEnv.slice(2, -2)
7    if (!envKeysSet.has(formattedExEnv)) {
8      newErrors.push({
9        id: `environment-not-found-${newErrors.length}`,
10        text: {
11          type: "text",
12          text: this.t("inspections.environment.not_found", {
13            environment: exEnv,
14          }),
15        },
16        action: {
17          text: this.t("inspections.environment.add_environment"),
18          apply: () =>
19            invokeAction("modals.environment.add", {
20              envName: formattedExEnv,
21              variableName: "",
22            }),
23          showAction: true,
24        },
25        severity: 3,
26        // ...
27      })
28    }
29  })
30})
## Variable Interpolation
### Template String Parsing
Variables are resolved recursively with a maximum depth of 10 expansions to prevent infinite loops from circular references:

>
Source: [environment/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/environment/index.ts#L55-L89)

typescript1const ENV_MAX_EXPAND_LIMIT = 10
2const ENV_EXPAND_LOOP = "ENV_EXPAND_LOOP" as const
3
4export function parseBodyEnvVariablesE(
5  body: string,
6  env: Environment["variables"]
7) {
8  let result = body
9  let depth = 0
10
11  while (result.match(REGEX_ENV_VAR) != null && depth <= ENV_MAX_EXPAND_LIMIT) {
12    result = result.replace(REGEX_ENV_VAR, (key) => {
13      const variableName = key.replace(/[<>]/g, "")
14
15      // Pre-defined variables take priority
16      const foundPredefinedVar = HOPP_SUPPORTED_PREDEFINED_VARIABLES.find(
17        (preVar) => preVar.key === variableName
18      )
19      if (foundPredefinedVar) {
20        return foundPredefinedVar.getValue()
21      }
22
23      const foundEnv = env.find((envVar) => envVar.key === variableName)
24      if (foundEnv && "currentValue" in foundEnv) {
25        return foundEnv.currentValue
26      }
27      return key  // Unresolved variables are left as-is
28    })
29    depth++
30  }
31
32  return depth > ENV_MAX_EXPAND_LIMIT
33    ? E.left(ENV_EXPAND_LOOP)
34    : E.right(result)
35}
### Environment Variable Regex
Environment variables in Hoppscotch are referenced using `<<variable_name>>` syntax:

>
Source: [environment-regex.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/environment-regex.ts#L1-L8)

typescript1const ENV_VAR_NAME_PATTERN = "[a-zA-Z0-9_.-]+"
2const HOPP_ENVIRONMENT_REGEX = new RegExp(`(<<${ENV_VAR_NAME_PATTERN}>>)`, "g")
3const ENV_VAR_NAME_REGEX = new RegExp(ENV_VAR_NAME_PATTERN)
4
5export { HOPP_ENVIRONMENT_REGEX, ENV_VAR_NAME_REGEX }
## Pre-defined Variables
Hoppscotch provides a set of built-in pre-defined variables that are always available without needing to define them in an environment. These variables are prefixed with `$`:

>
Source: [predefinedVariables.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/predefinedVariables.ts#L1-L5)

typescript1export type PredefinedVariable = {
2  key: `$${string}`
3  description: string
4  getValue: () => string
5}
VariableDescriptionExample Value`$guid`A v4 style GUID`550e8400-e29b-41d4-a716-446655440000``$timestamp`Current UNIX timestamp in seconds`1698000000``$isoTimestamp`Current ISO timestamp at zero UTC`2023-10-22T12:00:00.000Z``$randomUUID`A random 36-character UUID`6c84fb90-12c4-11e1-840d-7b25c5ee775a``$randomAlphaNumeric`A random alphanumeric character`A`, `z`, `7``$randomBoolean`A random boolean value`true``$randomInt`A random integer between 0 and 1000`472``$randomColor`A random color name`blue``$randomHexColor`A random hex color`#a3f0b2``$randomAbbreviation`A random abbreviation`API``$randomIP`A random IPv4 address`192.168.1.42``$randomIPV6`A random IPv6 address`2001:0db8:...``$randomMACAddress`A random MAC address`00:1a:2b:3c:4d:5e``$randomPassword`Random 15-char alphanumeric password`aB3xK9mP2rT5vW``$randomFirstName`A random first name`John``$randomLastName`A random last name`Smith``$randomFullName`A random full name`Jane Doe``$randomCompanyName`A random company name`Nexora``$randomCity`A random city name`New York``$randomJobTitle`A random job title`Dynamic Data Specialist``$randomSemver`A random semantic version`3.7.1``$randomUserAgent`A random user agent`Mozilla/5.0 (Macintosh; ...)`
## Editor Integration
### CodeMirror Plugin
Environment variables are highlighted and made interactive in the code editor through the `HoppEnvironmentPlugin`. This plugin provides:

- **Syntax highlighting**: Different colors for different variable sources (global, personal, team, request, collection)
- **Hover tooltips**: Shows variable details (source, initial value, current value) when hovering over `<<var>>`
- **Quick-edit**: Click the edit button in the tooltip to modify a variable's value

>
Source: [HoppEnvironment.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/editor/extensions/HoppEnvironment.ts#L346-L354)

typescript1const getMatchDecorator = (aggregateEnvs: AggregateEnvironment[]) =>
2  new MatchDecorator({
3    regexp: HOPP_ENVIRONMENT_REGEX,
4    decoration: (m, view, pos) => {
5      if (isComment(view.state, pos)) return null
6      return checkEnv(m[0], aggregateEnvs)
7    },
8  })
Variables are highlighted with different CSS classes based on their source:

>
Source: [HoppEnvironment.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/editor/extensions/HoppEnvironment.ts#L50-L56)

typescript1const HOPP_ENV_HIGHLIGHT = "cursor-help transition rounded px-1 focus:outline-none mx-0.5 env-highlight"
2const HOPP_REQUEST_VARIABLE_HIGHLIGHT = "request-variable-highlight"
3const HOPP_COLLECTION_ENVIRONMENT_HIGHLIGHT = "collection-variable-highlight"
4const HOPP_ENVIRONMENT_HIGHLIGHT = "environment-variable-highlight"
5const HOPP_GLOBAL_ENVIRONMENT_HIGHLIGHT = "global-variable-highlight"
6const HOPP_ENV_HIGHLIGHT_NOT_FOUND = "environment-not-found-highlight"
## Core Flow: Variable Resolution During Request Execution
加载图表中...
## Backend Integration
### Personal & Global Environments
The backend provides a GraphQL resolver for managing personal and global user environments:

>
Source: [user-environments.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/user-environment/user-environments.service.ts#L31-L50)

typescript1async fetchUserEnvironments(uid: string) {
2  const environments = await this.prisma.userEnvironment.findMany({
3    where: {
4      userUid: uid,
5      isGlobal: false,
6    },
7  });
8  // ...
9}
10
11async fetchUserGlobalEnvironment(uid: string) {
12  const globalEnvironment = await this.prisma.userEnvironment.findFirst({
13    where: {
14      userUid: uid,
15      isGlobal: true,
16    },
17  });
18  // ...
19}
The `UserEnvironment` GraphQL model:

>
Source: [user-environments.model.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/user-environment/user-environments.model.ts#L1-L29)

typescript1@ObjectType()
2export class UserEnvironment {
3  @Field(() => ID)
4  id: string;
5
6  @Field(() => ID)
7  userUid: string;
8
9  @Field(() => String, { nullable: true })
10  name: string | null | undefined;
11
12  @Field()
13  variables: string;  // JSON string of [{ key, value }, ...]
14
15  @Field()
16  isGlobal: boolean;
17}
### Team Environments
Team environments are shared among team members and managed via a separate service:

>
Source: [team-environments.service.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/team-environments/team-environments.service.ts#L74-L80)

typescript1async createTeamEnvironment(name: string, teamID: string, variables: string) {
2  const isTitleValid = isValidLength(name, this.TITLE_LENGTH);
3  if (!isTitleValid) return E.left(TEAM_ENVIRONMENT_SHORT_NAME);
4
5  const result = await this.prisma.teamEnvironment.create({
6    data: { name, teamID, variables: JSON.parse(variables) },
7  });
8  // ...
9}
## Usage Examples
### Basic Usage: Using Environment Variables in Requests

- Create an environment with variables in the Hoppscotch UI
- Reference them in any request field using `<<variable_name>>`

URL: https://<<base_url>>/api/<<endpoint>>
Header Key: Authorization
Header Value: Bearer <<auth_token>>
### Creating an Environment Programmatically
>
Source: [environments.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/environments.ts#L843-L856)

typescript1import { createEnvironment } from "~/newstore/environments"
2
3// Create a new environment with variables
4createEnvironment(
5  "Development",  // Environment name
6  [
7    {
8      key: "base_url",
9      initialValue: "localhost:3000",
10      currentValue: "localhost:3000",
11      secret: false,
12    },
13    {
14      key: "auth_token",
15      initialValue: "",
16      currentValue: "",
17      secret: true,  // This value will be stored locally
18    },
19  ]
20)
### Adding a Variable to an Existing Environment
>
Source: [environments.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/environments.ts#L915-L939)

typescript1import { addEnvironmentVariable } from "~/newstore/environments"
2
3addEnvironmentVariable(
4  0,  // Environment index
5  {
6    key: "api_version",
7    initialValue: "v2",
8    currentValue: "v2",
9    secret: false,
10  }
11)
### Selecting an Environment
>
Source: [environments.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/environments.ts#L730-L739)

typescript1import { setSelectedEnvironmentIndex } from "~/newstore/environments"
2
3// Select a personal environment at index 0
4setSelectedEnvironmentIndex({ type: "MY_ENV", index: 0 })
5
6// Select no environment
7setSelectedEnvironmentIndex({ type: "NO_ENV_SELECTED" })
### Getting Combined Environment Variables for a Request
>
Source: [environments.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/utils/environments.ts#L79-L89)

typescript1import { getCombinedEnvVariables } from "~/helpers/utils/environments"
2
3// Returns variables from: global env + selected environment + optional temp variables
4const envVars = getCombinedEnvVariables()
5// Result: { global: [...], selected: [...], temp: [] }
## Configuration Options
### Environment Store State
OptionTypeDefaultDescription`environments``Environment[]``[{ name: "My Environment Variables", variables: [], v: 2 }]`List of personal environments`globals``GlobalEnvironment``{ v: 2, variables: [] }`Global environment variables`globalEnvID``string | undefined``undefined`Server-side ID for the global environment`selectedEnvironmentIndex``SelectedEnvironmentIndex``{ type: "NO_ENV_SELECTED" }`Currently selected environment
### Environment Variable Properties
PropertyTypeDefaultDescription`key``string`RequiredVariable name used in `<<key>>` syntax`initialValue``string``""`Original value when environment was created`currentValue``string``""`Runtime value (can be modified locally)`secret``boolean``false`If true, value is stored locally and not synced
## API Reference
### `environmentsStore` — Dispatching Store
The central store managing all environment state.

>
Source: [environments.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/environments.ts#L378-L381)

### Key Store Functions
#### `createEnvironment(envName: string, variables?, envID?)`
Creates a new personal environment. If `envID` is provided, it uses that ID (for sync). Otherwise, a unique ID is generated.

#### `deleteEnvironment(envIndex: number, envID?: string)`
Deletes an environment by index. Automatically adjusts the selected environment index if the deleted environment was selected.

#### `setSelectedEnvironmentIndex(selectedEnvironmentIndex: SelectedEnvironmentIndex)`
Sets the currently active environment. The `SelectedEnvironmentIndex` type can be:

- `{ type: "NO_ENV_SELECTED" }` — No environment
- `{ type: "MY_ENV", index: number }` — A personal environment
- `{ type: "TEAM_ENV", teamID, teamEnvID, environment }` — A team environment

#### `getCurrentEnvironment(): Environment`
Returns the currently selected environment object or a default "No environment" placeholder if none is selected.

#### `aggregateEnvs$: Observable<AggregateEnvironment[]>`
An RxJS observable that emits the combined list of all available environment variables, following the priority chain: pre-defined → selected environment → global environment.

#### `getAggregateEnvsWithCurrentValue(): AggregateEnvironment[]`
Synchronous function that returns the combined environment variables with current values resolved from the `SecretEnvironmentService` and `CurrentValueService`.

### Backend GraphQL Mutations (via resolver)
**Personal Environments:**

- `createUserEnvironment(uid, name, variables, isGlobal)` — Create personal or global environment
- `updateUserEnvironment(id, name, variables, user)` — Update existing environment
- `deleteUserEnvironment(uid, id)` — Delete personal environment
- `clearGlobalEnvironments(uid, id)` — Clear all variables in global environment

**Team Environments:**

- `createTeamEnvironment(name, teamID, variables)` — Create team environment
- `updateTeamEnvironment(id, name, variables)` — Update team environment
- `deleteTeamEnvironment(id)` — Delete team environment

## Related Links

- [Collections Documentation](./7-collections-and-environments.1-collections)
- [Environment Variables Data Model](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/environment/index.ts)
- [Global Environment Data Model](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/global-environment/index.ts)
- [Environment Store Implementation](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/environments.ts)
- [Secret Environment Service](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/secret-environment.service.ts)
- [Current Value Service](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/current-environment-value.service.ts)
- [Environment Regex Pattern](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/environment-regex.ts)
- [Pre-defined Variables](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/predefinedVariables.ts)
- [Editor Integration (HoppEnvironment Plugin)](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/editor/extensions/HoppEnvironment.ts)
- [Environment Inspector Service](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/services/inspection/inspectors/environment.inspector.ts)
- [Backend User Environments Service](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/user-environment/user-environments.service.ts)
- [Backend Team Environments Service](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-backend/src/team-environments/team-environments.service.ts)