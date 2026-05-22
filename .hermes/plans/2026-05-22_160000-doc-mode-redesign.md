# Plan: 优化 Hoppscotch 文档模式(Design Mode)页面设计

## Goal

按照 `docs/API文档模式-布局与功能设计说明.md` 重新设计并实现 Design Mode 的编辑视图和预览视图，使其具备完整的 API 文档编辑与预览能力。

---

## Current State Analysis

### 现有组件
| 文件 | 职责 | 现状 |
|------|------|------|
| `RequestModeTabs.vue` | 模式切换 (design/debug/testcases) | ✅ 已有 |
| `Request.vue` | 地址栏 (Method + URL + Send) | ✅ 已有，但设计模式不需要 Send 按钮 |
| `RequestTab.vue` | 模式编排 | ✅ 已有 |
| `RequestDesignPanel.vue` | 设计面板 | ⚠️ 过于简陋，需大幅重构 |
| `RequestPreview.vue` | 集合文档预览 | 存在但仅用于集合侧边栏，不复用于 Design 模式 |

### 数据模型 (v19)
- 已有: `responseModels[]` (statusCode, description, headers[], bodySchema, bodyExample)
- 已有: `testCases[]`
- **缺失**: apiTitle, apiStatus, tags, responsibility, inheritedBaseUrl 等元信息字段

---

## Proposed Approach

分 4 个阶段实施:

1. **数据模型扩展** — 新增 v20 schema，补充文档元信息字段
2. **编辑视图重构** — 重写 RequestDesignPanel，拆分为 EditView 子组件
3. **预览视图新建** — 新建 DesignPreviewPanel 组件
4. **编辑/预览切换** — 在 Design 模式内增加 edit/preview 子模式切换

---

## Step-by-Step Plan

### Phase 1: 数据模型扩展 (hoppscotch-data)

#### 1.1 新建 v20 schema
- **文件**: `packages/hoppscotch-data/src/rest/v/20.ts`
- **操作**:
  - 从 v19 extend，新增字段:
    ```ts
    apiTitle: z.string().catch("")          // 接口中文名
    apiStatus: z.enum(["designing", "developing", "testing", "published", "deprecated"]).catch("developing")
    tags: z.array(z.string()).catch([])      // 标签列表
    responsibility: z.string().catch("")     // 责任人
    inheritedBaseUrl: z.string().catch("")   // 前置URL (继承父级)
    ```
  - 扩展 `HoppRESTResponseModel`:
    ```ts
    bodySchemaTree: z.any().catch(null)      // 树形 Schema (JSON Schema 对象)
    contentType: z.string().catch("application/json")
    ```
- **文件**: `packages/hoppscotch-data/src/rest/index.ts`
  - 引用 v20 为最新版本
  - 在 `isEqualHoppRESTRequest` 和 `makeRESTRequest` 中处理新字段

#### 1.2 类型安全
- 所有读取新字段的组件用 `?? defaultValue` 防护

---

### Phase 2: 编辑视图重构

#### 2.1 重构 RequestDesignPanel.vue 为编排容器
- **文件**: `packages/hoppscotch-common/src/components/http/RequestDesignPanel.vue`
- **职责变更**: 仅做 edit/preview 子模式切换，渲染对应子组件
- **新增**: 顶部 edit/preview toggle 按钮

#### 2.2 新建 DesignEditView.vue (编辑视图)
- **文件**: `packages/hoppscotch-common/src/components/http/design/EditView.vue`
- **布局**: 单列纵向滚动，4 个区域

**区域 1: 接口地址栏** (复用 Request.vue 的 Method+URL 部分，但替换按钮)
- Method 下拉 (带颜色)
- URL 输入框 (支持 `{变量}` 路径参数)
- 保存按钮 (紫色高亮) → 保存后切换到预览模式
- 调试按钮 → 切换到 debug 模式

**区域 2: 接口元信息区** — 新建 `design/MetaInfoSection.vue`
- 标题行: 接口中文名输入 + 状态徽标下拉 (设计中/开发中/测试中/已发布/废弃)
- Markdown 描述编辑器 (复用 DocumentationMarkdownEditor)
- 三列字段:
  - 责任人 (文本输入，后续可升级为人选择器)
  - 标签 (多选 Tag 输入，支持回车创建)
  - 前置 URL (下拉: "继承父级" / 自定义)

