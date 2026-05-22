# Predefined Variables
Predefined variables are built-in dynamic placeholders in Hoppscotch that generate values at runtime, such as UUIDs, timestamps, random names, and IP addresses. They are automatically available across all environments and are resolved with the highest priority when processing environment variable substitutions.

## Overview
Predefined variables provide a convenient way to inject dynamically generated values into your API requests. Unlike user-defined environment variables that store static values, predefined variables compute their values on-the-fly each time they are resolved. This makes them ideal for scenarios where you need unique, randomized, or timestamped data in your requests.

**Key characteristics:**

- **Always available**: Predefined variables exist in every environment without configuration
- **Highest priority**: They take precedence over user-defined environment variables with the same name
- **Syntax**: Referenced using the `<<$variableName>>` syntax (note the `$` prefix)
- **Dynamic evaluation**: Values are computed each time the variable is resolved
- **Editor integration**: Supported with syntax highlighting, hover tooltips, and validation in the Hoppscotch editor

## Architecture
The predefined variables system is built around a simple yet powerful architecture that integrates deeply into Hoppscotch's variable resolution pipeline.

加载图表中...
### Component Roles
ComponentLocationResponsibility**PredefinedVariable type**`packages/hoppscotch-data/src/predefinedVariables.ts`Defines the type structure with `key`, `description`, and `getValue()`**HOPP_SUPPORTED_PREDEFINED_VARIABLES**`packages/hoppscotch-data/src/predefinedVariables.ts`The comprehensive registry of all predefined variables with their generators**parseTemplateString() / parseBodyEnvVariables()**`packages/hoppscotch-data/src/environment/index.ts`Core resolution functions that substitute `<<var>>` with values**aggregateEnvs$**`packages/hoppscotch-common/src/newstore/environments.ts`Reactive store that assembles all available variables with priority ordering**HoppPredefinedVariablesPlugin**`packages/hoppscotch-common/src/helpers/editor/extensions/HoppPredefinedVariables.ts`CodeMirror plugin providing syntax highlighting and hover tooltips**EnvInput.vue**`packages/hoppscotch-common/src/components/smart/EnvInput.vue`Reusable text input component with predefined variable support**codemirror.ts composable**`packages/hoppscotch-common/src/composables/codemirror.ts`Composable that wires up editor extensions including predefined variable highlighting
## Variable Resolution Priority
When Hoppscotch resolves a variable reference (e.g., `<<$guid>>`), it follows a strict priority order. This ensures predefined variables always take precedence over user-defined variables with the same name.

加载图表中...
This priority is implemented in the `aggregateEnvs$` observable in `environments.ts`:

