import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ApiKeyService } from '../services/api-key.service';

/**
 * Payload structure embedded inside every JWT issued to external API clients.
 */
export interface JwtPayload {
  sub: number;
  clientName: string;
}

/**
 * Passport strategy that validates Bearer JWT tokens for the external API.
 * On valid signature, delegates revocation check to ApiKeyService.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'external-jwt') {
  constructor(private readonly apiKeyService: ApiKeyService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.EXTERNAL_API_JWT_SECRET ?? 'latamatters-secret',
    });
  }

  /**
   * Called by Passport after the JWT signature is verified.
   * Validates that the referenced API key is still active (not revoked).
   * @param payload - Decoded JWT payload containing the api key id.
   * @returns The validated ExternalApiKey entity attached to the request.
   * @throws UnauthorizedException if the key has been revoked.
   */
  async validate(payload: JwtPayload) {
    const apiKey = await this.apiKeyService.validateActiveKey(payload.sub);

    if (!apiKey) {
      throw new UnauthorizedException('API key has been revoked');
    }

    return apiKey;
  }
}
