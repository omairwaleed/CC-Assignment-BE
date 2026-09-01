import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UploadService } from '../upload/upload.service';
import { ImagingStudiesRepository } from './imaging-studies.repository';
import { CreateImagingStudyDto } from './dto/create-imaging-study.dto';

@Injectable()
export class ImagingStudiesService {
  constructor(
    private readonly studies: ImagingStudiesRepository,
    private readonly upload: UploadService,
  ) {}

  async create(dto: CreateImagingStudyDto) {
    const appointment = await this.studies.appointmentExists(dto.appointmentId);

    if (!appointment) {
      throw new BadRequestException(
        'appointmentId does not reference a known appointment.',
      );
    }

    return this.studies.create({
      appointmentId: dto.appointmentId,
      modality: dto.modality,
      description: dto.description,
      dicomFilePath: dto.dicomFilePath,
    });
  }

  findByAppointment(appointmentId: string) {
    return this.studies.findByAppointment(appointmentId);
  }

  async getImageSignedUrl(id: string) {
    const study = await this.studies.findById(id);

    if (!study) {
      throw new NotFoundException('Imaging study not found.');
    }

    return this.upload.createSignedUrl(study.dicomFilePath);
  }
}
