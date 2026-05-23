# Documentation Mode
Hoppscotch 的文档模式（Documentation Mode）为 API 提供了可视化的文档编写和预览能力。它由两个核心视图组成：**设计模式**（Design Mode）用于在请求编辑器中以可视化方式定义 API 的响应模型和 Schema，**文档预览模式**（Documentation Preview）用于以类似 API 文档的形式展示集合和请求的完整信息。

## 概述
文档模式旨在让开发者在设计 API 时就能同步编写文档，而非事后补充。核心思路是：

- **设计模式**（Design/Edit）：在请求 Tab 中切换到设计模式，通过可视化 Schema 树编辑器定义响应结构、状态码、请求参数等，所有修改直接保存到 `HoppRESTRequest.responseModels` 中。
- **文档预览**（Documentation Preview）：从集合侧边栏打开文档弹窗，以只读形式展示请求的完整文档，包括 Markdown 描述、请求参数、鉴权信息、响应示例等。

两者共享同一套数据模型（`HoppRESTResponseModelV20`、`HoppRESTSchemaNode`），但组件和交互完全分离。

### 关键概念

- **HoppRESTSchemaNode**：可视化 JSON Schema 编辑的树节点，支持 object/string/integer/number/boolean/array/file 七种类型，递归嵌套。
- **HoppRESTResponseModelV20**：扩展的响应模型，包含 statusCode、description、headers、bodySchema、bodyExample、bodySchemaTree、contentType。
- **双数据源兼容**：文档预览同时支持从 `responseModels`（v20 新数据源）和 `responses`（v8 遗留数据源）读取响应示例，优先使用 `responseModels`。
- **DocumentationService**：Dioc 服务，临时存储编辑中的 Markdown 文档内容（集合/请求描述），不处理 responseModels。

## 架构
### 组件树
文档模式涉及两套组件体系，分别用于设计和预览：

```
RequestDesignPanel.vue (设计/调试模式切换面板)
├── [subMode === 'edit']
│   ├── HttpRequest.vue (URL 栏)
│   ├── EditView.vue (设计编辑视图)
│   │   ├── MetaInfoSection.vue (描述/标签/负责人/基础URL)
│   │   ├── RequestOptions.vue (鉴权/参数/请求体/请求头)
│   │   └── ResponseSection.vue (响应模型管理)
│   │       ├── SchemaTreeEditor.vue (Schema 树编辑器)
│   │       │   └── SchemaTreeRow.vue[] (行组件)
│   │       └── JsonExampleBlock.vue (JSON 示例)
│   └── StatusBadge.vue (API 状态标识)
└── [subMode === 'preview']
    └── PreviewView.vue (设计预览视图)
        ├── SchemaTreeReadonly.vue[] (只读 Schema 树)
        └── JsonExampleBlock.vue (JSON 示例)

DocumentationModal (index.vue) (文档模式弹窗)
├── CollectionStructure.vue (集合结构导航)
├── Preview.vue (文档预览容器)
│   ├── CollectionPreview.vue (集合文档)
│   └── RequestPreview.vue (请求文档)
│       ├── MarkdownEditor.vue (Markdown 编辑器)
│       ├── sections/CurlView.vue (cURL 命令)
│       ├── sections/Auth.vue (鉴权信息)
│       ├── sections/Headers.vue (请求头)
│       ├── sections/Parameters.vue (查询参数)
│       ├── sections/PathParams.vue (路径参数)
│       ├── sections/Variables.vue (请求变量)
│       ├── sections/RequestBody.vue (请求体)
│       └── sections/Response.vue (响应展示)
│           ├── SchemaTreeReadonly.vue[] (只读 Schema 树)
│           └── JsonExampleBlock.vue (JSON 示例)
├── PublishDocModal.vue (发布文档弹窗)
│   ├── PublishDocForm.vue (发布表单)
│   └── PublishDocSnapshotPreview.vue (快照预览)
└── EnvironmentPicker.vue (环境选择器)
```

### 数据流
```
[编辑模式] ResponseSection.vue
  → emit('update:request', { ...request, responseModels: [...] })
  → EditView.vue
  → RequestDesignPanel.vue (request.value = updated)
  → saveRequest() 序列化整个 HoppRESTRequest 对象

[预览模式] RequestPreview.vue
  → getResponseExamples() 读取 responseModels，回退到 responses
  → sections/Response.vue 接收 responseExamples prop
  → 当 bodySchemaTree 存在时: SchemaTreeReadonly + JsonExampleBlock 双栏布局
  → 当 bodySchemaTree 缺失时: body/headers Tab 传统布局
```

