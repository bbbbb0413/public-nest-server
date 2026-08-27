import * as flatbuffers from 'flatbuffers';
import { ChatMessage } from './chat/chat-message';
import { MessageBatch } from './chat/message-batch';

/**
 * ZSET에 저장된 ChatMessage 바이너리들을 다시 파싱하여 하나의 MessageBatch로 묶습니다.
 * flatbuffers는 이미 finish()된 바이너리를 그대로 벡터에 넣는 것을 지원하지 않아,
 * 각 메시지를 파싱한 뒤 동일한 builder 안에서 다시 빌드합니다.
 */
export function buildMessageBatch(
  messageBuffers: Buffer[],
  latestEventTimestamp: number,
): Uint8Array {
  const builder = new flatbuffers.Builder(1024);

  const messageOffsets = messageBuffers.map((buf) => {
    const chatMsg = ChatMessage.getRootAsChatMessage(new flatbuffers.ByteBuffer(buf));

    const idOffset = builder.createString(chatMsg.id() || '');
    const senderIdOffset = builder.createString(chatMsg.senderId() || '');
    const contentOffset = builder.createString(chatMsg.content() || '');
    const metadataOffset = builder.createString(chatMsg.metadata() || '');

    ChatMessage.startChatMessage(builder);
    ChatMessage.addId(builder, idOffset);
    ChatMessage.addStatus(builder, chatMsg.status());
    ChatMessage.addSenderId(builder, senderIdOffset);
    ChatMessage.addContent(builder, contentOffset);
    ChatMessage.addMetadata(builder, metadataOffset);
    ChatMessage.addTimestamp(builder, chatMsg.timestamp());
    ChatMessage.addEventTimestamp(builder, chatMsg.eventTimestamp());
    return ChatMessage.endChatMessage(builder);
  });

  const messagesVector = MessageBatch.createMessagesVector(builder, messageOffsets);

  MessageBatch.startMessageBatch(builder);
  MessageBatch.addMessages(builder, messagesVector);
  MessageBatch.addLatestEventTimestamp(builder, BigInt(latestEventTimestamp));

  const endOffset = MessageBatch.endMessageBatch(builder);
  builder.finish(endOffset);

  return builder.asUint8Array();
}