**区域 3: 请求参数区** — 新建 `design/RequestParamsSection.vue`
- 复用调试模式的 Tab 切换样式 (Params / Headers / Body / Authorization)
- 与 debug 模式视觉一致，但数据绑定到 request 对象
- 底部: `+ 添加示例` 按钮

**区域 4: 返回响应区** — 新建 `design/ResponseSection.vue`
- 左侧状态码 Tab: `200 成功` (绿色)，可 `+` 新增
- 元信息: HTTP 状态码、名称、内容格式下拉 (JSON/XML/HTML)、MIME 类型
- Body 结构树编辑器 — 新建 `design/SchemaTreeEditor.vue`:
  - 树形 Schema 编辑，列: 字段名 | 类型 | Mock | 中文名 | 说明 | 操作
  - 类型枚举: object/string/integer/number/boolean/array/file
  - 根节点显示"根节点"，初始 "没有字段 添加"
  - 子字段缩进，支持无限嵌套
  - 行尾: 删除 / 添加子字段
- 底部: `+ 添加示例` `+ 添加描述` `+ Headers`

#### 2.3 子组件清单
```
design/
├── EditView.vue              # 编辑视图容器
├── PreviewView.vue           # 预览视图容器
├── MetaInfoSection.vue       # 元信息区 (标题/状态/描述/标签/责任人)
├── RequestParamsSection.vue  # 请求参数区 (Tab切换)
├── ResponseSection.vue       # 返回响应区 (状态码Tab + Schema)
├── SchemaTreeEditor.vue      # 树形Schema编辑器
├── StatusBadge.vue           # 状态徽标组件
├── TagInput.vue              # 多选Tag输入组件
└── JsonExampleBlock.vue      # JSON示例代码块 (语法高亮)
```

---

### Phase 3: 预览视图新建

#### 3.1 新建 PreviewView.vue (预览视图)
- **文件**: `packages/hoppscotch-common/src/components/http/design/PreviewView.vue`
- **布局**: 单列纵向滚动，5 个区域

**区域 1: 接口标题栏**
- 左侧: 接口中文名 (大标题) + 状态徽标 (蓝色胶囊) + 收藏/分享/更多图标
- Method + URL 行: Method 胶囊 + 完整 URL (灰色可复制)
- 右侧操作: `手动调试` (蓝色按钮) / `生成代码` / `复制`

**区域 2: 元信息行**
- 单行横向: 创建时间 | 修改时间 | 修改者 | 迭代 | 相关测试 | 负责人
- 灰色小字 + 间隔符

**区域 3: 请求参数区 (只读)**
- Authorization 折叠面板
- Path 参数: 参数名(蓝) + 类型(灰) + 必填徽标(橙)
- Header 参数: 同上 + 示例值缩进
- Body 参数: **两列布局**
  - 左列 (60%): 字段列表 (名称 + 类型 + 必填徽标)
  - 右列 (40%): JSON 示例代码块 (深色背景 + 语法高亮)

**区域 4: 返回响应区 (只读)**
- 状态码 Tab 栏
- 响应元信息: HTTP 状态码 + MIME
- Body: **两列布局** (同请求 Body 的布局)
  - 左列: 字段层级树 (可折叠)
  - 右列: JSON 示例代码块

---

### Phase 4: 编辑/预览切换 + 集成

#### 4.1 RequestDesignPanel 改造
```vue
<template>
  <div class="flex flex-col h-full">
    <!-- 子模式切换 -->
    <div class="flex items-center border-b border-dividerLight px-4">
      <button :class="subMode === 'edit' ? active : inactive" @click="subMode = 'edit'">编辑</button>
      <button :class="subMode === 'preview' ? active : inactive" @click="subMode = 'preview'">预览</button>
    </div>
    <DesignEditView v-if="subMode === 'edit'" v-model="request" @save="subMode = 'preview'" />
    <DesignPreviewView v-else v-model="request" @debug="emit('switchToDebug')" />
  </div>
</template>
```

#### 4.2 保存 → 预览联动
- 编辑视图"保存"按钮 → 切换 subMode 为 preview
- 预览视图"手动调试" → emit 事件给 RequestTab.vue 切换到 debug 模式

