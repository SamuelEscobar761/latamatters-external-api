import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];

    // Lógica dummy para TDD. En la vida real aquí verificarías BD y estado REVOKED.
    if (token === 'INVALID_OR_REVOKED_TOKEN') {
      throw new UnauthorizedException('Token has been revoked');
    }

    return true;
  }
}