### 服务层
- **DocumentationService**（`documentation.service.ts`）：Dioc 服务，管理文档编辑暂存和发布状态。
  - 使用 `Map<string, DocumentationItem>` 临时存储编辑中的文档内容
  - 仅处理 Markdown 描述文本，**不处理 responseModels**
  - 支持 `setCollectionDocumentation()` / `setRequestDocumentation()` 写入
  - 支持 `getDocumentation()` / `getChangedItems()` 读取
  - 管理 `publishedDocsMap` 跟踪已发布文档状态
  - 支持 `fetchUserPublishedDocs()` / `fetchTeamPublishedDocs()` 从后端拉取

## 数据模型
### HoppRESTResponseModelV20
v20 版本扩展的响应模型定义（`packages/hoppscotch-data/src/rest/v/20/index.ts`）：

```typescript
export const HoppRESTResponseModelV20 = z.object({
  statusCode: z.string().catch("200"),       // HTTP 状态码（字符串形式）
  description: z.string().catch(""),          // 响应描述（如 "成功"、"未找到"）
  headers: z.array(z.object({
    key: z.string().catch(""),
    description: z.string().catch(""),        // 注意：设计模式下 value 存储在 description 字段
  })).catch([]),
  bodySchema: z.string().catch(""),           // JSON Schema 字符串（原始）
  bodyExample: z.string().catch(""),          // JSON 示例字符串
  bodySchemaTree: z.array(z.any()).nullable().catch(null), // 可视化 Schema 树
  contentType: z.string().catch("application/json"),        // 内容类型
})
```

与 v19 的 `HoppRESTResponseModel` 相比，v20 新增了 `bodySchemaTree` 和 `contentType` 两个字段。`bodySchemaTree` 为 `null` 时表示该响应模型由旧版迁移而来，尚未通过可视化编辑器编辑。

### HoppRESTSchemaNode
可视化 Schema 树的节点类型（`packages/hoppscotch-data/src/rest/v/20/index.ts`）：

```typescript
export type HoppRESTSchemaNode = {
  name: string            // 字段名
  type: "object" | "string" | "integer" | "number" | "boolean" | "array" | "file"
  mock: string            // Mock 值（用于生成示例）
  displayName: string     // 显示名称
  description: string     // 字段描述
  required: boolean       // 是否必填
  children: HoppRESTSchemaNode[]  // 子节点（object/array 类型使用）
}
```

`SchemaTreeEditor` 组件递归地渲染和编辑此结构，`SchemaTreeReadonly` 组件递归地只读展示。

### 双数据源：responseModels vs responses
`HoppRESTRequest` 上存在两套响应数据：

| 属性 | 来源 | 类型 | 说明 |
|------|------|------|------|
| `request.responseModels` | v19/v20 设计模式 | `HoppRESTResponseModelV20[]` | 结构化数组，含 bodySchemaTree、contentType |
| `request.responses` | v8 遗留格式 | `Record<string, HoppRESTRequestResponse>` | 以名称为键的对象映射，值含 code/headers/body |

文档预览的 `getResponseExamples()` 函数优先读取 `responseModels`，仅当其为空时才回退到 `responses`。

## 编辑模式
### ResponseSection 组件
`ResponseSection.vue`（`components/http/design/`）是设计模式下响应编辑的核心组件。

**功能**：
- 管理当前请求的 `responseModels` 数组（增删改）
- 以状态码 Tab 形式切换不同响应模型
- 每个模型可编辑：HTTP 状态码、描述名称、内容格式（JSON/XML/HTML/Text）
- 内嵌 SchemaTreeEditor 编辑响应体的 Schema 树
- 内嵌 JsonExampleBlock 编辑/预览 JSON 示例

**数据流**：
```
ResponseSection.vue
  → 内部维护 activeModel 指向当前选中的 responseModels 索引
  → 修改时通过 emit('update:request', { ...request, responseModels: [...] }) 向上传递
  → EditView.vue → RequestDesignPanel.vue → saveRequest()
```

