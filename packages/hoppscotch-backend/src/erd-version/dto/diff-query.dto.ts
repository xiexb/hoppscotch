import { IsString, IsOptional } from 'class-validator';

/**
 * Query parameters for diff endpoint.
 * GET /api/erd/version/diff?from=<ref>&to=<ref>
 */
export class DiffQueryDto {
  /** Git ref for the base version (commit hash, tag, or 'HEAD~N'). Defaults to HEAD~1. */
  @IsString()
  @IsOptional()
  from?: string;

  /** Git ref for the target version. Defaults to HEAD. */
  @IsString()
  @IsOptional()
  to?: string;
}
