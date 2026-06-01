import { IsString, IsOptional, IsUrl } from 'class-validator';

/**
 * DTO for configuring a remote git repository for ERD version sync.
 * POST /api/erd/version/remote
 */
export class RemoteConfigDto {
  /** Remote git URL (e.g. git@github.com:org/erd-versions.git) */
  @IsString()
  @IsUrl({ require_tld: false, allow_protocol_relative_urls: false })
  url: string;

  /** Remote name. Defaults to 'origin'. */
  @IsString()
  @IsOptional()
  name?: string;

  /** Branch name for push/pull. Defaults to 'main'. */
  @IsString()
  @IsOptional()
  branch?: string;
}
