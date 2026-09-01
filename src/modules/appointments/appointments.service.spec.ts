import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
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
    it('creates an appointment when the doctor exists and the slot is free', async () => {
      const dto = makeDto();
      const created = { id: 'generated-id' };

      repository.doctorExists.mockResolvedValue({ id: dto.doctorId });
      repository.findOverlapping.mockResolvedValue(null);
      repository.create.mockResolvedValue(created as any);

      await expect(service.create(dto)).resolves.toBe(created);
      expect(repository.create).toHaveBeenCalledWith({
        patientName: dto.patientName,
        doctorId: dto.doctorId,
        startsAt: new Date(dto.startsAt),
        endsAt: new Date(
          new Date(dto.startsAt).getTime() + dto.durationMinutes * 60_000,
        ),
        reason: dto.reason,
      });
    });

    it('rejects when doctorId does not reference a known doctor', async () => {
      const dto = makeDto();

      repository.doctorExists.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repository.findOverlapping).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects a time slot that overlaps an existing appointment for the doctor', async () => {
      const dto = makeDto();

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

    it('rethrows unrelated errors from the repository unchanged', async () => {
      const dto = makeDto();
      const unrelated = new Error('connection reset');

      repository.doctorExists.mockResolvedValue({ id: dto.doctorId });
      repository.findOverlapping.mockResolvedValue(null);
      repository.create.mockRejectedValue(unrelated);

      await expect(service.create(dto)).rejects.toBe(unrelated);
    });
  });
});
