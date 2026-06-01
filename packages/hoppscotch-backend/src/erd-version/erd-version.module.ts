import { Module } from '@nestjs/common';
import { ErdVersionController } from './erd-version.controller';
import { ErdVersionService } from './erd-version.service';

@Module({
  imports: [],
  controllers: [ErdVersionController],
  providers: [ErdVersionService],
  exports: [ErdVersionService],
})
export class ErdVersionModule {}