>
Source: [environments.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/environments.ts#L430-L451)

typescript1// The priority of the variables is as follows:
2// 1. Pre-defined variables
3// 2. Request Variables (from the current request)
4// 3. Selected Environment Variables
5// 4. Global Environment Variables
6HOPP_SUPPORTED_PREDEFINED_VARIABLES.forEach(({ key, getValue }) => {
7  effectiveAggregateEnvs.push({
8    key,
9    currentValue: getValue(),
10    initialValue: getValue(),
11    secret: false,
12    sourceEnv: selectedEnv?.name ?? "Global",
13  })
14})
15
16const aggregateEnvKeys = effectiveAggregateEnvs.map(({ key }) => key)
17
18// Only add non-predefined environment variables if they don't conflict
19selectedEnv?.variables.forEach((variable) => {
20  if (!aggregateEnvKeys.includes(key)) {
21    effectiveAggregateEnvs.push({ ... })
22  }
23})
The same priority is applied during template string parsing in the data layer:

>
Source: [environment/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/environment/index.ts#L126-L133)

typescript1// Prioritise predefined variable values over normal environment variables processing.
2const foundPredefinedVar = HOPP_SUPPORTED_PREDEFINED_VARIABLES.find(
3  (preVar) => preVar.key === p1
4)
5
6if (foundPredefinedVar) {
7  return foundPredefinedVar.getValue()
8}
## Complete List of Predefined Variables
Predefined variables are organized into logical categories. Each variable is defined with a `key` (the identifier used in templates), a `description` shown in the editor tooltip, and a `getValue()` function that computes the runtime value.

### Type Definition
>
Source: [predefinedVariables.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/predefinedVariables.ts#L1-L5)

typescript1export type PredefinedVariable = {
2  key: `$${string}`
3  description: string
4  getValue: () => string
5}
### Common Variables
VariableDescriptionExample Output`<<$guid>>`A v4 style GUID (UUID v4)`550e8400-e29b-41d4-a716-446655440000``<<$timestamp>>`The current UNIX timestamp in seconds`1699000000``<<$isoTimestamp>>`The current ISO timestamp at zero UTC`2025-01-15T10:30:00.000Z``<<$randomUUID>>`A random 36-character UUID (same as $guid)`6ba7b810-9dad-11d1-80b4-00c04fd430c8`
>
Source: [predefinedVariables.ts - Common](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/predefinedVariables.ts#L26-L46)

typescript1{
2  key: "$guid",
3  description: "A v4 style GUID.",
4  getValue: generateV4Uuid,
5},
6{
7  key: "$timestamp",
8  description: "The current UNIX timestamp in seconds.",
9  getValue: () => Math.floor(Date.now() / 1000).toString(),
10},
11{
12  key: "$isoTimestamp",
13  description: "The current ISO timestamp at zero UTC.",
14  getValue: () => new Date().toISOString(),
15},
16{
17  key: "$randomUUID",
18  description: "A random 36-character UUID.",
19  getValue: generateV4Uuid,
20},
### Text, Numbers, and Colors
VariableDescriptionExample Output`<<$randomAlphaNumeric>>`A random alphanumeric character`K`, `7`, `x``<<$randomBoolean>>`A random boolean value`true` or `false``<<$randomInt>>`A random integer between 0 and 1000`742``<<$randomColor>>`A random color name`red`, `blue`, `purple``<<$randomHexColor>>`A random hex color value`#a3f1b2``<<$randomAbbreviation>>`A random abbreviation`SQL`, `JSON`, `API`
>
Source: [predefinedVariables.ts - Text/Numbers](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/predefinedVariables.ts#L49-L111)

### Internet and IP Addresses
VariableDescriptionExample Output`<<$randomIP>>`A random IPv4 address`192.168.1.1``<<$randomIPV6>>`A random IPv6 address`fe80:0000:0000:0000:0202:b3ff:fe1e:8329``<<$randomMACAddress>>`A random MAC address`00:1a:2b:3c:4d:5e``<<$randomPassword>>`A random 15-character alphanumeric password`aB3xK9mQ2pL5rN7``<<$randomLocale>>`A random two-letter language code (ISO 639-1)`ny`, `sr`, `si``<<$randomUserAgent>>`A random user agent string`Mozilla/5.0 (Macintosh; U; Intel Mac OS X...``<<$randomProtocol>>`A random internet protocol`http` or `https``<<$randomSemver>>`A random semantic version number`4.7.2`
>
Source: [predefinedVariables.ts - Internet/IP](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/predefinedVariables.ts#L113-L202)

### Names
VariableDescriptionExample Output`<<$randomFirstName>>`A random first name`Ethan`, `Alice`, `Bob``<<$randomLastName>>`A random last name`Smith`, `Johnson`, `Doe``<<$randomFullName>>`A random first and last name`Jane Smith``<<$randomNamePrefix>>`A random name prefix`Dr.`, `Mr.`, `Prof.``<<$randomNameSuffix>>`A random name suffix`Jr.`, `PhD`, `MD`
>
Source: [predefinedVariables.ts - Names](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/predefinedVariables.ts#L204-L277)

### Company and Address
VariableDescriptionExample Output`<<$randomCompanyName>>`A random company name`Nexora`, `CodeLoom`, `EcoVerse``<<$randomCity>>`A random city name`New York`, `Chicago`, `Houston`
>
Source: [predefinedVariables.ts - Company/Address](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/predefinedVariables.ts#L279-L326)

### Job/Profession
VariableDescriptionExample Output`<<$randomJobArea>>`A random job area`Development`, `Design`, `Testing``<<$randomJobDescriptor>>`A random job descriptor`Senior`, `Lead`, `Principal``<<$randomJobTitle>>`A random job title`Global Branding Officer`, `Dynamic Data Specialist``<<$randomJobType>>`A random job type`Manager`, `Director`, `Coordinator`
>
Source: [predefinedVariables.ts - Job/Profession](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/predefinedVariables.ts#L328-L381)

## Core Flow: Variable Resolution at Request Time
The following sequence diagram illustrates how predefined variables are resolved when an API request is executed.

加载图表中...
## Editor Integration
### Syntax Highlighting and Tooltips
The `HoppPredefinedVariablesPlugin` provides an integrated editor experience with two key features:

-
**Syntax Highlighting**: Matches the `<<$variableName>>` pattern using a regex-based `MatchDecorator`. Valid predefined variables are highlighted in yellow (`predefined-variable-valid` class), while invalid ones are highlighted in red (`predefined-variable-invalid` class).

-
**Hover Tooltips**: When hovering over a predefined variable, a tooltip appears showing the variable's name and description (or an error message if the variable is invalid).

>
Source: [HoppPredefinedVariables.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/editor/extensions/HoppPredefinedVariables.ts#L18-L23)

typescript1const HOPP_PREDEFINED_VARIABLES_REGEX = /(<<\$[a-zA-Z0-9-_]+>>)/g
2
3const HOPP_PREDEFINED_VARIABLE_HIGHLIGHT =
4  "cursor-help transition rounded px-1 focus:outline-none mx-0.5 predefined-variable-highlight"
5const HOPP_PREDEFINED_VARIABLE_HIGHLIGHT_VALID = "predefined-variable-valid"
6const HOPP_PREDEFINED_VARIABLE_HIGHLIGHT_INVALID = "predefined-variable-invalid"
### Plugin Class
>
Source: [HoppPredefinedVariables.ts - Plugin Class](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/editor/extensions/HoppPredefinedVariables.ts#L193-L202)

typescript1export class HoppPredefinedVariablesPlugin {
2  private compartment = new Compartment()
3
4  get extension() {
5    return this.compartment.of([
6      cursorTooltipField(),
7      predefinedVariableHighlightStyle(),
8    ])
9  }
10}
### Enabling Predefined Variables in Components
The `EnvInput.vue` component accepts a `predefinedVariablesHighlights` prop (default: `true`) to control whether predefined variable highlighting is active:

>
Source: [EnvInput.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/smart/EnvInput.vue#L117-L134)

typescript1const props = withDefaults(
2  defineProps<{
3    // ... other props
4    predefinedVariablesHighlights?: boolean
5  }>(),
6  {
7    // ... defaults
8    predefinedVariablesHighlights: true,
9  }
10)
The plugin is instantiated and conditionally applied:

>
Source: [EnvInput.vue - Plugin Application](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/smart/EnvInput.vue#L482-L569)

typescript1const predefinedVariablePlugin = new HoppPredefinedVariablesPlugin()
2
3// In getExtensions():
4const extensions: Extension = [
5  // ... other extensions
6  props.predefinedVariablesHighlights ? predefinedVariablePlugin : [],
7  // ...
8]
### Styling
The visual appearance of predefined variables in the editor is defined in the project's SCSS:

>
Source: [styles.scss](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/assets/scss/styles.scss#L527-L537)

scss1.predefined-variable-highlight {
2  &.predefined-variable-valid {
3    @apply bg-yellow-500;
4    @apply hover:bg-yellow-600;
5  }
6
7  &.predefined-variable-invalid {
8    @apply hover:bg-red-300;
9    @apply bg-red-300;
10  }
11}
Valid predefined variables are highlighted with a yellow background that darkens on hover. Invalid (unrecognized) variables use a red background to indicate the error.

## Usage Examples
### Basic Usage in HTTP Request Fields
You can use predefined variables in any text field within the Hoppscotch request builder — including URLs, headers, query parameters, and request body:

URL: https://api.example.com/users/<<$randomUUID>>
Header: X-Request-ID: <<$guid>>
Body: { "timestamp": "<<$isoTimestamp>>", "name": "<<$randomFullName>>" }
### Using in Pre-Request Scripts and Tests
Predefined variables can also be accessed through the `hopp.request.variables` API in scripts. They are included in the aggregate environment and can be retrieved using `get()`:

>
Source: [scripting-revamp-coll.json - Test fixture](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-cli/src/__tests__/e2e/fixtures/collections/scripting-revamp-coll.json#L160)

javascript1// Pre-defined request variables are accessible in test scripts
2hopp.test('Pre-defined request variables are accessible', () => {
3  const preDefinedVar = hopp.request.variables.get('req_var_1')
4  hopp.expect(preDefinedVar).toBe('request_variable_value')
5})
### UUID Generation for Testing
The UUID generator (`generateV4Uuid`) follows the RFC 4122 v4 specification, producing properly formatted UUIDs with the version nibble set to `4` and the variant bits correctly positioned:

>
Source: [predefinedVariables.ts - UUID Generator](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/predefinedVariables.ts#L7-L22)

typescript1const generateV4Uuid = () => {
2  const characters = "0123456789abcdef"
3  let uuid = ""
4  for (let i = 0; i < 36; i++) {
5    if (i === 8 || i === 13 || i === 18 || i === 23) {
6      uuid += "-"
7    } else if (i === 14) {
8      uuid += "4"
9    } else if (i === 19) {
10      uuid += characters.charAt(8 + Math.floor(Math.random() * 4))
11    } else {
12      uuid += characters.charAt(Math.floor(Math.random() * characters.length))
13    }
14  }
15  return uuid
16}
## Design Decisions
### Why Predefined Variables Have Highest Priority
The prioritization of predefined variables over user-defined environment variables is a deliberate design choice. It ensures:

- **Predictability**: Core dynamic values like `$guid` and `$timestamp` always work as expected, regardless of what environment variables a user has configured.
- **No accidental overrides**: Users cannot accidentally break functionality by creating an environment variable named `$guid` that produces incorrect values.
- **Consistency across environments**: Since predefined variables are not tied to any specific environment, they provide consistent behavior whether a user has an environment selected or not.

### Why a Dynamic `getValue()` Pattern
Each predefined variable defines a `getValue()` function rather than storing a static value. This design means:

- The variable is evaluated at the moment of resolution, ensuring freshness (critical for timestamps)
- Each use of `<<$guid>>` produces a unique UUID, rather than reusing the same value
- The system can support complex generation logic without impacting performance until resolution time

### Editor Plugin Architecture
The `HoppPredefinedVariablesPlugin` uses CodeMirror 6's `Compartment` API to enable dynamic enabling/disabling of the extension. This allows components to conditionally render predefined variable highlighting without recreating the editor instance.

## Related Links

- [Source: Predefined Variables Definition](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/predefinedVariables.ts) — The complete registry of all predefined variables
- [Source: Editor Extension](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/editor/extensions/HoppPredefinedVariables.ts) — CodeMirror plugin for syntax highlighting and tooltips
- [Source: Template String Parsing](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/environment/index.ts) — Variable resolution logic with priority handling
- [Source: Environment Store](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/newstore/environments.ts) — Reactive aggregation of environments with predefined variable priority
- [Source: EnvInput Component](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/smart/EnvInput.vue) — Reusable input component with predefined variable support
- [Source: CodeMirror Composable](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/composables/codemirror.ts) — Editor configuration composable
- [Related: Environments](./7-collections-and-environments.1-environments)
- [Related: Global Variables](./7-collections-and-environments.3-global-variables)
- [Related: Request Variables](./7-collections-and-environments.5-request-variables)