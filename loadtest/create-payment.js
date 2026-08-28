// payment 서비스(POST /payment)에 대한 k6 부하테스트.
//
// payment는 더 이상 host 포트를 노출하지 않는다(gateway를 통해서만 접근).
// 그래서 이 스크립트도 도커 네트워크 안에서 payment 컨테이너 이름으로 직접 실행해야 한다:
//   docker run --rm -i --network public-project_default \
//     -e BASE_URL=http://payment:18081 grafana/k6 run - < loadtest/create-payment.js
// (게이트웨이를 경유하는 실 트래픽 경로를 그대로 부하테스트하려면 JWT 발급 로직을
//  스크립트에 추가하고 BASE_URL을 http://gateway:3000 으로 바꿔야 한다 — 지금은 다루지 않는다.)
//
// idempotencyKey를 매 반복마다 새로 만든다 — 안 그러면 두 번째 요청부터
// Redis 멱등성 캐시에 히트해서 실제 쓰기 부하가 걸리지 않는다.
import http from 'k6/http';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://payment:18081';

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
