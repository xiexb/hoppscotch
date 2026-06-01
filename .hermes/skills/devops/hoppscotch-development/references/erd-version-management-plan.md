# ERD Version Management Architecture (Git-Based, v3)

Plan approved 2026-06-01. Implementation started (kanban tasks t_b3e87934 → t_e6399c9e).

## Architecture Overview

Backend NestJS module (`ErdVersionModule`) using `simple-git`. Each Team Collection gets its own independent git repository. All API endpoints require JWT authentication.

### Key Design Decisions (user-specified)
- **Per-collection independent git repo** — each collection has its own repo, not a shared one
- **Auto-commit on save** — every manual save triggers a git commit automatically (no explicit "save version" action needed)
- **Remote push** — commit content must push to a remote git repository (configurable)
- **JWT authentication** — all version management APIs require `@UseGuards(JwtAuthGuard)`
- **Extensible structure** — repo layout预留 `api/` and `tests/` directories for future version management of API definitions and test cases

## Local Repository Structure (per collection)

```
<ERD_VERSION_ROOT>/<teamId>/<collectionId>/
├── erd/                              # ERD versions (current scope)
│   ├── erd-schema.json                  Full erd-editor v3 JSON (for restore)
│   └── erd-schema.normalized.json       Name-based structural summary (for clean diff)
├── api/                              # RESERVED: API definitions (Phase 5+)
├── tests/                            # RESERVED: Test cases (Phase 5+)
├── .git/
│   └── config                         remote origin configured
└── README.md
```

Environment variable: `ERD_VERSION_ROOT=/data/erd-versions` (default)

## Backend API Design

All endpoints at `/api/v1/erd-version`, all require JWT auth.
Query params: `teamId` + `collectionId` on every call.

```
POST   /commit              → save + auto-commit (generates descriptive message)
GET    /log                 → version list (git log --oneline --stat)
GET    /:ref                → get version (git show <ref>:erd/erd-schema.json)
GET    /diff?from=X&to=Y    → structural diff (DiffResult)
POST   /restore/:ref        → return erdJson for editor loading
DELETE /commit/:ref          → logical delete (git revert)
GET    /stats/:ref           → table/column/relationship counts
PUT    /remote              → configure remote URL + push mode
GET    /remote              → get current remote config
POST   /push                → manual push trigger
GET    /export              → git archive as .tar.gz
```

Auth pattern (matches existing access-token.controller.ts):
```typescript
@UseGuards(ThrottlerBehindProxyGuard)
@Controller({ path: 'erd-version', version: '1' })
export class ErdVersionController {
  @Post('commit')
  @UseGuards(JwtAuthGuard)
  async commit(@GqlUser() user: AuthUser, @Query('teamId') teamId: string, ...)
}
```

## Dual-File Strategy

- `erd-schema.json`: Complete erd-editor data with UUIDs, coordinates, UI state — used for exact restoration
- `erd-schema.normalized.json`: Tables/columns organized by name, sorted alphabetically, no UUIDs or layout data — makes `git diff` produce clean semantic output

## Auto-Commit Logic

