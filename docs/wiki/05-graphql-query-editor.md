# Query Editor

The GraphQL Query Editor in Hoppscotch provides a full-featured code editor for composing, validating, and executing GraphQL queries, mutations, and subscriptions against GraphQL APIs.

## Overview

The Query Editor is the primary interface for interacting with GraphQL APIs within Hoppscotch. Built on top of CodeMirror 6, it provides syntax highlighting, schema-aware autocompletion, real-time linting, and multi-operation support. The editor integrates with the broader GraphQL client infrastructure including the connection manager, schema fetcher, documentation explorer, and response viewer.

**Key capabilities:**

- **Multi-operation support** — Write multiple queries, mutations, or subscriptions in a single editor; select and execute a specific operation
- **Schema-aware autocompletion** — Autocomplete suggestions based on the connected GraphQL schema
- **Real-time query linting** — Schema validation errors displayed inline as you type
- **Query prettification** — Format and beautify GraphQL queries with a single click
- **Operation highlighting** — Visually distinguish the currently selected operation
- **Integrated execution** — Run queries directly from the editor with keyboard shortcuts

## Architecture

The Query Editor is part of a layered GraphQL client architecture within Hoppscotch. The following diagram illustrates the component relationships and data flow:

### Component Roles

| Component | File | Role |
|-----------|------|------|
| GraphqlQuery | Query.vue | The main query editor component with toolbar and CodeMirror integration |
| GraphqlRequestOptions | RequestOptions.vue | Tab container for Query, Variables, Headers, and Authorization editors |
| GraphqlRequestTab | RequestTab.vue | Wraps request options and response into a split-pane layout |
| useCodemirror | codemirror.ts | Core CodeMirror 6 setup composable used across all editors |
| useQuery | query.ts | Query manipulation hook: add/remove fields, arguments via explorer |
| GQLTabService | graphql.ts | Tab state management for GQL documents |

## Query Editor Features

### Editor Toolbar

The toolbar above the editor provides actions for executing queries and managing editor state:

- **Subscribe** — Not Running
- **Run Selected Operation** — Running? → Stop
- **Save**
- **Help (?)**
- **Clear All**
- **Toggle Line Wrap**
- **Prettify Query**
- **Copy Query**

### CodeMirror Integration

The editor is initialized with GraphQL-specific extensions when mounted:

```typescript
const cmQueryEditor = useCodemirror(
  queryEditor,
  gqlQueryString,
  reactive({
    extendedEditorConfig: {
      mode: "graphql",
      placeholder: `${t("request.query")}`,
      lineWrapping: WRAP_LINES,
    },
    linter: createGQLQueryLinter(schema),
    completer: queryCompleter(schema),
    environmentHighlights: false,
    additionalExts: [markRaw(selectedGQLOpHighlight)],
    onUpdate: debouncedOnUpdateQueryState,
  })
)
```

The editor receives three critical extensions:

- **Linter** — Validates the query against the connected schema
- **Completer** — Provides field name, argument, and type autocompletions
- **Operation Highlighter** — Visually indicates which operation the cursor is currently in

### Multi-Operation Detection

When the editor content changes, the query string is parsed to detect all operation definitions. This enables the editor to identify which operation should be executed based on cursor position:

```typescript
const debouncedOnUpdateQueryState = debounce((update: ViewUpdate) => {
  const selectedPos = update.state.selection.main.head
  emit("cursor-position", selectedPos)
  selectedOperation.value = null
  const queryString = update.state.doc.toJSON().join(update.state.lineBreak)

  try {
    const ast = parse(queryString)

    operationDefinitions.value = ast.definitions.filter(
      (def) => def.kind === "OperationDefinition"
    ) as OperationDefinitionNode[]

    if (ast.definitions.length === 1) {
      selectedOperation.value = ast.definitions[0] as OperationDefinitionNode
      return
    }

    selectedOperation.value =
      (ast.definitions.find((def) => {
        if (def.kind !== "OperationDefinition") return false
        const { start, end } = def.loc!
        return selectedPos >= start && selectedPos <= end
      }) as OperationDefinitionNode) ?? null
  } catch (_error) {
    if (queryString.trim() === "") {
      operationDefinitions.value = []
    }
  }
}, 100)
```

