import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../auth/guards/supabase-auth.guard';
import { CreateSignedUploadUrlDto } from './dto/create-signed-upload-url.dto';
import { UploadService } from './upload.service';

@ApiTags('upload')
@ApiBearerAuth()
@UseGuards(SupabaseAuthGuard)
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a signed URL the frontend uploads an image to directly',
  })
  createSignedUploadUrl(@Body() dto: CreateSignedUploadUrlDto) {
    return this.uploadService.createSignedUploadUrl(dto.path, dto.upsert);
  }
}
