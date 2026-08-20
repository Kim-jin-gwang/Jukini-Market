// 서버 시간 브로드캐스트용 SSE 엔드포인트.
// (기존 sse 패키지는 연결 종료 시 setInterval을 정리하지 않아 타이머가 누수되었음)
const express = require('express');

const router = express.Router();

router.get('/sse', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();

  const send = () => res.write(`data: ${Date.now()}\n\n`);
  send();
  const timer = setInterval(send, 1000);

  req.on('close', () => {
    clearInterval(timer);
  });
});

module.exports = router;
