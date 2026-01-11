import { Controller, Get, Post, Body, Patch, Param, Delete, UseInterceptors, UploadedFile, ParseFilePipe, MaxFileSizeValidator, FileTypeValidator, UseGuards } from '@nestjs/common';
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadService } from '../upload/upload.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Brands')
@Controller('brands')
@UseGuards(RolesGuard)
export class BrandsController {
  constructor(
    private readonly brandsService: BrandsService,
    private readonly uploadService: UploadService
  ) {}

  @Post()
  @ApiOperation({ summary: 'Criar nova marca' })
  @Roles(Role.ADMIN)
  create(@Body() createBrandDto: CreateBrandDto) {
    return this.brandsService.create(createBrandDto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todas as marcas' })
  findAll() {
    return this.brandsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar marca por ID' })
  findOne(@Param('id') id: string) {
    return this.brandsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualizar marca' })
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() updateBrandDto: UpdateBrandDto) {
    return this.brandsService.update(id, updateBrandDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover marca' })
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.brandsService.remove(id);
  }

  @Post(':id/logo')
  @ApiOperation({ summary: 'Upload de logo da marca' })
  @Roles(Role.ADMIN)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @Param('id') id: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: '.(png|jpeg|jpg|webp)' }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    const url = await this.uploadService.uploadFile(file, 'logos', 'brand-logos');
    return this.brandsService.updateLogo(id, url);
  }

  @Post('check-pattern')
  @ApiOperation({ summary: 'Testar se um padrão de texto detecta uma descrição' })
  @Roles(Role.ADMIN)
  checkPattern(@Body() body: { pattern: string; text: string }) {
    const { pattern, text } = body;
    // Basic substring match logic matching the service
    const isMatch = text.toLowerCase().includes(pattern.toLowerCase());
    return { match: isMatch, pattern, text };
  }
}
