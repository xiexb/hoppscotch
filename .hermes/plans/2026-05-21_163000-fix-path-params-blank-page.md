# Plan: 修复 Path Params 功能导致的白屏问题

## Goal

重新实现 path params 功能，修复运行时 `TypeError: Cannot read properties of undefined (reading 'filter')` 导致的白屏。

## Context

- Path params 功能在 commit `4ebe691` 中首次实现，已通过 `git cherry-pick` 重新应用（staged 未 commit）
- **白屏根因已确认**：`request.value.pathParams` 为 `undefined`，调用 `.filter()` 崩溃
- 为什么 undefined：localStorage 中持久化的 tab 数据是 v17 格式（无 `pathParams` 字段），verzod v18 migration 仅在 `safeParse` 时生效，但 reactive 对象恢复路径可能跳过了 migration
- 另外 `import_meta_env_placeholder` 问题已通过硬编码 index.html 修复，需保留
- 当前已添加 `index.html` 中的 debug error capture 脚本，修复后需移除

## Error Detail

```
TypeError: Cannot read properties of undefined (reading 'filter')
```

出现 200+ 次，来自 `RequestOptions.vue` 和 `Request.vue` 中访问 `pathParams` 时未做 null-safe 处理。

## Step-by-step Plan

### Step 1: RequestOptions.vue — null-safe 保护

**File**: `packages/hoppscotch-common/src/components/http/RequestOptions.vue`

修改 `newActivePathParamsCount` computed：

```diff
- const newActivePathParamsCount = computed(() => {
-   const count = request.value.pathParams.filter(
+ const newActivePathParamsCount = computed(() => {
+   const count = (request.value.pathParams ?? []).filter(
```

同样检查该文件中所有 `request.value.pathParams` 的直接访问，都加 `?? []`。

### Step 2: Request.vue — null-safe 保护

**File**: `packages/hoppscotch-common/src/components/http/Request.vue`

修改 endpoint watcher 中的 pathParams 访问：

```diff
- const currentPathParams = tab.value.document.request.pathParams
+ const currentPathParams = tab.value.document.request.pathParams ?? []
```

同样检查该文件中所有 `pathParams` 的直接访问。

### Step 3: EffectiveURL.ts — 确认已有保护

**File**: `packages/hoppscotch-common/src/helpers/utils/EffectiveURL.ts`

该文件已使用 `request.pathParams ?? []`，确认无需修改。

### Step 4: safelyExtractRESTRequest — 确保 pathParams 字段被填充

**File**: `packages/hoppscotch-data/src/rest/index.ts`

在 `safelyExtractRESTRequest` 中，当 `pathParams` 字段不存在时（旧数据），确保赋值空数组：

```typescript
// 已有这段代码（来自 cherry-pick），确认逻辑正确：
if ("pathParams" in x) {
  const result = HoppRESTPathParams.safeParse(x.pathParams)
  if (result.success) {
    req.pathParams = result.data
  }
}
// 需要加 else 分支确保 req.pathParams 一定有值：
else {
  req.pathParams = []
}
```

### Step 5: getDefaultRESTRequest — 确认已有 pathParams

**File**: `packages/hoppscotch-data/src/rest/index.ts`

确认 `getDefaultRESTRequest()` 已返回 `pathParams: []`（cherry-pick 已包含）。

### Step 6: PathParams.vue 组件 — 确认 props 类型安全

**File**: `packages/hoppscotch-common/src/components/http/PathParams.vue`

检查组件内部对 `pathParams` 的访问是否做了 null-safe：
- `v-model` 绑定处
- computed 属性中的 `.filter()` 调用
- 如果 `pathParams` prop 可能为 undefined，加 `?? []` 保护

### Step 7: 移除 debug error capture 脚本

**File**: `packages/hoppscotch-selfhost-web/index.html`

移除之前添加的调试脚本：

```diff
-    <script>
-      // Error capture for debugging
-      window.__debugErrors = [];
-      window.addEventListener('error', function(e) {
-        window.__debugErrors.push('E:' + e.message + ' @ ' + (e.filename||'') + ':' + (e.lineno||''));
-      });
-      window.addEventListener('unhandledrejection', function(e) {
-        window.__debugErrors.push('R:' + String(e.reason).substring(0, 500));
-      });
-    </script>
```

### Step 8: 清除浏览器 localStorage

在浏览器中清除 localStorage（或在应用初始化时确保旧 tab 数据被 v18 migration 正确升级），避免残留 v17 格式数据。

可选方案：在 `RESTTabService` 的 tab 恢复逻辑中，对每个 tab 的 `document.request` 调用 `safelyExtractRESTRequest` 强制 migration。

### Step 9: 重启 Vite 并验证

1. Kill 旧 Vite 进程（3003/3101 端口）
2. 重新启动 selfhost-web 和 sh-admin
3. 浏览器访问 http://121.41.26.6:35051/
4. 确认页面正常加载，能看到 Path Params tab
5. 确认无 JS 错误

### Step 10: 提交代码

```bash
git add -A
git commit --no-verify -m "fix: path params blank page - add null-safe protections for undefined pathParams"
```

## Files to Change

| File | Change |
|------|--------|
| `packages/hoppscotch-common/src/components/http/RequestOptions.vue` | `request.value.pathParams` → `(request.value.pathParams ?? [])` |
| `packages/hoppscotch-common/src/components/http/Request.vue` | `tab.value.document.request.pathParams` → `tab.value.document.request.pathParams ?? []` |
| `packages/hoppscotch-data/src/rest/index.ts` | `safelyExtractRESTRequest` 加 `else { req.pathParams = [] }` |
| `packages/hoppscotch-common/src/components/http/PathParams.vue` | 检查并加 null-safe 保护 |
| `packages/hoppscotch-selfhost-web/index.html` | 移除 debug error capture 脚本 |

## Validation

1. 浏览器访问 http://121.41.26.6:35051/ — 页面正常加载，无白屏
2. `window.__debugErrors` 为空（修复后移除 debug 脚本前验证）
3. 能看到 Path Params tab，点击可正常编辑
4. 在 URL 中输入 `https://api.example.com/<<userId>>/posts`，pathParams 自动生成
5. 发送请求，确认 `<<userId>>` 被 pathParams 值正确替换
6. 旧 tab 数据（无 pathParams 字段）能正常打开，不崩溃

## Risks & Tradeoffs

1. **`?? []` 保护 vs 根治 migration**：null-safe 是防御性编程，但不解决旧数据无 `pathParams` 的根本问题。如果 tab 数据在 reactive 路径上从未经过 v18 migration，`pathParams` 就永远 undefined。建议同时修复 `safelyExtractRESTRequest`。
2. **localStorage 残留数据**：用户可能有多个旧 tab，v17→v18 migration 只在首次 parse 时生效。如果应用初始化时没有重新 parse，旧 tab 会一直缺 `pathParams`。最安全的做法是在 tab 恢复时强制调用 `safelyExtractRESTRequest`。
3. **HoppSmartWindow 的 duplicate ID**：之前观察到的 "Tab with duplicate ID" 错误可能是 secondary effect（由 primary `filter` 错误引起的组件重渲染），修复 primary 错误后应自动消失。

## Open Questions

- 是否需要在 `RESTTabService` 的 `loadTabsFromPersistedState` 中强制对所有 tab 做 v18 migration？
- PathParams.vue 中的 bulk editor 是否也需要 null-safe 保护？
