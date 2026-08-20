exports.isLoggedIn = (req, res, next) => {
  if (req.isAuthenticated()) {
    next();
  } else {
    // API 요청(POST 등)에는 403, GET 페이지 요청에는 로그인 안내와 함께 메인으로
    if (req.method === 'GET' && req.accepts('html')) {
      res.redirect(`/?loginError=${encodeURIComponent('로그인이 필요합니다.')}`);
    } else {
      res.status(403).send('로그인이 필요합니다.');
    }
  }
};

exports.isNotLoggedIn = (req, res, next) => {
  if (!req.isAuthenticated()) {
    next();
  } else {
    const message = encodeURIComponent('로그인한 상태입니다.');
    res.redirect(`/?error=${message}`);
  }
};
