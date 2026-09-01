import { Injectable, NotFoundException } from '@nestjs/common';
import { DoctorsRepository } from './doctors.repository';
import { CreateDoctorDto } from './dto/create-doctor.dto';

@Injectable()
export class DoctorsService {
  constructor(private readonly doctors: DoctorsRepository) {}

  create(dto: CreateDoctorDto) {
    return this.doctors.create({ name: dto.name });
  }

  findAll() {
    return this.doctors.findMany();
  }

  async findOne(id: string) {
    const doctor = await this.doctors.findById(id);

    if (!doctor) {
      throw new NotFoundException('Doctor not found.');
    }

    return doctor;
  }
}
