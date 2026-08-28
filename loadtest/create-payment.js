// payment 서비스(POST /payment)에 대한 k6 부하테스트.
// 실행: k6 run loadtest/create-payment.js
// 대상 변경: k6 run -e BASE_URL=http://localhost:18081 loadtest/create-payment.js
//
// idempotencyKey를 매 반복마다 새로 만든다 — 안 그러면 두 번째 요청부터
// Redis 멱등성 캐시에 히트해서 실제 쓰기 부하가 걸리지 않는다.
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:18081';

const completedCount = new Counter('payment_completed');
const failedCount = new Counter('payment_failed');
const unexpectedCount = new Counter('payment_unexpected');

export const options = {
  scenarios: {
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 20 },
        { duration: '20s', target: 50 },
        { duration: '20s', target: 100 },
        { duration: '20s', target: 200 },
        { duration: '30s', target: 200 },
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000'],
  },
};

export default function () {
  const idempotencyKey = `loadtest-${__VU}-${__ITER}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const payload = JSON.stringify({
    userId: __VU,
    amount: 1000 + (__ITER % 50) * 100,
    currency: 'KRW',
    paymentMethod: 'card',
    productId: `loadtest-product-${__VU % 10}`,
    quantity: '1',
    idempotencyKey,
  });

  const res = http.post(`${BASE_URL}/payment`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const ok = check(res, {
    'status is 200': (r) => r.status === 200,
  });

  if (ok) {
    const status = res.json('data.status');
    if (status === 'COMPLETED') completedCount.add(1);
    else if (status === 'FAILED') failedCount.add(1);
    else unexpectedCount.add(1);
  } else {
    unexpectedCount.add(1);
  }
}
