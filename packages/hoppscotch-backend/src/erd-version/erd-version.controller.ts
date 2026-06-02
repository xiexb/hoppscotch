import {
  Controller,
  Get,
  Post,
  Delete,
  Put,
  Query,
  Param,
  Body,
  UseGuards,
  HttpException,
  HttpStatus,
  Res,
  StreamableFile,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Response } from 'express';
import { spawn } from 'child_process';
import * as E from 'fp-ts/Either';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { GqlUser } from 'src/decorators/gql-user.decorator';
import { AuthUser } from 'src/types/AuthUser';
import { ThrottlerBehindProxyGuard } from 'src/guards/throttler-behind-proxy.guard';
import { ErdVersionService } from './erd-version.service';
import { CommitVersionDto } from './dto/commit-version.dto';
import { DiffQueryDto } from './dto/diff-query.dto';
import { RemoteConfigDto } from './dto/remote-config.dto';
import { CreateTagDto } from './dto/create-tag.dto';
import { TeamService } from '../team/team.service';

/**
 * ErdVersionController — REST endpoints for ERD version management.
 *
 * Base path: /api/v1/erd-version
 * All endpoints require JWT authentication + team membership validation.
 */
@UseGuards(ThrottlerBehindProxyGuard)
@Controller({ path: 'erd-version', version: '1' })
export class ErdVersionController {
  constructor(
    private readonly erdVersionService: ErdVersionService,
    private readonly teamService: TeamService,
  ) {}

  // ─── Helpers ────────────────────────────────────────────────────

  /**
   * Unwrap an fp-ts Either: return the right value or throw an HttpException.
   */
  private unwrap<T>(
    result: E.Either<string, T>,
    statusCode = HttpStatus.BAD_REQUEST,
  ): T {
    if (E.isLeft(result)) {
      throw new HttpException(result.left, statusCode);
    }
    return result.right;
  }

  /**
   * Validate required query parameters teamId and collectionId.
   * Ensures values contain only safe characters to prevent path traversal.
   */
  private validateCollectionParams(
    teamId: string | undefined,
    collectionId: string | undefined,
  ): { teamId: string; collectionId: string } {
    if (!teamId || !collectionId) {
      throw new BadRequestException(
        'Query parameters teamId and collectionId are required',
      );
    }
    // Reject path traversal attempts — only alphanumeric, hyphens, underscores allowed
    const safeIdPattern = /^[a-zA-Z0-9_-]+$/;
    if (!safeIdPattern.test(teamId) || !safeIdPattern.test(collectionId)) {
      throw new BadRequestException(
        'Invalid teamId or collectionId format',
      );
    }
    return { teamId, collectionId };
  }

  /**
   * Validate a git ref parameter to prevent command injection.
   * Allows: commit hashes (7-40 hex chars), HEAD~N expressions, or tag names
   * (alphanumeric with dots, underscores, hyphens — max 50 chars).
   */
  private validateRef(ref: string): string {
    if (!ref) {
      throw new BadRequestException('Parameter ref is required');
    }
    // Allow: commit hashes (7-40 hex), HEAD, HEAD~N, tag names (alphanumeric + ._-)
    if (
      /^[0-9a-f]{7,40}$/i.test(ref) ||
      /^HEAD~?\d*$/.test(ref) ||
      /^[a-zA-Z0-9._-]{1,50}$/.test(ref)
    ) {
      return ref;
    }
    throw new BadRequestException('Invalid git ref format');
  }

  /**
   * Validate that the authenticated user is a member of the specified team.
   */
  private async validateTeamMembership(
    userId: string,
    teamId: string,
  ): Promise<void> {
    const member = await this.teamService.getTeamMember(teamId, userId);
    if (!member) {
      throw new ForbiddenException('You are not a member of this team');
    }
  }

  // ─── Commit ─────────────────────────────────────────────────────

