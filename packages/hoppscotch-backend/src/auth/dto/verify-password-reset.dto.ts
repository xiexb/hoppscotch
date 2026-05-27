import { IsString, MinLength } from 'class-validator';

export class VerifyPasswordResetDto {
  @IsString()
  token: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
