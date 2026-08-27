import { shardIndex } from './chat.hash';

/**
 * 채팅 메시지를 저장하는 Redis ZSET 키를 반환합니다.
 */
export function getChatZsetKey(roomId: string): string {
  return `chat:messages:${roomId}`;
}

/**
 * Pub/Sub 알림을 위한 샤드 채널명을 반환합니다.
 * roomId와 shardCount가 제공되면 해싱을 통해 채널을 결정하고,
 * shardIndex가 숫자로 제공되면 해당 인덱스의 채널을 반환합니다.
 */
export function getChatShardChannel(
  roomIdOrIndex: string | number,
  shardCount?: number,
): string {
  let index: number;

  if (typeof roomIdOrIndex === 'string') {
    if (shardCount === undefined) {
      throw new Error('shardCount is required when roomId is provided');
    }
    index = shardIndex(roomIdOrIndex, shardCount);
  } else {
    index = roomIdOrIndex;
  }

  return `chat:ws:shard:${index}`;
}