  /**
   * POST /api/v1/erd-version/commit
   * Commit a new ERD version.
   */
  @Post('commit')
  @UseGuards(JwtAuthGuard)
  async commitVersion(
    @GqlUser() user: AuthUser,
    @Query('teamId') teamId: string,
    @Query('collectionId') collectionId: string,
    @Body() dto: CommitVersionDto,
  ) {
    const { teamId: tid, collectionId: cid } =
      this.validateCollectionParams(teamId, collectionId);
    await this.validateTeamMembership(user.uid, tid);

    const result = await this.erdVersionService.commitVersion(
      tid,
      cid,
      dto.erdJson,
      dto.message,
      dto.force,
    );
    return this.unwrap(result);
  }

  // ─── Log ────────────────────────────────────────────────────────

  /**
   * GET /api/v1/erd-version/log
   * Get the version history log.
   */
  @Get('log')
  @UseGuards(JwtAuthGuard)
  async getVersionLog(
    @GqlUser() user: AuthUser,
    @Query('teamId') teamId: string,
    @Query('collectionId') collectionId: string,
    @Query('limit') limit?: string,
    @Query('offset') _offset?: string,
  ) {
    const { teamId: tid, collectionId: cid } =
      this.validateCollectionParams(teamId, collectionId);
    await this.validateTeamMembership(user.uid, tid);

    const maxCount = limit ? parseInt(limit, 10) || 50 : 50;

    const result = await this.erdVersionService.getVersionLog(
      tid,
      cid,
      maxCount,
    );
    return this.unwrap(result);
  }

  // ─── Diff ───────────────────────────────────────────────────────

  /**
   * GET /api/v1/erd-version/diff
   * Compute a structural diff between two versions.
   */
  @Get('diff')
  @UseGuards(JwtAuthGuard)
  async getDiff(
    @GqlUser() user: AuthUser,
    @Query('teamId') teamId: string,
    @Query('collectionId') collectionId: string,
    @Query() query: DiffQueryDto,
  ) {
    const { teamId: tid, collectionId: cid } =
      this.validateCollectionParams(teamId, collectionId);
    await this.validateTeamMembership(user.uid, tid);

    // Validate refs if provided
    if (query.from) this.validateRef(query.from);
    if (query.to) this.validateRef(query.to);

    const result = await this.erdVersionService.getDiff(
      tid,
      cid,
      query.from,
      query.to,
    );
    return this.unwrap(result);
  }

  // ─── Stats ──────────────────────────────────────────────────────

  /**
   * GET /api/v1/erd-version/stats/:ref
   * Get table/column/relationship counts for a specific version.
   */
  @Get('stats/:ref')
  @UseGuards(JwtAuthGuard)
  async getVersionStats(
    @GqlUser() user: AuthUser,
    @Query('teamId') teamId: string,
    @Query('collectionId') collectionId: string,
    @Param('ref') ref: string,
  ) {
    const { teamId: tid, collectionId: cid } =
      this.validateCollectionParams(teamId, collectionId);
    await this.validateTeamMembership(user.uid, tid);
    this.validateRef(ref);

    const result = await this.erdVersionService.getVersionStats(
      tid,
      cid,
      ref,
    );
    return this.unwrap(result, HttpStatus.NOT_FOUND);
  }

  // ─── Remote ─────────────────────────────────────────────────────

  /**
   * PUT /api/v1/erd-version/remote
   * Configure a remote git repository for the collection.
   */
  @Put('remote')
  @UseGuards(JwtAuthGuard)
  async configureRemote(
    @GqlUser() user: AuthUser,
    @Query('teamId') teamId: string,
    @Query('collectionId') collectionId: string,
    @Body() dto: RemoteConfigDto,
  ) {
    const { teamId: tid, collectionId: cid } =
      this.validateCollectionParams(teamId, collectionId);
    await this.validateTeamMembership(user.uid, tid);

    const result = await this.erdVersionService.configureRemote(
      tid,
      cid,
      dto.url,
      dto.name,
    );
    const success = this.unwrap(result);
    return { success, remoteUrl: dto.url };
  }

