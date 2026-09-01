import { Injectable } from '@nestjs/common';
import { Appointment, AppointmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type OverlapConflict = Pick<Appointment, 'id' | 'startsAt' | 'endsAt'>;

export type CreateSerializedResult =
  | { appointment: Appointment; conflict?: undefined }
  | { conflict: OverlapConflict; appointment?: undefined };

@Injectable()
export class AppointmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

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

  updateStatusFrom(
    id: string,
    from: AppointmentStatus[],
    to: AppointmentStatus,
  ) {
    return this.prisma.appointment.updateMany({
      where: { id, status: { in: from } },
      data: { status: to },
    });
  }

  /**
   * Runs the overlap check and the insert in one transaction, gated by a
   * Postgres transaction-scoped advisory lock keyed on the doctor. Two
   * concurrent create requests for the same doctor serialize on that lock, so
   * the second one sees the first one's row in its overlap check instead of
   * both passing the check and double-booking the slot. The lock is released
   * automatically when the transaction commits or rolls back.
   */
  createSerialized(
    doctorId: string,
    startsAt: Date,
    endsAt: Date,
    data: Prisma.AppointmentUncheckedCreateInput,
  ): Promise<CreateSerializedResult> {
    return this.prisma.$transaction(async (tx) => {
      // hashtext() returns int4, which widens to the bigint pg_advisory_xact_lock overload.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${doctorId}))`;

      const conflict = await tx.appointment.findFirst({
        where: {
          doctorId,
          status: { not: AppointmentStatus.cancelled },
          startsAt: { lt: endsAt },
          endsAt: { gt: startsAt },
        },
        select: { id: true, startsAt: true, endsAt: true },
      });

      if (conflict) {
        return { conflict };
      }

      const appointment = await tx.appointment.create({ data });

      return { appointment };
    });
  }

  doctorExists(doctorId: string) {
    return this.prisma.doctor.findUnique({
      where: { id: doctorId },
      select: { id: true },
    });
  }
}
