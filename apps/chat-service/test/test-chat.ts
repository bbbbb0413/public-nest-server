import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import * as flatbuffers from 'flatbuffers';
import { SendMessageRequest } from '../src/flatbuffers/generated/chat/send-message-request';
import { MessageBatch } from '../src/flatbuffers/generated/chat/message-batch';
import { execSync } from 'child_process';

const CHAT_WS_URL = process.env.CHAT_WS_URL || 'http://localhost:8082/chat/ws';

// 유저 가입, 활성화 및 로그인 토큰 발급 헬퍼
async function createUserAndGetToken(suffix: string) {
  const email = `test-${suffix}-${Date.now()}@example.com`;
  const name = `TestUser-${suffix}`;
  const password = 'TestPassword123!';

  // 1. 회원가입 요청
  const signupRes = await axios.post('http://localhost:8080/auth/signup', {
    name,
    email,
    password,
  });
  const userId = signupRes.data.data.id;

  // 2. MySQL DB에서 유저 직접 활성화
  const dbPassword = process.env.DB_USER_PW;
  if (!dbPassword)
    throw new Error('DB_USER_PW 환경변수가 설정되어 있지 않습니다.');
  const safeUserId = parseInt(String(userId), 10);
  if (isNaN(safeUserId)) throw new Error('유효하지 않은 userId입니다.');
  execSync(
    `docker exec -i db mysql -uadmin -p${dbPassword} -e "UPDATE personal.user SET activatedAt = NOW() WHERE id = ${safeUserId}"`,
  );

  // 3. 로그인 요청을 통해 JWT 발급
  const loginRes = await axios.post('http://localhost:8080/auth/login', {
    name,
    email,
    password,
  });
  const token = loginRes.data.data.authToken;

  return { userId: String(userId), token, name };
}