### SchemaTreeEditor 组件
`SchemaTreeEditor.vue` 提供可视化 Schema 树的编辑能力：

- 根节点固定为 object 类型
- 每个字段通过 `SchemaTreeRow.vue` 渲染，支持：
  - 修改字段名（name）、类型（type）、Mock 值（mock）、描述（description）、是否必填（required）
  - 添加子字段（object/array 类型）
  - 删除字段
  - 折叠/展开子树
- 新增字段默认类型为 string，自动生成占位名称

### JsonExampleBlock 组件
`JsonExampleBlock.vue` 提供 JSON 示例代码块：

- 语法高亮显示
- 支持可编辑模式（设计模式）和只读模式（预览模式）
- 复制到剪贴板功能
- 自动根据 Schema 树生成示例（通过 `generateExampleFromSchema`）

### 保存流程
1. 用户在 ResponseSection 中编辑响应模型
2. ResponseSection 通过 `emit('update:request')` 将整个修改后的 `HoppRESTRequest` 对象向上传递
3. EditView 将更新传递给 RequestDesignPanel
4. RequestDesignPanel 更新 `request.value`
5. 用户点击保存按钮时，`saveRequest()` 将整个请求对象（包含 `responseModels`）序列化并持久化

> **注意**：responseModels 的保存走的是标准请求保存流程，**不经过 DocumentationService**。DocumentationService 仅管理 Markdown 描述文本。

## 预览模式
### 文档模式入口
从集合侧边栏打开文档弹窗（`collections/documentation/index.vue`），弹窗左侧为 `CollectionStructure` 导航树，右侧为 `Preview` 容器，根据选中项显示 `CollectionPreview` 或 `RequestPreview`。

### RequestPreview 组件
`RequestPreview.vue` 是文档预览的核心组件，展示单个请求的完整文档：

**布局**：
1. 请求方法标识 + 请求名称 + 在新标签页打开按钮
2. 完整 URL（经过环境变量解析）
3. Markdown 编辑器（支持编辑/预览切换，blur 时保存到 DocumentationService）
4. 各 section 组件：CurlView、Auth、Headers、Parameters、PathParams、Variables、RequestBody
5. Response section（由 `sections/Response.vue` 渲染）

**关键实现 — getResponseExamples()**：
```typescript
function getResponseExamples(): ResponseExample[] | null {
  if (!props.request) return null

  const examples: ResponseExample[] = []

  // 优先级 1: 从 v20 responseModels 读取（设计模式数据）
  const responseModels = (props.request as any)
    .responseModels as HoppRESTResponseModelV20[] | undefined

  if (responseModels && responseModels.length > 0) {
    for (const model of responseModels) {
      examples.push({
        name: model.description || `Status ${model.statusCode}`,
        statusCode: parseInt(model.statusCode, 10) || 200,
        headers: (model.headers || []).map((h) => ({
          key: h.key,
          value: h.description,  // 注意: 设计模式下 value 存储在 description 字段
        })),
        body: model.bodyExample || model.bodySchema || "",
        contentType: model.contentType || "application/json",
        bodySchemaTree: model.bodySchemaTree,
      })
    }
  }

  // 优先级 2: 回退到遗留 responses 字段
  if (examples.length === 0) {
    const responses = props.request.responses
    if (responses && Object.keys(responses).length > 0) {
      for (const [name, response] of Object.entries(responses)) {
        if (response && typeof response === "object") {
          examples.push({
            name: name || "Response Example",
            statusCode: response.code || 200,
            headers: response.headers || [],
            body: response.body || "",
            contentType: "application/json",
          })
        }
      }
    }
  }

  return examples.length > 0 ? examples : null
}
```

### sections/Response 组件
`sections/Response.vue` 负责渲染响应示例，根据数据源中是否包含 `bodySchemaTree` 采用不同的展示策略：

**当 `bodySchemaTree` 存在时**（设计模式创建的响应）：
- 双栏布局（3:2 比例）
  - 左栏：`SchemaTreeReadonly` 展示 Schema 树 + contentType 标签
  - 右栏：`JsonExampleBlock` 展示 JSON 示例
- Headers 以可折叠表格形式显示在双栏下方
- Tab 标签显示状态码 + 原因短语（如 "200 OK"）

