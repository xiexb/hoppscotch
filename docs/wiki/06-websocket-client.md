# WebSocket Client

The WebSocket Client in Hoppscotch provides a full-featured interface for testing and debugging WebSocket connections directly from the browser. It supports real-time bidirectional communication with WebSocket servers, including connection management, sub-protocol negotiation, message sending/receiving, and rich logging capabilities.

## Overview

The WebSocket Client is part of Hoppscotch's Realtime API testing suite, alongside Socket.IO, SSE (Server-Sent Events), and MQTT clients. It allows developers to interact with WebSocket endpoints (`ws://` and `wss://` protocols) for debugging, testing, and prototyping real-time applications.

**Key capabilities include:**

- **Connection Management**: Connect to any WebSocket endpoint with optional sub-protocols
- **Sub-Protocol Negotiation**: Specify one or more WebSocket sub-protocols during connection
- **Message Communication**: Send and receive messages in JSON or Raw text format
- **Real-Time Logging**: View a chronological log of all connection events, sent messages, and received messages
- **Rich Message Viewer**: Expand/collapse message payloads, view formatted JSON with syntax highlighting, and navigate JSON outlines
- **Persistence**: The last WebSocket request is automatically persisted to localStorage and restored on page reload
- **URL Validation**: Client-side URL validation via a Web Worker to ensure endpoint correctness before connecting

The default endpoint is `wss://echo-websocket.hoppscotch.io`, a public echo server that reflects back any message sent to it, making it easy to test connectivity.

## Architecture

The WebSocket Client follows a layered architecture with clear separation of concerns between the UI, state management, connection logic, and persistence.

### Component Roles

| Component | File | Role |
|-----------|------|------|
| websocket.vue | src/pages/realtime/websocket.vue | Main page component orchestrating URL input, connection toggle, tabs, and log |
| Communication.vue | src/components/realtime/Communication.vue | Message input area with content type selector (JSON/Raw), file upload, and send button |
| Log.vue | src/components/realtime/Log.vue | Log panel displaying all events with auto-scroll, scroll-to-top/bottom controls |
| LogEntry.vue | src/components/realtime/LogEntry.vue | Individual log entry with expand/collapse, formatted JSON viewer with outline navigation |
| WebSocketSession.ts | src/newstore/WebSocketSession.ts | State store managing request, socket instance, and log entries via DispatchingStore |
| WSConnection.ts | src/helpers/realtime/WSConnection.ts | WebSocket connection wrapper with ReactiveX event streams |
| persistence/index.ts | src/services/persistence/index.ts | Service that persists WebSocket request state to localStorage |

## Core Flow

The WebSocket client lifecycle involves a well-defined sequence of state transitions from initialization through connection, message exchange, and disconnection.

