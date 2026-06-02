import { SaveMessageRequest, SaveMessageResponse, GetMessagesResponse, ChatMessage } from '@libs/rpc';
import * as flatbuffers from 'flatbuffers';
import { buildChatMessage } from '../../flatbuffers/builders';
import * as Chat from '../../flatbuffers/generated/chat';

export class ChatGrpcMapper {
  static toMessageBuffer(
    request: SaveMessageRequest,
    messageId: string,
    timestamp: number,
    eventTimestamp: number,
  ): Buffer {
    const uint8Array = buildChatMessage(
      messageId,
      Chat.MessageStatus.NORMAL,
      request.senderUuid,
      request.content,
      '', // metadata
      timestamp,
      eventTimestamp,
    );
    return Buffer.from(uint8Array);
  }

  static toGetMessagesResponse(buffers: Buffer[]): GetMessagesResponse {
    const messages: ChatMessage[] = buffers.map((buf) => {
      const bb = new flatbuffers.ByteBuffer(new Uint8Array(buf));
      const chatMsg = Chat.ChatMessage.getRootAsChatMessage(bb);
      return {
        messageId: chatMsg.id() || '',
        senderUuid: chatMsg.senderId() || '',
        content: chatMsg.content() || '',
        createdAt: Number(chatMsg.timestamp()),
      };
    });

    return { messages };
  }
}
