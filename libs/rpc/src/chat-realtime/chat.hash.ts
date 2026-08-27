/**
 * roomId 문자열을 DJB2로 해싱한 뒤, MurmurHash3의 fmix32 finalizer를 적용하여 샤드 인덱스를 계산합니다.
 * DJB2 단독 사용 시 순차적 키에서 해시 분포가 편중되는 문제를 해결하기 위해 fmix32를 추가하여 avalanche 효과를 제공합니다.
 */
export function shardIndex(roomId: string, shardCount: number): number {
  let h = 0;
  for (let i = 0; i < roomId.length; i++) {
    h = ((h << 5) - h + roomId.charCodeAt(i)) | 0;
  }

  // MurmurHash3 fmix32 finalizer
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;

  // 결과값이 음수일 경우 양수로 변환 (unsigned shift) 후 modulo 연산
  return (h >>> 0) % shardCount;
}
