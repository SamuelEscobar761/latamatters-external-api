import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard that enforces JWT authentication for all external API endpoints.
 * Delegates signature verification and revocation check to JwtStrategy.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('external-jwt') {}
