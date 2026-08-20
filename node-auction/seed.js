// 데모용 시드 데이터: 판매자/체험 계정과 산지직송 상품을 생성한다.
// 서버 기동 시 1회 실행되며, 이미 존재하는 데이터는 건드리지 않는다.
const bcrypt = require('bcryptjs');
const { User, Good } = require('./models');

const SEED_SELLER_EMAIL = 'farmer@jukini.demo';
const SEED_BUYER_EMAIL = 'demo@jukini.demo';
const SEED_PASSWORD = process.env.SEED_PASSWORD || 'jukini1234';

// (상품명, 개당 가격 P, 수량, 업로드 이미지 파일명)
const SEED_GOODS = [
  ['강원도 하지 감자 3kg', 8900, 20, '감자1639546992618.jpg'],
  ['제주 흙당근 2kg', 6500, 15, '당근1639547012952.jpg'],
  ['해남 절임배추 5포기', 19900, 10, '배추1639549717655.jpg'],
  ['청주 애호박 5입', 4900, 25, '애호박1639547033668.jpg'],
];

async function findOrCreateUser(email, nick, money) {
  let user = await User.findOne({ where: { email } });
  if (!user) {
    const hash = await bcrypt.hash(SEED_PASSWORD, 12);
    user = await User.create({ email, nick, password: hash, money });
    console.log(`[seed] created user ${email}`);
  }
  return user;
}

async function seed() {
  const seller = await findOrCreateUser(SEED_SELLER_EMAIL, '김쭈끼니(농부)', 0);
  await findOrCreateUser(SEED_BUYER_EMAIL, '체험용계정', 1000000);

  const count = await Good.count({ where: { OwnerId: seller.id } });
  if (count === 0) {
    for (const [name, price, amount, img] of SEED_GOODS) {
      await Good.create({ OwnerId: seller.id, name, price, amount, img });
    }
    console.log(`[seed] created ${SEED_GOODS.length} demo goods`);
  }
  return seller;
}

module.exports = { seed, SEED_SELLER_EMAIL, SEED_GOODS };
