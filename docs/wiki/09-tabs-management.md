# Tabs Management
Hoppscotch's tab management system provides a complete multi-tab interface for working with multiple API requests simultaneously, supporting both REST and GraphQL request types with advanced navigation, persistence, and state management capabilities.

## Overview
The tab management system in Hoppscotch is modeled after modern browser tab behavior, allowing users to open, close, reorder, duplicate, and navigate between multiple request tabs. The system is designed around a generic, abstract `TabService<Doc>` class that manages tabs as a collection of documents with unique identifiers.

**Key design decisions:**

- **Generic type safety** — The tab service is parameterized with a document type (`Doc`), ensuring type-safe operations for REST vs GraphQL contexts
- **MRU (Most Recently Used) navigation** — Beyond simple sequential tab navigation, the system tracks usage patterns to enable fast switching between recently used tabs
- **Persistence** — Tab state (open tabs, their order, and the active tab) is persisted to local storage, so sessions are restored on reload
- **Platform-aware keyboard shortcuts** — Different keybindings are available on desktop (Tauri) vs web to avoid conflicts with native browser shortcuts
- **Dirty state tracking** — Each tab tracks whether its document has unsaved changes, with confirmation dialogs before closing dirty tabs

## Architecture
The tab management system follows a layered architecture built on the Dependency Injection with Inversion of Control (DI/IoC) pattern using the `dioc` library.

加载图表中...
### Component Responsibilities
LayerComponentResponsibility**Service**`TabService<Doc>` (abstract)Core tab lifecycle: create, close, reorder, navigate, MRU tracking, persistence serialization**Service**`RESTTabService`Concrete implementation for REST requests; provides `getTabRefWithSaveContext()` for collection sync**Service**`GQLTabService`Concrete implementation for GraphQL requests; handles GQL-specific document types**Service**`PersistenceService`Reads/writes serialized tab state to IndexedDB via LocalForage**UI**`index.vue` (REST page)Renders the REST workspace with `HoppSmartWindows` and tab management UI**UI**`graphql.vue` (GraphQL page)Renders the GraphQL workspace with tab management UI**UI**`HttpTabHead.vue`Tab header for REST tabs with method badge, context menu (rename, duplicate, close, share)**UI**`GraphqlTabHead.vue`Tab header for GraphQL tabs with context menu**Infrastructure**`keybindings.ts`Maps keyboard shortcuts to tab actions (close, open, navigate, MRU switch)**Infrastructure**`TabSpotlightSearcherService`Registers tab actions in the command palette (Spotlight)**Initialization**`InitializationService`Calls `init()` on both `RESTTabService` and `GQLTabService` at startup to restore persisted state
## Core Service Architecture
The tab service architecture uses a **Template Method** pattern, where `TabService<Doc>` defines the algorithm skeleton (tab lifecycle, navigation, persistence format) and subclasses provide specific implementations for document types and persistence loading.