**当 `bodySchemaTree` 缺失时**（遗留格式响应）：
- 传统 Tab 布局：Body tab + Headers tab
- Body 内容以 `<pre>` 标签格式化展示（JSON 自动格式化）
- Headers 以表格展示

### generateExampleFromSchema
当响应模型有 `bodySchemaTree` 但 `bodyExample` 为空时，`sections/Response.vue` 内部的 `generateExampleFromSchema()` 函数根据 Schema 树自动生成 JSON 示例：

```typescript
function generateExampleFromSchema(tree: HoppRESTSchemaNode[] | null | undefined): string {
  if (!tree || tree.length === 0) return "{}"
  const obj: Record<string, unknown> = {}
  for (const node of tree) {
    obj[node.name || "field"] = generateNodeExample(node)
  }
  return JSON.stringify(obj, null, 2)
}

function generateNodeExample(node: HoppRESTSchemaNode): unknown {
  switch (node.type) {
    case "string":   return node.mock || "string"
    case "integer":  return 0
    case "number":   return 0.0
    case "boolean":  return true
    case "array":    return node.children?.length ? [generateNodeExample(node.children[0])] : []
    case "object":   return node.children?.reduce((obj, child) => {
                       obj[child.name || "field"] = generateNodeExample(child)
                       return obj
                     }, {} as Record<string, unknown>) ?? {}
    default:         return null
  }
}
```

## 设计/调试模式切换
### RequestDesignPanel
`RequestDesignPanel.vue` 是请求编辑器中的顶层面板，管理"设计模式"和"调试模式"之间的切换。

**Props**：
- `modelValue: HoppRESTRequest` — 当前请求对象
- `tab: HoppTab<HoppRequestDocument>` — 当前标签页
- `inheritedProperties?: HoppInheritedProperty` — 继承属性
- `initialSubMode?: 'edit' | 'preview'` — 初始子模式（默认 'preview'）

**Emits**：
- `update:modelValue` — 请求对象更新
- `switchToDebug` — 切换到调试模式
- `update:subMode` — 子模式变更通知

**内部状态**：
- `subMode: ref<'edit' | 'preview'>` — 设计模式内部的编辑/预览切换
- `apiTitle: computed` — 读取 `request.apiTitle`
- `apiStatus: computed` — 读取 `request.apiStatus`（默认 'developing'）

**布局**：
1. 顶部标题栏：API 标题（编辑模式可编辑）+ StatusBadge + 子模式指示器 + 切换按钮
2. URL 栏（仅编辑模式显示）：HttpRequest 组件，发送按钮标签为"手动调试"，点击触发 `switchToDebug`
3. 内容区：
   - 编辑模式 → `EditView`（MetaInfoSection + RequestOptions + ResponseSection）
   - 预览模式 → `PreviewView`（只读展示 + "手动调试"按钮 + 保存按钮组）

### EditView
`EditView.vue` 是设计编辑视图的入口，组合三个区域：

1. **MetaInfoSection**：API 元信息编辑（描述、标签、负责人、继承基础 URL）
2. **RequestOptions**：复用调试模式的请求选项组件，但仅展示 authorization/params/bodyParams/headers 四个 Tab（不含脚本和变量 Tab）
3. **ResponseSection**：响应模型编辑

### PreviewView
`PreviewView.vue` 是设计预览视图，以只读形式展示请求文档：

1. Method + URL 行（只读）+ "手动调试"按钮 + 保存/另存为按钮组
2. Meta info 行：负责人、标签、说明
3. 请求参数（只读折叠面板）：鉴权、请求头、参数、请求体
4. 响应部分：SchemaTreeReadonly + JsonExampleBlock 双栏布局

## 关键实现细节
### getResponseExamples 双源读取策略
`RequestPreview.vue` 中的 `getResponseExamples()` 实现了双数据源兼容：

1. **优先读取 `responseModels`**：设计模式创建的结构化响应数据
   - 将 `HoppRESTResponseModelV20` 映射为统一的 `ResponseExample` 接口
   - 注意 headers 的映射：设计模式下 headers 的 `description` 字段被映射为预览模式下的 `value`
   - `body` 优先使用 `bodyExample`，回退到 `bodySchema`
   - 保留 `bodySchemaTree` 和 `contentType` 用于双栏展示

