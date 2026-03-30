import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { ExternalClientService } from '../services/external-client.service';
import { ExternalClient } from '../entities/external-client.entity';

/**
 * Guard that validates API Key from Authorization header.
 * Extracts Bearer token and validates it against external_clients table.
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private readonly externalClientService: ExternalClientService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    console.log('[ApiKeyAuthGuard] Authorization header:', request.headers.authorization);

    const token = this.extractTokenFromHeader(request);
    console.log('[ApiKeyAuthGuard] Extracted token:', token);

    if (!token) {
      throw new UnauthorizedException('Missing API key');
    }

    try {
      // Validate the API key and get the client
      const client = await this.externalClientService.validateApiKey(token);

      // Attach the client to the request object for use in controllers
      (request as any).user = client;

      return true;
    } catch (error) {
      console.log('[ApiKeyAuthGuard] Validation error:', error.message);
      throw new UnauthorizedException('Invalid or inactive API key');
    }
  }

  /**
   * Extracts the Bearer token from the Authorization header.
   *
   * @param request - Express request object
   * @returns The extracted token or undefined
   */
  private extractTokenFromHeader(request: Request): string | undefined {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ');

    return type === 'Bearer' ? token : undefined;
  }
}
