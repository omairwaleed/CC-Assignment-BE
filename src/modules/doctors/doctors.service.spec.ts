import { Test } from '@nestjs/testing';
import { DoctorsService } from './doctors.service';
import { DoctorsRepository } from './doctors.repository';
import { CreateDoctorDto } from './dto/create-doctor.dto';

function makeDto(overrides: Partial<CreateDoctorDto> = {}): CreateDoctorDto {
  return {
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
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(DoctorsService);
    repository = moduleRef.get(DoctorsRepository);
  });

  describe('create', () => {
    it('creates a doctor', async () => {
      const dto = makeDto();
      const created = { id: 'generated-id', name: dto.name };

      repository.create.mockResolvedValue(created as any);

      await expect(service.create(dto)).resolves.toBe(created);
      expect(repository.create).toHaveBeenCalledWith({ name: dto.name });
    });
  });
});