---

## Files Likely to Change

| 操作 | 文件 |
|------|------|
| 新建 | `packages/hoppscotch-data/src/rest/v/20.ts` |
| 修改 | `packages/hoppscotch-data/src/rest/index.ts` |
| 重构 | `packages/hoppscotch-common/src/components/http/RequestDesignPanel.vue` |
| 新建 | `packages/hoppscotch-common/src/components/http/design/EditView.vue` |
| 新建 | `packages/hoppscotch-common/src/components/http/design/PreviewView.vue` |
| 新建 | `packages/hoppscotch-common/src/components/http/design/MetaInfoSection.vue` |
| 新建 | `packages/hoppscotch-common/src/components/http/design/RequestParamsSection.vue` |
| 新建 | `packages/hoppscotch-common/src/components/http/design/ResponseSection.vue` |
| 新建 | `packages/hoppscotch-common/src/components/http/design/SchemaTreeEditor.vue` |
| 新建 | `packages/hoppscotch-common/src/components/http/design/StatusBadge.vue` |
| 新建 | `packages/hoppscotch-common/src/components/http/design/TagInput.vue` |
| 新建 | `packages/hoppscotch-common/src/components/http/design/JsonExampleBlock.vue` |
| 修改 | `packages/hoppscotch-common/src/components/http/RequestTab.vue` (传递 debug 切换事件) |
| 修改 | `packages/hoppscotch-common/locales/{en,zh}.json` (新增 i18n keys) |

---

## Tests / Validation

1. **TypeScript**: `pnpm run typecheck` 全量通过
2. **Lint**: `pnpm run lint` 全量通过
3. **功能验证**:
   - 切换 Design 模式 → 显示编辑视图，4 个区域正确渲染
   - 填写元信息 (标题/状态/标签/责任人) → 数据持久化到 request 对象
   - 请求参数区 Tab 切换正常，与 debug 模式视觉一致
   - Schema 树编辑器: 添加/删除字段、嵌套、类型选择
   - 点击"保存" → 切换到预览视图
   - 预览视图: 两列布局正确，JSON 语法高亮
   - 预览视图"手动调试" → 切换到 debug 模式
   - 数据模型 v20 向后兼容 (旧数据迁移不丢字段)
4. **主题兼容**: light/dark 模式切换无硬编码颜色

---

## Risks, Tradeoffs & Open Questions

### Risks
1. **Schema 树编辑器复杂度高** — 无限嵌套 + 拖拽排序 + 类型推断，建议 MVP 先做基础增删改，拖拽排序二期
2. **数据模型 v20 迁移** — 已有用户数据可能触发 verzod 迁移链，需确保 v19→v20 up() 正确
3. **请求参数区复用** — debug 模式的 Parameters/Headers/Body 组件内部可能有 debug 特有逻辑 (如发送按钮)，需要抽取公共展示层

### Tradeoffs
1. **编辑/预览 vs 纯编辑** — 增加子模式切换复杂度，但符合设计文档要求，且预览模式可作为"文档发布预览"
2. **Schema 树 vs JSON Schema textarea** — 树编辑器 UX 更好但开发成本高；可先用 textarea + JSON 解析做过渡，后续迭代为可视化树

### Open Questions
1. "生成代码" 按钮 — 具体生成什么代码？(cURL / fetch / axios / 多语言？) 是否复用已有功能？
2. 元信息中的"创建时间/修改时间" — 数据来源？request 对象目前没有这些字段，是否需要后端支持或从 collection 元数据获取？
3. 责任人选择器 — 是否需要对接用户系统，还是纯文本输入即可？
4. "前置URL 继承父级" — 具体逻辑是否与集合的 inheritedProperties 一致？

---

## Recommended Implementation Order

1. Phase 1 (数据模型) → 最基础，阻塞其他所有工作
2. Phase 2 区域 1-2 (地址栏 + 元信息) → 立即可见效果
3. Phase 2 区域 3 (请求参数) → 复用现有组件
4. Phase 2 区域 4 (响应 + Schema树) → 最复杂，可先用 textarea 过渡
5. Phase 4 (编辑/预览切换) → 串联编辑视图
6. Phase 3 (预览视图) → 依赖编辑视图数据完整
7. i18n + 主题适配 + 测试