2. **回退到 `responses`**：仅在 `responseModels` 为空时使用
   - 遍历 `Record<string, HoppRESTRequestResponse>` 的每个条目
   - 以条目键名作为示例名称
   - 不含 `bodySchemaTree`，因此使用传统 Body/Headers Tab 布局

### DocumentationService 暂存机制
DocumentationService 使用 `reactive(Map<string, DocumentationItem>)` 存储编辑中的文档内容：

- **键格式**：`collection_${id}` 或 `request_${id}`
- **写入时机**：MarkdownEditor 失焦时（`handleBlur`），仅当内容确实发生变化时才写入
- **区分团队/个人**：通过 `isTeamItem` 标志区分，团队请求使用 `requestID`，个人请求使用 `requestIndex`
- **批量保存**：`getChangedItems()` 返回所有变更项，支持批量保存
- **发布管理**：`publishedDocsMap` 跟踪已发布文档状态，支持按集合 ID 查询

### SchemaTreeEditor vs SchemaTreeReadonly
| 特性 | SchemaTreeEditor | SchemaTreeReadonly |
|------|-----------------|-------------------|
| 用途 | 设计模式编辑 | 文档/预览模式展示 |
| 交互 | 可增删改字段 | 纯展示 |
| 根节点 | 固定 object，带"添加字段"按钮 | 仅展示 |
| 行组件 | SchemaTreeRow（可编辑） | 简化行渲染 |
| 数据绑定 | v-model 双向绑定 | 只读 prop |

### JsonExampleBlock 的可编辑性
JsonExampleBlock 在不同场景下的行为：

- **设计模式**：可编辑，用户可直接修改 JSON 示例
- **预览模式**：只读展示，支持复制到剪贴板
- **自动生成**：当 bodyExample 为空时，可调用 `generateExampleFromSchema()` 从 Schema 树生成

## 已知问题和注意事项
1. **headers 字段映射不一致**：设计模式下 ResponseSection 的 headers 使用 `{ key, description }` 结构，但预览模式下 Response section 期望 `{ key, value }` 结构。`getResponseExamples()` 中将 `description` 映射为 `value`，这在语义上可能造成混淆。

2. **bodySchemaTree 为 null 的迁移数据**：从旧版本迁移的 responseModels 其 `bodySchemaTree` 为 `null`，`contentType` 默认为 `"application/json"`。文档预览会正确回退到传统 Tab 布局，但用户需要手动在设计模式中编辑才能获得双栏体验。

3. **DocumentationService 不处理 responseModels**：Markdown 描述和响应模型是两套独立的保存流程。Markdown 通过 DocumentationService 暂存后批量保存，responseModels 通过标准请求保存流程即时持久化。

4. **类型断言 `(props.request as any).responseModels`**：由于 `HoppRESTRequest` 的类型定义可能尚未完全包含 v20 字段，`getResponseExamples()` 中使用了 `as any` 类型断言来访问 `responseModels`。未来应在类型定义中正式声明此字段。

5. **设计模式仅支持 REST**：当前的设计模式组件（EditView、PreviewView、ResponseSection 等）仅用于 REST 请求，GraphQL 请求不支持设计模式。

6. **Markdown 编辑器 blur 保存**：文档描述的编辑在 blur 事件时保存到 DocumentationService，如果用户在未 blur 的情况下关闭弹窗，可能丢失未保存的编辑内容。

7. **环境变量解析**：RequestPreview 中的完整 URL 展示使用了 `getEffectiveRESTRequest()` 进行环境变量解析，这是一个异步操作，URL 显示可能有短暂的空白期。

## 相关文件

| 类别 | 路径 |
|------|------|
| 文档模式组件 | `packages/hoppscotch-common/src/components/collections/documentation/` |
| 设计模式组件 | `packages/hoppscotch-common/src/components/http/design/` |
| 设计/调试切换面板 | `packages/hoppscotch-common/src/components/http/RequestDesignPanel.vue` |
| DocumentationService | `packages/hoppscotch-common/src/services/documentation.service.ts` |
| v20 数据模型 | `packages/hoppscotch-data/src/rest/v/20/index.ts` |
| HTTP 状态码工具 | `packages/hoppscotch-common/src/helpers/utils/statusCodes.ts` |
| 集合管理 | [07-collection-management](./07-collection-management.md) |
| REST 请求构建器 | [04-rest-request-builder](./04-rest-request-builder.md) |