  /**
   * GET /api/v1/erd-version/remote
   * Get the remote configuration and push status.
   */
  @Get('remote')
  @UseGuards(JwtAuthGuard)
  async getRemoteStatus(
    @GqlUser() user: AuthUser,
    @Query('teamId') teamId: string,
    @Query('collectionId') collectionId: string,
  ) {
    const { teamId: tid, collectionId: cid } =
      this.validateCollectionParams(teamId, collectionId);
    await this.validateTeamMembership(user.uid, tid);

    const status = await this.erdVersionService.getRemoteStatus(tid, cid);
    return {
      remoteUrl: status.url,
      configured: status.configured,
      lastPushAt: status.lastPushAt,
      lastPushError: status.lastPushError,
      aheadOfRemote: status.aheadOfRemote,
    };
  }

  // ─── Push ───────────────────────────────────────────────────────

  /**
   * POST /api/v1/erd-version/push
   * Trigger a manual push to the configured remote.
   */
  @Post('push')
  @UseGuards(JwtAuthGuard)
  async pushToRemote(
    @GqlUser() user: AuthUser,
    @Query('teamId') teamId: string,
    @Query('collectionId') collectionId: string,
  ) {
    const { teamId: tid, collectionId: cid } =
      this.validateCollectionParams(teamId, collectionId);
    await this.validateTeamMembership(user.uid, tid);

    const result = await this.erdVersionService.pushToRemoteNow(tid, cid);
    const pushResult = this.unwrap(result);
    return { success: true, pushed: pushResult.pushed };
  }

  // ─── Export ─────────────────────────────────────────────────────

