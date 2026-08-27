import { Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IPubSubPort } from '@libs/rpc/chat-realtime';
import { CHAT_SOCKET_NOTIFY } from './message.constants';

/**
 * 로컬 persist 이벤트를 받아 Redis 샤드 채널로 알림을 발행한다.
 * 실제 소켓 emit은 클라이언트가 붙어있는 gateway 앱에서 처리한다.
 */
@Injectable()
export class ChatNotifyListener {
  constructor(
    @Inject(IPubSubPort)
    private readonly pubSubService: IPubSubPort,
  ) {}

  @OnEvent(CHAT_SOCKET_NOTIFY)
  async handleSocketNotify(payload: { roomId: string }) {
    await this.pubSubService.publish(payload.roomId);
  }
}