Design intent: When a user has multiple operations in a single document (e.g., both a query and a mutation), the editor needs to determine which one to execute. By detecting the cursor position relative to parsed AST node positions, the user can simply place their cursor in the desired operation and click "Run" — no need to select from a dropdown.

### Operation Highlighting

A custom CodeMirror ViewPlugin visually distinguishes the active operation from inactive ones when multiple operations exist:

```typescript
export const selectedGQLOpHighlight = ViewPlugin.define(
  (view) => ({
    decorations: generateSelectedOpDecors(view.state),
    update(u) {
      this.decorations = generateSelectedOpDecors(u.state)
    },
  }),
  {
    decorations: (v) => v.decorations,
  }
)
```

When only a single operation exists, no decorations are applied. When multiple operations exist, the operation containing the cursor gets the `gql-operation-highlight` CSS class while others get `gql-operation-not-highlight` (visually dimmed).

### Core Flow: Query Execution

The following sequence describes what happens when a user runs a query from the editor:

1. User clicks "Run" or presses shortcut
2. Emit "run-query" with selected OperationDefinition
3. `runQuery(definition)` — Clone URL, query, variables
4. `runGQLOperation({url, query, variables, operationName, ...})` — Build HoppGQLRequest with merged headers/auth
5. Execute via `GQLRequest.toRequest()` — HTTP POST with GraphQL query
6. JSON Response — Parse response via `GQLResponse.toResponse()`
7. `gqlMessageEvent` (response data) — Emit "update:response" event
8. Update response component — Display formatted JSON result

### Schema-Aware Linting

The query linter validates the GraphQL query against the currently connected schema:

```typescript
export const createGQLQueryLinter: (
  schema: Ref<GraphQLSchema | null>
) => LinterDefinition = (schema: Ref<GraphQLSchema | null>) => (text) => {
  if (text === "") return Promise.resolve([])
  if (!schema.value) return Promise.resolve([])

  try {
    const doc = gqlParse(text)
    const results = gqlValidate(schema.value, doc).map(
      ({ locations, message }) =>
        <LinterResult>{
          from: {
            line: locations![0].line,
            ch: locations![0].column - 1,
          },
          to: {
            line: locations![0].line,
            ch: locations![0].column - 1,
          },
          message,
          severity: "error",
        }
    )
    return Promise.resolve(results)
  } catch (e) {
    const err = e as GraphQLError
    return Promise.resolve([
      <LinterResult>{
        from: {
          line: err.locations![0].line,
          ch: err.locations![0].column - 1,
        },
        to: {
          line: err.locations![0].line,
          ch: err.locations![0].column,
        },
        message: err.message,
        severity: "error",
      },
    ])
  }
}
```

Design intent: The linter is designed to be a higher-order function that takes a reactive schema reference. This means the linter automatically re-validates queries whenever the schema changes (e.g., when connecting to a different GraphQL endpoint). If no schema is connected, linting is silently skipped — enabling query editing without a live connection.

### Schema-Aware Autocompletion

The completer provides field suggestions based on the schema:

```typescript
const completer: (schemaRef: Ref<GraphQLSchema | null>) => Completer =
  (schemaRef: Ref<GraphQLSchema | null>) => (text, completePos) => {
    if (!schemaRef.value) return Promise.resolve(null)

    const completions = getAutocompleteSuggestions(schemaRef.value, text, {
      line: completePos.line,
      character: completePos.ch,
    } as any)

    return Promise.resolve(<CompleterResult>{
      completions: completions.map(
        (x, i) =>
          <CompletionEntry>{
            text: x.label!,
            meta: x.detail!,
            score: completions.length - i,
          }
      ),
    })
  }
```

Uses the `graphql-language-service-interface` package's `getAutocompleteSuggestions` function, which provides schema-aware completions. Returns null when no schema is connected, allowing CodeMirror to gracefully degrade to basic syntax-only completion.

### Query Builder via Explorer

The `useQuery()` composable in `query.ts` provides the bridge between the Documentation Explorer sidebar and the Query Editor. When a user clicks a field in the explorer, it programmatically adds or removes that field from the active query:

```typescript
const handleOperation = (item: ExplorerFieldDef, isArgument = false) => {
  const currentTab = tabs.currentActiveTab.value
  if (!currentTab) return

  const currentQuery = currentTab.document.request.query || ""
  const selectedOperation = getOperation(
    currentTab.document.cursorPosition || 0
  )
  const navItems = [...navStack.value, { name: item.name, def: item }]

  const result = processOperation(
    navItems as ExplorerNavStackItem[],
    selectedOperation,
    isArgument
  )

  const newQuery = result.document
    ? print(result.document.definitions[0])
    : "\n"

  // If operation type is different or no existing operation,
  // append as a new operation
  if (
    !selectedOperation ||
    selectedOperation.operation !== getOperationTypeNode(navItems[1].name) ||
    result.append
  ) {
    updatedQuery.value = currentQuery.trim()
      ? `${currentQuery}\n\n${newQuery}`
      : newQuery
    cursorPosition.value = {
      line: currentQuery.split("\n").length + (currentQuery.trim() ? 2 : 1),
      ch: -1,
    }
    return
  }

  // Replace existing operation if operation types match
  updatedQuery.value = currentQuery.replace(
    currentQuery.substring(
      selectedOperation.loc!.start,
      selectedOperation.loc!.end
    ),
    newQuery
  )
  // ...cursor position update follows
}
```

Design intent: The query builder provides a visual, click-driven alternative to manual query writing. When a user explores the schema documentation and clicks a field, the query builder determines whether to:

- Append as a new operation (if different operation type or no existing operation)
- Toggle the field within the current operation (add if absent, remove if present)
- Toggle arguments within a field

This makes the GraphQL client accessible to users who may not be intimately familiar with GraphQL syntax.

### Tab State Management

The `GQLTabService` manages the lifecycle of GraphQL document tabs:

```typescript
export class GQLTabService extends TabService<HoppGQLDocument> {
  public static readonly ID = "GQL_TAB_SERVICE"

  constructor(c: Container) {
    super(c)

    this.tabMap.set("test", {
      id: "test",
      document: {
        request: getDefaultGQLRequest(),
        isDirty: false,
        optionTabPreference: "query",
        cursorPosition: 0,
      },
    })

    this.watchCurrentTabID()
  }

  // override persistableTabState to remove response from the document
  public override persistableTabState = computed(() => ({
    lastActiveTabID: this.currentTabID.value,
    orderedDocs: this.tabOrdering.value.map((tabID) => {
      const tab = this.tabMap.get(tabID)!
      return {
        tabID: tab.id,
        doc: {
          ...tab.document,
          response: null,
        },
      }
    }),
  }))
}
```

Each tab stores a `HoppGQLDocument` which includes the request, dirty state, cursor position, option tab preference, and response data. The persistence layer explicitly excludes response data to avoid storing large payloads.

## Usage Examples

### Basic Usage — Initializing the Page

The GraphQL page creates a new tab with a default request when opened:

```typescript
const addNewTab = () => {
  const tab = tabs.createNewTab({
    request: getDefaultGQLRequest(),
    isDirty: false,
    cursorPosition: 0,
  })

  tabs.setActiveTab(tab.id)
}
```

### Default Request Configuration

The default GQL request provides sensible initial values:

```typescript
export function getDefaultGQLRequest(): HoppGQLRequest {
  return {
    v: GQL_REQ_SCHEMA_VERSION,
    name: "Untitled",
    url: "https://echo.hoppscotch.io/graphql",
    headers: [],
    variables: `{
  "id": "1"
}`,
    query: `query Request {
  method
  url
  headers {
    key
    value
  }
}`,
    auth: {
      authType: "inherit",
      authActive: true,
    },
  }
}
```

### Prettifying a Query

The prettify action formats the query using the graphql package's print function:

```typescript
const prettifyQuery = () => {
  try {
    gqlQueryString.value = print(
      parse(gqlQueryString.value, {
        allowLegacyFragmentVariables: true,
      })
    )
    prettifyQueryIcon.value = IconCheck
  } catch (_e) {
    toast.error(`${t("error.gql_prettify_invalid_query")}`)
    prettifyQueryIcon.value = IconInfo
  }
}
```

## Configuration Options

The Query Editor supports the following user-configurable settings:

| Setting Key | Scope | Type | Default | Description |
|-------------|-------|------|---------|-------------|
| WRAP_LINES | graphqlQuery | boolean | Platform-dependent | Toggles line wrapping in the query editor |
| WRAP_LINES | graphqlVariables | boolean | Platform-dependent | Toggles line wrapping in the variables editor |
| WRAP_LINES | graphqlHeaders | boolean | Platform-dependent | Toggles line wrapping in the headers bulk editor |
| WRAP_LINES | graphqlSchema | boolean | Platform-dependent | Toggles line wrapping in the schema viewer |
| WRAP_LINES | graphqlResponseBody | boolean | Platform-dependent | Toggles line wrapping in the response viewer |

Settings are managed through the `useNestedSetting` composable and toggled via `toggleNestedSetting(key, scope)`.

## API Reference

### GraphqlQuery Component

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| modelValue | string | Yes | The current GraphQL query string |

**Emits:**

| Event | Payload | Description |
|-------|---------|-------------|
| update:modelValue | val: string | Emitted when the query content changes |
| save-request | — | Emitted when the user clicks Save |
| cursor-position | val: number | Emitted with cursor position on editor updates |
| run-query | definition: OperationDefinitionNode \| null | Emitted when the user runs a query |

### useQuery() Composable

**Returns:**

| Property/Method | Type | Description |
|-----------------|------|-------------|
| handleAddField | (field: ExplorerFieldDef) => void | Adds or removes a field from the current query |
| handleAddArgument | (arg: ExplorerFieldDef) => void | Adds or removes an argument from the current field |
| updatedQuery | Ref\<string\> | The updated query string (watched by the editor) |
| cursorPosition | Ref\<{line: number, ch: number}\> | Target cursor position after query update |
| operationDefinitions | Ref\<OperationDefinitionNode[]\> | Parsed operation definitions in the current query |
| isFieldInOperation | (field: ExplorerFieldDef) => boolean | Checks if a field exists in the current operation |
| isArgumentInOperation | (arg: ExplorerFieldDef) => boolean | Checks if an argument exists in the current operation |

## Related Links

- GraphQL Client Page — The main GraphQL page component
- GQLTabService — Tab state management service
- Connection & Schema Management — WebSocket/HTTP connection and schema fetching
- Query Builder (useQuery) — Programmatic query manipulation
- Documentation Explorer — Schema documentation explorer sidebar
- Explorer State — Explorer navigation stack management
- CodeMirror Composable — Shared CodeMirror initialization logic
- GQL Linter — Schema-aware query linter
- GQL Completer — Schema-aware autocompletion
- Operation Highlighter — Multi-operation visual highlighting
- HoppGQLRequest Data Model — Request data schema definition
- HoppGQLDocument Type — Document type for tab state management

## Sources

(30 files)

- PACKAGES/HOPPSCOTCH-COMMON/SRC/COMPONENTS/GRAPHQL: Authorization.vue, DocExplorer.vue, ExplorerSection.vue, Headers.vue, Query.vue, Request.vue, RequestOptions.vue, RequestTab.vue, Response.vue, Sidebar.vue, Variable.vue
- PACKAGES/HOPPSCOTCH-COMMON/SRC/COMPOSABLES: codemirror.ts, graphql.ts
- PACKAGES/HOPPSCOTCH-COMMON/SRC/HELPERS/EDITOR/COMPLETION: gqlQuery.ts
- PACKAGES/HOPPSCOTCH-COMMON/SRC/HELPERS/EDITOR/GQL: operation.ts
- PACKAGES/HOPPSCOTCH-COMMON/SRC/HELPERS/EDITOR/LINTING: gqlQuery.ts
- PACKAGES/HOPPSCOTCH-COMMON/SRC/HELPERS/GRAPHQL: connection.ts, default.ts, document.ts, explorer.ts, query.ts
- PACKAGES/HOPPSCOTCH-COMMON/SRC/PAGES: graphql.vue
- PACKAGES/HOPPSCOTCH-COMMON/SRC/SERVICES/TAB: graphql.ts, index.ts
- PACKAGES/HOPPSCOTCH-DATA/SRC/GRAPHQL: index.ts
- PACKAGES/HOPPSCOTCH-DATA/SRC/GRAPHQL/V: 1.ts, 6.ts, 7.ts, 8.ts, 9.ts
