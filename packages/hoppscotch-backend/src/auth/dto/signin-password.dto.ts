import { IsEmail, IsString } from 'class-validator';

export class SignInPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}