  /**
   * GET /api/v1/erd-version/export
   * Export the collection's version repo as a .tar.gz archive.
   */
  @Get('export')
  @UseGuards(JwtAuthGuard)
  async exportRepo(
    @GqlUser() user: AuthUser,
    @Query('teamId') teamId: string,
    @Query('collectionId') collectionId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { teamId: tid, collectionId: cid } =
      this.validateCollectionParams(teamId, collectionId);
    await this.validateTeamMembership(user.uid, tid);

    const pathResult = await this.erdVersionService.getRepoPathPublic(
      tid,
      cid,
    );
    const repoPath = this.unwrap(pathResult, HttpStatus.NOT_FOUND);

    // Create tar.gz stream using system tar command
    const tarProcess = spawn('tar', ['-czf', '-', '.'], {
      cwd: repoPath,
    });

    // Handle tar errors
    tarProcess.on('error', (err) => {
      throw new HttpException(
        `Export failed: ${err.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    });

    res.set({
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="erd-version-${tid}-${cid}.tar.gz"`,
    });

    return new StreamableFile(tarProcess.stdout);
  }

  // ─── Restore ────────────────────────────────────────────────────

  /**
   * POST /api/v1/erd-version/restore/:ref
   * Restore (retrieve) a specific version's ERD JSON.
   */
  @Post('restore/:ref')
  @UseGuards(JwtAuthGuard)
  async restoreVersion(
    @GqlUser() user: AuthUser,
    @Query('teamId') teamId: string,
    @Query('collectionId') collectionId: string,
    @Param('ref') ref: string,
  ) {
    const { teamId: tid, collectionId: cid } =
      this.validateCollectionParams(teamId, collectionId);
    await this.validateTeamMembership(user.uid, tid);
    this.validateRef(ref);

    const result = await this.erdVersionService.restoreVersion(
      tid,
      cid,
      ref,
    );
    const erdJson = this.unwrap(result, HttpStatus.NOT_FOUND);
    return { erdJson };
  }

  // ─── Tags ─────────────────────────────────────────────────────────

  /**
   * POST /api/v1/erd-version/tag
   * Create a lightweight tag on a specific version.
   */
  @Post('tag')
  @UseGuards(JwtAuthGuard)
  async createTag(
    @GqlUser() user: AuthUser,
    @Query('teamId') teamId: string,
    @Query('collectionId') collectionId: string,
    @Body() dto: CreateTagDto,
  ) {
    const { teamId: tid, collectionId: cid } =
      this.validateCollectionParams(teamId, collectionId);
    await this.validateTeamMembership(user.uid, tid);

    // Validate the ref format before passing to service
    this.validateRef(dto.ref);

    const result = await this.erdVersionService.createTag(
      tid,
      cid,
      dto.tagName,
      dto.ref,
    );

    if (E.isLeft(result)) {
      if (result.left === 'erd_version/tag_exists') {
        throw new ConflictException('Tag already exists');
      }
      if (result.left === 'erd_version/ref_not_found') {
        throw new BadRequestException('Invalid ref: ref not found');
      }
      throw new BadRequestException(result.left);
    }

    return result.right;
  }

  /**
   * DELETE /api/v1/erd-version/tag/:tagName
   * Delete a tag.
   */
  @Delete('tag/:tagName')
  @UseGuards(JwtAuthGuard)
  async deleteTag(
    @GqlUser() user: AuthUser,
    @Query('teamId') teamId: string,
    @Query('collectionId') collectionId: string,
    @Param('tagName') tagName: string,
  ) {
    const { teamId: tid, collectionId: cid } =
      this.validateCollectionParams(teamId, collectionId);
    await this.validateTeamMembership(user.uid, tid);

    const result = await this.erdVersionService.deleteTag(
      tid,
      cid,
      tagName,
    );

    if (E.isLeft(result)) {
      if (result.left === 'erd_version/ref_not_found') {
        throw new NotFoundException('Tag not found');
      }
      throw new BadRequestException(result.left);
    }

    return result.right;
  }

  /**
   * GET /api/v1/erd-version/tags
   * List all tags for the collection.
   */
  @Get('tags')
  @UseGuards(JwtAuthGuard)
  async listTags(
    @GqlUser() user: AuthUser,
    @Query('teamId') teamId: string,
    @Query('collectionId') collectionId: string,
  ) {
    const { teamId: tid, collectionId: cid } =
      this.validateCollectionParams(teamId, collectionId);
    await this.validateTeamMembership(user.uid, tid);

    const result = await this.erdVersionService.listTags(tid, cid);
    return this.unwrap(result);
  }

  // ─── Show Version ───────────────────────────────────────────────

  /**
   * GET /api/v1/erd-version/:ref
   * Get a specific version's ERD JSON and commit info.
   */
  @Get(':ref')
  @UseGuards(JwtAuthGuard)
  async getVersion(
    @GqlUser() user: AuthUser,
    @Query('teamId') teamId: string,
    @Query('collectionId') collectionId: string,
    @Param('ref') ref: string,
  ) {
    const { teamId: tid, collectionId: cid } =
      this.validateCollectionParams(teamId, collectionId);
    await this.validateTeamMembership(user.uid, tid);
    this.validateRef(ref);

    // Get the ERD JSON
    const versionResult = await this.erdVersionService.getVersion(
      tid,
      cid,
      ref,
    );
    const erdJson = this.unwrap(versionResult, HttpStatus.NOT_FOUND);

    // Get commit info from log (find the matching hash)
    const logResult = await this.erdVersionService.getVersionLog(
      tid,
      cid,
      100,
    );
    let commit = { hash: ref, message: '', date: '' };
    if (E.isRight(logResult)) {
      const entry = logResult.right.find(
        (e) => e.hash === ref || e.shortHash === ref,
      );
      if (entry) {
        commit = {
          hash: entry.hash,
          message: entry.message,
          date: entry.date,
        };
      }
    }

    return { erdJson, commit };
  }

  // ─── Revert (Delete) ────────────────────────────────────────────

  /**
   * DELETE /api/v1/erd-version/commit/:ref
   * Revert a specific version (creates a new revert commit).
   */
  @Delete('commit/:ref')
  @UseGuards(JwtAuthGuard)
  async revertVersion(
    @GqlUser() user: AuthUser,
    @Query('teamId') teamId: string,
    @Query('collectionId') collectionId: string,
    @Param('ref') ref: string,
  ) {
    const { teamId: tid, collectionId: cid } =
      this.validateCollectionParams(teamId, collectionId);
    await this.validateTeamMembership(user.uid, tid);
    this.validateRef(ref);

    const result = await this.erdVersionService.revertVersion(
      tid,
      cid,
      ref,
    );
    const revertResult = this.unwrap(result);
    return { success: true, revertHash: revertResult.commitHash };
  }
}
