import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ExternalClient } from '../entities/external-client.entity';

/**
 * Service for managing and validating external API clients.
 * Handles API key validation using bcrypt comparison.
 */
@Injectable()
export class ExternalClientService {
  constructor(
    @InjectRepository(ExternalClient)
    private readonly externalClientRepository: Repository<ExternalClient>,
  ) {}

  /**
   * Validates an API key by comparing it with all active clients' hashed keys.
   * Updates request count and last used timestamp on successful validation.
   *
   * @param apiKey - The plain text API key from the Authorization header
   * @returns The validated ExternalClient with populated countries relation
   * @throws UnauthorizedException if no matching active client is found
   */
  async validateApiKey(apiKey: string): Promise<ExternalClient> {
    console.log('[ExternalClientService] Validating API key:', apiKey.substring(0, 10) + '...');

    // Fetch all active clients with their country relations
    const activeClients = await this.externalClientRepository.find({
      where: { isActive: true },
      relations: ['countries'],
    });

    console.log('[ExternalClientService] Found active clients:', activeClients.length);

    // Try to find a matching client by comparing the API key with each hash
    for (const client of activeClients) {
      console.log('[ExternalClientService] Comparing with client:', client.companyName);
      console.log('[ExternalClientService] Hash:', client.apiKeyHash);

      const isMatch = await bcrypt.compare(apiKey, client.apiKeyHash);
      console.log('[ExternalClientService] Match result:', isMatch);

      if (isMatch) {
        console.log('[ExternalClientService] Match found! Client:', client.companyName);
        console.log('[ExternalClientService] Countries loaded:', client.countries?.length || 0);

        // Update usage statistics
        await this.externalClientRepository.update(client.id, {
          requestCount: client.requestCount + 1,
          lastUsedAt: new Date(),
        });

        return client;
      }
    }

    // No matching client found
    console.log('[ExternalClientService] No matching client found');
    throw new UnauthorizedException('Invalid API key');
  }

  /**
   * Checks if a client has access to a specific country.
   *
   * @param client - The authenticated external client
   * @param countryId - The UUID of the country to check access for
   * @returns true if the client has access, false otherwise
   */
  hasCountryAccess(client: ExternalClient, countryId: string): boolean {
    return client.countries.some(country => country.id === countryId);
  }

  /**
   * Gets the list of country IDs the client has access to.
   *
   * @param client - The authenticated external client
   * @returns Array of country UUIDs
   */
  getClientCountryIds(client: ExternalClient): string[] {
    return client.countries.map(country => country.id);
  }
}