async function runTest() {
  console.log('=== Chat Service 2-User E2E Test ===');

  // 1. 두 명의 테스트 유저 생성 및 토큰 발급
  console.log('\n1. Creating 2 test users (Client A & Client B)...');
  let userA: { userId: string; token: string; name: string };
  let userB: { userId: string; token: string; name: string };

  try {
    userA = await createUserAndGetToken('A');
    console.log(
      `   - Client A registered & activated. (ID: ${userA.userId}, Name: ${userA.name})`,
    );

    userB = await createUserAndGetToken('B');
    console.log(
      `   - Client B registered & activated. (ID: ${userB.userId}, Name: ${userB.name})`,
    );
  } catch (error: any) {
    const errorDetails = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message;
    console.error('❌ Failed to prepare users:', errorDetails);
    process.exit(1);
  }

  // 2. 비정상 토큰 접근 제한 테스트
  console.log('\n2. Testing invalid token connection...');
  const invalidSocket: Socket = io(CHAT_WS_URL, {
    auth: { token: 'Bearer invalid_token_123' },
    transports: ['websocket'],
  });

  await new Promise<void>((resolve) => {
    invalidSocket.on('connect_error', (err) => {
      console.log(
        '✅ Connection correctly rejected for invalid token:',
        err.message,
      );
      invalidSocket.disconnect();
      resolve();
    });
    invalidSocket.on('connect', () => {
      console.warn('⚠️ Connection unexpectedly succeeded with invalid token!');
      invalidSocket.disconnect();
      resolve();
    });
  });

  // 3. Client A 및 Client B 소켓 연결
  console.log('\n3. Connecting Client A and Client B to Chat Service...');
  const socketA: Socket = io(CHAT_WS_URL, {
    auth: { token: `Bearer ${userA.token}` },
    transports: ['websocket'],
  });

  const socketB: Socket = io(CHAT_WS_URL, {
    auth: { token: `Bearer ${userB.token}` },
    transports: ['websocket'],
  });

  await Promise.all([
    new Promise<void>((resolve) => {
      socketA.on('connect', () => {
        console.log(`✅ Client A connected. Socket ID: ${socketA.id}`);
        resolve();
      });
    }),
    new Promise<void>((resolve) => {
      socketB.on('connect', () => {
        console.log(`✅ Client B connected. Socket ID: ${socketB.id}`);
        resolve();
      });
    }),
  ]);

  const roomId = 'test-shared-room';

  // 4. Client A와 Client B 모두 방 참여 (join_room)
  console.log(`\n4. Both clients joining room: ${roomId}...`);
  const [joinA, joinB] = await Promise.all([
    new Promise<any>((resolve) => {
      socketA.emit('join_room', { roomId }, (res: any) => resolve(res));
    }),
    new Promise<any>((resolve) => {
      socketB.emit('join_room', { roomId }, (res: any) => resolve(res));
    }),
  ]);

  if (joinA?.success && joinB?.success) {
    console.log('✅ Both clients successfully joined the room.');
  } else {
    console.error('❌ Failed to join room. A:', joinA, 'B:', joinB);
    process.exit(1);
  }

  // 5. Client A가 메시지 전송 -> Client B가 실시간 수신 검증
  console.log('\n5. Verifying message delivery from Client A to Client B...');
  const messageContent = 'Hello Client B, this is Client A!';

  const builder = new flatbuffers.Builder(512);
  const roomIdOffset = builder.createString(roomId);
  const contentOffset = builder.createString(messageContent);
  const metadataOffset = builder.createString('');

  const sendReqOffset = SendMessageRequest.createSendMessageRequest(
    builder,
    roomIdOffset,
    contentOffset,
    metadataOffset,
  );
  builder.finish(sendReqOffset);
  const messageBuffer = Buffer.from(builder.asUint8Array());

  // Client B에서 메시지 수신 대기 및 검증
  const receivePromise = new Promise<void>((resolve, reject) => {
    socketB.on('new_messages', (receivedRoomId, data) => {
      try {
        const bb = new flatbuffers.ByteBuffer(new Uint8Array(data));
        const batch = MessageBatch.getRootAsMessageBatch(bb);
        const count = batch.messagesLength();
        console.log(
          `✅ Client B received 'new_messages' event with ${count} message(s).`,
        );

        for (let i = 0; i < count; i++) {
          const msg = batch.messages(i);
          if (msg) {
            console.log(
              `   - Received Message: SenderID=${msg.senderId()}, Content="${msg.content()}"`,
            );

            // 검증 수행: 보낸 사람이 Client A의 userId이고 내용이 일치하는지 확인
            if (msg.content() === messageContent) {
              if (msg.senderId() === userA.userId) {
                console.log(
                  '🎉 MATCH SUCCESS: Sender ID matches Client A and content matches perfectly!',
                );
                resolve();
                return;
              } else {
                reject(
                  new Error(
                    `Sender ID mismatch. Expected: ${
                      userA.userId
                    }, Received: ${msg.senderId()}`,
                  ),
                );
                return;
              }
            }
          }
        }
      } catch (err) {
        reject(err);
      }
    });
  });

  // Client A가 메시지 발송
  socketA.emit('send_message', messageBuffer, (response: any) => {
    if (response && response.success) {
      console.log('✅ Client A: send_message ack received.');
    } else {
      console.error('❌ Client A: Failed to send message:', response);
    }
  });

  // Client B가 메시지를 정상적으로 수신 및 검증할 때까지 대기
  try {
    await receivePromise;
  } catch (error: any) {
    console.error(
      '❌ E2E Message delivery verification failed:',
      error.message,
    );
    process.exit(1);
  }

  // 6. 방 퇴장 및 종료
  console.log(`\n6. Cleaning up sockets...`);
  await Promise.all([
    new Promise<void>((resolve) => {
      socketA.emit('leave_room', { roomId }, () => resolve());
    }),
    new Promise<void>((resolve) => {
      socketB.emit('leave_room', { roomId }, () => resolve());
    }),
  ]);

  console.log('✅ Disconnecting sockets...');
  socketA.disconnect();
  socketB.disconnect();

  console.log('\n✅ All 2-user E2E tests passed successfully.');
  process.exit(0);
}

runTest();
