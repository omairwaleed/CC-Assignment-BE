import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
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

    try {
      return await this.studies.create({
        appointmentId: dto.appointmentId,
        modality: dto.modality,
        description: dto.description,
        dicomFilePath: dto.dicomFilePath,
      });
    } catch (error) {
      // The appointment was deleted between the check above and this insert,
      // so the foreign key no longer resolves. Report it the same way as a
      // missing appointment rather than surfacing a 500.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException(
          'appointmentId does not reference a known appointment.',
        );
      }

      throw error;
    }
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
