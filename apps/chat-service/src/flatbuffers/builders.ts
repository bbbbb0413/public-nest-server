import * as flatbuffers from 'flatbuffers';
import * as Chat from './generated/chat';

/**
 * 개별 ChatMessage를 FlatBuffers 바이너리로 빌드합니다.
 */
export function buildChatMessage(
  id: string,
  status: number,
  senderId: string,
  content: string,
  metadata: string,
  timestamp: number,
  eventTimestamp: number,
): Uint8Array {
  const builder = new flatbuffers.Builder(512);
  
  const idOffset = builder.createString(id);
  const senderIdOffset = builder.createString(senderId);
  const contentOffset = builder.createString(content);
  const metadataOffset = builder.createString(metadata);

  Chat.ChatMessage.startChatMessage(builder);
  Chat.ChatMessage.addId(builder, idOffset);
  Chat.ChatMessage.addStatus(builder, status);
  Chat.ChatMessage.addSenderId(builder, senderIdOffset);
  Chat.ChatMessage.addContent(builder, contentOffset);
  Chat.ChatMessage.addMetadata(builder, metadataOffset);
  Chat.ChatMessage.addTimestamp(builder, BigInt(timestamp));
  Chat.ChatMessage.addEventTimestamp(builder, BigInt(eventTimestamp));
  
  const endOffset = Chat.ChatMessage.endChatMessage(builder);
  builder.finish(endOffset);
  
  return builder.asUint8Array();
}

/**
 * 여러 메시지를 포함하는 MessageBatch를 FlatBuffers 바이너리로 빌드합니다.
 */
export function buildMessageBatch(
  messageBuffers: Buffer[],
  latestEventTimestamp: number,
): Uint8Array {
  const builder = new flatbuffers.Builder(1024);

  // 각 메시지 버퍼를 ChatMessage 객체로 역직렬화한 뒤 다시 빌드하는 과정이 필요할 수 있으나,
  // 성능을 위해 이미 빌드된 ChatMessage들을 그대로 벡터에 넣는 방식은 flatbuffers에서 직접 지원하지 않습니다.
  // 여기서는 메시지 객체들을 인자로 받아 처음부터 다시 빌드하는 시나리오를 가정하거나,
  // ZSET에 저장된 것이 완성된 ChatMessage 바이너리라고 가정하고 배치 구조를 만듭니다.

  // ZSET에는 Chat.ChatMessage.finish()된 바이너리가 저장되어 있다고 가정합니다.
  // 하지만 MessageBatch 내의 messages:[ChatMessage]는 finish() 전의 offset들을 원하므로
  // 단순 Buffer concat은 불가능합니다.
  
  // (실제 구현) ZSET에 저장된 바이너리들을 다시 파싱하여 배치에 추가합니다.
  const messageOffsets = messageBuffers.map((buf) => {
    const chatMsg = Chat.ChatMessage.getRootAsChatMessage(new flatbuffers.ByteBuffer(buf));
    
    const idOffset = builder.createString(chatMsg.id() || '');
    const senderIdOffset = builder.createString(chatMsg.senderId() || '');
    const contentOffset = builder.createString(chatMsg.content() || '');
    const metadataOffset = builder.createString(chatMsg.metadata() || '');

    Chat.ChatMessage.startChatMessage(builder);
    Chat.ChatMessage.addId(builder, idOffset);
    Chat.ChatMessage.addStatus(builder, chatMsg.status());
    Chat.ChatMessage.addSenderId(builder, senderIdOffset);
    Chat.ChatMessage.addContent(builder, contentOffset);
    Chat.ChatMessage.addMetadata(builder, metadataOffset);
    Chat.ChatMessage.addTimestamp(builder, chatMsg.timestamp());
    Chat.ChatMessage.addEventTimestamp(builder, chatMsg.eventTimestamp());
    return Chat.ChatMessage.endChatMessage(builder);
  });

  const messagesVector = Chat.MessageBatch.createMessagesVector(builder, messageOffsets);

  Chat.MessageBatch.startMessageBatch(builder);
  Chat.MessageBatch.addMessages(builder, messagesVector);
  Chat.MessageBatch.addLatestEventTimestamp(builder, BigInt(latestEventTimestamp));
  
  const endOffset = Chat.MessageBatch.endMessageBatch(builder);
  builder.finish(endOffset);

  return builder.asUint8Array();
}
