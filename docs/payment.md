# Payment 서비스

결제 생성 및 조회를 담당하는 내부 서비스.

| 항목 | 내용 |
|---|---|
| 포트 | 8081 (HTTP), 50052 (gRPC) |
| DB | MySQL (개인DB, 게임DB, 결제DB) |

---

## gRPC — PaymentService

Gateway에서 내부적으로 호출. `proto/payment.proto` 기준.

### `CreatePayment`
- 요청: `{ accountId: number, amount: number, currency: string, productId: string }`
- 응답: `PaymentReply` (paymentId, status, amount, currency, productId, createdAt)
- 동작: Payment 도메인 모델 생성 → 영속화 → 결과 반환
- 인증: gRPC Metadata에서 세션 추출

### `GetPayment`
- 요청: `{ paymentId: number }`
- 응답: `PaymentReply`
- 동작: paymentId로 결제 조회. 없으면 `NOT_FOUND` 에러
- 인증: gRPC Metadata에서 세션 추출

---

## REST API (내부 직접 접근)

#### `POST /payment` — 결제 생성
- 요청: `CreatePaymentInDto` `{ userId, amount, currency, paymentMethod, productId, quantity }`
- 응답: `PaymentOutDto`

---

## 도메인 모델

**Payment**
- `id` — 결제 식별자
- `userId` — 결제 주체 유저 ID
- `amount` — 금액 (Money VO)
- `currency` — 통화 코드
- `paymentMethod` — 결제 수단
- `productId` — 상품 ID
- `quantity` — 수량
