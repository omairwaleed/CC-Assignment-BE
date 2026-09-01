import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppointmentsRepository } from './appointments.repository';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { FindAppointmentsQueryDto } from './dto/find-appointments-query.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';

@Injectable()
export class AppointmentsService {
  constructor(private readonly appointments: AppointmentsRepository) {}

  async create(dto: CreateAppointmentDto) {
    const doctor = await this.appointments.doctorExists(dto.doctorId);

    if (!doctor) {
      throw new BadRequestException('doctorId does not reference a known doctor.');
    }

    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(startsAt.getTime() + dto.durationMinutes * 60_000);

    const conflict = await this.appointments.findOverlapping(
      dto.doctorId,
      startsAt,
      endsAt,
    );

    if (conflict) {
      throw new ConflictException(
        'This doctor already has an appointment overlapping the requested time.',
      );
    }

    return this.appointments.create({
      patientName: dto.patientName,
      doctorId: dto.doctorId,
      startsAt,
      endsAt,
      reason: dto.reason,
    });
  }

  findAll(query: FindAppointmentsQueryDto = {}) {
    const filters: Prisma.AppointmentWhereInput = {};

    if (query.doctorId) {
      filters.doctorId = query.doctorId;
    }

    if (query.status) {
      filters.status = query.status;
    }

    if (query.date) {
      const dayStart = new Date(`${query.date}T00:00:00.000Z`);

      if (Number.isNaN(dayStart.getTime())) {
        throw new BadRequestException('date is not a valid calendar day.');
      }

      const dayEnd = new Date(dayStart);
      dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

      filters.startsAt = { gte: dayStart, lt: dayEnd };
    }

    return this.appointments.findMany(filters);
  }

  async findOne(id: string) {
    const appointment = await this.appointments.findById(id);

    if (!appointment) {
      throw new NotFoundException('Appointment not found.');
    }

    return appointment;
  }

  async updateStatus(id: string, dto: UpdateAppointmentStatusDto) {
    await this.findOne(id);

    return this.appointments.update(id, { status: dto.status });
  }
}
