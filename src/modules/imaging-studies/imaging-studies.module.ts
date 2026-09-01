import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UploadModule } from '../upload/upload.module';
import { ImagingStudiesController } from './imaging-studies.controller';
import { ImagingStudiesRepository } from './imaging-studies.repository';
import { ImagingStudiesService } from './imaging-studies.service';

@Module({
  imports: [AuthModule, UploadModule],
  controllers: [ImagingStudiesController],
  providers: [ImagingStudiesService, ImagingStudiesRepository],
  exports: [ImagingStudiesService],
})
export class ImagingStudiesModule {}
