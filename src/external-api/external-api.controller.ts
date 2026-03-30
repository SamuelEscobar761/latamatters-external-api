import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ExternalApiService } from './external-api.service';
import { GetDataDto } from './dto/get-data.dto';
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard';
import { ExternalClient } from './entities/external-client.entity';

/**
 * Exposes read-only B2B endpoints protected by API Key authentication.
 * Access events are logged externally (Grafana or similar monitoring system).
 */
@Controller('api/v1')
@UseGuards(ApiKeyAuthGuard)
export class ExternalApiController {
  constructor(
    private readonly externalApiService: ExternalApiService,
  ) {}

  /**
   * Returns structured JSON data from the most recent Approved version.
   * Data is filtered by the countries the client has access to.
   * @param query - Optional filters: country (alpha-2, comma-separated) and variable.
   * @param req - HTTP request, used to extract client IP and API key identity.
   */
  @Get('data')
  async getData(@Query() query: GetDataDto, @Req() req: Request) {
    const client = req.user as ExternalClient;
    const result = await this.externalApiService.getNestedData(query, client);

    // Audit logging handled externally by monitoring system (e.g., Grafana)
    console.log('[AUDIT] EXTERNAL_DATA_ACCESS', {
      userId: client.id,
      companyName: client.companyName,
      ipAddress: req.ip ?? 'unknown',
      query,
    });

    return result;
  }

  /**
   * Returns pre-signed S3 URLs (24h expiry) for approved Excel files.
   * Only returns URLs for countries the client has access to.
   * @param country - Optional alpha-2 country code. Omit for all authorized countries.
   * @param req - HTTP request, used to extract client IP and API key identity.
   */
  @Get('files/download')
  async downloadFiles(@Query('country') country: string | undefined, @Req() req: Request) {
    const client = req.user as ExternalClient;
    const result = await this.externalApiService.getPreSignedUrls(country, client);

    // Audit logging handled externally by monitoring system (e.g., Grafana)
    console.log('[AUDIT] EXTERNAL_FILE_DOWNLOAD', {
      userId: client.id,
      companyName: client.companyName,
      ipAddress: req.ip ?? 'unknown',
      country: country ?? 'all',
    });

    return result;
  }
}
