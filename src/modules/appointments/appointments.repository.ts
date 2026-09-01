import { Injectable } from '@nestjs/common';
import { AppointmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AppointmentsRepository {
  constructor(private readonly prisma: PrismaService) { }

  create(data: Prisma.AppointmentUncheckedCreateInput) {
    return this.prisma.appointment.create({ data });
  }

  findMany(where: Prisma.AppointmentWhereInput = {}) {
    return this.prisma.appointment.findMany({
      where,
      orderBy: { startsAt: 'asc' },
      omit: { doctorId: true },
      include: { doctor: true },
    });
  }

  findById(id: string) {
    return this.prisma.appointment.findUnique({
      where: { id },
      include: { doctor: true, imagingStudies: true },
    });
  }

  update(id: string, data: Prisma.AppointmentUncheckedUpdateInput) {
    return this.prisma.appointment.update({ where: { id }, data });
  }


  findOverlapping(doctorId: string, startsAt: Date, endsAt: Date) {
    return this.prisma.appointment.findFirst({
      where: {
        doctorId,
        status: { not: AppointmentStatus.cancelled },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { id: true, startsAt: true, endsAt: true },
    });
  }

  doctorExists(doctorId: string) {
    return this.prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { id: true },
    });
  }

  appointmentExists(id: string) {
    return this.prisma.appointment.findUnique({
      where: { id },
      select: { id: true },
    });
  }
}
