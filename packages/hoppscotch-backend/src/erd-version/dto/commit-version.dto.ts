import { IsString, IsOptional, IsBoolean } from 'class-validator';

/**
 * DTO for committing a new ERD version.
 * POST /api/erd/version/commit
 */
export class CommitVersionDto {
  /** Full erd-editor v3.0.0 JSON string */
  @IsString()
  erdJson: string;

  /** Optional commit message. Auto-generated from diff if omitted. */
  @IsString()
  @IsOptional()
  message?: string;

  /** If true, force commit even if no changes detected vs last version. */
  @IsBoolean()
  @IsOptional()
  force?: boolean;
}
