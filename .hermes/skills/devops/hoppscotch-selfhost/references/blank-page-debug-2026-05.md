# Blank Page Debug Session (2026-05-21)

## Scenario
Page at http://121.41.26.6:35051/ was blank/white after adding path params feature.

## Root Causes (four stacked)

### 1. import_meta_env_placeholder (P19)
- `@import-meta-env/unplugin` was gated by `process.env.HOPP_ALLOW_RUNTIME_ENV`
- Even with env var set, plugin's relative path `"../../.env.example"` resolved from CWD
  (`/home/jcwl/`) instead of from vite.config.ts location, so it silently failed
- Fix: remove conditional guard, use `path.resolve(__dirname, ...)` absolute paths,
  hardcode env JSON in index.html as fallback

### 2. TypeError: Cannot read properties of undefined (reading 'filter') (P20)
- Commit `4ebe691` added `pathParams` field to `HoppRESTRequest` (v17→v18 migration)
- `getDefaultRESTRequest()` included `pathParams: []`, but persisted tab data in
  localStorage was still v17 format (no `pathParams` field)
- `safelyExtractRESTRequest()` only sets `req.pathParams` when `"pathParams" in x`
  (old data doesn't have the key), so the reactive object had `pathParams: undefined`
- Multiple computed properties and watchers accessed `.filter()` on undefined → crash

**Fix applied in 4 files**:

1. **RequestOptions.vue** — computed property:
   ```ts
   const count = (request.value.pathParams ?? []).filter(x => x.active).length
   ```

2. **Request.vue** — watcher:
   ```ts
   const currentPathParams = tab.value.document.request.pathParams ?? []
   ```

3. **safelyExtractRESTRequest()** in `hoppscotch-data/src/rest/index.ts`:
   ```ts
   if ("pathParams" in x) {
     const result = HoppRESTPathParams.safeParse(x.pathParams)
     if (result.success) { req.pathParams = result.data }
   } else {
     req.pathParams = []  // old data won't have this key
   }
   ```

4. **PathParams.vue** — useVModel initialization:
   ```ts
   const params = useVModel(props, "modelValue", emit)
   if (!params.value) { params.value = [] }
   ```

### 3. Tab with duplicate ID from `render-inactive-tabs` (P22) — PRIMARY CRASH
- After fixing the TypeError above, page STILL showed blank request options area
- `HoppSmartTabs` in `RequestOptions.vue` had `render-inactive-tabs` attribute
- This caused all `HoppSmartTab` children to mount simultaneously
- During Vue component patching, new tab components mount BEFORE old ones unmount
- `addTabEntry('params')` fires while old 'params' entry still exists → throws
  `Error: Tab with duplicate ID created: 'params'` → crashes component tree

**This was the ACTUAL primary crash** that prevented the request options from rendering.
The TypeError from P20 was necessary to fix but not sufficient.

**Fix**: Remove `render-inactive-tabs` from `HoppSmartTabs`:
```html
<!-- BEFORE (crashes): -->
<HoppSmartTabs v-model="selectedOptionTab" render-inactive-tabs ...>
<!-- AFTER (stable): -->
<HoppSmartTabs v-model="selectedOptionTab" ...>
```

### 4. git revert restored default ports (P10)
- After reverting `4ebe691`, ports went back to 3000/3100 (from custom 3003/3101)
- Required re-application of all vite.config.ts modifications

## Key Debugging Techniques

1. **browser_console errors had empty messages** — 200+ JS exceptions all showed
   `"message": "", "source": "exception"`. Fix: inject error-listener script in
   `index.html` BEFORE module scripts:
   ```html
   <script>
     window.__debugErrors = [];
     window.addEventListener('unhandledrejection', function(e) {
       window.__debugErrors.push('R:' + String(e.reason).substring(0, 500));
     });
   </script>
   ```
   This captured: `R:Error: Tab with duplicate ID created: 'params'`

2. **Vue app mounted but rendered nothing** — `__vue_app__` existed, router resolved
   to `/`, but RouterView's DOM element had `inDocument: false`. This pattern
   (vnode exists, DOM not inserted) indicates runtime errors during mounting.

3. **git revert + cherry-pick workflow** — To test if a specific commit caused the issue:
   ```bash
   git stash
   git revert --no-commit <SHA>  # test without the commit
   # verify page works → confirms the commit is the cause
   git checkout .                 # undo the revert
   git stash pop                  # restore local modifications
   git cherry-pick --no-commit <SHA>  # re-apply, then fix
   ```

4. **Diagnosis order matters** — When both TypeError AND "duplicate ID" errors are
   present, fix the TypeError first (it produces noise that obscures other errors),
   then re-test. The duplicate ID error may only become visible (or only occur)
   after the TypeError is fixed and components survive long enough to re-render.

5. **useVModel + undefined props** — When a Vue component receives `v-model` binding
   for a field that doesn't exist on the parent's reactive object (e.g., `pathParams`
   on old persisted tab data), `useVModel()` returns `undefined`. Must initialize.

## Resolution

Fixes applied in order:
1. Null-safe guards in 4 files (P20) — eliminated TypeError cascade
2. Removed `render-inactive-tabs` from RequestOptions.vue (P22) — eliminated duplicate ID crash
3. Re-applied vite.config.ts port/host modifications (P10)

After all three fixes, page loads with 0 errors. Path Params tab visible between
Parameters and Body tabs.

Commits:
- `9d5846c revert: path params feature causing blank page + fix import_meta_env_placeholder`
- `b8c2ca2 feat: add path parameters with null-safe fix`
- `6cfbfe4 fix: remove render-inactive-tabs to resolve duplicate tab ID error`

---

## Session 2: Blank page after inspector path params update (2026-05-21)

### Scenario
After updating the inspector to check pathParam values (commit `e0c2bab`), the entire
Hoppscotch page was blank — not just the inspect sidebar, but the whole app failed to mount.

### Root Cause: Circular dependency in hoppscotch-data dist (P23)

`rest-request-response/original-request/v/7.ts` imported `HoppRESTPathParams` from
`rest/v/18.ts`. This created a circular import chain that caused Rollup to emit the
minified schema variable (`ol`) at line 5855 in the dist, while its first usage was at
line 5439. Runtime: `ReferenceError: Cannot access 'ol' before initialization`.

The error occurred during ES module initialization — before Vue even started. Standard
`browser_console` tool showed only empty-message exceptions. The app appeared as a
completely blank white page.

### Diagnosis

Dynamic `import()` in browser console surfaced the actual error:
```js
import('/@fs/.../hoppscotch-common/src/index.ts')
  .then(m => 'ok')
  .catch(e => e.message);
// → "Cannot access 'ol' before initialization"
// Stack trace pointed to hoppscotch-data.js:5439
```

Then verified in dist:
```bash
grep -n 'ol = \|ol\.extend' dist/hoppscotch-data.js
# 5439: }), Qu = ol.extend({       ← USAGE
# 5855: const ol = il.extend({     ← DEFINITION (after usage = BUG)
```

### Fix

Extracted `HoppRESTPathParams` into a standalone `v/18/params.ts` file (no version-chain
imports). Changed `original-request/v/7.ts` to import from `params.ts` instead of
`v/18/index.ts`. Rebuilt `hoppscotch-data` (`pnpm build`). After rebuild:
```bash
grep -n 'ol = \|ol\.extend' dist/hoppscotch-data.js
# 5844: }), ol = il.extend({       ← DEFINITION (before usage = CORRECT)
# 5857: }), ay = ol.extend({       ← USAGE
```

Commit: `dd28e61 fix: resolve circular dependency in hoppscotch-data causing blank page`
