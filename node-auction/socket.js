const { Server } = require('socket.io');

module.exports = (server, app) => {
  const io = new Server(server, { path: '/socket.io' });
  app.set('io', io);
  io.on('connection', (socket) => {
    // Referer가 없는 접속(비브라우저 클라이언트 등)으로 서버가 죽지 않도록 방어
    const referer = socket.request.headers.referer;
    if (!referer) {
      return;
    }
    const parts = referer.split('/');
    const roomId = parts[parts.length - 1];
    if (!roomId) {
      return;
    }
    socket.join(roomId);
    socket.on('disconnect', () => {
      socket.leave(roomId);
    });
  });
};
