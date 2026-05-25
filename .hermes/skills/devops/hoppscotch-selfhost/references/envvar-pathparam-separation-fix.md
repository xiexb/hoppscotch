# Env Var / Path Param Separation Fix

**Date**: 2026-05-22
**Commit**: fix: <<variable>> should only resolve from env vars, not pathParams

## Problem

When a `<<variable>>` in the request body (or headers, params, URL) had the same
name as a path parameter `{variable}`, the actual request used the path parameter
value instead of the environment variable value.

Example: URL = `/api/{userId}`, body = `{"id": "<<userId>>"}`, pathParam userId=42,
env var userId=99. The body would be sent as `{"id": "42"}` instead of `{"id": "99"}`.

## Root Cause

`getEffectiveRESTRequest()` in `EffectiveURL.ts` (line ~391-408) merged pathParams
into the environment variables array with higher priority:

```typescript
const activePathParams: EnvironmentVariable[] = (request.pathParams ?? [])
  .filter((p) => p.key !== "" && p.active)
  .map((p) => ({
    key: p.key, value: p.value,
    initialValue: p.value, currentValue: p.value, secret: false,
  }))

const mergedEnvVars = [...activePathParams, ...environment.variables]
```

`parseTemplateString()` uses `variables.find(x => x.key === p1)` which returns the
FIRST match. Since pathParams were prepended to the array, they took priority over
environment variables when names collided.

The same pattern existed in CLI's `getResolvedVariables()` (getters.ts) where
`activePathParams` was prepended to the returned array.

## Fix

**4 files changed:**

### 1. `packages/hoppscotch-common/src/helpers/utils/EffectiveURL.ts`
- Removed `activePathParams` construction and `mergedEnvVars` merge
- Changed all `mergedEnvVars` references to `envVars` (= `environment.variables` only)
- Removed unused `EnvironmentVariable` import
- `replacePathParams()` still handles `{var}` separately after `parseTemplateString()`

### 2. `packages/hoppscotch-cli/src/utils/getters.ts`
- Renamed `pathParams` parameter to `_pathParams` (unused, kept for API compat)
- Removed `activePathParams` construction and merge into return array
- Removed `pathParamKeys` from the filter that excludes env vars

### 3. `packages/hoppscotch-cli/src/__tests__/functions/pre-request/getEffectiveRESTRequest.spec.ts`
- Fixed test: `<<USER_ID>>` in body should resolve from env var (99), not pathParam (42)
- Updated "PathParams take priority" test to reflect correct behavior
- Added new test: "<<var>> in body resolves from env vars, not pathParams"

### 4. `packages/hoppscotch-cli/src/__tests__/unit/getters.spec.ts`
- Updated `getResolvedVariables` expected output: pathParams no longer in result

## Correct Behavior After Fix

| Scenario | Before Fix | After Fix |
|----------|-----------|-----------|
| URL `{userId}` + pathParam=42 | Might not work | → 42 (replacePathParams) |
| `<<userId>>` + pathParam=42 + env=99 | → 42 (wrong) | → 99 (env only) |
| Body `<<userId>>` + pathParam=42 + env=99 | → 42 (wrong) | → 99 (env only) |
| Header `<<userId>>` + pathParam=42 + env=99 | → 42 (wrong) | → 99 (env only) |

## Architecture Principle

The template resolution pipeline has two separate stages:

1. **`parseTemplateString(vars)`** — resolves `<<var>>` from `environment.variables` ONLY
2. **`replacePathParams(params)`** — resolves `{var}` from `request.pathParams` ONLY

These two must NEVER share a lookup array. Merging pathParams into envVars breaks
the `<<>>` vs `{}` contract and causes silent value substitution bugs.

## Follow-up Fixes (2026-05-22)

### Body missing replacePathParams()

`getEffectiveRESTRequest()` applied `replacePathParams()` to URL, headers, params,
and requestVariables — but forgot `effectiveFinalBody`. Body content with `{var}`
was never resolved, causing "Unresolved templates detected" false warnings.

Fix: apply `replacePathParams()` to string-type bodies after `getFinalBodyFromRequest()`:
```ts
const effectiveFinalBody =
  typeof raw === "string" ? replacePathParams(raw, pathParamsList) : raw
```

FormData/Blob bodies are left unchanged (path params don't apply to binary).

### Path param regex too broad

`REGEX_PATH_PARAM = /\{([^}]+)\}/g` matched ANY content inside braces, including
JSON like `{"key": "value"}`. This caused:
- `replacePathParams()` to try replacing JSON braces (no match found, left as-is but wasteful)
- `hasTemplate()` in ActualRequestRenderer to falsely detect unresolved templates on every JSON body request

Fix: use `/\{([a-zA-Z0-9_.-]+)\}/g` — same character class as env var names.
Only matches `{variable_name}` patterns, not JSON with colons/quotes/spaces.

Three locations must stay in sync:
1. `REGEX_PATH_PARAM` in `EffectiveURL.ts`
2. `HOPP_PATH_PARAM_REGEX` in `environment-regex.ts`
3. `PATH_PARAM_RE` in `ActualRequestRenderer.vue`
