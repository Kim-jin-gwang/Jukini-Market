const { Op } = require('sequelize');
const { Good, Auction, User, sequelize } = require('../models');

const SALE_DURATION_MS = 24 * 60 * 60 * 1000;

function withSaleState(good) {
  const endTime = new Date(new Date(good.createdAt).valueOf() + SALE_DURATION_MS);
  return {
    ...good.toJSON(),
    endTime,
    expired: endTime < new Date(),
    soldOut: good.amount <= 0,
  };
}

exports.renderMain = async (req, res, next) => {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const goods = await Good.findAll({
      where: { createdAt: { [Op.gte]: yesterday } },
      include: { model: User, as: 'Owner', attributes: ['nick'] },
      order: [['createdAt', 'DESC']],
    });
    res.render('main', {
      title: '오늘의 상품',
      goods: goods.map(withSaleState),
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
    if (!req.file) {
      return res.redirect('/good?error=상품 이미지를 등록해주세요.');
    }
    const unitPrice = Number.parseInt(price, 10);
    const stock = Number.parseInt(amount, 10);
    if (!name || !Number.isInteger(unitPrice) || unitPrice <= 0 || !Number.isInteger(stock) || stock <= 0) {
      return res.redirect('/good?error=상품명, 가격, 수량을 올바르게 입력해주세요.');
    }
    await Good.create({
      OwnerId: req.user.id,
      name,
      img: req.file.filename,
      price: unitPrice,
      amount: stock,
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
        // NOTE: MySQL에서는 goodId(소문자)도 우연히 동작했지만
        // Postgres는 식별자 대소문자를 구분하므로 GoodId가 정확한 컬럼명이다.
        where: { GoodId: req.params.id },
        include: { model: User },
        order: [['createdAt', 'ASC']],
      }),
    ]);
    if (!good) {
      const err = new Error('존재하지 않는 상품입니다.');
      err.status = 404;
      throw err;
    }
    res.render('auction', {
      title: `${good.name}`,
      good: withSaleState(good),
      auction,
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

exports.bid = async (req, res, next) => {
  try {
    const quantity = Number.parseInt(req.body.bid, 10);
    const msg = typeof req.body.msg === 'string' ? req.body.msg.slice(0, 100) : null;

    if (!Number.isInteger(quantity) || quantity <= 0) {
      const err = new Error('잘못된 수량을 입력하였습니다.');
      err.status = 403;
      throw err;
    }

    // 트랜잭션 적용
    const result = await sequelize.transaction(async (t) => {
      // 1. 상품/구매자 조회 시 트랜잭션 및 락(Lock) 적용으로 동시성 보장
      const good = await Good.findOne({
        where: { id: req.params.id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!good) {
        const err = new Error('해당 상품을 찾을 수 없습니다.');
        err.status = 404;
        throw err;
      }
      if (new Date(good.createdAt).valueOf() + SALE_DURATION_MS < Date.now()) {
        const err = new Error('판매가 이미 종료되었습니다.');
        err.status = 403;
        throw err;
      }
      if (good.amount <= 0) {
        const err = new Error('재고가 없습니다.');
        err.status = 403;
        throw err;
      }
      if (good.amount < quantity) {
        const err = new Error('구매할 수 있는 수량을 초과하였습니다.');
        err.status = 403;
        throw err;
      }
      if (good.OwnerId === req.user.id) {
        const err = new Error('판매자는 자신의 상품을 구매할 수 없습니다.');
        err.status = 403;
        throw err;
      }

      // 2. 구매자 잔액 검사 (락 적용) — 잔액이 부족하면 거래 불가
      const buyer = await User.findOne({
        where: { id: req.user.id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      const totalPrice = quantity * good.price;
      if (buyer.money < totalPrice) {
        const err = new Error(`포인트가 부족합니다. (필요: ${totalPrice.toLocaleString()}P, 보유: ${buyer.money.toLocaleString()}P)`);
        err.status = 403;
        throw err;
      }

      // 3. 구매 내역 생성
      const auctionResult = await Auction.create({
        bid: quantity,
        msg,
        UserId: req.user.id,
        GoodId: good.id,
      }, { transaction: t });

      // 4. 상품 재고 차감
      await Good.update({
        amount: good.amount - quantity,
      }, {
        where: { id: good.id },
        transaction: t,
      });

      // 5. 구매자 포인트 차감 + 판매자 대금 지급 (포인트 순환 완성)
      await User.decrement({ money: totalPrice }, { where: { id: buyer.id }, transaction: t });
      await User.increment({ money: totalPrice }, { where: { id: good.OwnerId }, transaction: t });

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
      order: [['createdAt', 'DESC']],
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
      include: { model: Auction, include: { model: User, attributes: ['nick'] } },
      order: [['createdAt', 'DESC']],
    });
    res.render('lookup', {
      title: '판매 목록',
      goods: goods.map((good) => {
        const g = withSaleState(good);
        g.soldCount = good.Auctions.reduce((sum, a) => sum + a.bid, 0);
        g.revenue = g.soldCount * good.price;
        return g;
      }),
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
};
