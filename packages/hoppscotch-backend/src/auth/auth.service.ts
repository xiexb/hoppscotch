import { HttpStatus, Injectable } from '@nestjs/common';
import { MailerService } from 'src/mailer/mailer.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { VerifyMagicDto } from './dto/verify-magic.dto';
import * as argon2 from 'argon2';
import * as bcrypt from 'bcrypt';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import { DeviceIdentifierToken } from 'src/types/Passwordless';
import {
  INVALID_EMAIL,
  INVALID_MAGIC_LINK_DATA,
  VERIFICATION_TOKEN_DATA_NOT_FOUND,
  MAGIC_LINK_EXPIRED,
  USER_NOT_FOUND,
  INVALID_REFRESH_TOKEN,
  INVALID_CREDENTIALS,
  PASSWORD_NOT_SET,
  PASSWORD_TOO_SHORT,
  INVALID_OLD_PASSWORD,
  RESET_TOKEN_EXPIRED,
  RESET_TOKEN_INVALID,
  PASSWORD_ALREADY_SET,
} from 'src/errors';
import { validateEmail } from 'src/utils';
import {
  AccessTokenPayload,
  AuthTokens,
  RefreshTokenPayload,
} from 'src/types/AuthTokens';
import { JwtService } from '@nestjs/jwt';
import { RESTError } from 'src/types/RESTError';
import { AuthUser, IsAdmin } from 'src/types/AuthUser';
import { VerificationToken } from 'src/generated/prisma/client';
import { Origin } from './helper';
import { ConfigService } from '@nestjs/config';
import { InfraConfigService } from 'src/infra-config/infra-config.service';
import { randomUUID } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UserService,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly infraConfigService: InfraConfigService,
  ) {}

  /**
   * Generate Id and token for email Magic-Link auth
   *
   * @param user User Object
   * @returns Created VerificationToken token
   */
  private async generateMagicLinkTokens(user: AuthUser) {
    const salt = await bcrypt.genSalt(
      parseInt(this.configService.get('INFRA.TOKEN_SALT_COMPLEXITY')),
    );

    // Calculate expiration time by adding hours to current time
    let validityInHours = parseInt(
      this.configService.get('INFRA.MAGIC_LINK_TOKEN_VALIDITY'),
    );
    if (isNaN(validityInHours)) validityInHours = 24; // Default: 24 hours

    const expiresOn = new Date();
    expiresOn.setHours(expiresOn.getHours() + validityInHours);

    const idToken = await this.prisma.verificationToken.create({
      data: {
        deviceIdentifier: salt,
        userUid: user.uid,
        expiresOn: expiresOn,
      },
    });

    return idToken;
  }

  /**
   * Check if VerificationToken exist or not
   *
   * @param magicLinkTokens Object containing deviceIdentifier and token
   * @returns Option of VerificationToken token
   */
  private async validatePasswordlessTokens(magicLinkTokens: VerifyMagicDto) {
    try {
      const tokens = await this.prisma.verificationToken.findUniqueOrThrow({
        where: {
          passwordless_deviceIdentifier_tokens: {
            deviceIdentifier: magicLinkTokens.deviceIdentifier,
            token: magicLinkTokens.token,
          },
        },
      });
      return O.some(tokens);
    } catch (error) {
      return O.none;
    }
  }

  /**
   * Generate new refresh token for user
   *
   * @param userUid User Id
   * @returns Generated refreshToken
   */
  private async generateRefreshToken(userUid: string) {
    const refreshTokenPayload: RefreshTokenPayload = {
      iss: this.configService.get('VITE_BASE_URL'),
      sub: userUid,
      aud: [this.configService.get('VITE_BASE_URL')],
    };

    const refreshToken = await this.jwtService.sign(refreshTokenPayload, {
      expiresIn: this.configService.get('INFRA.REFRESH_TOKEN_VALIDITY'), //7 Days
    });

    const refreshTokenHash = await argon2.hash(refreshToken);

    const updatedUser = await this.usersService.updateUserRefreshToken(
      refreshTokenHash,
      userUid,
    );
    if (E.isLeft(updatedUser))
      return E.left(<RESTError>{
        message: updatedUser.left,
        statusCode: HttpStatus.NOT_FOUND,
      });

    return E.right(refreshToken);
  }

  /**
   * Generate access and refresh token pair
   *
   * @param userUid User ID
   * @returns Either of generated AuthTokens
   */
  async generateAuthTokens(userUid: string) {
    const accessTokenPayload: AccessTokenPayload = {
      iss: this.configService.get('VITE_BASE_URL'),
      sub: userUid,
      aud: [this.configService.get('VITE_BASE_URL')],
    };

    const refreshToken = await this.generateRefreshToken(userUid);
    if (E.isLeft(refreshToken)) return E.left(refreshToken.left);

    return E.right(<AuthTokens>{
      access_token: await this.jwtService.sign(accessTokenPayload, {
        expiresIn: this.configService.get('INFRA.ACCESS_TOKEN_VALIDITY'), //1 Day
      }),
      refresh_token: refreshToken.right,
    });
  }

  /**
   * Deleted used VerificationToken tokens
   *
   * @param passwordlessTokens VerificationToken entry to delete from DB
   * @returns Either of deleted VerificationToken token
   */
  private async deleteMagicLinkVerificationTokens(
    passwordlessTokens: VerificationToken,
  ) {
    try {
      const deletedPasswordlessToken =
        await this.prisma.verificationToken.delete({
          where: {
            passwordless_deviceIdentifier_tokens: {
              deviceIdentifier: passwordlessTokens.deviceIdentifier,
              token: passwordlessTokens.token,
            },
          },
        });
      return E.right(deletedPasswordlessToken);
    } catch (error) {
      return E.left(VERIFICATION_TOKEN_DATA_NOT_FOUND);
    }
  }

  /**
   * Verify if Provider account exists for User
   *
   * @param user User Object
   * @param SSOUserData User data from SSO providers (Magic,Google,Github,Microsoft)
   * @returns Either of existing user provider Account
   */
  async checkIfProviderAccountExists(user: AuthUser, SSOUserData) {
    const provider = await this.prisma.account.findUnique({
      where: {
        verifyProviderAccount: {
          provider: SSOUserData.provider,
          providerAccountId: SSOUserData.id,
        },
      },
    });

    if (!provider) return O.none;

    return O.some(provider);
  }

  /**
   * Create User (if not already present) and send email to initiate Magic-Link auth
   *
   * @param email User's email
   * @returns Either containing DeviceIdentifierToken
   */
  async signInMagicLink(email: string, origin: string) {
    if (!validateEmail(email))
      return E.left({
        message: INVALID_EMAIL,
        statusCode: HttpStatus.BAD_REQUEST,
      });

    let user: AuthUser;
    const queriedUser = await this.usersService.findUserByEmail(email);

    if (O.isNone(queriedUser)) {
      user = await this.usersService.createUserViaMagicLink(email);
    } else {
      user = queriedUser.value;
    }

    const generatedTokens = await this.generateMagicLinkTokens(user);

    // check to see if origin is valid
    let url: string;
    switch (origin) {
      case Origin.ADMIN:
        url = this.configService.get('VITE_ADMIN_URL');
        break;
      case Origin.APP:
        url = this.configService.get('VITE_BASE_URL');
        break;
      default:
        // if origin is invalid by default set URL to Hoppscotch-App
        url = this.configService.get('VITE_BASE_URL');
    }

    await this.mailerService.sendEmail(email, {
      template: 'user-invitation',
      variables: {
        inviteeEmail: email,
        magicLink: `${url}/enter?token=${generatedTokens.token}`,
      },
    });

    return E.right(<DeviceIdentifierToken>{
      deviceIdentifier: generatedTokens.deviceIdentifier,
    });
  }

  /**
   * Verify and authenticate user from received data for Magic-Link
   *
   * @param magicLinkIDTokens magic-link verification tokens from client
   * @returns Either of generated AuthTokens
   */
  async verifyMagicLinkTokens(
    magicLinkIDTokens: VerifyMagicDto,
  ): Promise<E.Right<AuthTokens> | E.Left<RESTError>> {
    const passwordlessTokens =
      await this.validatePasswordlessTokens(magicLinkIDTokens);
    if (O.isNone(passwordlessTokens))
      return E.left({
        message: INVALID_MAGIC_LINK_DATA,
        statusCode: HttpStatus.NOT_FOUND,
      });

    const user = await this.usersService.findUserById(
      passwordlessTokens.value.userUid,
    );
    if (O.isNone(user))
      return E.left({
        message: USER_NOT_FOUND,
        statusCode: HttpStatus.NOT_FOUND,
      });

    /**
     * * Check to see if entry for Magic-Link is present in the Account table for user
     * * If user was created with another provider findUserById may return true
     */
    const profile = {
      provider: 'magic',
      id: user.value.email,
    };
    const providerAccountExists = await this.checkIfProviderAccountExists(
      user.value,
      profile,
    );

    if (O.isNone(providerAccountExists)) {
      await this.usersService.createProviderAccount(
        user.value,
        null,
        null,
        profile,
      );
    }

    const currentTime = new Date();
    if (currentTime > passwordlessTokens.value.expiresOn)
      return E.left({
        message: MAGIC_LINK_EXPIRED,
        statusCode: HttpStatus.UNAUTHORIZED,
      });

    const tokens = await this.generateAuthTokens(
      passwordlessTokens.value.userUid,
    );
    if (E.isLeft(tokens))
      return E.left({
        message: tokens.left.message,
        statusCode: tokens.left.statusCode,
      });

    const deletedPasswordlessToken =
      await this.deleteMagicLinkVerificationTokens(passwordlessTokens.value);
    if (E.isLeft(deletedPasswordlessToken))
      return E.left({
        message: deletedPasswordlessToken.left,
        statusCode: HttpStatus.NOT_FOUND,
      });

    this.usersService.updateUserLastLoggedOn(passwordlessTokens.value.userUid);

    return E.right(tokens.right);
  }

  /**
   * Refresh refresh and auth tokens
   *
   * @param hashedRefreshToken Hashed refresh token received from client
   * @param user User Object
   * @returns Either of generated AuthTokens
   */
  async refreshAuthTokens(hashedRefreshToken: string, user: AuthUser) {
    // Check to see user is valid
    if (!user)
      return E.left({
        message: USER_NOT_FOUND,
        statusCode: HttpStatus.NOT_FOUND,
      });

    // Check to see if the hashed refresh_token received from the client is the same as the refresh_token saved in the DB
    const isTokenMatched = await argon2.verify(
      user.refreshToken,
      hashedRefreshToken,
    );
    if (!isTokenMatched)
      return E.left({
        message: INVALID_REFRESH_TOKEN,
        statusCode: HttpStatus.NOT_FOUND,
      });

    // if tokens match, generate new pair of auth tokens
    const generatedAuthTokens = await this.generateAuthTokens(user.uid);
    if (E.isLeft(generatedAuthTokens))
      return E.left({
        message: generatedAuthTokens.left.message,
        statusCode: generatedAuthTokens.left.statusCode,
      });

    return E.right(generatedAuthTokens.right);
  }

  /**
   * Verify is signed in User is an admin or not
   *
   * @param user User Object
   * @returns Either of boolean if user is admin or not
   */
  async verifyAdmin(user: AuthUser) {
    if (user.isAdmin) return E.right(<IsAdmin>{ isAdmin: true });

    const usersCount = await this.usersService.getUsersCount();
    if (usersCount === 1) {
      const elevatedUser = await this.usersService.makeAdmin(user.uid);
      if (E.isLeft(elevatedUser))
        return E.left(<RESTError>{
          message: elevatedUser.left,
          statusCode: HttpStatus.NOT_FOUND,
        });

      return E.right(<IsAdmin>{ isAdmin: true });
    }

    return E.right(<IsAdmin>{ isAdmin: false });
  }

  getAuthProviders() {
    return this.infraConfigService.getAllowedAuthProviders();
  }

  /**
   * Sign in with email and password
   */
  async signInWithPassword(email: string, password: string) {
    if (!validateEmail(email))
      return E.left(<RESTError>{
        message: INVALID_EMAIL,
        statusCode: HttpStatus.BAD_REQUEST,
      });

    const queriedUser = await this.usersService.findUserByEmail(email);
    if (O.isNone(queriedUser))
      return E.left(<RESTError>{
        message: INVALID_CREDENTIALS,
        statusCode: HttpStatus.UNAUTHORIZED,
      });

    const user = queriedUser.value;
    if (!user.passwordHash)
      return E.left(<RESTError>{
        message: PASSWORD_NOT_SET,
        statusCode: HttpStatus.UNAUTHORIZED,
      });

    const isPasswordValid = await argon2.verify(user.passwordHash, password);
    if (!isPasswordValid)
      return E.left(<RESTError>{
        message: INVALID_CREDENTIALS,
        statusCode: HttpStatus.UNAUTHORIZED,
      });

    const tokens = await this.generateAuthTokens(user.uid);
    if (E.isLeft(tokens)) return E.left(tokens.left);

    // Create provider account if not exists
    const profile = { provider: 'email-password', id: user.email };
    const providerAccountExists = await this.checkIfProviderAccountExists(
      user,
      profile,
    );
    if (O.isNone(providerAccountExists)) {
      await this.usersService.createProviderAccount(user, null, null, profile);
    }

    this.usersService.updateUserLastLoggedOn(user.uid);
    return E.right(tokens.right);
  }

  /**
   * Set password for the first time (user registered via magic link)
   */
  async setPassword(userUid: string, password: string) {
    if (password.length < 8)
      return E.left(<RESTError>{
        message: PASSWORD_TOO_SHORT,
        statusCode: HttpStatus.BAD_REQUEST,
      });

    const user = await this.usersService.findUserById(userUid);
    if (O.isNone(user))
      return E.left(<RESTError>{
        message: USER_NOT_FOUND,
        statusCode: HttpStatus.NOT_FOUND,
      });

    if (user.value.passwordHash)
      return E.left(<RESTError>{
        message: PASSWORD_ALREADY_SET,
        statusCode: HttpStatus.BAD_REQUEST,
      });

    const passwordHash = await argon2.hash(password);
    await this.prisma.user.update({
      where: { uid: userUid },
      data: { passwordHash },
    });

    return E.right({ message: 'Password set successfully' });
  }

  /**
   * Change password (requires old password verification)
   */
  async changePassword(
    userUid: string,
    oldPassword: string,
    newPassword: string,
  ) {
    if (newPassword.length < 8)
      return E.left(<RESTError>{
        message: PASSWORD_TOO_SHORT,
        statusCode: HttpStatus.BAD_REQUEST,
      });

    const user = await this.usersService.findUserById(userUid);
    if (O.isNone(user))
      return E.left(<RESTError>{
        message: USER_NOT_FOUND,
        statusCode: HttpStatus.NOT_FOUND,
      });

    if (!user.value.passwordHash)
      return E.left(<RESTError>{
        message: PASSWORD_NOT_SET,
        statusCode: HttpStatus.BAD_REQUEST,
      });

    const isOldPasswordValid = await argon2.verify(
      user.value.passwordHash,
      oldPassword,
    );
    if (!isOldPasswordValid)
      return E.left(<RESTError>{
        message: INVALID_OLD_PASSWORD,
        statusCode: HttpStatus.UNAUTHORIZED,
      });

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({
      where: { uid: userUid },
      data: { passwordHash },
    });

    return E.right({ message: 'Password changed successfully' });
  }

  /**
   * Request password reset via email
   */
  async requestPasswordReset(email: string) {
    if (!validateEmail(email))
      return E.left(<RESTError>{
        message: INVALID_EMAIL,
        statusCode: HttpStatus.BAD_REQUEST,
      });

    const queriedUser = await this.usersService.findUserByEmail(email);
    // Always return success to prevent email enumeration
    if (O.isNone(queriedUser))
      return E.right({
        message: 'If the email exists, a reset link has been sent',
      });

    const user = queriedUser.value;
    const token = randomUUID();
    const expiresOn = new Date();
    expiresOn.setHours(expiresOn.getHours() + 1); // 1 hour validity

    await this.prisma.passwordResetToken.create({
      data: {
        userUid: user.uid,
        token,
        expiresOn,
      },
    });

    const baseUrl = this.configService.get('VITE_BASE_URL');
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    await this.mailerService.sendEmail(email, {
      template: 'password-reset',
      variables: {
        resetLink: resetUrl,
        userEmail: email,
      },
    });

    return E.right({
      message: 'If the email exists, a reset link has been sent',
    });
  }

  /**
   * Verify password reset token and set new password
   */
  async verifyPasswordReset(resetToken: string, newPassword: string) {
    if (newPassword.length < 8)
      return E.left(<RESTError>{
        message: PASSWORD_TOO_SHORT,
        statusCode: HttpStatus.BAD_REQUEST,
      });

    try {
      const resetRecord =
        await this.prisma.passwordResetToken.findUniqueOrThrow({
          where: { token: resetToken },
        });

      if (resetRecord.usedAt)
        return E.left(<RESTError>{
          message: RESET_TOKEN_INVALID,
          statusCode: HttpStatus.UNAUTHORIZED,
        });

      if (new Date() > resetRecord.expiresOn)
        return E.left(<RESTError>{
          message: RESET_TOKEN_EXPIRED,
          statusCode: HttpStatus.UNAUTHORIZED,
        });

      const passwordHash = await argon2.hash(newPassword);

      // Update password and mark token as used in a transaction
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { uid: resetRecord.userUid },
          data: { passwordHash },
        }),
        this.prisma.passwordResetToken.update({
          where: { token: resetToken },
          data: { usedAt: new Date() },
        }),
      ]);

      return E.right({ message: 'Password reset successfully' });
    } catch (error) {
      return E.left(<RESTError>{
        message: RESET_TOKEN_INVALID,
        statusCode: HttpStatus.UNAUTHORIZED,
      });
    }
  }
}
