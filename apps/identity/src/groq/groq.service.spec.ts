import { Test, TestingModule } from '@nestjs/testing';
import { GroqService } from './groq.service';
import { GroqProvider } from '@libs/common/provider/groq.provider';

describe('GroqService', () => {
  let service: GroqService;
  let groqProvider: any;

  beforeEach(async () => {
    groqProvider = {
      getGroqChatCompletion: jest.fn(),
      embedding: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroqService,
        {
          provide: GroqProvider,
          useValue: groqProvider,
        },
      ],
    }).compile();

    service = module.get<GroqService>(GroqService);
  });

  describe('getGroqCompletion', () => {
    it('groqProvider.getGroqChatCompletion을 호출하고 결과를 반환한다', async () => {
      const mockResult = { choices: [{ message: { content: 'hello' } }] };
      groqProvider.getGroqChatCompletion.mockResolvedValue(mockResult);

      const result = await service.getGroqCompletion({ content: 'hi' });
      expect(result).toBe(mockResult);
      expect(groqProvider.getGroqChatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: 'user', content: 'hi' }],
          model: 'llama3-70b-8192',
          response_format: { type: 'text' },
        }),
      );
    });
  });

  describe('embedding', () => {
    it('groqProvider.embedding을 호출하고 결과를 반환한다', async () => {
      const mockEmbeddingResult = {
        data: [
          {
            embedding: [0.1, 0.2, 0.3],
          },
        ],
      };
      groqProvider.embedding.mockResolvedValue(mockEmbeddingResult);

      const result = await service.embedding({ content: 'text to embed' });
      expect(result).toBe(mockEmbeddingResult.data);
      expect(groqProvider.embedding).toHaveBeenCalledWith(
        expect.objectContaining({
          input: 'text to embed',
        }),
      );
    });
  });
});