### Tab Data Model
typescript1// A single tab is a simple structure: an ID and a document
2type HoppTab<Doc> = {
3  id: string        // UUID v4 unique identifier
4  document: Doc     // The request document (REST or GraphQL)
5}
6
7// Serialization format for persistence
8type PersistableTabState<Doc> = {
9  lastActiveTabID: string
10  orderedDocs: Array<{
11    tabID: string
12    doc: Doc
13  }>
14}
>
Source: [tab.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/services/tab/index.ts#L7-L20)

### Abstract TabService (`TabService<Doc>`)
加载图表中...
## Core Flow: Tab Creation and Lifecycle
加载图表中...
## Usage Examples
### Basic Usage: Creating a New REST Tab (from `index.vue`)
typescript1const tabs = useService(RESTTabService)
2
3const addNewTab = () => {
4  const tab = tabs.createNewTab({
5    type: "request",
6    request: getDefaultRESTRequest(),
7    isDirty: false,
8  })
9
10  tabs.setActiveTab(tab.id)
11}
>
Source: [index.vue](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/pages/index.vue#L223-L231)

### Closing Tabs with Dirty State Protection (from `index.vue`)
typescript1const removeTab = (tabID: string) => {
2  const tabState = tabs.getTabRef(tabID).value
3
4  if (tabState.document.isDirty) {
5    confirmingCloseForTabID.value = tabID  // Shows confirmation dialog
6  } else {
7    scrollService.cleanupScrollForTab(tabState.id)
8    tabs.closeTab(tabState.id)
9    inspectionService.deleteTabInspectorResult(tabState.id)
10  }
11}
>
Source: [index.vue](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/pages/index.vue#L250-L260)

### Duplicating a Tab (from `index.vue`)
typescript1const duplicateTab = (tabID: string) => {
2  const tab = tabs.getTabRef(tabID)
3  if (tab.value && tab.value.document.type === "request") {
4    const newTab = tabs.createNewTab({
5      type: "request",
6      request: {
7        ...cloneDeep(tab.value.document.request),
8        _ref_id: generateUniqueRefId("req"),
9      },
10      isDirty: true,  // Mark as dirty to distinguish from original
11    })
12    tabs.setActiveTab(newTab.id)
13  }
14}
>
Source: [index.vue](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/pages/index.vue#L279-L292)

### Tab Ordering via Drag and Drop (from `index.vue`)
typescriptconst sortTabs = (e: { oldIndex: number; newIndex: number }) => {
  tabs.updateTabOrdering(e.oldIndex, e.newIndex)
}
>
Source: [index.vue](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/pages/index.vue#L232-L234)

### Finding a Tab by Save Context (from `RESTTabService`)
typescript1public getTabRefWithSaveContext(ctx: HoppRESTSaveContext) {
2  for (const tab of this.tabMap.values()) {
3    if (tab.document.type === "test-runner") continue
4
5    if (ctx?.originLocation === "team-collection") {
6      if (
7        tab.document.saveContext?.originLocation === "team-collection" &&
8        tab.document.saveContext.requestID === ctx.requestID &&
9        tab.document.saveContext.exampleID === ctx.exampleID
10      ) {
11        return this.getTabRef(tab.id)
12      }
13    } else if (
14      tab.document.saveContext?.originLocation === "user-collection" &&
15      tab.document.saveContext.folderPath === ctx?.folderPath &&
16      tab.document.saveContext.requestIndex === ctx?.requestIndex &&
17      tab.document.saveContext.exampleID === ctx?.exampleID
18    ) {
19      return this.getTabRef(tab.id)
20    }
21  }
22  return null
23}
>
Source: [rest.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/services/tab/rest.ts#L73-L100)

## Most Recently Used (MRU) Navigation
The MRU navigation system enables quick switching between recently used tabs, similar to Alt+Tab in operating systems. It tracks a separate `mruOrder` array that reorders based on activation history.

加载图表中...
**MRU Navigation keybindings (desktop only):**

- `Ctrl+Alt+]` — Switch to next MRU tab (`goToMRUTab`)
- `Ctrl+Alt+[` — Switch to previous MRU tab (`goToPreviousMRUTab`)

## Keyboard Shortcuts for Tab Management
Shortcut (Desktop)Shortcut (Web)ActionHandler`Ctrl+T`—Open new tab`tab.open-new``Ctrl+W``Ctrl+D`Close current tab`tab.close-current``Ctrl+Alt+Right`—Next tab`tab.next``Ctrl+Alt+Left`—Previous tab`tab.prev``Ctrl+Alt+9`—First tab`tab.switch-to-first``Ctrl+Alt+0`—Last tab`tab.switch-to-last``Ctrl+Alt+]`—MRU switch forward`tab.mru-switch``Ctrl+Alt+[`—MRU switch reverse`tab.mru-switch-reverse``Ctrl+Shift+T`—Reopen closed tab`tab.reopen-closed`
>
Source: [keybindings.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/helpers/keybindings.ts#L106-L119)

The distinction between web and desktop bindings is intentional: on web, `Ctrl+W` closes the browser tab and `Ctrl+T` opens a new browser tab, so Hoppscotch uses `Ctrl+D` for closing tabs in the web version. On desktop (Tauri), there are no such conflicts.

## Configuration Options
### Tab Service Internal Configuration
PropertyTypeDefaultDescription`MAX_CLOSED_TABS_HISTORY`number10Maximum number of recently closed tabs to remember for reopening`mruOrder`string[]`[]`Most Recently Used tab order (index 0 = most recent)`mruNavigationIndex`number-1Current position in MRU navigation (-1 = not navigating)`recentlyClosedTabs`Array`[]`Stack of recently closed tabs with their original indices
### Persistence Store Keys
Store KeyValueUsed ByDescription`restTabs``PersistableTabState<HoppTabDocument>``RESTTabService`Persisted REST tab state`gqlTabs``PersistableTabState<HoppGQLDocument>``GQLTabService`Persisted GraphQL tab state
>
Source: [persistence/index.ts](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/services/persistence/index.ts#L126-L127)

## API Reference
### `TabService<Doc>` (abstract class)
#### `createNewTab(document: Doc, switchToIt?: boolean): HoppTab<Doc>`
Creates a new tab with the given document. If `switchToIt` is true (default), the new tab becomes active immediately and is added to the MRU order.

**Parameters:**

- `document` (Doc): The document to associate with the tab
- `switchToIt` (boolean, optional): Whether to immediately activate the tab. Default: `true`

**Returns:** The newly created `HoppTab<Doc>` with a generated UUID v4 ID.

#### `closeTab(tabID: string): void`
Closes the tab with the specified ID. Does nothing if the tab doesn't exist or if it's the only remaining tab. The closed tab is saved to the recently closed stack for potential reopening.

**Parameters:**

- `tabID` (string): The ID of the tab to close

**Behavior:**

- If tab doesn't exist: logs a warning, returns
- If it's the only tab: logs a warning, returns
- Otherwise: saves to recently closed stack, removes from ordering and MRU, deletes from map on next tick

#### `closeOtherTabs(tabID: string): void`
Closes all tabs except the one specified. Resets the tab ordering and MRU order to contain only the kept tab.

**Parameters:**

- `tabID` (string): The ID of the tab to keep open

#### `setActiveTab(tabID: string): void`
Sets the active tab by ID and updates the MRU order. Validates existence before changing.

**Parameters:**

- `tabID` (string): Valid tab ID to activate

#### `goToNextTab(): void` / `goToPreviousTab(): void`
Navigates sequentially through tabs in order. Wraps around at boundaries.

#### `goToFirstTab(): void` / `goToLastTab(): void`
Navigates to the first or last tab in the ordering.

#### `goToMRUTab(): void` / `goToPreviousMRUTab(): void`
Navigates through the Most Recently Used order. Forward moves to older tabs, backward moves to more recent tabs. Wraps around at boundaries. Used for Alt+Tab-style navigation.

#### `commitMRUNavigation(): void`
Commits the current MRU navigation selection, moving the selected tab to the front of the MRU order. Should be called when the modifier key is released.

#### `reopenClosedTab(): boolean`
Reopens the most recently closed tab at its original position in the ordering. Returns `true` if a tab was reopened, `false` if no closed tabs are available.

**Returns:** boolean

#### `updateTab(tabUpdate: HoppTab<Doc>): void`
Updates the document stored in a tab. Warns if the tab ID doesn't exist.

**Parameters:**

- `tabUpdate` (HoppTab<Doc>): The updated tab object

#### `updateTabOrdering(fromIndex: number, toIndex: number): string[]`
Moves a tab from one index to another in the ordering (used for drag-and-drop reordering).

**Parameters:**

- `fromIndex` (number): Current index
- `toIndex` (number): Target index

**Returns:** The updated ordering array (`string[]`)

#### `getActiveTabs(): Readonly<ComputedRef<HoppTab<Doc>[]>>`
Returns a readonly reference to the currently open tabs in order. The reference is reactive — the UI will re-render when tabs change.

#### `getTabRef(tabID: string): WritableComputedRef<HoppTab<Doc>>`
Returns a writable computed reference to a specific tab. Throws an error if the tab ID doesn't exist.

#### `persistableTabState: ComputedRef<PersistableTabState<Doc>>`
A computed property that returns the current tab state in a serializable format, ready for persistence.

### `RESTTabService` (concrete class)
#### `getTabRefWithSaveContext(ctx: HoppRESTSaveContext): WritableComputedRef<HoppTab<HoppTabDocument>> | null`
Searches all open tabs for one matching a specific save context (collection path, request index, etc.). Used to find and focus an existing tab when opening a request from the collection sidebar.

**Parameters:**

- `ctx` (HoppRESTSaveContext): The save context to match against

**Returns:** A writable tab reference if found, or `null`

#### `getDirtyTabsCount(): number`
Counts the number of tabs that have unsaved changes (used for confirmation dialogs).

**Returns:** number

### `GQLTabService` (concrete class)
#### `getTabRefWithSaveContext(ctx: HoppGQLSaveContext): WritableComputedRef<HoppTab<HoppGQLDocument>> | null`
Same as `RESTTabService.getTabRefWithSaveContext` but for GraphQL documents.

#### `getDirtyTabsCount(): number`
Same as `RESTTabService.getDirtyTabsCount`.

## Persistence Architecture
Tab state persistence follows a **watch-and-save** pattern:

加载图表中...
**Key persistence behavior:**

- REST tab responses are stripped before persistence to save storage space (overridden `persistableTabState`)
- The PersistenceService watches the state with a 500ms debounce to avoid excessive writes
- If parsing persisted data fails, a backup is saved with a `-backup` suffix before the corrupted data
- On app startup, `InitializationService` calls `init()` on both tab services concurrently

## Related Links

- [Source: TabService Abstract Class](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/services/tab/tab.ts) — Core implementation of tab lifecycle, navigation, MRU tracking, and persistence
- [Source: TabService Interface & Types](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/services/tab/index.ts) — Type definitions for `HoppTab`, `PersistableTabState`, and the `TabService` interface
- [Source: RESTTabService](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/services/tab/rest.ts) — REST-specific tab service implementation
- [Source: GQLTabService](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/services/tab/graphql.ts) — GraphQL-specific tab service implementation
- [Source: Tab Service Tests](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/services/tab/__tests__/tab.service.spec.ts) — Comprehensive test suite covering tab creation, navigation, MRU, and reopen
- [Source: Keybindings](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/helpers/keybindings.ts) — Keyboard shortcut definitions for tab actions
- [Source: Actions Definition](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/helpers/actions.ts) — Action types and dispatching for tab operations
- [Source: HTTP Tab Head Component](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/components/http/TabHead.vue) — REST tab header UI with context menu
- [Source: GraphQL Tab Head Component](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/components/graphql/TabHead.vue) — GraphQL tab header UI with context menu
- [Source: REST Workspace Page](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/pages/index.vue) — Main REST workspace with tab management integration
- [Source: GraphQL Workspace Page](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/pages/graphql.vue) — Main GraphQL workspace with tab management integration
- [Source: Tab Spotlight Searcher](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/services/spotlight/searchers/tab.searcher.ts) — Tab commands available in the command palette
- [Source: Persistence Service](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/services/persistence/index.ts) — Storage layer for persisted tab state
- [Source: Initialization Service](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/services/initialization.service.ts) — App startup initialization of tab services
- [Source: Platform Tab Abstraction](%7B%7Bfile_base_url%7D%7D/packages/hoppscotch-common/src/platform/tab.ts) — Platform-specific tab sync definitions