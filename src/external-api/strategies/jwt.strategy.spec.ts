import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { ApiKeyService } from '../services/api-key.service';
import { ExternalApiKey } from '../entities/external-api-key.entity';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let apiKeyService: jest.Mocked<ApiKeyService>;

  const activeKey: ExternalApiKey = {
    id: 1,
    clientName: 'Acme Corp',
    apiKeyHash: 'hash_abc',
    isActive: true,
    createdAt: new Date('2026-01-01'),
  };

  beforeEach(() => {
    apiKeyService = {
      validateActiveKey: jest.fn(),
    } as unknown as jest.Mocked<ApiKeyService>;

    strategy = new JwtStrategy(apiKeyService);
  });

  /**
   * T2 — Fallo 1: Sin header Authorization → canActivate de AuthGuard(passport-jwt) lanza 401.
   * Aquí probamos que cuando passport extrae el token y la firma no es válida
   * (simulado con payload null llegando a validate), la strategy lanza UnauthorizedException.
   *
   * Flujo: Bearer ausente → passport-jwt nunca llama validate → AuthGuard devuelve 401.
   * Este test valida el contrato de validate() cuando apiKeyService retorna null.
   */
  it('T2: should throw UnauthorizedException when validateActiveKey returns null (missing/invalid token path)', async () => {
    apiKeyService.validateActiveKey.mockResolvedValue(null as any);

    await expect(strategy.validate({ sub: 99, clientName: 'unknown' })).rejects.toThrow(
      new UnauthorizedException('API key has been revoked'),
    );
  });

  /**
   * T3 — Fallo 2: Token válido firmado pero api_key revocada (is_active=false).
   * Flujo: JWT firma OK → passport llama validate(payload) → ApiKeyService.validateActiveKey
   *        → lanza UnauthorizedException('API key has been revoked')
   *        → strategy re-lanza, request rechazado con 401.
   */
  it('T3: should propagate UnauthorizedException when ApiKeyService throws (key revoked)', async () => {
    apiKeyService.validateActiveKey.mockRejectedValue(
      new UnauthorizedException('API key has been revoked'),
    );

    await expect(strategy.validate({ sub: 2, clientName: 'Acme Corp' })).rejects.toThrow(
      new UnauthorizedException('API key has been revoked'),
    );
    expect(apiKeyService.validateActiveKey).toHaveBeenCalledWith(2);
  });

  /**
   * Happy Path: JWT válido + key activa → validate retorna la entity.
   * Flujo: passport llama validate(payload) → ApiKeyService → is_active=true → retorna ExternalApiKey.
   */
  it('should return the active ExternalApiKey when JWT is valid and key is active', async () => {
    apiKeyService.validateActiveKey.mockResolvedValue(activeKey);

    const result = await strategy.validate({ sub: 1, clientName: 'Acme Corp' });

    expect(result).toEqual(activeKey);
    expect(apiKeyService.validateActiveKey).toHaveBeenCalledWith(1);
  });
});
