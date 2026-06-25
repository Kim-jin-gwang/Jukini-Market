const { Op } = require('sequelize');
const { Good, Auction, User, sequelize } = require('../models');

exports.renderMain = async (req, res, next) => {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const goods = await Good.findAll({ where: { createdAt : { [Op.gte ]: yesterday } } }); 
    res.render('main', {
      title: 'Fresh-Market',
      goods,
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

exports.renderJoin = (req, res) => {
  res.render('join', {
    title: '회원가입',
  });
};

exports.renderGood = (req, res) => {
  res.render('good', { title: '상품 등록' });
};

exports.createGood = async (req, res, next) => {
  try {
    const { name, price, amount } = req.body;
    await Good.create({
      OwnerId: req.user.id,
      name,
      img: req.file.filename,
      price,
      amount,
    });
    res.redirect('/');
  } catch (error) {
    console.error(error);
    next(error);
  }
};

exports.renderAuction = async (req, res, next) => {
  try {
    const [good, auction] = await Promise.all([
      Good.findOne({
        where: { id: req.params.id },
        include: {
          model: User,
          as: 'Owner',
        },
      }),
      Auction.findAll({
        where: { goodId: req.params.id },
        include: { model: User },
        order: [['bid', 'ASC']],
      }),
    ]);
    res.render('auction', {
      title: `${good.name}`,
      good,
      auction,
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

exports.bid = async (req, res, next) => {
  try {
    const { bid, msg } = req.body;
    
    // 트랜잭션 적용
    const result = await sequelize.transaction(async (t) => {
      // 1. 상품 조회 시 트랜잭션 및 락(Lock) 적용으로 동시성 보장
      const good = await Good.findOne({
        where: { id: req.params.id },
        include: { model: Auction },
        order: [[{ model: Auction }, 'bid']],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!good) {
        const err = new Error('해당 상품을 찾을 수 없습니다.');
        err.status = 404;
        throw err;
      }
      if (good.amount < bid) {
        const err = new Error('구매할 수 있는 수량을 초과하였습니다.');
        err.status = 403;
        throw err;
      }
      if (new Date(good.createdAt).valueOf() + (24 * 60 * 60 * 1000) < new Date()) {
        const err = new Error('판매가 이미 종료되었습니다.');
        err.status = 403;
        throw err;
      }
      if (good.amount <= 0) {
        const err = new Error('재고가 없습니다.');
        err.status = 403;
        throw err;
      }
      if (bid <= 0) {
        const err = new Error('잘못된 수량을 입력하였습니다.');
        err.status = 403;
        throw err;
      }
      if (good.OwnerId == req.user.id) {
        const err = new Error('판매자는 구매할 수 없습니다.');
        err.status = 403;
        throw err;
      }

      // 2. 입찰 내역 생성
      const auctionResult = await Auction.create({
        bid,
        msg,
        UserId: req.user.id,
        GoodId: req.params.id,
      }, { transaction: t });

      // 3. 상품 재고 차감
      await Good.update({  
        amount: good.amount - bid,
      }, { 
        where: { id: good.id },
        transaction: t,
      });

      // 4. 사용자 돈 차감
      await User.update({
        money: sequelize.literal(`money - ${(bid * good.price)}`),
      }, {
        where: { id: req.user.id },
        transaction: t,
      });

      return auctionResult;
    });

    // 트랜잭션 성공 완료 후 실시간 소켓 전송
    req.app.get('io').to(req.params.id).emit('bid', {
      bid: result.bid,
      msg: result.msg,
      nick: req.user.nick,
    });
    
    return res.send('ok');
  } catch (error) {
    console.error(error);
    if (error.status) {
      return res.status(error.status).send(error.message);
    }
    return next(error);
  }
};

exports.renderList = async (req, res, next) => {
  try {
    const purchases = await Auction.findAll({
      where: { UserId: req.user.id },
      include: { model: Good },
    });
    res.render('list', { title: '구매 목록', purchases });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

exports.renderLookup = async (req, res, next) => {
  try {
    const goods = await Good.findAll({
      where: { OwnerId: req.user.id },
      include: { model: Auction },
    });
    res.render('lookup', { title: '판매 목록', goods });
  } catch (error) {
    console.error(error);
    next(error);
  }
};