On every save (manual save or auto-save interval):
1. Normalize current ERD JSON
2. Compare with last committed normalized.json
3. If changes detected → write files → auto-generate commit message → `git add` + `git commit`
4. If no changes → skip (no empty commits)
5. Async `git push` after commit (non-blocking, failure logged but doesn't block response)

Commit message format: `erd: add 2 tables, modify users.email type, remove legacy_orders`
Simplified (when >10 changes): `erd: auto-save 2026-06-01 15:30 (X tables, Y columns changed)`

## Remote Push Configuration

Two modes (user configures per collection):
- **Mode A (branch)**: Single remote repo, each collection pushes to branch `erd/<collection-id>`
- **Mode B (repo)**: Each collection has its own remote repository

Env vars: `ERD_VERSION_REMOTE_URL`, `ERD_VERSION_REMOTE_MODE=branch|repo`, `ERD_VERSION_SSH_KEY`

Push failures are non-blocking — logged and surfaced in UI as "未推送" status.

## Diff Algorithm (Name-Based Matching)

Due to UUID instability (see erd-editor-integration.md), matching uses:
1. `table.name` → match tables across versions
2. `table.name + column.name` → match columns
3. `(fromTable.fromCol → toTable.toCol)` four-tuple → match relationships

Compare per-column: type, default, comment, pk, notNull, unique, autoIncrement
Compare per-table: comment

## Visual Diff Rendering (Frontend)

Merge two versions into one erd-editor JSON with `ui.color` annotations:
- `#22c55e` (green) = added tables/columns
- `#eab308` (yellow) = modified tables/columns
- `#6b7280` (gray) = deleted tables/columns (extracted from old version)
- `""` (empty) = unchanged

Note: erd-editor only supports table-level `ui.color`, not per-column colors. Column-level diffs shown in `ErdDiffDetail.vue` structured panel only.

## Planned Files

### Backend (new)
- `backend/src/erd-version/erd-version.module.ts`
- `backend/src/erd-version/erd-version.controller.ts` — REST API with JwtAuthGuard
- `backend/src/erd-version/erd-version.service.ts` — git ops + mutex + auto-commit
- `backend/src/erd-version/erd-diff.util.ts` — structural diff algorithm
- `backend/src/erd-version/erd-normalize.util.ts` — JSON normalization
- `backend/src/erd-version/erd-commit-msg.util.ts` — auto commit message generation
- `backend/src/erd-version/dto/` — commit-version, diff-query, remote-config DTOs

### Frontend (new)
- `common/src/helpers/erdDiff.ts` — Diff rendering (merge JSON with colors)
- `common/src/helpers/erdVersionApi.ts` — API client (carries JWT token)
- `common/src/components/erd/ErdVersionPanel.vue` — Version list + save UI + remote config
- `common/src/components/erd/ErdDiffView.vue` — Diff mode (read-only editor overlay)
- `common/src/components/erd/ErdDiffDetail.vue` — Structured change panel

### Modified
- `common/src/pages/erd.vue` — Add version management button, auto-commit on save, query params for teamId/collectionId
- `backend/package.json` — Add `simple-git` dependency
- `.env` — Add ERD_VERSION_ROOT, ERD_VERSION_REMOTE_URL, etc.
- `common/locales/{en,cn}.json` — i18n keys for erd.version.*

## Implementation Phases (Kanban Chain)

1. **Phase 1** (t_b3e87934): Backend module + DTOs + util functions (normalize, diff, commit-msg)
2. **Phase 2** (t_4a1e9659): Backend service (git operations, repo management, mutex, auto-commit)
3. **Phase 3** (t_1cda611c): Backend controller (REST API + JWT auth + remote config)
4. **Phase 4** (t_a884c775): Frontend API client + version panel + i18n
5. **Phase 5** (t_58ef3967): Frontend erd.vue integration (auto-commit + version management entry)
6. **Phase 6** (t_fec7de41): Frontend diff view + detail panel
7. **Testing** (t_d3e18c4f): Full-stack functional testing
8. **Review** (t_e6399c9e): Code quality review

## Technical Risks

| Risk | Mitigation |
|------|-----------|
| simple-git blocks event loop | async/await + mutex per collection |
| UUID instability in relationships | Normalized JSON matches by name |
| Shadow DOM color rendering | `ui.color` is native erd-editor API (table-level only) |
| Git repo corruption | Periodic `git fsck`, export backup support |
| Concurrent save conflicts | Backend mutex, one git op at a time per collection |
| git push failure (network/auth) | Non-blocking, log + UI status indicator |
| Path traversal (teamId/collectionId) | Validate/sanitize before filesystem operations |
| SSH key permission issues | Config health check, failure notification |
