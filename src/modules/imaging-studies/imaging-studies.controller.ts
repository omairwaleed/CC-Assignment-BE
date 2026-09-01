import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { IdempotencyInterceptor } from '../../common/idempotency/idempotency.interceptor';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CreateImagingStudyDto } from './dto/create-imaging-study.dto';
import { ImagingStudiesService } from './imaging-studies.service';

@ApiTags('imaging-studies')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('imaging-studies')
export class ImagingStudiesController {
  constructor(private readonly imagingStudiesService: ImagingStudiesService) {}

  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'A client-generated key that makes a retried request safe.',
    required: true,
  })
  @ApiOperation({ summary: 'Attach an imaging study to an appointment' })
  create(@Body() dto: CreateImagingStudyDto) {
    return this.imagingStudiesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List imaging studies for an appointment' })
  @ApiQuery({ name: 'appointmentId', format: 'uuid' })
  findByAppointment(
    @Query('appointmentId', ParseUUIDPipe) appointmentId: string,
  ) {
    return this.imagingStudiesService.findByAppointment(appointmentId);
  }

  @Get(':id/image-url')
  @ApiOperation({
    summary: 'Get a signed URL to download/view the imaging study image',
  })
  getImageUrl(@Param('id', ParseUUIDPipe) id: string) {
    return this.imagingStudiesService.getImageSignedUrl(id);
  }
}
