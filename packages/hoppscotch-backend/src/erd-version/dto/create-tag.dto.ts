import { IsString, Matches } from 'class-validator';

/**
 * DTO for creating a new tag on an ERD version.
 * POST /api/v1/erd-version/tag
 */
export class CreateTagDto {
  /** Tag name — alphanumeric, dots, underscores, hyphens; max 50 chars */
  @IsString()
  @Matches(/^[a-zA-Z0-9._-]{1,50}$/, {
    message:
      'tagName must be 1-50 characters: alphanumeric, dots, underscores, hyphens only',
  })
  tagName: string;

  /** Git ref (commit hash, HEAD~N, or existing tag) to tag */
  @IsString()
  ref: string;
}
