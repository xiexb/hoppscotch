import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ErdVersionController } from './erd-version.controller';
import { ErdVersionService } from './erd-version.service';

@Module({
  imports: [ConfigModule],
  controllers: [ErdVersionController],
  providers: [ErdVersionService],
  exports: [ErdVersionService],
})
export class ErdVersionModule {}
