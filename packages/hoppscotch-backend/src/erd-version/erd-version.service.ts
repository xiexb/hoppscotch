import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { simpleGit, SimpleGit, LogResult } from 'simple-git';
import { Mutex } from 'async-mutex';
import * as E from 'fp-ts/Either';
import * as path from 'path';
import * as fs from 'fs/promises';
import {
  ERD_VERSION_REPO_NOT_FOUND,
  ERD_VERSION_COMMIT_FAILED,
  ERD_VERSION_REF_NOT_FOUND,
  ERD_VERSION_REVERT_FAILED,
  ERD_VERSION_DIFF_FAILED,
  ERD_VERSION_LOG_FAILED,
  ERD_VERSION_INVALID_JSON,
  ERD_VERSION_REMOTE_PUSH_FAILED,
} from 'src/errors';
import {
  normalizeErdJson,
  NormalizedErdSchema,
} from './erd-normalize.util';
import { diffNormalizedErd, DiffResult } from './erd-diff.util';
import { generateCommitMessage } from './erd-commit-msg.util';

// ─── Types ──────────────────────────────────────────────────────────

/** Result of a successful commit */
export interface CommitResult {
  commitHash: string;
  shortHash: string;
  message: string;
  timestamp: string;
  stats: {
    filesChanged: number;
    insertions: number;
    deletions: number;
  };
}

/** A single log entry */
export interface VersionLogEntry {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  stats: {
    filesChanged: number;
    insertions: number;
    deletions: number;
  } | null;
  tags: string[];
}

/** Status of remote push for a collection */
export interface RemoteStatus {
  configured: boolean;
  url: string | null;
  lastPushAt: string | null;
  lastPushError: string | null;
  aheadOfRemote: number;
}

// ─── Constants ──────────────────────────────────────────────────────

const DEFAULT_ERD_VERSION_ROOT = '/data/erd-versions';
const ERD_DIR = 'erd';
const ERD_SCHEMA_FILE = 'erd-schema.json';
const ERD_NORMALIZED_FILE = 'erd-schema.normalized.json';
const GIT_USER_NAME = 'ERD Version Bot';
const GIT_USER_EMAIL = '***';

// ─── Service ────────────────────────────────────────────────────────

/**
 * ErdVersionService — manages ERD version history via per-collection git repos.
 *
 * Each (teamId, collectionId) pair gets its own git repository at:
 *   <ERD_VERSION_ROOT>/<teamId>/<collectionId>/
 *
 * Repository structure:
 *   erd/erd-schema.json              — full erd-editor v3.0.0 JSON
 *   erd/erd-schema.normalized.json   — normalized (diff-friendly) version
 *   api/                              — reserved for future use
 *   tests/                            — reserved for future use
 */
@Injectable()
export class ErdVersionService {
  private readonly logger = new Logger(ErdVersionService.name);

  /** Root directory for all ERD version repositories */
  private readonly erdVersionRoot: string;

  /** Per-collection mutexes to prevent concurrent git operations */
  private readonly mutexes = new Map<string, Mutex>();

  /** Per-collection remote push status tracking */
  private readonly remoteStatuses = new Map<
    string,
    { lastPushAt: string | null; lastPushError: string | null }
  >();

  /** Default remote URL from environment (optional) */
  private readonly defaultRemoteUrl: string | undefined;

