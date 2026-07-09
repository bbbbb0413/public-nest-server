import { Injectable } from '@nestjs/common';
import { Critique } from '../domain/vo/critique.vo';

@Injectable()
export class QueryRefinerService {
  refine(originalQuestion: string, critique: Critique): string {
    const nextQuery = critique.getNextQuery();
    if (nextQuery && nextQuery.trim().length > 0) {
      return nextQuery;
    }
    const missing = critique.getMissing();
    if (missing.length > 0) {
      return `${originalQuestion} (특히: ${missing.join(', ')})`;
    }
    return originalQuestion;
  }
}
