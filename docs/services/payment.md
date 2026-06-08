# Payment Service

<!-- AUTO-GENERATED -->

**gRPC 포트**: 50052  
**역할**: 결제 생성 및 조회

## gRPC 서비스 (`PaymentService`)

| 메서드 | 요청 | 응답 | 설명 |
|--------|------|------|------|
| `CreatePayment` | `{ accountId, amount, currency, productId }` | `{ id, amount, currency, status }` | 결제 생성 |
| `GetPayment` | `{ paymentId }` | `{ id, amount, currency, status }` | 결제 조회 (없으면 NOT_FOUND) |

## HTTP 엔드포인트 (내부용)

| 메서드 | 경로 | 요청 | 응답 |
|--------|------|------|------|
| POST | `/payment` | `{ userId, amount, currency, paymentMethod, productId, quantity }` | `{ id, userId, amount, currency, paymentMethod, productId, quantity }` |

## 도메인 모델

### Payment

```typescript
Payment {
  id: number
  userId: number
  money: Money       // Value Object { amount, currency }
  paymentMethod: string
  productId: number
  quantity: number
}
```

**팩토리**:
- `Payment.create(props)` — 신규 생성
- `Payment.restore(props)` — DB 복원

### Money (Value Object)

```typescript
Money {
  amount: number
  currency: string   // 예: 'KRW', 'USD'
}
```

`amount`는 0 이상이어야 하며, `currency`는 필수다.

## 의존성

| 의존 | 용도 |
|------|------|
| MySQL (Payment DB) | 결제 데이터 저장 |

<!-- /AUTO-GENERATED -->
