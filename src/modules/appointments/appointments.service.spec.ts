import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AppointmentStatus } from '@prisma/client';
import { AppointmentsService } from './appointments.service';
import { AppointmentsRepository } from './appointments.repository';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

function makeDto(
  overrides: Partial<CreateAppointmentDto> = {},
): CreateAppointmentDto {
  return {
    patientName: 'John Doe',
    doctorId: '22222222-2222-2222-2222-222222222222',
    startsAt: '2026-09-05T14:30:00.000Z',
    durationMinutes: 30,
    ...overrides,
  };
}

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let repository: jest.Mocked<AppointmentsRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        {
          provide: AppointmentsRepository,
          useValue: {
            doctorExists: jest.fn(),
            createSerialized: jest.fn(),
            updateStatusFrom: jest.fn(),
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AppointmentsService);
    repository = moduleRef.get(AppointmentsRepository);
  });

  describe('create', () => {
    it('creates an appointment when the doctor exists and the slot is free', async () => {
      const dto = makeDto();
      const created = { id: 'generated-id' };

      repository.doctorExists.mockResolvedValue({ id: dto.doctorId });
      repository.createSerialized.mockResolvedValue({
        appointment: created as any,
      });

      await expect(service.create(dto)).resolves.toBe(created);

      const startsAt = new Date(dto.startsAt);
      const endsAt = new Date(
        startsAt.getTime() + dto.durationMinutes * 60_000,
      );

      expect(repository.createSerialized).toHaveBeenCalledWith(
        dto.doctorId,
        startsAt,
        endsAt,
        {
          patientName: dto.patientName,
          doctorId: dto.doctorId,
          startsAt,
          endsAt,
          reason: dto.reason,
        },
      );
    });

    it('rejects when doctorId does not reference a known doctor', async () => {
      const dto = makeDto();

      repository.doctorExists.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repository.createSerialized).not.toHaveBeenCalled();
    });

    it('rejects a time slot that overlaps an existing appointment for the doctor', async () => {
      const dto = makeDto();

      repository.doctorExists.mockResolvedValue({ id: dto.doctorId });
      repository.createSerialized.mockResolvedValue({
        conflict: {
          id: 'other-appointment',
          startsAt: new Date(dto.startsAt),
          endsAt: new Date(dto.startsAt),
        } as any,
      });

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rethrows unrelated errors from the repository unchanged', async () => {
      const dto = makeDto();
      const unrelated = new Error('connection reset');

      repository.doctorExists.mockResolvedValue({ id: dto.doctorId });
      repository.createSerialized.mockRejectedValue(unrelated);

      await expect(service.create(dto)).rejects.toBe(unrelated);
    });
  });

  describe('updateStatus', () => {
    const id = '33333333-3333-3333-3333-333333333333';

    it('applies the change atomically and only from an allowed previous state', async () => {
      const updated = { id, status: AppointmentStatus.checked_in };

      repository.updateStatusFrom.mockResolvedValue({ count: 1 } as any);
      repository.findById.mockResolvedValue(updated as any);

      await expect(
        service.updateStatus(id, { status: AppointmentStatus.checked_in }),
      ).resolves.toBe(updated);

      expect(repository.updateStatusFrom).toHaveBeenCalledWith(
        id,
        [AppointmentStatus.scheduled],
        AppointmentStatus.checked_in,
      );
    });

    it('404s when no row matched and the appointment does not exist', async () => {
      repository.updateStatusFrom.mockResolvedValue({ count: 0 } as any);
      repository.findById.mockResolvedValue(null);

      await expect(
        service.updateStatus(id, { status: AppointmentStatus.checked_in }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('409s when the row exists but is in a state the transition disallows', async () => {
      repository.updateStatusFrom.mockResolvedValue({ count: 0 } as any);
      repository.findById.mockResolvedValue({
        id,
        status: AppointmentStatus.completed,
      } as any);

      await expect(
        service.updateStatus(id, { status: AppointmentStatus.checked_in }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
