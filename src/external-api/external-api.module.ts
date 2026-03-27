import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ExternalApiController } from './external-api.controller';
import { ExternalApiService } from './external-api.service';
import { ApiKeyService } from './services/api-key.service';
import { AuditLogService } from './services/audit-log.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ExternalApiKey } from './entities/external-api-key.entity';
import { Version } from './entities/version.entity';
import { Sheet } from './entities/sheet.entity';
import { SheetRow } from './entities/sheet-row.entity';
import { AuditLog } from './entities/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExternalApiKey, Version, Sheet, SheetRow, AuditLog]),
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('EXTERNAL_API_JWT_SECRET', 'latamatters-secret'),
        signOptions: { expiresIn: '1h' },
      }),
    }),
  ],
  controllers: [ExternalApiController],
  providers: [ExternalApiService, ApiKeyService, AuditLogService, JwtStrategy],
})
export class ExternalApiModule {}
