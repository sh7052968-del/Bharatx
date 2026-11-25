import { Module } from '@nestjs/common';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AdminOperationsService } from './admin-operations.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminOperationsService, CryptoService],
  exports: [AdminService, AdminOperationsService],
})
export class AdminModule {}
