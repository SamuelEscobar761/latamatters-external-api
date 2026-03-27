import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ExternalApiService } from './external-api.service';
import { AuditLogService } from './services/audit-log.service';
import { GetDataDto } from './dto/get-data.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ExternalApiKey } from './entities/external-api-key.entity';

/**
 * Exposes read-only B2B endpoints protected by JWT authentication.
 * All access events are recorded in AUDIT_LOGS per US-35 AC-3.
 */
@Controller('api/v1')
@UseGuards(JwtAuthGuard)
export class ExternalApiController {
  constructor(
    private readonly externalApiService: ExternalApiService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Returns structured JSON data from the most recent Approved version.
   * @param query - Optional filters: country (alpha-2, comma-separated) and variable.
   * @param req - HTTP request, used to extract client IP and JWT identity.
   */
  @Get('data')
  async getData(@Query() query: GetDataDto, @Req() req: Request) {
    const client = req.user as ExternalApiKey;
    const result = await this.externalApiService.getNestedData(query);

    await this.auditLogService.log({
      action: 'EXTERNAL_DATA_ACCESS',
      ipAddress: req.ip ?? 'unknown',
      details: { clientName: client?.clientName, query },
    });

    return result;
  }

  /**
   * Returns pre-signed S3 URLs (24h expiry) for approved Excel files.
   * @param country - Optional alpha-2 country code. Omit for all countries.
   * @param req - HTTP request, used to extract client IP and JWT identity.
   */
  @Get('files/download')
  async downloadFiles(@Query('country') country: string | undefined, @Req() req: Request) {
    const client = req.user as ExternalApiKey;
    const result = await this.externalApiService.getPreSignedUrls(country);

    await this.auditLogService.log({
      action: 'EXTERNAL_FILE_DOWNLOAD',
      ipAddress: req.ip ?? 'unknown',
      details: { clientName: client?.clientName, country: country ?? 'all' },
    });

    return result;
  }
}
