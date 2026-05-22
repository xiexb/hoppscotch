# cURL Import/Parse
The cURL Import/Parse feature allows users to convert raw cURL commands into Hoppscotch REST API requests. It provides a modal-based interface for pasting cURL commands and automatically parsing them into structured requests with method, URL, headers, body, authentication, and parameters.

## Overview
Hoppscotch's cURL importer is a critical feature for developers migrating from terminal-based API testing. It accepts standard cURL commands (with flags like `-X`, `-H`, `-d`, `-F`, `-u`, `-b`, etc.) and transforms them into fully structured Hoppscotch REST requests. The parser is designed to handle the wide variety of cURL syntax variations, including long-form options (`--header`), short-form flags (`-H`), URL-encoded data, multipart form data, authentication headers, cookies, and more.

The import system consists of two main parts:

- **UI Component (`ImportCurl.vue`)**: A modal dialog with a code editor for pasting cURL commands
- **Parser Engine (`curlparser.ts` and sub-helpers)**: A modular parsing pipeline that breaks down cURL commands into structured REST request objects

This feature is designed with **functional programming principles** using the `fp-ts` library, ensuring pure, composable, and type-safe parsing logic throughout the pipeline.

## Architecture
The following diagram illustrates the overall architecture of the cURL Import/Parse system, showing how the UI component interacts with the parsing pipeline to produce a structured Hoppscotch REST request.

加载图表中...
**Component Responsibilities:**

ComponentRoleKey Function`ImportCurl.vue`UI modal for cURL importPresents code editor, handles paste/import actions`index.ts`Public API entry pointExports `parseCurlToHoppRESTReq` (composes `parseCurlCommand` + `cloneDeep`)`curlparser.ts`Main parsing orchestratorCoordinates all sub-helpers to build the final request`preproc.ts`Command preprocessorSanitizes cURL text: removes line continuations, normalizes long options to short flags`method.ts`HTTP method extractorExtracts method from `-X` flag or deduces from context (e.g., `-d` implies POST)`headers.ts`Header parserExtracts headers from `-H`/`--header` flags, handles `-A` for User-Agent`auth.ts`Authentication parserExtracts auth from `Authorization` header, `-u` flag, or URL credentials`body.ts`Request body parserHandles `-d`/`--data` and `-F`/`--form` arguments`url.ts`URL resolverExtracts URL from arguments, auto-adds protocol for localhost/IP`queries.ts`Query parameter handlerSeparates query params into structured params and dangling params`cookies.ts`Cookie parserExtracts cookies from `-b`/`--cookie` flags`contentParser.ts`Content type detection & body formattingAuto-detects content type and formats body (JSON, XML, form-data, etc.)
### Design Intent
The parser is built using a **functional programming pipeline** pattern. Each sub-helper is a pure function that takes parsed arguments and returns a specific piece of the request. The main `parseCurlCommand` function orchestrates these helpers and composes them into a complete `HoppRESTRequest` object. This design offers several benefits:

- **Testability**: Each sub-helper can be tested independently with specific inputs
- **Composability**: New parsing capabilities can be added as additional sub-helpers
- **Type Safety**: Using `fp-ts/Option` ensures safe handling of potentially missing arguments
- **Immutability**: The pipeline transforms data through pure functions without mutation

## Core Flow
The following sequence diagram illustrates the step-by-step flow of parsing a cURL command into a Hoppscotch REST request:

加载图表中...
### Step-by-Step Parsing Process

-
**Preprocessing** (`preproc.ts`): The raw cURL command is sanitized by:

Removing backslash line continuations and newlines
- Normalizing long options to their short equivalents (e.g., `--header` → `-H`, `--data` → `-d`)
- Handling `$'...'` and `$"..."` shell quote syntax
- Splitting combined `-XPOST` into `-X POST` for proper yargs parsing

-
**Tokenization** (`yargs-parser`): The sanitized string is passed to `yargs-parser/browser` which tokenizes it into a structured arguments object, similar to how CLI argument parsers work.

-
**Decomposition**: The main parser (`curlparser.ts`) extracts individual components:

HTTP method from `-X` or deduced from context
- Headers from `-H` flags, with special handling for User-Agent (`-A`)
- Authentication from `Authorization` header, `-u` flag, or URL credentials
- URL from positional arguments, with automatic protocol detection
- Query parameters and dangling params from URL
- Body from `-d`/`--data` or `-F`/`--form` flags
- Cookies from `-b`/`--cookie` flags

-
**Assembly**: All parsed components are combined via `makeRESTRequest()` into a complete `HoppRESTRequest` object with a schema version and unique reference ID.

-
**Deep Clone**: The final request is deep-cloned using lodash's `cloneDeep` to ensure immutability before being passed to the UI.

### Protocol Auto-Detection
The URL helper (`url.ts`) intelligently determines the protocol:

- URLs with explicit protocols (http://, https://) are used as-is
- URLs without protocols use auto-detection:

`localhost`, `127.0.0.1`, and private IP ranges → `http://`
- All other domains → `https://`

- Invalid URLs fall back to the default endpoint `https://echo.hoppscotch.io`

## Usage Examples
### Basic Usage
The following example shows how to parse a simple cURL command with query parameters and form data:

typescript1import { parseCurlToHoppRESTReq } from "~/helpers/curl"
2
3// Parse a simple GET request with form data
4const curlCommand = `curl --request GET \\
5  --url https://echo.hoppscotch.io/ \\
6  --header 'content-type: application/x-www-form-urlencoded' \\
7  --data a=b \\
8  --data c=d`
9
10const request = parseCurlToHoppRESTReq(curlCommand)
11
12console.log(request.method)          // "GET"
13console.log(request.endpoint)        // "https://echo.hoppscotch.io/"
14console.log(request.body.contentType) // "application/x-www-form-urlencoded"
15console.log(request.body.body)       // "a: b\nc: d"
>
Source: [curlparser.spec.js](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/curl/__tests__/curlparser.spec.js#L9-L43)

### Advanced Usage with Authentication
The parser automatically extracts authentication from various sources, with the following priority:

- `Authorization` header (Basic or Bearer)
- `--user` or `-u` flag
- Credentials embedded in URL

typescript1import { parseCurlToHoppRESTReq } from "~/helpers/curl"
2
3// Parse a PUT request with Basic Auth from URL credentials
4const curlCommand = `curl 'http://avs:def@127.0.0.1:8000/api/admin/crm/brand/4' \\
5  -X PUT \\
6  -H 'User-Agent: Mozilla/5.0' \\
7  -H 'Content-Type: application/hal+json;charset=utf-8' \\
8  --data-raw '{"id":4,"name":"Kellolaa"}'`
9
10const request = parseCurlToHoppRESTReq(curlCommand)
11
12console.log(request.method)               // "PUT"
13console.log(request.endpoint)             // "http://127.0.0.1:8000/api/admin/crm/brand/4"
14console.log(request.auth.authType)        // "basic"
15console.log(request.auth.username)        // "avs"
16console.log(request.auth.password)        // "def"
17console.log(request.body.contentType)     // "application/hal+json"
>
Source: [curlparser.spec.js](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/curl/__tests__/curlparser.spec.js#L45-L155)

### Multipart Form Data
The parser handles `-F`/`--form` flags for multipart form data submissions:

typescript1import { parseCurlToHoppRESTReq } from "~/helpers/curl"
2
3// Parse a multipart form upload
4const curlCommand = `curl -F hello=hello2 -F hello3=@hello4.txt bing.com`
5
6const request = parseCurlToHoppRESTReq(curlCommand)
7
8console.log(request.method)               // "POST"
9console.log(request.endpoint)             // "https://bing.com/"
10console.log(request.body.contentType)     // "multipart/form-data"
11console.log(request.body.body)
12// [
13//   { active: true, isFile: false, key: "hello", value: "hello2" },
14//   { active: true, isFile: false, key: "hello3", value: "" }  // file - value left empty
15// ]
>
Source: [curlparser.spec.js](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/curl/__tests__/curlparser.spec.js#L233-L264)

### Bearer Token Authentication
Bearer tokens in `Authorization` headers are automatically extracted and stored as a bearer auth type:

typescript1import { parseCurlToHoppRESTReq } from "~/helpers/curl"
2
3const curlCommand = `curl -X GET localhost \\
4  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.test'`
5
6const request = parseCurlToHoppRESTReq(curlCommand)
7
8console.log(request.auth.authType)        // "bearer"
9console.log(request.auth.token)           // "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.test"
>
Source: [curlparser.spec.js](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/curl/__tests__/curlparser.spec.js#L359-L391)

### UI Component Usage
The `ImportCurl.vue` component provides the user interface. Here's how it's integrated within the application:

vue1<template>
2  <HoppSmartModal
3    v-if="show"
4    dialog
5    :title="`${t('import.curl')}`"
6    @close="hideModal"
7  >
8    <template #body>
9      <!-- Code editor for cURL command input -->
10      <div class="rounded border border-dividerLight">
11        <div ref="curlEditor" class="h-full rounded-b border-t border-dividerLight"></div>
12      </div>
13    </template>
14    <template #footer>
15      <HoppButtonPrimary
16        ref="importButton"
17        :label="`${t('import.title')}`"
18        outline
19        @click="handleImport"
20      />
21      <HoppButtonSecondary
22        :icon="pasteIcon"
23        :label="`${t('action.paste')}`"
24        filled
25        outline
26        @click="handlePaste"
27      />
28    </template>
29  </HoppSmartModal>
30</template>
31
32<script setup lang="ts">
33import { parseCurlToHoppRESTReq } from "~/helpers/curl"
34import { RESTTabService } from "~/services/tab/rest"
35
36const handleImport = () => {
37  const text = curl.value
38  try {
39    const req = parseCurlToHoppRESTReq(text)
40
41    // Preserve the existing request name when importing cURL
42    const currentRequest = tabs.currentActiveTab.value.document.request
43    const reqName = currentRequest?.name ?? req.name
44
45    tabs.currentActiveTab.value.document.request = { ...req, name: reqName }
46  } catch (e) {
47    console.error(e)
48    toast.error(`${t("error.curl_invalid_format")}`)
49  }
50  hideModal()
51}
52</script>
>
Source: [ImportCurl.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/ImportCurl.vue#L74-L162)

## Supported cURL Flags
The parser handles the following cURL flags and options:

cURL FlagLong OptionParser HandlerDescription`-X``--request``method.ts`HTTP method (GET, POST, PUT, etc.)`-H``--header``headers.ts`Request headers`-d``--data` / `--data-raw` / `--data-ascii` / `--data-binary``body.ts`, `curlparser.ts`Request body data`-F``--form``body.ts`Multipart form data`-u``--user``auth.ts`Basic auth credentials`-A``--user-agent``headers.ts`User-Agent header`-b``--cookie``cookies.ts`Cookies`-I``--head``method.ts`HEAD method (deduced)`-G``--get``method.ts`, `curlparser.ts`Forces GET method, puts `-d` data into URL query`--url`—`url.ts`Explicit URL specification`--compressed`—SkippedCompressed response handling`--form-string`—`body.ts`Form string (disables file prefix handling)
### Method Deduction Rules
When no explicit `-X` flag is provided, the parser deduces the HTTP method using these rules:

- If `-T` (upload-file) is present → `PUT`
- If `-I` (head) is present → `HEAD`
- If `-G` (get) is present → `GET`
- If `-d` (data) or `-F` (form) is present → `POST`
- Otherwise → Default method from config (`GET`)

## API Reference
### `parseCurlToHoppRESTReq(curlCommand: string): HoppRESTRequest`
The main entry point for cURL parsing. Composes `parseCurlCommand` with `cloneDeep` for immutability.

typescript1import { flow } from "fp-ts/function"
2import { cloneDeep } from "lodash-es"
3import { parseCurlCommand } from "./curlparser"
4
5export const parseCurlToHoppRESTReq = flow(parseCurlCommand, cloneDeep)
>
Source: [index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/curl/index.ts)

**Parameters:**

- `curlCommand` (`string`): A raw cURL command string (e.g., `curl -X GET https://api.example.com`)

**Returns:** `HoppRESTRequest` — A structured request object with the following shape:

typescript1{
2  v: number                    // Schema version
3  _ref_id: string              // Unique reference ID
4  endpoint: string             // Request URL
5  name: string                 // Request name (default: "Untitled")
6  method: string               // HTTP method (uppercase)
7  params: HoppRESTParam[]      // Query parameters
8  headers: HoppRESTHeader[]    // Request headers
9  auth: HoppRESTAuth           // Authentication configuration
10  body: HoppRESTReqBody        // Request body
11  preRequestScript: string     // Pre-request script
12  testScript: string           // Test script
13  requestVariables: any[]      // Request variables
14  responses: Record<string, any> // Saved responses
15}
**Throws:**

- May throw if the cURL command is completely unparseable. The UI catches this and shows an error toast: `"Invalid cURL format"`.

### `parseCurlCommand(curlCommand: string): HoppRESTRequest`
The core parsing function that orchestrates the entire conversion pipeline.

>
Source: [curlparser.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/curl/curlparser.ts)

**Processing Steps:**

- Preprocesses the command string via `preProcessCurlCommand()`
- Tokenizes via `yargs-parser`
- Handles `--data-urlencode` decoding
- Extracts headers, method, cookies, URL, auth, and body
- Assembles and returns the final `HoppRESTRequest` via `makeRESTRequest()`

### `preProcessCurlCommand(curlCommand: string): string`
Sanitizes the raw cURL command string for parsing.

>
Source: [preproc.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/curl/sub_helpers/preproc.ts)

**Transforms:**

- Removes `\` line continuations and newlines
- Replaces `$'...'` with `'...'` and `$"..."` with `"..."`
- Converts long options to short options (e.g., `--header` → `-H`)
- Prescreens combined flags (e.g., `-XPOST` → `-X POST`)

### `detectContentType(rawData: string): HoppRESTReqBody["contentType"]`
Auto-detects the content type of raw body data based on its content.

>
Source: [contentParser.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/curl/sub_helpers/contentParser.ts)

**Detection Order:**

- `application/json` — Valid JSON string
- `multipart/form-data` — Contains multipart boundary markers
- `application/xml` — XML with declaration or valid XML tags
- `text/html` — HTML tags
- `application/x-www-form-urlencoded` — Key=value pairs
- `text/plain` — Fallback for unrecognized content

## Related Links

- [Source: curlparser.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/curl/curlparser.ts) — Main parser implementation
- [Source: ImportCurl.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/ImportCurl.vue) — Import UI component
- [Source: Test Suite](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/curl/__tests__/curlparser.spec.js) — Comprehensive parser tests with 20+ sample cURL commands
- [Source: Content Type Detection Tests](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/curl/__tests__/detectContentType.spec.js) — Tests for automatic content type detection
- [Source: @hoppscotch/data - makeRESTRequest](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-data/src/rest/index.ts#L242-L250) — Request factory function
- [General Import/Export](./10-import-and-export.1-overview) — Overview of all import/export features
- [Postman Import](./10-import-and-export.2-postman-import) — Postman collection import documentation