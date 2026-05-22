# Plan: 在接口URL上方添加 设计/调试/测试用例 三个模式Tab

## 目标

在 Hoppscotch 的 REST 请求面板中，URL地址栏上方添加三个模式切换Tab：
- **设计模式** — API设计与文档描述，参考 Apifox 文档模式，包含返回模型设计
- **调试模式** — 当前的默认模式，即现有的请求编辑+发送+响应查看流程
- **测试用例模式** — 针对当前API的测试用例展示与执行

## 当前上下文

### 布局结构
```
RequestTab.vue (请求标签页容器)
├── AppPaneLayout (rest-primary, 上下分割)
│   ├── #primary (上区)
│   │   ├── Request.vue (URL栏 + 方法 + 发送按钮) ← 新Tab插入位置在URL栏上方
│   │   └── RequestOptions.vue (Params/Body/Headers/Auth/Scripts/Tests 子Tab)
│   └── #secondary (下区)
│       └── Response.vue
```

### 关键文件
- `packages/hoppscotch-common/src/components/http/RequestTab.vue` — 请求标签页主容器
- `packages/hoppscotch-common/src/components/http/Request.vue` — URL栏组件
- `packages/hoppscotch-common/src/components/http/RequestOptions.vue` — 请求选项子Tab
- `packages/hoppscotch-data/src/rest/index.ts` — HoppRESTRequest 数据模型 (v18)
- `packages/hoppscotch-common/src/helpers/rest/document.ts` — HoppRequestDocument 标签页文档模型
- `packages/hoppscotch-common/src/components/collections/documentation/RequestPreview.vue` — 已有请求文档预览组件
- `packages/hoppscotch-common/locales/en.json` / `cn.json` — i18n翻译文件

### 数据模型现状
- `HoppRESTRequest` 已有 `description: string | null` (v17新增) 但UI几乎未暴露
- `HoppRESTRequest.responses` 存储 `Record<string, HoppRESTRequestResponse>` — 已有保存响应示例能力
- 尚无 "返回模型" (response schema/model) 字段 — 需新增
- 现有 test script 是 JavaScript 脚本式测试，非结构化测试用例

## 实现方案

### 架构设计

在 `RequestTab.vue` 的 #primary slot 内，URL栏(`Request.vue`)上方插入一个模式切换栏组件。切换模式时：
- **调试模式**: 显示现有 URL栏 + RequestOptions（即当前全部UI）
- **设计模式**: 隐藏 RequestOptions，显示 API 设计面板（描述编辑 + 返回模型设计 + 请求参数文档）
- **测试用例模式**: 隐藏 RequestOptions，显示测试用例列表与执行面板

模式状态存储在 `HoppRequestDocument` 中（持久化到标签页），默认为 `debug`。

### Step 1: 扩展数据模型 — 添加返回模型和测试用例

**文件**: `packages/hoppscotch-data/src/rest/index.ts`

1.1 新增 `HoppRESTResponseModel` 类型:
```typescript
export type HoppRESTResponseModel = {
  statusCode: string          // e.g. "200", "400"
  description: string         // 状态码描述
  headers: Array<{            // 响应头文档
    key: string
    description: string
  }>
  bodySchema: string          // JSON Schema 字符串，描述返回数据结构
  bodyExample: string         // 返回示例 JSON 字符串
}
```

1.2 在 `HoppRESTRequest` 中新增字段 (v19):
```typescript
responseModels: HoppRESTResponseModel[]  // 返回模型列表
```

1.3 新增 `HoppRESTTestCase` 类型:
```typescript
export type HoppRESTTestCase = {
  id: string
  name: string
  description: string
  requestOverride?: Partial<HoppRESTRequest>  // 可选：覆盖请求参数
  expectations: {
    statusCode?: number
    bodyContains?: string[]
    headerExists?: string[]
    jsonPath?: Array<{ path: string; value: string; operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt' }>
  }
}
```

1.4 在 `HoppRESTRequest` 中新增字段:
```typescript
testCases: HoppRESTTestCase[]
```

1.5 更新 verzod 版本 v17→v18→v19 的迁移链，添加默认值 `responseModels: []` 和 `testCases: []`

**文件**: `packages/hoppscotch-data/src/rest/v/19.ts` (新建)

### Step 2: 扩展标签页文档模型

**文件**: `packages/hoppscotch-common/src/helpers/rest/document.ts`

在 `HoppRequestDocument` 中新增:
```typescript
modePreference?: "debug" | "design" | "testcases"  // 默认 "debug"
```

更新 `RESTTabService` 的默认标签页创建逻辑，设置 `modePreference: "debug"`。

### Step 3: 创建模式切换栏组件

**文件**: `packages/hoppscotch-common/src/components/http/RequestModeTabs.vue` (新建)

