const jwt = require('jsonwebtoken');
const cors = require('cors');
const url = require('url');
const { Domain, User, Auction } = require('../models');

exports.corsCheck = async (req, res, next) => {
  const origin = req.get('origin');
  if (!origin) {
    return next();
  }
  try {
    const domain = await Domain.findOne({
      where: { host: url.parse(origin).host },
    });
    if (domain) {
      cors({
        origin: origin,
        credentials: true,
      })(req, res, next);
    } else {
      next();
    }
  } catch (error) {
    console.error(error);
    next(error);
  }
};

exports.createToken = async (req, res) => {
  const { clientSecret } = req.body;
  try {
    const domain = await Domain.findOne({
      where: { clientSecret },
      include: {
        model: User,
        attribute: ['nick', 'id'],
      },
    });
    if (!domain) {
      return res.status(401).json({
        code: 401,
        message: '등록되지 않은 도메인입니다. 먼저 도메인을 등록하세요',
      });
    }
    const token = jwt.sign({
      id: domain.User.id,
      nick: domain.User.nick,
    }, process.env.JWT_SECRET, {
      expiresIn: '30m', // 30분
      issuer: 'nodebird',
    });
    return res.json({
      code: 200,
      message: '토큰이 발급되었습니다',
      token,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      code: 500,
      message: '서버 에러',
    });
  }
};

exports.testToken = (req, res) => {
  res.json(req.decoded);
};

exports.getMyGoods = (req, res) => {
  Auction.findAll({ where: { userId: req.decoded.id } })
    .then((posts) => {
      res.json({
        code: 200,
        payload: posts,
      });
    })
    .catch((error) => {
      console.error(error);
      return res.status(500).json({
        code: 500,
        message: '서버 에러',
      });
    });
};
