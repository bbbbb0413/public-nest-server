abstract class Base {
  static create<T>(this: new () => T, partial?: Partial<T>): T {
    return Object.assign(new this(), partial);
  }
}

export class Room extends Base {
  userList: string[] = [];
}

export class Connection extends Base {
  socketId = '';
  nickName = '';
  room = '';
}

export class Chat extends Base {
  userId = '';
  nickName = '';
  message = '';
  time = Date.now();
}
