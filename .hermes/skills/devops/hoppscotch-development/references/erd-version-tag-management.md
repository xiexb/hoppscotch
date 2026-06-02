# ERD Version Tag Management

> Implemented 2026-06-02. Git-backed tag CRUD for ERD version milestones.

## Architecture

### Backend API (3 endpoints)

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/erd-version/tag` | `{tagName, ref}` | `{tagName, commitHash, createdAt}` |
| DELETE | `/erd-version/tag/:tagName` | — | `{success: true}` |
| GET | `/erd-version/tags` | — | `TagInfo[]` |

**Files:**
- `erd-version/dto/create-tag.dto.ts` — `@IsString() @Matches(/^[a-zA-Z0-9._-]{1,50}$/) tagName`
- `erd-version/erd-version.service.ts` — `createTag()`, `deleteTag()`, `listTags()`
- `erd-version/erd-version.controller.ts` — route registration + `validateRef()` extended for tag names
- `errors.ts` — `ERD_VERSION_TAG_CREATE_FAILED`, `ERD_VERSION_TAG_DELETE_FAILED`, `ERD_VERSION_TAG_EXISTS`

### Frontend Components

- `ErdVersionTimeline.vue` — horizontal scrolling timeline (max 30 nodes), tag nodes highlighted with colored dots + labels
- `ErdVersionPanel.vue` — tag badges with delete buttons, inline tag creation input per version row
- `erdVersionApi.ts` — `createTag()`, `deleteTag()`, `listTags()` + `TagInfo` interface
- i18n: 10 keys under `erd.version.tag.*` in en.json + cn.json

### Git Operations

- Create: `git.raw(['tag', tagName, ref])` (lightweight tag)
- Delete: `git.raw(['tag', '-d', tagName])`
- List: `git.raw(['tag', '-l', '--format=%(refname:short) %(objectname) %(creatordate:iso)'])`
- Push: `git.raw(['push', 'origin', 'refs/tags/' + tagName])` — **MUST use `refs/tags/` prefix**
- Remote delete: `git.raw(['push', 'origin', ':refs/tags/' + tagName])`

## Pitfalls Discovered During Review

### 1. Backend-Frontend type field name consistency (CRITICAL)

Backend `createTag()` and `listTags()` returned `{ commitHash, ... }` but the frontend `TagInfo` interface expected `{ ref, ... }`. When the frontend eventually consumed `tagInfo.ref`, it would be `undefined`.

**Rule:** When defining API response types, the backend interface field names MUST exactly match the frontend interface field names. Use a shared type definition or verify field-by-field.

**Prevention checklist:**
1. Define the response interface in one place (backend or shared package)
2. When creating the frontend API helper, copy field names verbatim from backend
3. Reviewer should verify field name parity between backend DTO and frontend interface

### 2. git tag push needs `refs/tags/` prefix

`git.push('origin', tagName)` is ambiguous when a branch with the same name exists. Git will error with `src refspec X matches more than one`.

**Fix:** Always use explicit ref path:
```typescript
// Push tag
await git.raw(['push', 'origin', `refs/tags/${tagName}`])
// Delete remote tag
await git.raw(['push', 'origin', `:refs/tags/${tagName}`])
```

### 3. `pushToRemoteAsync` doesn't push tags

The existing `pushToRemoteAsync()` method uses `git.push('origin', 'main')` which only pushes commits, not tags. Tag changes require a separate push.

**Fix:** Create a dedicated `pushTagToRemoteAsync()` method:
```typescript
private pushTagToRemoteAsync(teamId: string, collectionId: string, git: SimpleGit, tagName: string): void {
  git.raw(['push', 'origin', `refs/tags/${tagName}`])
    .then(() => this.logger.debug(`Remote tag push succeeded: ${tagName}`))
    .catch((err) => this.logger.warn(`Remote tag push failed: ${err.message}`))
}
```

Call this from `createTag()` and `deleteTag()` after the local git operation.

### 4. Save `git.revparse()` return value

`createTag()` calls `git.revparse([ref])` to validate the ref, but didn't save the return value. Then it used the raw input `ref` string in the response instead of the resolved full commit hash.

**Fix:**
```typescript
const resolvedHash = await git.revparse([ref])  // returns full 40-char hash
return E.right({ tagName, commitHash: resolvedHash, createdAt: new Date().toISOString() })
```

### 5. `listTags` hash length inconsistency

`listTags()` used `%(objectname:short)` format (7-char hash) while `createTag()` returned the full 40-char hash from `revparse()`. This inconsistency breaks any code that compares hashes between the two endpoints.

**Fix:** Use `%(objectname)` (full hash) in the list format, consistent with `revparse()`.

### 6. DELETE endpoint path parameter validation

The `DELETE /tag/:tagName` endpoint's path parameter needs the SAME format validation (`/^[a-zA-Z0-9._-]{1,50}$/`) as the POST DTO. Without it, a malicious tagName in the URL bypasses the DTO validator.

**Fix:** Extract validation into a shared method and call it in both POST and DELETE handlers:
```typescript
private validateTagName(name: string): string {
  if (!/^[a-zA-Z0-9._-]{1,50}$/.test(name)) {
    throw new BadRequestException('Invalid tag name format')
  }
  return name
}
```

### 7. `validateRef()` must support tag names

The existing `validateRef()` only allowed hex hashes (`[0-9a-f]{7,40}`) and `HEAD~N` patterns. Tag names (e.g., `v1.0`, `release-2026-Q1`) were rejected.

**Fix:** Add a tag-name pattern to the regex:
```typescript
private validateRef(ref: string): string {
  if (/^[0-9a-f]{7,40}$/i.test(ref) || /^HEAD~?\d*$/.test(ref) || /^[a-zA-Z0-9._-]{1,50}$/.test(ref)) {
    return ref
  }
  throw new BadRequestException('Invalid git ref format')
}
```

**Route ordering:** `GET /tags` MUST be registered BEFORE `GET /:ref` to prevent NestJS from matching `tags` as a ref parameter.

### 8. Version panel entry point must not be gated by route params

The IconHistory toolbar button was originally wrapped in `v-if="hasCollectionContext"`, which required `?teamId=xxx&collectionId=xxx` in the URL. Users accessing `/erd` directly never saw the button — the feature was invisible.

**Fix:** Removed the `v-if` guard. The button is always visible. When no collection context exists, API calls return 404/empty gracefully, and the panel shows "No versions yet."

**General rule:** See the "Feature gating behind route params" pitfall in SKILL.md.
