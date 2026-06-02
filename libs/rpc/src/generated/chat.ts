import { Observable } from 'rxjs';
import { Metadata } from '@grpc/grpc-js';

export interface SaveMessageRequest {
  roomId: string;
  senderUuid: string;
  content: string;
}

export interface SaveMessageResponse {
  messageId: string;
  createdAt: number;
}

export interface GetMessagesRequest {
  roomId: string;
  limit: number;
}

export interface ChatMessage {
  messageId: string;
  senderUuid: string;
  content: string;
  createdAt: number;
}

export interface GetMessagesResponse {
  messages: ChatMessage[];
}

export interface ChatServiceClient {
  saveMessage(request: SaveMessageRequest, metadata?: Metadata): Observable<SaveMessageResponse>;
  getMessages(request: GetMessagesRequest, metadata?: Metadata): Observable<GetMessagesResponse>;
}

export interface ChatServiceController {
  saveMessage(
    request: SaveMessageRequest,
    metadata: Metadata,
  ): Promise<SaveMessageResponse> | Observable<SaveMessageResponse> | SaveMessageResponse;

  getMessages(
    request: GetMessagesRequest,
    metadata: Metadata,
  ): Promise<GetMessagesResponse> | Observable<GetMessagesResponse> | GetMessagesResponse;
}
