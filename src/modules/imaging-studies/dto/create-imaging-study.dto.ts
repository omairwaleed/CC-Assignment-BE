import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateImagingStudyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  appointmentId!: string;

  @ApiProperty({
    example: 'CT',
    description: 'DICOM modality code (CT, MR, XR, US, ...)',
  })
  @IsString()
  @MinLength(2)
  modality!: string;

  @ApiPropertyOptional({ example: 'Chest CT without contrast' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'studies/2026/09/abc123.dcm' })
  @IsString()
  @MinLength(1)
  dicomFilePath!: string;
}