```vue
<template>
  <div class="flex items-center border-b border-divider">
    <button
      v-for="mode in modes"
      :key="mode.id"
      :class="[currentMode === mode.id ? 'active-tab' : 'inactive-tab']"
      @click="emit('update:mode', mode.id)"
    >
      {{ mode.label }}
    </button>
  </div>
</template>
```

三个Tab: 设计 | 调试 | 测试用例

样式参考现有 `HoppSmartTabs` 的活跃/非活跃状态样式，但更醒目（全宽Tab）。

### Step 4: 修改 RequestTab.vue 布局

**文件**: `packages/hoppscotch-common/src/components/http/RequestTab.vue`

在 #primary slot 内：
```
之前: Request.vue → RequestOptions.vue
之后: RequestModeTabs.vue → Request.vue → [条件渲染]
       ├── debug → RequestOptions.vue (现有)
       ├── design → RequestDesignPanel.vue (新)
       └── testcases → RequestTestCasesPanel.vue (新)
```

URL栏(`Request.vue`)在所有模式下都显示（设计模式仍需看到endpoint）。
发送按钮在设计模式和测试用例模式下可隐藏或弱化显示。

### Step 5: 实现设计模式面板

**文件**: `packages/hoppscotch-common/src/components/http/RequestDesignPanel.vue` (新建)

布局参考 Apifox 文档模式，分为左右或上下区域：

**5.1 API基本信息区**
- API名称 (已有 `name` 字段，可编辑)
- API描述 (已有 `description` 字段，使用 MarkdownEditor 组件)
- 请求方法 + URL (只读展示，编辑仍在URL栏)

**5.2 请求参数文档区**
- Params — 展示 query 参数列表，每个参数有 `key` / `description` / `required` (新增required标记)
- Path Params — 展示路径参数，同上
- Headers — 展示请求头，同上
- Body — 展示请求体结构和描述
- Auth — 展示认证方式描述

**5.3 返回模型区 (核心新增)**
- 响应模型列表，每个模型包含:
  - 状态码 (如 200, 400, 404)
  - 描述
  - 响应头文档
  - Body Schema — JSON Schema 编辑器 (可使用 Monaco Editor + JSON Schema 格式)
  - Body Example — JSON 示例编辑
- 可添加/删除/编辑多个返回模型
- 支持从已有保存的响应(`responses`)导入生成返回模型

**5.4 复用现有组件**
- `collections/documentation/sections/` 下的各section组件可复用于只读展示
- `MarkdownEditor.vue` 可复用于描述编辑
- 参数编辑可复用 `SmartEnvInput` 和现有的kv编辑器模式

### Step 6: 实现测试用例模式面板

**文件**: `packages/hoppscotch-common/src/components/http/RequestTestCasesPanel.vue` (新建)

**6.1 测试用例列表**
- 展示当前API的所有测试用例 (`testCases` 数组)
- 每个用例显示: 名称、描述、断言数量、上次运行结果(pass/fail)
- 支持添加/删除/复制/编辑测试用例
- 支持全部运行 / 单个运行

**6.2 测试用例编辑器**
- 名称 + 描述
- 请求参数覆盖 (可选，覆盖当前请求的某些参数)
- 断言编辑:
  - 状态码断言
  - Body 包含文本断言
  - Header 存在断言
  - JSON Path 断言 (path + operator + value)

**6.3 测试结果展示**
- 复用现有 `TestResult.vue` / `TestResultEntry.vue` 组件
- 每个断言显示 pass/fail + 期望值 vs 实际值

**6.4 运行逻辑**
- 运行测试用例 = 用当前请求(或覆盖后的请求) 发送 + 执行断言检查
- 使用现有的 `runRESTRequest$()` 执行请求
- 断言在客户端执行（不依赖test script引擎）

### Step 7: i18n 国际化

**文件**: `packages/hoppscotch-common/locales/en.json`

新增键值:
```json
{
  "request_mode.debug": "Debug",
  "request_mode.design": "Design", 
  "request_mode.testcases": "Test Cases",
  "request_mode.design.description": "Description",
  "request_mode.design.response_model": "Response Model",
  "request_mode.design.response_model.add": "Add Response Model",
  "request_mode.design.response_model.status_code": "Status Code",
  "request_mode.design.response_model.schema": "Schema",
  "request_mode.design.response_model.example": "Example",
  "request_mode.testcase.add": "Add Test Case",
  "request_mode.testcase.run_all": "Run All",
  "request_mode.testcase.assertions": "Assertions",
  "request_mode.testcase.expect_status": "Expect Status Code",
  "request_mode.testcase.expect_body_contains": "Body Contains",
  "request_mode.testcase.expect_header_exists": "Header Exists",
  "request_mode.testcase.expect_json_path": "JSON Path Assertion"
}
```

**文件**: `packages/hoppscotch-common/locales/cn.json`

