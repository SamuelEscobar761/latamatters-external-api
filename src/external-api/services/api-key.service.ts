import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExternalApiKey } from '../entities/external-api-key.entity';

/**
 * Manages lifecycle validation of external API keys.
 * Responsible for checking active status and supporting revocation.
 */
@Injectable()
export class ApiKeyService {
  constructor(
    @InjectRepository(ExternalApiKey)
    private readonly apiKeyRepository: Repository<ExternalApiKey>,
  ) {}

  /**
   * Validates that an API key exists and has not been revoked.
   * @param id - The api key id extracted from the JWT payload (sub).
   * @returns The active ExternalApiKey entity.
   * @throws UnauthorizedException if the key does not exist or is_active is false.
   */
  async validateActiveKey(id: number): Promise<ExternalApiKey> {
    const apiKey = await this.apiKeyRepository.findOne({ where: { id } });

    if (!apiKey) {
      throw new UnauthorizedException('API key not found');
    }

    if (!apiKey.isActive) {
      throw new UnauthorizedException('API key has been revoked');
    }

    return apiKey;
  }
}
