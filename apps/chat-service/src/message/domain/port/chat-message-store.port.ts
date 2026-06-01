export interface IChatMessageStore {
  addMessage(roomId: string, message: Buffer, timestamp: number): Promise<void>;
  getMessagesSince(
    roomId: string,
    since: number,
    limit: number,
  ): Promise<Buffer[]>;
  trimMessages(roomId: string, maxMessages: number): Promise<void>;
  getMessagesBefore(
    roomId: string,
    before: number,
    limit: number,
  ): Promise<Buffer[]>;
}

export const IChatMessageStore = Symbol('IChatMessageStore');
