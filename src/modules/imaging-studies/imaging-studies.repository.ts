import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ImagingStudiesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.ImagingStudyUncheckedCreateInput) {
    return this.prisma.imagingStudy.create({ data });
  }

  findByAppointment(appointmentId: string) {
    return this.prisma.imagingStudy.findMany({ where: { appointmentId } });
  }

  findById(id: string) {
    return this.prisma.imagingStudy.findUnique({ where: { id } });
  }

  /** Lightweight FK check used before creating a study. */
  appointmentExists(appointmentId: string) {
    return this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { id: true },
    });
  }
}
