import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DoctorsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.DoctorUncheckedCreateInput) {
    return this.prisma.doctor.create({ data });
  }

  findMany() {
    return this.prisma.doctor.findMany({ orderBy: { name: 'asc' } });
  }

  findById(id: string) {
    return this.prisma.doctor.findUnique({ where: { id } });
  }
}
