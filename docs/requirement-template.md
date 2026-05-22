# Requirement Template

Use this template when describing new features or modifications for Hoppscotch.
A well-structured requirement helps AI (Claude Code, Hermes) produce correct code faster.

---

## Template

```markdown
## 需求：[简短标题]

**影响范围**: [哪些 packages，如 hoppscotch-common, hoppscotch-data]
**涉及数据模型**: [是否需要修改 HoppRESTRequest 等版本化实体？是/否]
**UI位置**: [哪个组件/页面，如 RequestOptions.vue → Parameters tab]

### 预期行为
[具体描述功能应该做什么，包含输入和预期输出]

### 验收标准
- [ ] [可测试的条件1]
- [ ] [可测试的条件2]
- [ ] 不影响现有功能（无白屏、无回归）

### 相关文件
[已知的源文件路径，帮助AI快速定位]
- `packages/hoppscotch-common/src/components/http/RequestOptions.vue`
- `packages/hoppscotch-data/src/rest/v/17.ts`

### 技术约束
[任何限制，如：不能改kernel接口、必须兼容v15数据格式等]

### 参考
[相关wiki文档、设计稿、issue链接等]
```

---

## 填写示例

```markdown
## 需求：Path Params 支持自动检测URL中的路径参数

**影响范围**: hoppscotch-common, hoppscotch-data
**涉及数据模型**: 是 — 需要在 HoppRESTRequest 新增 pathParams 字段
**UI位置**: RequestOptions.vue → Parameters tab，合并显示 Query Params 和 Path Params

### 预期行为
1. 用户输入URL如 `https://api.example.com/users/:userId/posts/:postId`
2. 系统自动检测 `:userId` 和 `:postId` 为路径参数
3. 在 Parameters tab 中自动生成 Path Params 行（key只读，value可编辑）
4. 发送请求时，将 Path Params 值替换到URL中
5. Path Params 值同时作为环境变量，可被 `<<userId>>` 语法引用

### 验收标准
- [ ] URL输入 `:paramName` 后，Parameters tab 自动出现 Path Params 行
- [ ] Path Params key 为只读（从URL自动提取）
- [ ] 发送请求时URL中的 `:paramName` 被替换为对应值
- [ ] 已保存的旧格式 tab（无 pathParams）不会导致白屏
- [ ] typecheck 和 lint 通过

### 相关文件
- `packages/hoppscotch-common/src/components/http/RequestOptions.vue`
- `packages/hoppscotch-common/src/helpers/utils/EffectiveURL.ts`
- `packages/hoppscotch-data/src/rest/v/17.ts`
- `packages/hoppscotch-data/src/rest/index.ts`

### 技术约束
- 必须新增 HoppRESTRequest v18（verzod migration）
- 旧数据（v17）打开时 pathParams 默认为空数组
- 不能使用 HoppSmartTabs 的 render-inactive-tabs（已知会crash）

### 参考
- docs/wiki/04-rest-request-builder.md
- docs/verzod-migration-checklist.md
```

---

## 评分标准

| 信息完整度 | AI输出质量 | 调试轮次 |
|-----------|-----------|---------|
| 只给一句话描述 | 需反复确认需求 | 5-10轮 |
| 填了预期行为+验收标准 | 一次基本正确 | 2-3轮 |
| 完整模板（含相关文件+约束） | 几乎一次到位 | 0-1轮 |
