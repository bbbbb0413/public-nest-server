import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RagContentValidator } from '../../application/filter/rag-content-validator';

interface AskRequestBody {
  body?: { question?: string };
}

@Injectable()
export class PromptInjectionGuard implements CanActivate {
  private readonly logger = new Logger(PromptInjectionGuard.name);

  constructor(
    private readonly validator: RagContentValidator,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const enabled =
      this.configService.get<string>('GUARDRAIL_ENABLED') !== 'false';
    if (!enabled) return true;

    const req = context.switchToHttp().getRequest<AskRequestBody>();
    const question = req.body?.question ?? '';
    const verdict = this.validator.inspectInput(question);

    if (!verdict.isAllowed()) {
      this.logger.warn(`프롬프트 인젝션 차단: ${verdict.getReason()}`);
      throw new ForbiddenException('요청이 보안 정책에 의해 차단되었습니다.');
    }

    return true;
  }
}
