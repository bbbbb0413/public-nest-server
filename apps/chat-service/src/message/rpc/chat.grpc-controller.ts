import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { Metadata } from '@grpc/grpc-js';
import { ChatServiceController, SaveMessageRequest, SaveMessageResponse, GetMessagesRequest, GetMessagesResponse } from '@libs/rpc';
import { MessageService } from '../message.service';
import { ChatGrpcMapper } from './chat.grpc-mapper';
import { v4 as uuidv4 } from 'uuid';

@Controller()
export class ChatGrpcController implements ChatServiceController {
  constructor(private readonly messageService: MessageService) {}

  @GrpcMethod('ChatService', 'SaveMessage')
  async saveMessage(
    request: SaveMessageRequest,
    metadata: Metadata,
  ): Promise<SaveMessageResponse> {
    const messageId = uuidv4();
    const timestamp = Date.now();
    const eventTimestamp = timestamp * 1000;

    const messageBuffer = ChatGrpcMapper.toMessageBuffer(
      request,
      messageId,
      timestamp,
      eventTimestamp,
    );

    await this.messageService.persistAndNotify(
      request.roomId,
      messageBuffer,
      eventTimestamp,
      'socket',
    );

    return {
      messageId,
      createdAt: timestamp,
    };
  }

  @GrpcMethod('ChatService', 'GetMessages')
  async getMessages(
    request: GetMessagesRequest,
    metadata: Metadata,
  ): Promise<GetMessagesResponse> {
    const buffers = await this.messageService.getHistory(
      request.roomId,
      Date.now() * 1000,
      request.limit,
    );

    return ChatGrpcMapper.toGetMessagesResponse(buffers);
  }
}
