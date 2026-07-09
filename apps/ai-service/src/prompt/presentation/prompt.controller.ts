import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreatePromptUseCase } from '../application/create-prompt.use-case';
import { ActivatePromptUseCase } from '../application/activate-prompt.use-case';
import { GetActivePromptUseCase } from '../application/get-active-prompt.use-case';
import { CreatePromptCommand } from '../application/command/create-prompt.command';
import { ActivatePromptCommand } from '../application/command/activate-prompt.command';
import { CreatePromptInDto } from './dto/create-prompt-in.dto';
import { PromptOutDto } from './dto/prompt-out.dto';
import {
  IPromptTemplateRepository,
  PromptTemplateRepository,
} from '../domain/repository/prompt-template.repository';
import { Inject } from '@nestjs/common';

@ApiTags('prompts')
@Controller('prompts')
export class PromptController {
  constructor(
    private readonly createUseCase: CreatePromptUseCase,
    private readonly activateUseCase: ActivatePromptUseCase,
    private readonly getActiveUseCase: GetActivePromptUseCase,
    @Inject(PromptTemplateRepository)
    private readonly repo: IPromptTemplateRepository,
  ) {}

  @Post()
  @ApiOperation({ summary: '프롬프트 신규 버전 생성' })
  async create(@Body() dto: CreatePromptInDto): Promise<PromptOutDto> {
    const template = await this.createUseCase.execute(
      new CreatePromptCommand(dto.name, dto.content, dto.variables, dto.userId),
    );
    return PromptOutDto.fromDomain(template);
  }

  @Get(':name')
  @ApiOperation({ summary: '특정 이름의 버전 목록 조회' })
  async list(@Param('name') name: string): Promise<PromptOutDto[]> {
    const templates = await this.repo.findAllByName(name);
    return templates.map(PromptOutDto.fromDomain);
  }

  @Get(':name/active')
  @ApiOperation({ summary: '현재 활성 버전 조회' })
  async getActive(
    @Param('name') name: string,
    @Query('userId') userId?: string,
  ): Promise<PromptOutDto> {
    const template = await this.getActiveUseCase.execute(name, userId);
    return PromptOutDto.fromDomain(template);
  }

  @Patch(':name/:version/activate')
  @ApiOperation({ summary: '특정 버전 활성화' })
  async activate(
    @Param('name') name: string,
    @Param('version', ParseIntPipe) version: number,
  ): Promise<PromptOutDto> {
    const template = await this.activateUseCase.execute(
      new ActivatePromptCommand(name, version),
    );
    return PromptOutDto.fromDomain(template);
  }
}
