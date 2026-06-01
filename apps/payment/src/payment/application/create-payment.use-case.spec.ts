import { Test, TestingModule } from '@nestjs/testing';
import { CreatePaymentUseCase } from './create-payment.use-case';
import { CreatePaymentCommand } from './command/create-payment.command';
import { IPaymentRepository } from '../domain/repository/payment.repository';
import { Payment } from '../domain/model/payment';
import { Money } from '../domain/vo/money.vo';

const mockPaymentRepository = () => ({
  persist: jest.fn(),
  findPaymentById: jest.fn(),
  findAllAndCount: jest.fn(),
});

const buildPaymentFixture = (): Payment =>
  Payment.restore({
    id: 1,
    userId: 100,
    amount: 10000,
    currency: 'KRW',
    paymentMethod: 'card',
    productId: 'product-001',
    quantity: '1',
  });

describe('CreatePaymentUseCase', () => {
  let useCase: CreatePaymentUseCase;
  let paymentRepository: ReturnType<typeof mockPaymentRepository>;

  beforeEach(async () => {
    paymentRepository = mockPaymentRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatePaymentUseCase,
        { provide: IPaymentRepository, useValue: paymentRepository },
      ],
    }).compile();

    useCase = module.get<CreatePaymentUseCase>(CreatePaymentUseCase);
  });

  it('유효한 결제 커맨드를 받아 저장하고 도메인 객체를 반환한다', async () => {
    const fixture = buildPaymentFixture();
    paymentRepository.persist.mockResolvedValue(fixture);

    const command = new CreatePaymentCommand(
      100,
      10000,
      'KRW',
      'card',
      'product-001',
      '1',
    );
    const result = await useCase.execute(command);

    expect(paymentRepository.persist).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 100 }),
    );
    expect(result.money.getAmount()).toBe(10000);
    expect(result.money.getCurrency()).toBe('KRW');
  });

  it('음수 금액은 Money VO 생성 시 에러를 던진다', () => {
    expect(() => Money.of(-1, 'KRW')).toThrow('금액은 0 이상이어야 합니다.');
  });

  it('빈 통화 코드는 Money VO 생성 시 에러를 던진다', () => {
    expect(() => Money.of(1000, '')).toThrow('통화 코드는 필수입니다.');
  });
});
