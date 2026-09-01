import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @MinLength(2)
  patientName!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  doctorId!: string;

  @ApiProperty({ example: '2026-09-05T14:30:00.000Z' })
  @IsISO8601()
  startsAt!: string;

  @ApiProperty({ example: 30, minimum: 1 })
  @IsInt()
  @Min(1)
  durationMinutes!: number;

  @ApiPropertyOptional({ example: 'Follow-up consultation' })
  @IsOptional()
  @IsString()
  reason?: string;
}