  /** SSH key path for remote operations (optional) */
  private readonly sshKeyPath: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.erdVersionRoot =
      this.configService.get<string>('ERD_VERSION_ROOT') ||
      DEFAULT_ERD_VERSION_ROOT;
    this.defaultRemoteUrl = this.configService.get<string>(
      'ERD_VERSION_REMOTE_URL',
    );
    this.sshKeyPath = this.configService.get<string>('ERD_VERSION_SSH_KEY');
    this.logger.log(
      `ERD version root: ${this.erdVersionRoot}`,
    );
  }

  // ─── Repository Management ──────────────────────────────────────

  /**
   * Get the local filesystem path for a collection's git repo.
   */
  private getRepoPath(teamId: string, collectionId: string): string {
    return path.join(this.erdVersionRoot, teamId, collectionId);
  }

  /**
   * Build a unique key for mutex lookup.
   */
  private getCollectionKey(teamId: string, collectionId: string): string {
    return `${teamId}/${collectionId}`;
  }

  /**
   * Get or create a Mutex for a specific collection.
   */
  private getMutex(teamId: string, collectionId: string): Mutex {
    const key = this.getCollectionKey(teamId, collectionId);
    let mutex = this.mutexes.get(key);
    if (!mutex) {
      mutex = new Mutex();
      this.mutexes.set(key, mutex);
    }
    return mutex;
  }

  /**
   * Create a simple-git instance configured for the given repo path.
   */
  private createGit(repoPath: string): SimpleGit {
    return simpleGit(repoPath, {
      config: [
        `user.name=${GIT_USER_NAME}`,
        `user.email=${GIT_USER_EMAIL}`,
      ],
    });
  }

  /**
   * Check if a git repo exists at the given path.
   */
  private async repoExists(repoPath: string): Promise<boolean> {
    try {
      const gitDir = path.join(repoPath, '.git');
      await fs.access(gitDir);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Initialize a new git repository for a collection.
   * Creates directory structure, README.md, and initial commit.
   */
  private async initRepo(
    teamId: string,
    collectionId: string,
  ): Promise<E.Either<string, SimpleGit>> {
    const repoPath = this.getRepoPath(teamId, collectionId);

    try {
      // Create directory structure
      await fs.mkdir(path.join(repoPath, ERD_DIR), { recursive: true });
      await fs.mkdir(path.join(repoPath, 'api'), { recursive: true });
      await fs.mkdir(path.join(repoPath, 'tests'), { recursive: true });

      // Initialize git repo
      const git = this.createGit(repoPath);
      await git.init();

      // Configure git user
      await git.addConfig('user.name', GIT_USER_NAME);
      await git.addConfig('user.email', GIT_USER_EMAIL);

      // Configure SSH key if provided
      if (this.sshKeyPath) {
        await git.addConfig(
          'core.sshCommand',
          `ssh -i ${this.sshKeyPath} -o StrictHostKeyChecking=no`,
        );
      }

      // Create README.md
      const readme = `# ERD Version History\n\nTeam: ${teamId}\nCollection: ${collectionId}\n\nAuto-managed by Hoppscotch ERD Version Service.\n`;
      await fs.writeFile(path.join(repoPath, 'README.md'), readme, 'utf-8');

      // Create .gitkeep for reserved directories
      await fs.writeFile(path.join(repoPath, 'api', '.gitkeep'), '', 'utf-8');
      await fs.writeFile(path.join(repoPath, 'tests', '.gitkeep'), '', 'utf-8');

      // Initial commit
      await git.add('.');
      await git.commit('init: ERD version repository');

      // Configure remote if default URL is available
      if (this.defaultRemoteUrl) {
        await git.addRemote('origin', this.defaultRemoteUrl).catch(() => {
          // Remote might already exist
        });
      }

      this.logger.log(
        `Initialized ERD version repo: ${teamId}/${collectionId}`,
      );
      return E.right(git);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to init repo for ${teamId}/${collectionId}: ${msg}`,
      );
      return E.left(ERD_VERSION_REPO_NOT_FOUND);
    }
  }

  /**
   * Get or initialize the git repo for a collection.
   * Returns a configured SimpleGit instance.
   */
  private async getOrInitRepo(
    teamId: string,
    collectionId: string,
  ): Promise<E.Either<string, SimpleGit>> {
    const repoPath = this.getRepoPath(teamId, collectionId);

    if (await this.repoExists(repoPath)) {
      return E.right(this.createGit(repoPath));
    }

    return this.initRepo(teamId, collectionId);
  }

  // ─── Core Operations ────────────────────────────────────────────

  /**
   * Commit a new ERD version.
   *
   * Flow:
   * 1. Acquire per-collection mutex
   * 2. Get/initialize repo
   * 3. Normalize the ERD JSON
   * 4. Compare with last committed normalized version
   * 5. If no changes (and not forced), skip commit
   * 6. Write both JSON files
   * 7. Generate commit message (auto or user-provided)
   * 8. git add + commit
   * 9. Async push to remote (non-blocking)
   *
   * @returns Either<error_code, CommitResult>
   */
  async commitVersion(
    teamId: string,
    collectionId: string,
    erdJson: string,
    message?: string,
    force?: boolean,
  ): Promise<E.Either<string, CommitResult>> {
    const mutex = this.getMutex(teamId, collectionId);

    return mutex.runExclusive(async () => {
      // 1. Normalize
      let normalized: NormalizedErdSchema;
      try {
        normalized = normalizeErdJson(erdJson);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Invalid ERD JSON: ${msg}`);
        return E.left(ERD_VERSION_INVALID_JSON);
      }

      // 2. Get or init repo
      const repoResult = await this.getOrInitRepo(teamId, collectionId);
      if (E.isLeft(repoResult)) {
        return repoResult;
      }
      const git = repoResult.right;
      const repoPath = this.getRepoPath(teamId, collectionId);

      try {
        // 3. Compare with last committed normalized version
        const normalizedPath = path.join(
          repoPath,
          ERD_DIR,
          ERD_NORMALIZED_FILE,
        );

        if (!force) {
          try {
            const lastNormalizedStr = await fs.readFile(
              normalizedPath,
              'utf-8',
            );
            const lastNormalized: NormalizedErdSchema = JSON.parse(
              lastNormalizedStr,
            );

            // Compare normalized structures (ignore generatedAt timestamp)
            const diff = diffNormalizedErd(lastNormalized, normalized);
            if (diff.summary.totalChanges === 0) {
              this.logger.debug(
                `No changes detected for ${teamId}/${collectionId}, skipping commit`,
              );
              // Return the last commit info
              const log = await git.log({ maxCount: 1 });
              const latest = log.latest;
              if (latest) {
                return E.right({
                  commitHash: latest.hash,
                  shortHash: latest.hash.substring(0, 7),
                  message: latest.message,
                  timestamp: latest.date,
                  stats: { filesChanged: 0, insertions: 0, deletions: 0 },
                });
              }
            }
          } catch {
            // No previous normalized file — first commit, proceed
          }
        }

        // 4. Compute diff for commit message generation
        let commitMessage = message;
        if (!commitMessage) {
          try {
            const lastNormalizedStr = await fs.readFile(
              normalizedPath,
              'utf-8',
            );
            const lastNormalized: NormalizedErdSchema = JSON.parse(
              lastNormalizedStr,
            );
            const diff = diffNormalizedErd(lastNormalized, normalized);
            commitMessage = generateCommitMessage(diff);
          } catch {
            commitMessage = 'erd: initial version';
          }
        }

        // 5. Write files
        const schemaPath = path.join(repoPath, ERD_DIR, ERD_SCHEMA_FILE);
        await fs.writeFile(schemaPath, erdJson, 'utf-8');
        await fs.writeFile(
          normalizedPath,
          JSON.stringify(normalized, null, 2),
          'utf-8',
        );

        // 6. Git add + commit
        await git.add('.');
        const commitResult = await git.commit(commitMessage);

        const commitHash = commitResult.commit || '';
        const shortHash = commitHash.substring(0, 7);

        // 7. Get commit stats
        let stats = { filesChanged: 0, insertions: 0, deletions: 0 };
        try {
          const statOutput = await git.raw([
            'diff',
            '--stat',
            '--numstat',
            `${commitHash}~1`,
            commitHash,
          ]);
          stats = this.parseGitStats(statOutput);
        } catch {
          // First commit has no parent, that's fine
          stats = { filesChanged: 2, insertions: 0, deletions: 0 };
        }

        const result: CommitResult = {
          commitHash,
          shortHash,
          message: commitMessage,
          timestamp: new Date().toISOString(),
          stats,
        };

        // 8. Async push to remote (non-blocking)
        this.pushToRemoteAsync(teamId, collectionId, git);

        this.logger.log(
          `Committed ERD version ${shortHash} for ${teamId}/${collectionId}: ${commitMessage}`,
        );
        return E.right(result);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Commit failed for ${teamId}/${collectionId}: ${msg}`,
        );
        return E.left(ERD_VERSION_COMMIT_FAILED);
      }
    });
  }

  /**
   * Get the version log for a collection.
   *
   * @returns Either<error_code, VersionLogEntry[]>
   */
  async getVersionLog(
    teamId: string,
    collectionId: string,
    maxCount = 50,
  ): Promise<E.Either<string, VersionLogEntry[]>> {
    const repoPath = this.getRepoPath(teamId, collectionId);

    if (!(await this.repoExists(repoPath))) {
      return E.right([]); // No repo yet = no history
    }

    const git = this.createGit(repoPath);

    try {
      const log: LogResult = await git.log({
        maxCount,
      });

      const entries: VersionLogEntry[] = log.all.map((entry) => {
        // Parse tags from refs
        const tags: string[] = [];
        if (entry.refs) {
          const refParts = entry.refs.split(',').map((s) => s.trim());
          for (const ref of refParts) {
            if (ref.startsWith('tag: ')) {
              tags.push(ref.substring(5));
            }
          }
        }

        // Extract stats from diff if available (requires --stat in log options)
        const diffStats = (entry as any).diff;
        return {
          hash: entry.hash,
          shortHash: entry.hash.substring(0, 7),
          message: entry.message,
          author: entry.author_name,
          date: entry.date,
          stats: diffStats
            ? {
                filesChanged: diffStats.changed ?? 0,
                insertions: diffStats.insertions ?? 0,
                deletions: diffStats.deletions ?? 0,
              }
            : null,
          tags,
        };
      });

      return E.right(entries);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Log failed for ${teamId}/${collectionId}: ${msg}`,
      );
      return E.left(ERD_VERSION_LOG_FAILED);
    }
  }

  /**
   * Get a specific version's full ERD JSON by git ref.
   *
   * @param ref - Git ref: commit hash, tag, or expression like HEAD~1
   * @returns Either<error_code, erdJson string>
   */
  async getVersion(
    teamId: string,
    collectionId: string,
    ref: string,
  ): Promise<E.Either<string, string>> {
    const repoPath = this.getRepoPath(teamId, collectionId);

    if (!(await this.repoExists(repoPath))) {
      return E.left(ERD_VERSION_REPO_NOT_FOUND);
    }

    const git = this.createGit(repoPath);

    try {
      const content = await git.show([
        `${ref}:${ERD_DIR}/${ERD_SCHEMA_FILE}`,
      ]);
      return E.right(content);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Get version failed for ref ${ref} in ${teamId}/${collectionId}: ${msg}`,
      );
      return E.left(ERD_VERSION_REF_NOT_FOUND);
    }
  }

  /**
   * Compute a structural diff between two versions.
   *
   * @param fromRef - Base ref (defaults to HEAD~1)
   * @param toRef - Target ref (defaults to HEAD)
   * @returns Either<error_code, DiffResult>
   */
  async getDiff(
    teamId: string,
    collectionId: string,
    fromRef?: string,
    toRef?: string,
  ): Promise<E.Either<string, DiffResult>> {
    const repoPath = this.getRepoPath(teamId, collectionId);

    if (!(await this.repoExists(repoPath))) {
      return E.left(ERD_VERSION_REPO_NOT_FOUND);
    }

    const git = this.createGit(repoPath);
    const from = fromRef || 'HEAD~1';
    const to = toRef || 'HEAD';

    try {
      // Read normalized JSON from both refs
      const fromContent = await git.show([
        `${from}:${ERD_DIR}/${ERD_NORMALIZED_FILE}`,
      ]);
      const toContent = await git.show([
        `${to}:${ERD_DIR}/${ERD_NORMALIZED_FILE}`,
      ]);

      const fromNormalized: NormalizedErdSchema = JSON.parse(fromContent);
      const toNormalized: NormalizedErdSchema = JSON.parse(toContent);

      const diff = diffNormalizedErd(fromNormalized, toNormalized);
      return E.right(diff);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Diff failed for ${teamId}/${collectionId} (${from}..${to}): ${msg}`,
      );
      return E.left(ERD_VERSION_DIFF_FAILED);
    }
  }

  /**
   * Restore a specific version — returns the ERD JSON for the frontend to load.
   * This is essentially the same as getVersion but semantically distinct.
   *
   * @param ref - Git ref to restore from
   * @returns Either<error_code, erdJson string>
   */
  async restoreVersion(
    teamId: string,
    collectionId: string,
    ref: string,
  ): Promise<E.Either<string, string>> {
    return this.getVersion(teamId, collectionId, ref);
  }

  /**
   * Revert a specific version using `git revert`.
   * Creates a new commit that undoes the changes from the given ref.
   *
   * @param ref - Git ref to revert
   * @returns Either<error_code, CommitResult>
   */
  async revertVersion(
    teamId: string,
    collectionId: string,
    ref: string,
  ): Promise<E.Either<string, CommitResult>> {
    const mutex = this.getMutex(teamId, collectionId);

    return mutex.runExclusive(async () => {
      const repoPath = this.getRepoPath(teamId, collectionId);

      if (!(await this.repoExists(repoPath))) {
        return E.left(ERD_VERSION_REPO_NOT_FOUND);
      }

      const git = this.createGit(repoPath);

      try {
        // Verify the ref exists
        await git.revparse([ref]);

        // git revert --no-edit <ref>
        await git.raw(['revert', ref, '--no-edit']);

        // Get the new commit info
        const log = await git.log({ maxCount: 1 });
        const latest = log.latest;

        if (!latest) {
          return E.left(ERD_VERSION_REVERT_FAILED);
        }

        const revertDiff = (latest as any).diff;
        const result: CommitResult = {
          commitHash: latest.hash,
          shortHash: latest.hash.substring(0, 7),
          message: latest.message,
          timestamp: latest.date,
          stats: revertDiff
            ? {
                filesChanged: revertDiff.changed ?? 0,
                insertions: revertDiff.insertions ?? 0,
                deletions: revertDiff.deletions ?? 0,
              }
            : { filesChanged: 0, insertions: 0, deletions: 0 },
        };

        // Async push
        this.pushToRemoteAsync(teamId, collectionId, git);

        this.logger.log(
          `Reverted ${ref} for ${teamId}/${collectionId}: ${latest.message}`,
        );
        return E.right(result);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Revert failed for ${ref} in ${teamId}/${collectionId}: ${msg}`,
        );
        return E.left(ERD_VERSION_REVERT_FAILED);
      }
    });
  }

  // ─── Remote Operations ──────────────────────────────────────────

  /**
   * Push to remote asynchronously (non-blocking).
   * Failures are logged but do not affect the commit response.
   */
  private pushToRemoteAsync(
    teamId: string,
    collectionId: string,
    git: SimpleGit,
  ): void {
    const key = this.getCollectionKey(teamId, collectionId);

    // Check if remote is configured
    git
      .getRemotes()
      .then((remotes) => {
        if (remotes.length === 0) {
          return; // No remote configured, skip push
        }

        return git.push('origin', 'main').then(() => {
          this.remoteStatuses.set(key, {
            lastPushAt: new Date().toISOString(),
            lastPushError: null,
          });
          this.logger.debug(
            `Remote push succeeded for ${key}`,
          );
        });
      })
      .catch((error) => {
        const msg = error instanceof Error ? error.message : String(error);
        this.remoteStatuses.set(key, {
          lastPushAt: null,
          lastPushError: msg,
        });
        this.logger.warn(
          `Remote push failed for ${key}: ${msg}`,
        );
      });
  }

  /**
   * Get the remote push status for a collection.
   */
  async getRemoteStatus(
    teamId: string,
    collectionId: string,
  ): Promise<RemoteStatus> {
    const key = this.getCollectionKey(teamId, collectionId);
    const repoPath = this.getRepoPath(teamId, collectionId);
    const status = this.remoteStatuses.get(key);

    if (!(await this.repoExists(repoPath))) {
      return {
        configured: false,
        url: null,
        lastPushAt: null,
        lastPushError: null,
        aheadOfRemote: 0,
      };
    }

    const git = this.createGit(repoPath);

    let remoteUrl: string | null = null;
    let aheadOfRemote = 0;

    try {
      const remotes = await git.getRemotes(true);
      if (remotes.length > 0) {
        remoteUrl = remotes[0].refs.push || remotes[0].refs.fetch || null;
      }

      // Check ahead/behind status
      if (remoteUrl) {
        try {
          const revList = await git.raw([
            'rev-list',
            '--left-right',
            '--count',
            'HEAD...@{upstream}',
          ]);
          const parts = revList.trim().split(/\s+/);
          aheadOfRemote = parseInt(parts[0], 10) || 0;
        } catch {
          // No upstream tracking branch yet
        }
      }
    } catch {
      // Remotes query failed
    }

    return {
      configured: remoteUrl !== null,
      url: remoteUrl,
      lastPushAt: status?.lastPushAt ?? null,
      lastPushError: status?.lastPushError ?? null,
      aheadOfRemote,
    };
  }

  /**
   * Configure a remote for a specific collection's repo.
   */
  async configureRemote(
    teamId: string,
    collectionId: string,
    url: string,
    name = 'origin',
  ): Promise<E.Either<string, boolean>> {
    const mutex = this.getMutex(teamId, collectionId);

    return mutex.runExclusive(async () => {
      const repoPath = this.getRepoPath(teamId, collectionId);

      if (!(await this.repoExists(repoPath))) {
        return E.left(ERD_VERSION_REPO_NOT_FOUND);
      }

      const git = this.createGit(repoPath);

      try {
        // Remove existing remote with the same name
        const remotes = await git.getRemotes();
        if (remotes.some((r) => r.name === name)) {
          await git.removeRemote(name);
        }

        await git.addRemote(name, url);

        // Configure SSH key if provided
        if (this.sshKeyPath) {
          await git.addConfig(
            'core.sshCommand',
            `ssh -i ${this.sshKeyPath} -o StrictHostKeyChecking=no`,
          );
        }

        this.logger.log(
          `Configured remote '${name}' for ${teamId}/${collectionId}: ${url}`,
        );
        return E.right(true);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to configure remote for ${teamId}/${collectionId}: ${msg}`,
        );
        return E.left(ERD_VERSION_REMOTE_PUSH_FAILED);
      }
    });
  }

  // ─── Public Accessors ─────────────────────────────────────────

  /**
   * Get the repo path for a collection (public for export use).
   */
  async getRepoPathPublic(
    teamId: string,
    collectionId: string,
  ): Promise<E.Either<string, string>> {
    const repoPath = this.getRepoPath(teamId, collectionId);
    if (!(await this.repoExists(repoPath))) {
      return E.left(ERD_VERSION_REPO_NOT_FOUND);
    }
    return E.right(repoPath);
  }

  /**
   * Push to remote synchronously (blocking, returns result).
   */
  async pushToRemoteNow(
    teamId: string,
    collectionId: string,
  ): Promise<E.Either<string, { pushed: boolean }>> {
    const mutex = this.getMutex(teamId, collectionId);

    return mutex.runExclusive(async () => {
      const repoPath = this.getRepoPath(teamId, collectionId);

      if (!(await this.repoExists(repoPath))) {
        return E.left(ERD_VERSION_REPO_NOT_FOUND);
      }

      const git = this.createGit(repoPath);

      try {
        const remotes = await git.getRemotes();
        if (remotes.length === 0) {
          return E.right({ pushed: false });
        }

        await git.push('origin', 'main');

        const key = this.getCollectionKey(teamId, collectionId);
        this.remoteStatuses.set(key, {
          lastPushAt: new Date().toISOString(),
          lastPushError: null,
        });

        this.logger.log(
          `Manual push succeeded for ${teamId}/${collectionId}`,
        );
        return E.right({ pushed: true });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Manual push failed for ${teamId}/${collectionId}: ${msg}`,
        );
        return E.left(ERD_VERSION_REMOTE_PUSH_FAILED);
      }
    });
  }

  /**
   * Get version stats: count tables, columns, relationships from normalized JSON.
   */
  async getVersionStats(
    teamId: string,
    collectionId: string,
    ref: string,
  ): Promise<
    E.Either<
      string,
      { tables: number; columns: number; relationships: number }
    >
  > {
    const repoPath = this.getRepoPath(teamId, collectionId);

    if (!(await this.repoExists(repoPath))) {
      return E.left(ERD_VERSION_REPO_NOT_FOUND);
    }

    const git = this.createGit(repoPath);

    try {
      const content = await git.show([
        `${ref}:${ERD_DIR}/${ERD_NORMALIZED_FILE}`,
      ]);
      const normalized: NormalizedErdSchema = JSON.parse(content);

      const tables = normalized.tables.length;
      const columns = normalized.tables.reduce(
        (sum, t) => sum + t.columns.length,
        0,
      );
      const relationships = normalized.relationships.length;

      return E.right({ tables, columns, relationships });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Stats failed for ref ${ref} in ${teamId}/${collectionId}: ${msg}`,
      );
      return E.left(ERD_VERSION_REF_NOT_FOUND);
    }
  }

  // ─── Utility ────────────────────────────────────────────────────

  /**
   * Parse git numstat output into stats object.
   */
  private parseGitStats(output: string): {
    filesChanged: number;
    insertions: number;
    deletions: number;
  } {
    let insertions = 0;
    let deletions = 0;
    let filesChanged = 0;

    const lines = output.trim().split('\n');
    for (const line of lines) {
      const match = line.match(/^(\d+)\s+(\d+)\s+(.+)$/);
      if (match) {
        filesChanged++;
        insertions += parseInt(match[1], 10);
        deletions += parseInt(match[2], 10);
      }
    }

    return { filesChanged, insertions, deletions };
  }
}
