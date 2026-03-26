import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ExternalApiService } from './external-api.service';
import { GetDataDto } from './dto/get-data.dto';
import { ApiKeyAuthGuard } from './guards/api-key.guard';

/**
 * Controller exposing B2B read-only endpoints in external_api module.
 */
@Controller('api/v1')
@UseGuards(ApiKeyAuthGuard)
export class ExternalApiController {
  constructor(private readonly externalApiService: ExternalApiService) {}

  @Get('data')
  async getData(@Query() query: GetDataDto) {
    return this.externalApiService.getNestedData(query);
  }

  @Get('files/download')
  async downloadFiles(@Query('country') country?: string) {
    return this.externalApiService.getPreSignedUrls(country);
  }
}
