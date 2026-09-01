import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'omairwaleed17@gmail.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123Asd++', minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;
}
