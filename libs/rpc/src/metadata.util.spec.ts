import { Metadata } from '@grpc/grpc-js';
import { toMetadata, fromMetadata } from './metadata.util';
import { Session } from './generated/common';

describe('Metadata Util', () => {
  const mockSession: Session = {
    id: 'session-123',
    uuid: 'user-uuid-456',
    nickName: '홍길동',
    gameDbId: 789,
    database: 'game_db_1',
  };

  describe('toMetadata', () => {
    it('Session 객체를 올바르게 gRPC Metadata로 인코딩해야 한다', () => {
      const metadata = toMetadata(mockSession);
      expect(metadata.get('x-session-id')[0]).toBe(mockSession.id);
      expect(metadata.get('x-session-uuid')[0]).toBe(mockSession.uuid);
      expect(metadata.get('x-session-nickname')[0]).toBe(encodeURIComponent(mockSession.nickName));
      expect(metadata.get('x-session-game-db')[0]).toBe(String(mockSession.gameDbId));
      expect(metadata.get('x-session-database')[0]).toBe(mockSession.database);
    });
  });

  describe('fromMetadata', () => {
    it('gRPC Metadata로부터 Session 객체를 올바르게 복원해야 한다', () => {
      const metadata = new Metadata();
      metadata.set('x-session-id', mockSession.id);
      metadata.set('x-session-uuid', mockSession.uuid);
      metadata.set('x-session-nickname', encodeURIComponent(mockSession.nickName));
      metadata.set('x-session-game-db', String(mockSession.gameDbId));
      metadata.set('x-session-database', mockSession.database);

      const session = fromMetadata(metadata);
      expect(session).toEqual(mockSession);
    });

    it('Metadata에 필수 세션 필드가 누락되었을 경우 RpcException(UNAUTHENTICATED)을 발생시켜야 한다', () => {
      const metadata = new Metadata();
      // x-session-id 누락
      metadata.set('x-session-uuid', mockSession.uuid);
      metadata.set('x-session-nickname', encodeURIComponent(mockSession.nickName));
      metadata.set('x-session-game-db', String(mockSession.gameDbId));
      metadata.set('x-session-database', mockSession.database);

      expect(() => fromMetadata(metadata)).toThrow();
    });
  });
});