```json
{
  "request_mode.debug": "调试",
  "request_mode.design": "设计",
  "request_mode.testcases": "测试用例",
  "request_mode.design.description": "描述",
  "request_mode.design.response_model": "返回模型",
  "request_mode.design.response_model.add": "添加返回模型",
  "request_mode.design.response_model.status_code": "状态码",
  "request_mode.design.response_model.schema": "数据结构",
  "request_mode.design.response_model.example": "返回示例",
  "request_mode.testcase.add": "添加测试用例",
  "request_mode.testcase.run_all": "全部运行",
  "request_mode.testcase.assertions": "断言",
  "request_mode.testcase.expect_status": "期望状态码",
  "request_mode.testcase.expect_body_contains": "Body 包含",
  "request_mode.testcase.expect_header_exists": "Header 存在",
  "request_mode.testcase.expect_json_path": "JSON Path 断言"
}
```

## 文件变更清单

| 操作 | 文件路径 |
|------|----------|
| 修改 | `packages/hoppscotch-data/src/rest/index.ts` — 添加 v19 字段 |
| 新建 | `packages/hoppscotch-data/src/rest/v/19.ts` — v19 迁移 |
| 修改 | `packages/hoppscotch-common/src/helpers/rest/document.ts` — 添加 modePreference |
| 新建 | `packages/hoppscotch-common/src/components/http/RequestModeTabs.vue` |
| 修改 | `packages/hoppscotch-common/src/components/http/RequestTab.vue` |
| 新建 | `packages/hoppscotch-common/src/components/http/RequestDesignPanel.vue` |
| 新建 | `packages/hoppscotch-common/src/components/http/RequestTestCasesPanel.vue` |
| 新建 | `packages/hoppscotch-common/src/components/http/ResponseModelEditor.vue` |
| 新建 | `packages/hoppscotch-common/src/components/http/TestCaseEditor.vue` |
| 新建 | `packages/hoppscotch-common/src/components/http/AssertionEditor.vue` |
| 修改 | `packages/hoppscotch-common/locales/en.json` |
| 修改 | `packages/hoppscotch-common/locales/cn.json` |

## 验证步骤

1. `pnpm run dev` 启动开发服务器，确认无编译错误
2. 打开一个 REST 请求，确认URL栏上方出现三个Tab
3. 调试模式: 行为与现有完全一致，无回归
4. 设计模式: 
   - 可编辑API描述(markdown)
   - 可添加/编辑/删除返回模型
   - 返回模型可编辑状态码、描述、JSON Schema、示例
   - 切换到其他Tab再切回，数据保留
5. 测试用例模式:
   - 可添加/编辑/删除测试用例
   - 可添加断言(状态码/Body包含/Header/JSON Path)
   - 单个运行测试用例，查看结果
   - 全部运行，查看结果
6. 保存请求后重新加载，确认新字段(responseModels/testCases)持久化
7. 切换主题(light/dark)，确认新组件正确使用语义化颜色类

## 风险与权衡

1. **数据模型升级 (v18→v19)**: 需确保向后兼容。新字段 `responseModels` 和 `testCases` 默认为空数组，旧数据加载时自动迁移，风险低。

2. **返回模型 vs 现有 responses 字段**: `responses` 存储实际保存的响应(含真实body)，`responseModels` 存储设计的返回模型(含schema)。两者语义不同但可能造成用户困惑。建议在设计模式面板中提供"从已有响应导入"功能，将 `responses` 中的数据自动转换为 `responseModels`。

3. **测试用例 vs 现有 testScript**: 现有 `testScript` 是 JavaScript 脚本，新的 `testCases` 是结构化断言。两者并存可能造成概念重叠。建议:
   - 在测试用例Tab中同时展示结构化用例和脚本式测试
   - 长期可考虑让结构化用例生成对应testScript

4. **性能**: 设计模式和测试用例面板在首次渲染时可能增加JS bundle大小。建议使用 `defineAsyncComponent` 懒加载。

5. **Apifox参考**: Apifox的设计模式还包含"接口分组"、"版本管理"等高级功能。首期仅实现核心的描述+返回模型，后续迭代再扩展。

## 实施顺序

建议按以下顺序分步实施:

**Phase 1 — 基础架构** (Step 1-4)
- 数据模型扩展 + 模式切换Tab + RequestTab布局修改
- 此阶段完成后可看到三个Tab切换，但设计和测试用例面板为空

**Phase 2 — 设计模式** (Step 5)
- 实现API描述编辑 + 返回模型编辑器
- 这是最核心的新功能

**Phase 3 — 测试用例模式** (Step 6)
- 实现测试用例列表 + 断言编辑 + 运行逻辑

**Phase 4 — i18n + 打磨** (Step 7)
- 完善中文翻译
- 主题适配
- 从已有响应导入返回模型
- 懒加载优化
