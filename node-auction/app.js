const express = require('express');
const path = require('path');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const passport = require('passport');
const nunjucks = require('nunjucks');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');

dotenv.config({ path: path.join(__dirname, '.env') });
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');
const sseRouter = require('./sse');
const { sequelize } = require('./models');
const passportConfig = require('./passport');
const webSocket = require('./socket');
const { seed } = require('./seed');
const checkAuction = require('./checkAuction');

const app = express();
const isProduction = process.env.NODE_ENV === 'production';
passportConfig();
app.set('port', process.env.PORT || 8010);
app.set('view engine', 'html');
if (isProduction) {
  app.set('trust proxy', 1); // Render 등 리버스 프록시 뒤에서 secure 쿠키/IP 인식
}
nunjucks.configure(path.join(__dirname, 'views'), {
  express: app,
  watch: !isProduction,
});

sequelize.sync({ force: false })
  .then(async () => {
    console.log('데이터베이스 연결 성공');
    await seed();
    checkAuction();
  })
  .catch((err) => {
    console.error(err);
  });

const sessionMiddleware = session({
  resave: false,
  saveUninitialized: false,
  secret: process.env.COOKIE_SECRET,
  cookie: {
    httpOnly: true,
    secure: isProduction,
  },
});

// 데모 서버 보호: IP당 분당 요청 제한
app.use(rateLimit({ windowMs: 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

app.use(morgan(isProduction ? 'combined' : 'dev'));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/img', express.static(path.join(__dirname, 'uploads')));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

app.use(sseRouter);
app.use('/', indexRouter);
app.use('/auth', rateLimit({ windowMs: 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }), authRouter);

app.use((req, res, next) => {
  const error = new Error(`${req.method} ${req.url} 라우터가 없습니다.`);
  error.status = 404;
  next(error);
});

app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = !isProduction ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

const server = app.listen(app.get('port'), () => {
  console.log(app.get('port'), '번 포트에서 대기중');
});

webSocket(server, app);
