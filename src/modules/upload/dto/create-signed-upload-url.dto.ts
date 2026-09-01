import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';

export class CreateSignedUploadUrlDto {
  @ApiProperty({
    example: 'studies/2026/09/abc123.dcm',
    description:
      'Destination object path (including file name) within the storage bucket. Only DICOM (.dcm) files are supported.',
  })
  @IsString()
  @Matches(/\.dcm$/i, { message: 'path must point to a .dcm file.' })
  path!: string;

  @ApiPropertyOptional({
    default: false,
    description: 'Allow overwriting an object that already exists at the path.',
  })
  @IsOptional()
  @IsBoolean()
  upsert?: boolean;
}