1. User enters URL (e.g. wss://echo.example.com)
2. Validate URL via Web Worker
3. User clicks "Connect"
4. `connect(url, protocols)` → Update connectionState$ → "CONNECTING"
5. Display "Connecting to..." message
6. `new WebSocket(url, protocols)`
7. `onopen` fired → Update connectionState$ → "CONNECTED"
8. Display "Connected to..." message
9. User types message in Communication panel, clicks Send (or Ctrl+Enter)
10. `sendMessage({ message, eventName })` → `socket.send(message)`
11. Display outgoing message → `onmessage` fired with data
12. Display incoming message
13. User clicks "Disconnect" → `disconnect()` → `socket.close()`
14. `onclose` fired → Update connectionState$ → "DISCONNECTED"

## Main Content

### WebSocket Connection Wrapper (WSConnection)

The `WSConnection` class is a RxJS-based wrapper around the browser's native WebSocket API. It provides reactive streams for connection state and events, making it easy for Vue components to subscribe to state changes.

Design Intent: Rather than using callback-based event handlers scattered across components, WSConnection centralizes all WebSocket lifecycle management into a single class that emits typed events through RxJS Observables. This enables reactive UI updates and clean separation of concerns.

The class exposes two key reactive streams:

- **connectionState$** — A `BehaviorSubject<ConnectionState>` that tracks connection status ("CONNECTING", "CONNECTED", "DISCONNECTED")
- **event$** — A `Subject<WSEvent>` that emits typed event objects for connection, disconnection, messages, and errors

```typescript
// Event type hierarchy
export type WSEvent = { time: number } & (
  | { type: "CONNECTING" }
  | { type: "CONNECTED" }
  | { type: "MESSAGE_SENT"; message: string }
  | { type: "MESSAGE_RECEIVED"; message: string }
  | { type: "DISCONNECTED"; manual: boolean }
  | { type: "ERROR"; error: WSErrorMessage }
)
```

The `connect()` method creates a new WebSocket instance, sets up event handlers, and emits lifecycle events:

```typescript
connect(url: string, protocols: string[]) {
  try {
    this.connectionState$.next("CONNECTING")
    this.socket = new WebSocket(url, protocols)

    this.addEvent({
      time: Date.now(),
      type: "CONNECTING",
    })

    this.socket.onopen = () => {
      this.connectionState$.next("CONNECTED")
      this.addEvent({
        type: "CONNECTED",
        time: Date.now(),
      })
    }

    this.socket.onmessage = ({ data }) => {
      this.addEvent({
        time: Date.now(),
        type: "MESSAGE_RECEIVED",
        message: data,
      })
    }
    // ... onerror, onclose handlers
  } catch (error) {
    this.handleError(error as SyntaxError)
  }
}
```

### State Management (WebSocketSession)

The WebSocketSession module uses a DispatchingStore pattern — a lightweight state management approach built on RxJS BehaviorSubject. This pattern was designed in Hoppscotch to provide type-safe, observable state without the overhead of a full state management library.

Design Intent: Using RxJS streams instead of Vue's reactive system for cross-component state ensures that state updates remain framework-agnostic and can be consumed by persistence services, analytics, and other non-UI code.

The store manages three pieces of state:

```typescript
export type HoppWSSession = {
  request: HoppWSRequest     // endpoint + protocols
  log: HoppRealtimeLog       // array of log entries
  socket: WSConnection       // the connection instance
}

export type HoppWSRequest = {
  endpoint: string
  protocols: HoppWSProtocol[]
}

export type HoppWSProtocol = {
  value: string
  active: boolean
}
```

Reactive observables are exposed for individual slices of state:

```typescript
export const WSEndpoint$ = WSSessionStore.subject$.pipe(
  pluck("request", "endpoint"),
  distinctUntilChanged()
)

export const WSProtocols$ = WSSessionStore.subject$.pipe(
  pluck("request", "protocols"),
  distinctUntilChanged()
)

export const WSLog$ = WSSessionStore.subject$.pipe(
  pluck("log"),
  distinctUntilChanged()
)

export const WSSocket$ = WSSessionStore.subject$.pipe(
  pluck("socket"),
  distinctUntilChanged()
)
```

### Log Data Model

Log entries use a shared type across all real-time clients:

```typescript
export type HoppRealtimeLogLine = {
  prefix?: string
  payload: string
  source: string        // "info" | "client" | "server" | "disconnected"
  color?: string
  ts: number | undefined
}

export type HoppRealtimeLog = HoppRealtimeLogLine[]
```

### Persistence

WebSocket request state is automatically persisted to localStorage and restored on application load. This ensures that navigating away from the WebSocket page and returning preserves the last used endpoint and protocols.

The persistence is handled by `PersistenceService.setupWebsocketPersistence()`, which:

1. Reads the stored WebSocket request from localStorage
2. Validates it against a Zod schema (`WEBSOCKET_REQUEST_SCHEMA`)
3. If valid, sets it as the current request
4. Subscribes to `WSRequest$` to save any future changes

```typescript
private async setupWebsocketPersistence() {
  const loadResult = await Store.get<any>(
    STORE_NAMESPACE,
    STORE_KEYS.WEBSOCKET
  )

  if (isRight(loadResult)) {
    const data = loadResult.right
    if (data) {
      const result = WEBSOCKET_REQUEST_SCHEMA.safeParse(data)
      if (result.success) {
        setWSRequest(result.data)
      } else {
        this.showErrorToast(STORE_KEYS.WEBSOCKET)
        await Store.set(
          STORE_NAMESPACE,
          `${STORE_KEYS.WEBSOCKET}-backup`,
          data
        )
      }
    }
  }

  WSRequest$.subscribe(async (req) => {
    await Store.set(STORE_NAMESPACE, STORE_KEYS.WEBSOCKET, req)
  })
}
```

The validation schema enforces the shape of the persisted data:

```typescript
export const WEBSOCKET_REQUEST_SCHEMA = z.nullable(
  z.object({
    endpoint: z.string(),
    protocols: z.array(
      z.object({
        value: z.string(),
        active: z.boolean(),
      }).strict()
    ),
  }).strict()
)
```

## Usage Examples

### Basic Usage: Connecting and Sending a Message

The WebSocket page component demonstrates the core interaction pattern. Below is the connection toggle logic extracted from websocket.vue:

```typescript
const toggleConnection = () => {
  // If it is connecting:
  if (connectionState.value === "DISCONNECTED") {
    return socket.value.connect(url.value, activeProtocols.value)
  }
  // Otherwise, it's disconnecting.
  socket.value.disconnect()
}

const sendMessage = (event: { message: string; eventName: string }) => {
  socket.value.sendMessage(event)
}
```

The connection state is derived from the WSConnection instance and is used to control UI state (e.g., disabling the URL input while connected):

```typescript
const connectionState = useReadonlyStream(
  socket.value.connectionState$,
  "DISCONNECTED"
)
```

### Event Subscription and Logging

The page subscribes to WebSocket events on mount to build the log display:

```typescript
onMounted(() => {
  subscribeToStream(socket.value.event$, (event) => {
    switch (event?.type) {
      case "CONNECTING":
        log.value = [{
          payload: `${t("state.connecting_to", { name: url.value })}`,
          source: "info",
          color: "var(--accent-color)",
          ts: undefined,
        }]
        break

      case "CONNECTED":
        log.value = [{
          payload: `${t("state.connected_to", { name: url.value })}`,
          source: "info",
          color: "var(--accent-color)",
          ts: Date.now(),
        }]
        break

      case "MESSAGE_SENT":
        addWSLogLine({
          payload: event.message,
          source: "client",
          ts: Date.now(),
        })
        break

      case "MESSAGE_RECEIVED":
        addWSLogLine({
          payload: event.message,
          source: "server",
          ts: event.time,
        })
        break

      case "ERROR":
        addWSLogLine({
          payload: getErrorPayload(event.error),
          source: "info",
          color: "#ff5555",
          ts: event.time,
        })
        break

      case "DISCONNECTED":
        addWSLogLine({
          payload: t("state.disconnected_from", { name: url.value }).toString(),
          source: "disconnected",
          color: "#ff5555",
          ts: event.time,
        })
        break
    }
  })
})
```

### Sending Messages with Content Type Selection

The Communication.vue component provides a code editor (CodeMirror) for composing messages and supports JSON/Raw content types:

```typescript
const knownContentTypes = {
  JSON: "application/ld+json",
  Raw: "text/plain",
} as const

const sendMessage = () => {
  if (!communicationBody.value) return

  emit("send-message", {
    eventName: eventName.value,
    message: communicationBody.value,
  })
  clearContent()
}
```

### URL Validation via Web Worker

URL validation runs in a Web Worker to avoid blocking the UI thread:

```typescript
onMounted(() => {
  worker = new RegexWorker()
  worker.addEventListener("message", workerResponseHandler)
  // ...
})

const debouncer = debounce(function () {
  worker.postMessage({ type: "ws", url: url.value })
}, 1000)

const workerResponseHandler = ({
  data,
}: {
  data: { url: string; result: boolean }
}) => {
  if (data.url === url.value) isUrlValid.value = data.result
}
```

## Configuration Options

| Aspect | Type | Default | Description |
|--------|------|---------|-------------|
| Endpoint URL | string | wss://echo-websocket.hoppscotch.io | The WebSocket server URL (ws:// or wss:// scheme) |
| Sub-Protocols | HoppWSProtocol[] | [] | Array of WebSocket sub-protocols to negotiate during connection |
| Message Content Type | "JSON" \| "Raw" | "JSON" | Content type for message composition |
| Clear Input on Send | boolean | false | Whether to clear the message input after sending |
| Line Wrap | boolean | true | Whether to enable line wrapping in the message editor and log viewer |

### Sub-Protocol Configuration

Each protocol entry has two fields:

| Field | Type | Description |
|-------|------|-------------|
| value | string | The protocol name (e.g., "graphql-ws", "soap") |
| active | boolean | Whether this protocol is enabled for the connection |

Only active protocols are sent during the WebSocket handshake:

```typescript
const activeProtocols = ref<string[]>([])

watch(protocols, (newProtocols) => {
  activeProtocols.value = newProtocols
    .filter((item) =>
      Object.prototype.hasOwnProperty.call(item, "active")
        ? item.active === true
        : true
    )
    .map(({ value }) => value)
}, { deep: true })
```

## API Reference

### WSConnection Class

The core connection wrapper class.

**constructor()** — Creates a new WebSocket connection manager with an initial DISCONNECTED state.

**connect(url: string, protocols: string[]): void** — Establishes a WebSocket connection to the given URL with optional sub-protocols.

Parameters:
- `url` (string): The WebSocket endpoint URL (ws:// or wss://)
- `protocols` (string[]): Array of sub-protocol names for negotiation

Throws:
- `SyntaxError`: If the URL is malformed (caught internally and emitted as an ERROR event)

**sendMessage(event: { message: string; eventName: string }): void** — Sends a message through the WebSocket connection. No-op if disconnected.

Parameters:
- `event.message` (string): The message content to send
- `event.eventName` (string): Reserved for Socket.IO compatibility; unused for WebSocket

**disconnect(): void** — Closes the WebSocket connection gracefully by calling `socket.close()`.

**connectionState$: BehaviorSubject\<ConnectionState\>** — RxJS BehaviorSubject that emits connection state changes. Values: "CONNECTING" | "CONNECTED" | "DISCONNECTED".

**event$: Subject\<WSEvent\>** — RxJS Subject that emits lifecycle events (CONNECTING, CONNECTED, MESSAGE_SENT, MESSAGE_RECEIVED, DISCONNECTED, ERROR).

### Exported Functions from WebSocketSession.ts

| Function | Signature | Description |
|----------|-----------|-------------|
| setWSEndpoint | (newEndpoint: string) => void | Updates the WebSocket endpoint URL in the store |
| setWSProtocols | (protocols: HoppWSProtocol[]) => void | Replaces all sub-protocols |
| addWSProtocol | (protocol: HoppWSProtocol) => void | Adds a new sub-protocol entry |
| deleteWSProtocol | (index: number) => void | Removes a sub-protocol by index |
| updateWSProtocol | (index: number, updatedProtocol: HoppWSProtocol) => void | Updates a sub-protocol at the given index |
| deleteAllWSProtocols | () => void | Removes all sub-protocols |
| setWSSocket | (socket: WSConnection) => void | Sets the current WSConnection instance in the store |
| addWSLogLine | (line: HoppRealtimeLogLine) => void | Appends a log entry |
| setWSLog | (log: HoppRealtimeLog) => void | Replaces the entire log |
| setWSRequest | (newRequest?: HoppWSRequest) => void | Replaces the entire request (endpoint + protocols) |

### Exported RxJS Observables from WebSocketSession.ts

| Observable | Emits | Description |
|------------|-------|-------------|
| WSRequest$ | HoppWSRequest | The full request object (endpoint + protocols) |
| WSEndpoint$ | string | The WebSocket endpoint URL |
| WSProtocols$ | HoppWSProtocol[] | The list of sub-protocols |
| WSSocket$ | WSConnection | The current WSConnection instance |
| WSLog$ | HoppRealtimeLog | The array of log entries |

## Related Links

- Source: websocket.vue (Page Component)
- Source: WebSocketSession.ts (State Store)
- Source: WSConnection.ts (Connection Wrapper)
- Source: Communication.vue (Message Input)
- Source: Log.vue (Log Panel)
- Source: LogEntry.vue (Message Viewer)
- Source: HoppRealtimeLog.ts (Log Types)
- Source: DispatchingStore.ts (State Management)
- Source: Persistence Service
- Source: Validation Schema
- Socket.IO Client
- SSE Client
- MQTT Client

## Sources

(11 files)

- PACKAGES/HOPPSCOTCH-COMMON/SRC/COMPONENTS/REALTIME: Communication.vue, Log.vue, LogEntry.vue
- PACKAGES/HOPPSCOTCH-COMMON/SRC/COMPOSABLES: stream.ts
- PACKAGES/HOPPSCOTCH-COMMON/SRC/HELPERS/REALTIME: WSConnection.ts
- PACKAGES/HOPPSCOTCH-COMMON/SRC/HELPERS/TYPES: HoppRealtimeLog.ts
- PACKAGES/HOPPSCOTCH-COMMON/SRC/MODULES: router.ts
- PACKAGES/HOPPSCOTCH-COMMON/SRC/NEWSTORE: DispatchingStore.ts, WebSocketSession.ts
- PACKAGES/HOPPSCOTCH-COMMON/SRC/PAGES/REALTIME: websocket.vue
- PACKAGES/HOPPSCOTCH-COMMON/SRC/SERVICES/PERSISTENCE/VALIDATION-SCHEMAS: index.ts
