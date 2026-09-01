import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppointmentsService } from './appointments.service';
import { AppointmentsRepository } from './appointments.repository';
import { CreateAppointmentDto } from './dto/create-appointment.dto';

/** Builds a Prisma unique-constraint violation, as thrown for a duplicate id. */
function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

function makeDto(
  overrides: Partial<CreateAppointmentDto> = {},
): CreateAppointmentDto {
  return {
    id: '11111111-1111-1111-1111-111111111111',
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
            appointmentExists: jest.fn(),
            doctorExists: jest.fn(),
            findOverlapping: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AppointmentsService);
    repository = moduleRef.get(AppointmentsRepository);
  });

  describe('create', () => {
    it('creates an appointment when the id is new and the slot is free', async () => {
      const dto = makeDto();
      const created = { id: dto.id };

      repository.appointmentExists.mockResolvedValue(null);
      repository.doctorExists.mockResolvedValue({ id: dto.doctorId });
      repository.findOverlapping.mockResolvedValue(null);
      repository.create.mockResolvedValue(created as any);

      await expect(service.create(dto)).resolves.toBe(created);
      expect(repository.create).toHaveBeenCalledWith({
        id: dto.id,
        patientName: dto.patientName,
        doctorId: dto.doctorId,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(
          new Date(dto.startsAt).getTime() + dto.durationMinutes * 60_000,
        ),
        reason: dto.reason,
      });
    });

    it('rejects a duplicate appointment id', async () => {
      const dto = makeDto();

      repository.appointmentExists.mockResolvedValue({ id: dto.id });

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      // The duplicate is caught before any downstream lookups happen.
      expect(repository.doctorExists).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects when doctorId does not reference a known doctor', async () => {
      const dto = makeDto();

      repository.appointmentExists.mockResolvedValue(null);
      repository.doctorExists.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects a time slot that overlaps an existing appointment for the doctor', async () => {
      const dto = makeDto();

      repository.appointmentExists.mockResolvedValue(null);
      repository.doctorExists.mockResolvedValue({ id: dto.doctorId });
      repository.findOverlapping.mockResolvedValue({
        id: 'other-appointment',
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(dto.startsAt),
      } as any);

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('converts a unique-constraint violation from a concurrent insert into a ConflictException', async () => {
      // Both requests can pass the pre-check (existing === null) before either
      // has inserted; the DB unique constraint is the real arbiter and surfaces
      // as a P2002 error on the loser's create() call.
      const dto = makeDto();

      repository.appointmentExists.mockResolvedValue(null);
      repository.doctorExists.mockResolvedValue({ id: dto.doctorId });
      repository.findOverlapping.mockResolvedValue(null);
      repository.create.mockRejectedValue(uniqueConstraintError());

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rethrows unrelated errors from the repository unchanged', async () => {
      const dto = makeDto();
      const unrelated = new Error('connection reset');

      repository.appointmentExists.mockResolvedValue(null);
      repository.doctorExists.mockResolvedValue({ id: dto.doctorId });
      repository.findOverlapping.mockResolvedValue(null);
      repository.create.mockRejectedValue(unrelated);

      await expect(service.create(dto)).rejects.toBe(unrelated);
    });

    it('resolves two concurrent requests for the same id with exactly one winner', async () => {
      // Simulates a real unique-id column: an in-memory store shared by both
      // "requests", where only the first insert to land succeeds and the
      // second observes a P2002 unique-constraint violation - regardless of
      // how the pre-check/insert calls interleave.
      const dto = makeDto();
      const store = new Map<string, unknown>();
      let inFlightInserts = 0;

      repository.doctorExists.mockResolvedValue({ id: dto.doctorId });
      repository.findOverlapping.mockResolvedValue(null);
      repository.appointmentExists.mockImplementation(async (id) =>
        store.has(id) ? { id } : null,
      );
      repository.create.mockImplementation(async (data) => {
        // Force both calls to race past the pre-check before either inserts.
        inFlightInserts += 1;
        await Promise.resolve();

        if (store.has(data.id)) {
          throw uniqueConstraintError();
        }

        store.set(data.id, data);
        return { id: data.id, ...data } as any;
      });

      const results = await Promise.allSettled([
        service.create(dto),
        service.create(dto),
      ]);

      expect(inFlightInserts).toBe(2);
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
        ConflictException,
      );
      expect(store.size).toBe(1);
    });
  });
});
