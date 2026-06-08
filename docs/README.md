# 서버 문서 인덱스

NestJS 모노레포 서버의 기능 문서 목록.

---

## 서비스 구성

```
외부 클라이언트
      ↓
  [Gateway] :3000          ← 단일 진입점, JWT 인증
  ┌────┬────┬────┐
  ↓    ↓    ↓    ↓
Identity Payment Chat   AI Service
:50051  :50052 :50053   :3004
(gRPC) (gRPC) (gRPC+WS) (REST)
```

---

## 문서 목록

| 서비스 | 문서 | 주요 기능 |
|---|---|---|
| Gateway | [gateway.md](./gateway.md) | REST API 라우팅, WebSocket 프록시, JWT 인증 |
| Identity | [identity.md](./identity.md) | 게임 계정 로그인, 메일 발송, Groq AI, Bull 큐 |
| Payment | [payment.md](./payment.md) | 결제 생성 및 조회 |
| Chat Service | [chat-service.md](./chat-service.md) | 실시간 채팅, FlatBuffers, Redis Pub/Sub |
| AI Service | [ai-service.md](./ai-service.md) | RAG Q&A, 문서 업로드, LLM 멀티 프로바이더 |

## 스펙 문서

| 문서 | 내용 |
|---|---|
| [spec/gateway-grpc-migration.md](./spec/gateway-grpc-migration.md) | Gateway gRPC 전환 설계 |
| [spec/ai-service-rag.md](./spec/ai-service-rag.md) | AI Service RAG 상세 스펙 |

---

## 포트 정리

| 서비스 | HTTP | gRPC |
|---|---|---|
| Gateway | 3000 | — |
| Identity | 8080 | 50051 |
| Payment | 8081 | 50052 |
| Chat Service | — | 50053 |
| AI Service | 3004 | — |
