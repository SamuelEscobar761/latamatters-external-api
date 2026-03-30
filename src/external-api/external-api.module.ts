import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExternalApiController } from './external-api.controller';
import { ExternalApiService } from './external-api.service';
import { ExternalClientService } from './services/external-client.service';
import { ExternalClient } from './entities/external-client.entity';
import { Country } from './entities/country.entity';
import { Version } from './entities/version.entity';
import { Sheet } from './entities/sheet.entity';
import { SheetRow } from './entities/sheet-row.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ExternalClient,
      Country,
      Version,
      Sheet,
      SheetRow,
    ]),
  ],
  controllers: [ExternalApiController],
  providers: [ExternalApiService, ExternalClientService],
})
export class ExternalApiModule {}
