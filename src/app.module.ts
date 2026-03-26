import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ExternalApiModule } from './external-api/external-api.module';

@Module({
  imports: [ExternalApiModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
