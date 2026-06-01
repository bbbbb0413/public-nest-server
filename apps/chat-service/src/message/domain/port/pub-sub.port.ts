export interface IPubSubPort {
  publish(roomId: string): Promise<void>;
  subscribeAll(): Promise<void>;
  unsubscribeAll(): Promise<void>;
  onMessage(callback: (roomId: string) => void): void;
}

export const IPubSubPort = Symbol('IPubSubPort');
