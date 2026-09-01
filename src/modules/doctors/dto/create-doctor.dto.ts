import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateDoctorDto {
  @ApiProperty({ example: 'Dr. Jane Smith' })
  @IsString()
  @MinLength(2)
  name!: string;
}
