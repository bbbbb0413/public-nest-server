const io = require('socket.io-client');

const socket = io('http://localhost:4000', {
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('Connected to server');

  // 닉네임 설정
  socket.emit('setUserNick', 'TestUser');

  // 방 참가
  socket.emit('join', 'room1');

  // 채팅 메시지 전송
  setTimeout(() => {
    socket.emit('chatMessage', { message: 'Hello, World!', room: 'room1' });
  }, 2000);
});

socket.on('chatMessage', (data) => {
  console.log(`Message from ${data.userId}: ${data.message}`);
});

socket.on('userList', (data) => {
  console.log(`User list in ${data.room || 'global'}:`, data.userList);
});

socket.on('userJoined', (data) => {
  console.log(`${data.userId} joined ${data.room}`);
});

socket.on('userLeft', (data) => {
  console.log(`${data.userId} left ${data.room}`);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});
