## 需求：Actual Request Header List 分类显示（用户自定义展开 / 系统头收缩 / 浏览器头不显示）

**影响范围**: hoppscotch-common
**涉及数据模型**: 否 — 不需要修改 HoppRESTRequest 等版本化实体
**UI位置**: Response 区域 → Actual Request tab → Header List 表格

### 预期行为

1. 用户发送 REST 请求后，切换到 "Actual Request" tab，Header List 按**来源分类**显示 headers
2. 三类 headers 分区显示：
   - **用户自定义 Headers**（用户在 Headers tab 手动添加的，即使 key 与系统头重复如手动写 `Content-Type` 也算用户头）：**默认展开**，每个 header 显示 Name + Value
   - **系统 Headers**（仅限 Hoppscotch 框架自动添加的：auth 产生的 `Authorization` 等 + body 产生的 `Content-Type`/`Content-Disposition` 等）：**默认收缩**，点击可展开查看
   - **浏览器 Transport Headers**（`User-Agent`、`Accept`、`Origin`、`sec-*`、`Referer` 等浏览器自动附加的）：**不显示**
3. 系统头收缩状态下，显示类似 "System Headers (3) ▶" 的摘要行，点击后展开显示详细 Name + Value
4. 无任何 header 时仍显示 "None"

### 当前问题

- `ActualSentRequest.headers` 类型为 `Record<string, string>`，丢失了 header 来源信息
- `effectiveFinalHeaders` 构建时，`getComputedHeaders()` 已经区分了 `source: "auth" | "body"`，但经过 `filterActiveToRecord()` 合并为 Record 后来源信息丢失
- 导致所有 headers 混在一起，无法区分哪些是用户手动添加的、哪些是 Hoppscotch 自动生成的
- 无自定义 header 且无 body/auth 时，Header List 显示 "None"，但实际请求确实发出了 Content-Type 等系统头

### 数据流分析

```
getComputedHeaders() → ComputedHeader[] (source: "auth" | "body")
  ↓ 拼接
effectiveFinalHeaders = computedHeaders + request.headers (用户定义)
  ↓ filterActiveToRecord()
RelayRequest.headers: Record<string, string>  ← 来源信息丢失
  ↓ relayRequestToActualSent()
ActualSentRequest.headers: Record<string, string>  ← 无法区分来源
```

**关键**：`effectiveFinalHeaders` 中的元素已经有来源区分（computed = 系统头, request.headers = 用户头），但在转换为 Record 时丢失了。

### 解决方案

1. **扩展 `ActualSentRequest` 类型**，将 `headers` 从 `Record<string, string>` 改为分类结构：
   ```ts
   type ActualSentRequest = {
     // ...
     headers: {
       user: [string, string][]      // 用户自定义 headers
       system: [string, string][]    // Hoppscotch 系统添加的 headers (auth + body)
     }
   }
   ```

2. **修改 `relayRequestToActualSent()`**，接收分类的 header 数据而非合并后的 Record

3. **修改 `RESTRequest.toRequest()`**，返回分类的 headers 信息（同时保留合并后的 Record 给 kernel 使用）

4. **修改 `ActualRequestRenderer.vue`**，按分类渲染 Header List：
   - 用户 headers: 展开显示，Name 列用 `text-secondaryDark`，Value 列用 `text-secondary`
   - 系统 headers: 收缩显示（带点击展开），Name 列用 `text-secondaryLight`
   - 不显示浏览器 transport headers

5. **修改 `network.ts`**，传递分类 headers 到 actualSentRequest

### 验收标准

- [ ] 发送带自定义 header 的 GET 请求，Actual Request Header List 中用户自定义 headers **展开显示**（包括用户手动添加的 Content-Type 等）
- [ ] 发送带 body 的 POST 请求，系统自动添加的 `Content-Type` header 出现在 "System Headers" 分区，**默认收缩**
- [ ] 发送带 Auth 的请求，系统自动添加的 `Authorization` header 出现在 "System Headers" 分区，**默认收缩**
- [ ] 点击 "System Headers (N) ▶" 可展开/收缩查看详细 header
- [ ] 浏览器自动添加的 transport headers（User-Agent, Accept, sec-*, Referer 等）**不在列表中显示**
- [ ] 无任何 header 时仍显示 "None"
- [ ] 复制请求（Copy）功能仍包含所有 headers（用户 + 系统）
- [ ] 不影响现有功能（无白屏、无回归）
- [ ] typecheck 和 lint 通过

### 相关文件

- `packages/hoppscotch-common/src/components/lenses/ActualRequestRenderer.vue` — 渲染 Actual Request 的 Header List，需改为分类展示
- `packages/hoppscotch-common/src/helpers/types/HoppRESTResponse.ts` — `ActualSentRequest` 类型定义、`relayRequestToActualSent()` 转换函数，需扩展 headers 结构
- `packages/hoppscotch-common/src/helpers/network.ts` — 请求发送流程，需传递分类 headers
- `packages/hoppscotch-common/src/helpers/kernel/rest/request.ts` — `RESTRequest.toRequest()`，需同时返回分类 headers
- `packages/hoppscotch-common/src/helpers/utils/EffectiveURL.ts` — `getComputedHeaders()` 已有 `source: "auth" | "body"` 区分，`effectiveFinalHeaders` 已有隐式来源区分
- `packages/hoppscotch-common/src/helpers/functional/filter-active.ts` — `filterActiveToRecord()` 将 headers 合并为 Record，丢失来源信息

### 技术约束

- 必须保持 `RelayRequest.headers` 的 `Record<string, string>` 接口不变（kernel 公共 API）
- 分类 headers 信息是额外的附加数据，仅用于 UI 展示，不影响请求发送
- 不需要修改 HoppRESTRequest verzod 版本化实体
- 不需要修改 hoppscotch-kernel 包
- 使用 Hoppscotch 语义化 Tailwind 类（`text-secondaryDark`, `text-secondaryLight`, `text-secondary`, `bg-primaryLight`, `border-dividerLight` 等），确保主题兼容

### 参考

- 测试端点: `https://echo.hoppscotch.io/A2235456655B1234/root/11/test33aaa`
- `ComputedHeader` 类型已有 `source: "auth" | "body"` 字段，可区分系统头来源
- `effectiveFinalHeaders` 构建逻辑：computedHeaders (auth + body sources) + request.headers (user defined)
