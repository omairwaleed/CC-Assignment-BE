import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ImagingStudiesService } from './imaging-studies.service';
import { ImagingStudiesRepository } from './imaging-studies.repository';
import { UploadService } from '../upload/upload.service';
import { CreateImagingStudyDto } from './dto/create-imaging-study.dto';

/** Builds a Prisma unique-constraint violation, as thrown for a duplicate id. */
function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

function makeDto(
  overrides: Partial<CreateImagingStudyDto> = {},
): CreateImagingStudyDto {
  return {
    id: '44444444-4444-4444-4444-444444444444',
    appointmentId: '11111111-1111-1111-1111-111111111111',
    modality: 'CT',
    dicomFilePath: 'studies/2026/09/abc123.dcm',
    ...overrides,
  };
}

describe('ImagingStudiesService', () => {
  let service: ImagingStudiesService;
  let repository: jest.Mocked<ImagingStudiesRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ImagingStudiesService,
        {
          provide: ImagingStudiesRepository,
          useValue: {
            appointmentExists: jest.fn(),
            studyExists: jest.fn(),
            create: jest.fn(),
            findById: jest.fn(),
            findByAppointment: jest.fn(),
          },
        },
        {
          provide: UploadService,
          useValue: {
            createSignedUrl: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(ImagingStudiesService);
    repository = moduleRef.get(ImagingStudiesRepository);
  });

  describe('create', () => {
    it('creates an imaging study when the appointment exists and the id is new', async () => {
      const dto = makeDto();
      const created = { id: dto.id };

      repository.appointmentExists.mockResolvedValue({ id: dto.appointmentId });
      repository.studyExists.mockResolvedValue(null);
      repository.create.mockResolvedValue(created as any);

      await expect(service.create(dto)).resolves.toBe(created);
      expect(repository.create).toHaveBeenCalledWith({
        id: dto.id,
        appointmentId: dto.appointmentId,
        modality: dto.modality,
        description: dto.description,
        dicomFilePath: dto.dicomFilePath,
      });
    });

    it('rejects when appointmentId does not reference a known appointment', async () => {
      const dto = makeDto();

      repository.appointmentExists.mockResolvedValue(null);

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repository.studyExists).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate imaging study id', async () => {
      const dto = makeDto();

      repository.appointmentExists.mockResolvedValue({ id: dto.appointmentId });
      repository.studyExists.mockResolvedValue({ id: dto.id });

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('converts a unique-constraint violation from a concurrent insert into a ConflictException', async () => {
      const dto = makeDto();

      repository.appointmentExists.mockResolvedValue({ id: dto.appointmentId });
      repository.studyExists.mockResolvedValue(null);
      repository.create.mockRejectedValue(uniqueConstraintError());

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rethrows unrelated errors from the repository unchanged', async () => {
      const dto = makeDto();
      const unrelated = new Error('connection reset');

      repository.appointmentExists.mockResolvedValue({ id: dto.appointmentId });
      repository.studyExists.mockResolvedValue(null);
      repository.create.mockRejectedValue(unrelated);

      await expect(service.create(dto)).rejects.toBe(unrelated);
    });

    it('resolves two concurrent requests for the same id with exactly one winner', async () => {
      const dto = makeDto();
      const store = new Map<string, unknown>();

      repository.appointmentExists.mockResolvedValue({ id: dto.appointmentId });
      repository.studyExists.mockImplementation(async (id) =>
        store.has(id) ? { id } : null,
      );
      repository.create.mockImplementation(async (data) => {
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
