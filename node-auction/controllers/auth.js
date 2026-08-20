const bcrypt = require('bcryptjs');
const passport = require('passport');
const User = require('../models/user');

// 가입 축하 포인트: 클라이언트가 아닌 서버가 지급액을 결정한다.
// (기존에는 req.body.money를 그대로 저장해 임의 금액 가입이 가능했던 보안 결함이 있었음)
const SIGNUP_POINT = Number(process.env.SIGNUP_POINT || 1000000);

exports.join = async (req, res, next) => {
  const { email, nick, password } = req.body;
  try {
    if (!email || !nick || !password) {
      return res.redirect('/join?joinError=이메일, 닉네임, 비밀번호를 모두 입력해주세요.');
    }
    const exUser = await User.findOne({ where: { email } });
    if (exUser) {
      return res.redirect('/join?joinError=이미 가입된 이메일입니다.');
    }
    const hash = await bcrypt.hash(password, 12);
    await User.create({
      email,
      nick,
      password: hash,
      money: SIGNUP_POINT,
    });
    return res.redirect('/');
  } catch (error) {
    console.error(error);
    return next(error);
  }
};

exports.login = (req, res, next) => {
  passport.authenticate('local', (authError, user, info) => {
    if (authError) {
      console.error(authError);
      return next(authError);
    }
    if (!user) {
      return res.redirect(`/?loginError=${encodeURIComponent(info.message)}`);
    }
    return req.login(user, (loginError) => {
      if (loginError) {
        console.error(loginError);
        return next(loginError);
      }
      return res.redirect('/');
    });
  })(req, res, next);
};

exports.logout = (req, res) => {
  req.logout();
  req.session.destroy();
  res.redirect('/');
};
