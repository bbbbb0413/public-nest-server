# 서비스 전체 개요

NestJS 모노레포 기반 마이크로서비스 아키텍처. Gateway 패턴으로 외부 요청을 처리하고, 내부 서비스 간 통신은 gRPC를 사용한다.

<!-- AUTO-GENERATED -->

## 서비스 목록

| 서비스 | 포트 | 프로토콜 | 역할 |
|--------|------|----------|------|
| [Gateway](./gateway.md) | 3000 | HTTP + WebSocket | API Gateway, 인증, 라우팅 |
| [Identity](./identity.md) | 50051 | gRPC | 게임 계정, 로그인, 메일, 채팅 |
| [Payment](./payment.md) | 50052 | gRPC | 결제 생성 및 조회 |
| [Chat Service](./chat-service.md) | 50053 | gRPC + WebSocket | 실시간 메시지 처리 |
| [AI Service](./ai-service.md) | 3004 | HTTP + SSE | RAG 기반 Q&A, 문서 벡터화 |

## 라이브러리

| 라이브러리 | 역할 |
|------------|------|
| [libs 개요](./libs.md) | auth, common, llm, rpc, shared-kernel |

## 데이터 흐름

### 로그인

```
Client → POST /auth/login
  └─ Gateway (IdentityGatewayController)
       └─ gRPC → Identity (IdentityGrpcController.login)
            └─ LoginUseCase → GameAccount 도메인
```

### 결제 생성

```
Client → POST /payments (JWT 인증)
  └─ Gateway (PaymentGatewayController)
       └─ gRPC → Payment (PaymentGrpcController.createPayment)
            └─ CreatePaymentUseCase → Payment 도메인
```

### 실시간 채팅

```
Client → WebSocket /chat/ws (join_room → send_message)
  └─ Gateway ChatGateway 또는 ChatService ChatGateway
       └─ MessageService.persistAndNotify()
            └─ FlatBuffer 저장 + 브로드캐스트
```

### RAG Q&A

```
Client → POST /qa/ask
  └─ AI Service (QaController)
       └─ AskUseCase
            ├─ 벡터 스토어에서 관련 문서 검색 (topK)
            └─ LLM 스트리밍 응답 → SSE 청크 전송
```

## 포트 설정

| 서비스 | HTTP | gRPC | WebSocket |
|--------|------|------|-----------|
| Gateway | 3000 | - | 3000 (`/chat/ws`) |
| Identity | - | 50051 | `$SOCKET_PORT` |
| Payment | - | 50052 | - |
| Chat Service | - | 50053 | `$SOCKET_PORT` |
| AI Service | 3004 | - | - |

## 인증 방식

| 타입 | 헤더 | 대상 |
|------|------|------|
| JWT Bearer | `Authorization: Bearer <token>` | 일반 클라이언트 |
| Basic Auth | `Authorization: Basic <credentials>` | 레거시 시스템 |
| API Key | `X-API-Key: <key>` | 서버-투-서버 |

<!-- /AUTO-GENERATED -->
