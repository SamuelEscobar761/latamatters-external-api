import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { ExternalApiKey } from '../entities/external-api-key.entity';

describe('ApiKeyService', () => {
  let service: ApiKeyService;
  let repo: jest.Mocked<Repository<ExternalApiKey>>;

  const activeKey: ExternalApiKey = {
    id: 1,
    clientName: 'Acme Corp',
    apiKeyHash: 'hash_abc123',
    isActive: true,
    createdAt: new Date('2026-01-01'),
  };

  const revokedKey: ExternalApiKey = {
    ...activeKey,
    id: 2,
    isActive: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyService,
        {
          provide: getRepositoryToken(ExternalApiKey),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ApiKeyService>(ApiKeyService);
    repo = module.get(getRepositoryToken(ExternalApiKey));
  });

  /**
   * T6 — Happy Path: key activa en BD
   * Flujo: validateActiveKey(1) → repo.findOne({ where: { id: 1 } }) → is_active=true → retorna entity
   */
  it('T6: should return the active ExternalApiKey when it exists and is active', async () => {
    repo.findOne.mockResolvedValue(activeKey);

    const result = await service.validateActiveKey(1);

    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(result).toEqual(activeKey);
    expect(result.isActive).toBe(true);
  });

  /**
   * T7 — Fallo 1: key no existe en BD
   * Flujo: validateActiveKey(999) → repo.findOne → null → UnauthorizedException('API key not found')
   */
  it('T7: should throw UnauthorizedException when key does not exist', async () => {
    repo.findOne.mockResolvedValue(null);

    await expect(service.validateActiveKey(999)).rejects.toThrow(
      new UnauthorizedException('API key not found'),
    );
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 999 } });
  });

  /**
   * T8 — Fallo 2: key revocada (is_active=false)
   * Flujo: validateActiveKey(2) → repo.findOne → entity con is_active=false → UnauthorizedException('API key has been revoked')
   */
  it('T8: should throw UnauthorizedException when key is revoked (is_active=false)', async () => {
    repo.findOne.mockResolvedValue(revokedKey);

    await expect(service.validateActiveKey(2)).rejects.toThrow(
      new UnauthorizedException('API key has been revoked'),
    );
    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 2 } });
  });
});
