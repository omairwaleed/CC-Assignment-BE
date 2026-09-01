import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DoctorsService } from './doctors.service';
import { DoctorsRepository } from './doctors.repository';
import { CreateDoctorDto } from './dto/create-doctor.dto';

/** Builds a Prisma unique-constraint violation, as thrown for a duplicate id. */
function uniqueConstraintError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });
}

function makeDto(overrides: Partial<CreateDoctorDto> = {}): CreateDoctorDto {
  return {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Dr. Jane Smith',
    ...overrides,
  };
}

describe('DoctorsService', () => {
  let service: DoctorsService;
  let repository: jest.Mocked<DoctorsRepository>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        DoctorsService,
        {
          provide: DoctorsRepository,
          useValue: {
            exists: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(DoctorsService);
    repository = moduleRef.get(DoctorsRepository);
  });

  describe('create', () => {
    it('creates a doctor when the id is new', async () => {
      const dto = makeDto();
      const created = { id: dto.id, name: dto.name };

      repository.exists.mockResolvedValue(null);
      repository.create.mockResolvedValue(created as any);

      await expect(service.create(dto)).resolves.toBe(created);
      expect(repository.create).toHaveBeenCalledWith({
        id: dto.id,
        name: dto.name,
      });
    });

    it('rejects a duplicate doctor id', async () => {
      const dto = makeDto();

      repository.exists.mockResolvedValue({ id: dto.id });

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('converts a unique-constraint violation from a concurrent insert into a ConflictException', async () => {
      const dto = makeDto();

      repository.exists.mockResolvedValue(null);
      repository.create.mockRejectedValue(uniqueConstraintError());

      await expect(service.create(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rethrows unrelated errors from the repository unchanged', async () => {
      const dto = makeDto();
      const unrelated = new Error('connection reset');

      repository.exists.mockResolvedValue(null);
      repository.create.mockRejectedValue(unrelated);

      await expect(service.create(dto)).rejects.toBe(unrelated);
    });

    it('resolves two concurrent requests for the same id with exactly one winner', async () => {
      const dto = makeDto();
      const store = new Map<string, unknown>();

      repository.exists.mockImplementation(async (id) =>
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
