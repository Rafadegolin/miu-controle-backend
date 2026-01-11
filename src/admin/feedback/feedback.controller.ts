import { Controller, Get, Post, Body, Patch, Param, UseGuards, Req, Query } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto, FeedbackType } from './dto/create-feedback.dto';
import { UpdateFeedbackStatusDto, FeedbackStatus } from './dto/update-feedback-status.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@ApiTags('Feedback')
@Controller('feedback') // Public/User path
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enviar feedback (Bug/Sugestão)' })
  create(@Req() req, @Body() dto: CreateFeedbackDto) {
    return this.feedbackService.create(req.user.id, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar meus feedbacks' })
  getMyFeedback(@Req() req) {
    return this.feedbackService.getMyFeedback(req.user.id);
  }

  // --- ADMIN ROUTES ---

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar todos feedbacks (Admin)' })
  @ApiQuery({ name: 'status', enum: FeedbackStatus, required: false })
  @ApiQuery({ name: 'type', enum: FeedbackType, required: false })
  findAll(
    @Query('status') status?: FeedbackStatus,
    @Query('type') type?: FeedbackType
  ) {
    return this.feedbackService.findAll({ status, type });
  }

  @Patch('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar status do feedback e responder' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFeedbackStatusDto,
    @Req() req
  ) {
    return this.feedbackService.updateStatus(id, dto, req.user.id);
  }
}
