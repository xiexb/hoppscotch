# Code Snippet Generation
Hoppscotch's code snippet generation feature converts HTTP requests into ready-to-use source code across multiple programming languages and libraries, enabling developers to quickly integrate API calls into their applications.

## Overview
The Code Snippet Generation system allows users to take any REST request they build in Hoppscotch and instantly translate it into executable code for their preferred language or library. This feature eliminates the tedious work of manually writing HTTP request code and reduces the risk of errors when translating API calls between environments.

### Key Concepts

- **Codegen (Code Generation)**: The process of transforming a structured HTTP request (method, URL, headers, body, query parameters) into source code in a target language/library.
- **HAR (HTTP Archive) Format**: An intermediate representation used to normalize requests before conversion. Hoppscotch supports the [HAR 1.2 Spec](http://www.softwareishard.com/blog/har-12-spec/).
- **HTTPSnippet**: The underlying library (forked from [Kong/httpsnippet](https://github.com/Kong/httpsnippet)) that handles the actual code conversion from HAR format to various language targets.
- **Effective Request**: A fully resolved request where all environment variables have been substituted, authentication has been applied, and headers have been inherited from collections.

### Use Cases

- **Rapid prototyping**: Convert a tested API call directly into production-ready code
- **Documentation**: Generate code examples for API documentation across multiple languages
- **Code sharing**: Copy generated code snippets and share them with team members
- **Migration**: Quickly translate API calls from one language/library to another

## Architecture
The code generation architecture follows a pipeline pattern where a raw REST request is progressively transformed into the final code output.

加载图表中...
### Component Roles
ComponentRoleSource File**Codegen.vue**Vue component that orchestrates code generation UI and pipeline[Codegen.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/Codegen.vue)**CodegenModal.vue**Modal wrapper that provides copy-to-clipboard action[CodegenModal.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/CodegenModal.vue)**new-codegen/index.ts**Core code generation logic and supported language definitions[new-codegen/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/new-codegen/index.ts)**new-codegen/har.ts**HAR 1.2 request builder from HoppRESTRequest[new-codegen/har.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/new-codegen/har.ts)**@hoppscotch/httpsnippet**Library that converts HAR to code snippetsExternal dependency (v3.0.9)**EffectiveURL.ts**Resolves environment variables and computes effective request[EffectiveURL.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/utils/EffectiveURL.ts)
## Code Generation Pipeline
The code generation process follows a carefully designed pipeline that ensures all environment variables, authentication, headers, and body content are properly resolved before conversion.

加载图表中...
### Step-by-Step Pipeline
#### 1. Environment Building
The `buildFinalEnvironment()` method merges environment variables from three sources:

- **Request variables**: Local variables defined within the request itself
- **Collection variables**: Inherited variables from the parent collection
- **Environment variables**: From the currently selected Hoppscotch environment (including secrets with current values)

Variables are deduplicated and filtered to remove empty entries using `filterNonEmptyEnvironmentVariables()`.

>
Source: [Codegen.vue - buildFinalEnvironment](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/Codegen.vue#L242-L287)

#### 2. Authentication and Header Resolution
When a request's auth type is set to `"inherit"`, the system looks up the inherited authentication from the collection. Similarly, collection-level headers are prepended to request-level headers.

>
Source: [Codegen.vue - resolveRequestAuthAndHeaders](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/Codegen.vue#L292-L312)

#### 3. Effective Request Computation
The `getEffectiveRESTRequest()` function substitutes all environment variable placeholders (`<<variable_name>>`) in the URL, headers, params, and body with their actual values from the merged environment.

>
Source: [EffectiveURL.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/utils/EffectiveURL.ts)

#### 4. URL Normalization
The `getFinalURL()` function ensures the URL is well-formed:

- Strips malformed protocols like `https :// ` or `https:///`
- Prepends `http://` for localhost/IP addresses
- Prepends `https://` for all other domains
- Leaves variable placeholders (`<<var>>`) untouched

>
Source: [Codegen.vue - getFinalURL](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/Codegen.vue#L210-L237)

#### 5. HAR Request Building
The `buildHarRequest()` function converts the Hoppscotch request into a **HAR 1.2** format request object. This includes:

- **Headers**: Filtered to active headers only
- **Query Strings**: Filtered to active params only
- **Cookies**: Currently empty (Hoppscotch does not have formal cookie support)
- **Post Data**: Handles multiple content types:

`application/x-www-form-urlencoded`: Parses line-separated key:value pairs
- `multipart/form-data`: Supports file uploads and typed fields
- `application/octet-stream`: Binary file data
- Other types: Treated as plain text (typically JSON)

>
Source: [new-codegen/har.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/new-codegen/har.ts#L146-L165)

#### 6. Final Code Generation
The `generateCode()` function creates an `HTTPSnippet` instance with the HAR request and calls `.convert(lang, mode)` with the target language and mode:

typescript1new HTTPSnippet({
2  ...buildHarRequest(req),
3}).convert(codegenInfo.lang, codegenInfo.mode, {
4  indent: "  ",
5})
>
Source: [new-codegen/index.ts - generateCode](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/new-codegen/index.ts#L207-L238)

## Supported Languages
Hoppscotch supports **28 code generation targets** across **17 languages**.

LanguageLibrary/ModeCodegen NameCcURL`c-curl`Clojureclj-http`clojure-clj_http`C#HttpClient`csharp-httpclient`C#RestSharp`csharp-restsharp`GoNative`go-native`HTTPHTTP 1.1 Request String`http-http1.1`JavaAsyncHTTPClient`java-asynchttp`Javajava.net.http`java-nethttp`JavaOkHttp`java-okhttp`JavaUnirest`java-unirest`JavaScriptAxios`javascript-axios`JavaScriptFetch`javascript-fetch`JavaScriptjQuery`javascript-jquery`JavaScriptXMLHttpRequest`javascript-xhr`KotlinOkHttp`kotlin-okhttp`Objective CNSURLSession`objc-nsurlsession`OCamlcohttp`ocaml-cohttp`PHPcURL`php-curl`PowerShellInvoke-RestMethod`powershell-restmethod`PowerShellInvoke-WebRequest`powershell-webrequest`PythonPython 3 Native`python-python3`PythonRequests`python-requests`Rhttr`r-httr`RubyNative`ruby-native`RustReqwest`rust-reqwest`ShellcURL`shell-curl`ShellHTTPie`shell-httpie`ShellWget`shell-wget`SwiftNSURLSession`swift-nsurlsession`
These definitions are configured in the `CodegenDefinitions` constant array:

>
Source: [new-codegen/index.ts - CodegenDefinitions](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/new-codegen/index.ts#L14-L189)

## Usage Examples
### Basic Usage: Converting a Request via the UI
The code generation feature is accessible from the REST request editor. When the user opens the Codegen modal, the system automatically generates code for the currently active request.

**Triggering code generation:**

typescript1// From Request.vue - the action handler that opens the codegen modal
2defineActionHandler("request.show-code", () => {
3  showCodegenModal.value = true
4})
>
Source: [Request.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/Request.vue#L668-L670)

**The modal renders the Codegen component:**

vue1<HttpCodegenModal
2  v-if="showCodegenModal"
3  :show="showCodegenModal"
4  @hide-modal="showCodegenModal = false"
5/>
>
Source: [Request.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/Request.vue#L223-L227)

### Manually Generating Code from a Request
The core `generateCode()` function accepts a `CodegenName` and a `HoppRESTRequest` object, returning an `fp-ts Option<string>`:

typescript1import { generateCode, CodegenDefinitions } from "~/helpers/new-codegen"
2import { buildHarRequest } from "~/helpers/new-codegen/har"
3import { HoppRESTRequest } from "@hoppscotch/data"
4import * as O from "fp-ts/Option"
5
6// Example: Generate shell cURL code from a request
7function generateCurl(request: HoppRESTRequest): string | null {
8  const result = generateCode("shell-curl", request)
9
10  if (O.isSome(result)) {
11    return result.value
12  }
13  return null
14}
>
Source: [new-codegen/index.ts - generateCode](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/new-codegen/index.ts#L207-L238)

### Copying Generated Code to Clipboard
The modal component handles copying via the `copyToClipboard` utility:

typescript1const copyRequestCode = () => {
2  copyToClipboard(requestCode.value)
3  copyCodeIcon.value = IconCheck
4  toast.success(`${t("state.copied_to_clipboard")}`)
5}
>
Source: [CodegenModal.vue - copyRequestCode](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/CodegenModal.vue#L73-L77)

### Using Codegen in Collections Documentation
The `CurlView.vue` component uses the same code generation logic for rendering code examples in API documentation views:

typescript1import {
2  CodegenDefinitions,
3  CodegenLang,
4  CodegenName,
5  generateCode,
6} from "~/helpers/new-codegen"
>
Source: [CurlView.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/collections/documentation/sections/CurlView.vue#L128-L133)

## Configuration Options
The code generation feature supports the following user-configurable settings:

OptionTypeDefaultDescription`WRAP_LINES` (in `codeGen` namespace)`boolean``false`Enables line wrapping in the code editor for long generated code lines
The line wrapping is toggled in the UI:

typescript`const WRAP_LINES = useNestedSetting("WRAP_LINES", "codeGen")`
>
Source: [Codegen.vue - WRAP_LINES](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/Codegen.vue#L394)

## API Reference
### `generateCode(codegen: CodegenName, req: HoppRESTRequest): O.Option<string>`
The main function for generating code snippets.

**Purpose:** Converts a Hoppscotch REST request into a source code snippet for the specified target language/library.

**Parameters:**

- `codegen` (`CodegenName`): A valid codegen identifier from the `CodegenDefinitions` array (e.g., `"shell-curl"`, `"javascript-fetch"`, `"python-requests"`)
- `req` (`HoppRESTRequest`): The fully constructed REST request object

**Returns:** `O.Option<string>` — An fp-ts Option type:

- `O.Some<string>`: Contains the generated code string on success
- `O.None`: Returned when code generation fails

**Error Handling:**

- The function wraps `HTTPSnippet.convert()` in a try-catch block via `E.tryCatch`
- It validates the output is a string via `E.fromPredicate`
- Errors are logged to the console via `console.error`

>
Source: [new-codegen/index.ts - generateCode](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/new-codegen/index.ts#L207-L238)

### `buildHarRequest(req: HoppRESTRequest): Har.Request`
Converts a Hoppscotch request into HAR 1.2 format for consumption by HTTPSnippet.

**Parameters:**

- `req` (`HoppRESTRequest`): The request to convert

**Returns:** A `Har.Request` object with `postData` always populated (defaults to `mimeType: "x-unknown"` if no content type is set)

**Key details:**

- `headersSize` and `bodySize` are set to `-1` (calculated sizes not yet implemented)
- `httpVersion` is hardcoded to `"HTTP/1.1"`
- `cookies` is always an empty array

>
Source: [new-codegen/har.ts - buildHarRequest](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/new-codegen/har.ts#L146-L165)

### `getFinalURL(input: string): string`
Normalizes and validates a URL for code generation.

**Parameters:**

- `input` (`string`): The raw URL string

**Returns:** A normalized URL string

**Behavior:**

- Returns `"https://"` for empty input
- Fixes malformed protocols (e.g., `https :// ` → `https://`)
- Prepends `http://` for localhost or IP addresses without protocol
- Prepends `https://` for other domains without protocol
- Leaves `<<variable>>` patterns untouched

>
Source: [Codegen.vue - getFinalURL](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/Codegen.vue#L210-L237)

## Related Links

- [HTTP Request Builder](./10-import-and-export.1-import-curl)
- [Environment Variables](../6-environment-variables/6.1-overview)
- [Collections](../8-collections/8.1-overview)
- [HAR 1.2 Specification](http://www.softwareishard.com/blog/har-12-spec/)
- [HTTPSnippet Library (Kong)](https://github.com/Kong/httpsnippet)
- Source: [new-codegen/index.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/new-codegen/index.ts)
- Source: [new-codegen/har.ts](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/helpers/new-codegen/har.ts)
- Source: [Codegen.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/Codegen.vue)
- Source: [CodegenModal.vue](https://github.com/xiexb/hoppscotch/blob/main/packages/hoppscotch-common/src/components/http/CodegenModal.vue)