import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ImagingStudiesService } from './imaging-studies.service';
import { ImagingStudiesRepository } from './imaging-studies.repository';
import { UploadService } from '../upload/upload.service';
import { CreateImagingStudyDto } from './dto/create-imaging-study.dto';

function makeDto(
  overrides: Partial<CreateImagingStudyDto> = {},
): CreateImagingStudyDto {
  return {
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
    it('creates an imaging study when the appointment exists', async () => {
      const dto = makeDto();
      const created = { id: 'generated-id' };

      repository.appointmentExists.mockResolvedValue({ id: dto.appointmentId });
      repository.create.mockResolvedValue(created as any);

      await expect(service.create(dto)).resolves.toBe(created);
      expect(repository.create).toHaveBeenCalledWith({
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
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rethrows unrelated errors from the repository unchanged', async () => {
      const dto = makeDto();
      const unrelated = new Error('connection reset');

      repository.appointmentExists.mockResolvedValue({ id: dto.appointmentId });
      repository.create.mockRejectedValue(unrelated);

      await expect(service.create(dto)).rejects.toBe(unrelated);
    });
  });
});
