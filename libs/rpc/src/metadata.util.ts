import { Metadata, status } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { Session } from './generated/common';
import { METADATA_KEYS } from './constants';

export function toMetadata(session: Session): Metadata {
  const metadata = new Metadata();
  
  if (session.id) metadata.set(METADATA_KEYS.SESSION_ID, session.id);
  if (session.uuid) metadata.set(METADATA_KEYS.SESSION_UUID, session.uuid);
  if (session.nickName) {
    metadata.set(METADATA_KEYS.SESSION_NICKNAME, encodeURIComponent(session.nickName));
  }
  if (session.gameDbId !== undefined && session.gameDbId !== null) {
    metadata.set(METADATA_KEYS.SESSION_GAME_DB_ID, String(session.gameDbId));
  }
  if (session.database) metadata.set(METADATA_KEYS.SESSION_DATABASE, session.database);

  return metadata;
}

export function fromMetadata(metadata: Metadata): Session {
  const getSingleValue = (key: string): string | undefined => {
    const values = metadata.get(key);
    if (!values || values.length === 0) return undefined;
    return values[0] as string;
  };

  const id = getSingleValue(METADATA_KEYS.SESSION_ID);
  const uuid = getSingleValue(METADATA_KEYS.SESSION_UUID);
  const encodedNickName = getSingleValue(METADATA_KEYS.SESSION_NICKNAME);
  const gameDbIdStr = getSingleValue(METADATA_KEYS.SESSION_GAME_DB_ID);
  const database = getSingleValue(METADATA_KEYS.SESSION_DATABASE);

  if (!id || !uuid || !encodedNickName || !gameDbIdStr || !database) {
    throw new RpcException({
      code: status.UNAUTHENTICATED,
      message: 'Required session fields are missing in metadata',
    });
  }

  const nickName = decodeURIComponent(encodedNickName);
  const gameDbId = Number(gameDbIdStr);

  if (isNaN(gameDbId)) {
    throw new RpcException({
      code: status.UNAUTHENTICATED,
      message: 'Invalid game DB ID in metadata',
    });
  }

  return {
    id,
    uuid,
    nickName,
    gameDbId,
    database,
  };
}
