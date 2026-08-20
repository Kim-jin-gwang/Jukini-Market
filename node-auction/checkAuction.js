// 24시간 판매 종료 후속 처리 잡.
// (원본 app.js에 주석으로만 남아있던 미완성 기능을 복원)
// 데모 서비스가 늘 살아있도록, 만료되거나 품절된 '시드 판매자'의 상품은
// 매시 정각에 재등록(재고 복구 + 판매 시작 시각 갱신)한다.
const schedule = require('node-schedule');
const { Op } = require('sequelize');
const { Good, User } = require('./models');
const { SEED_SELLER_EMAIL, SEED_GOODS } = require('./seed');

const SALE_DURATION_MS = 24 * 60 * 60 * 1000;

async function relistDemoGoods() {
  const seller = await User.findOne({ where: { email: SEED_SELLER_EMAIL } });
  if (!seller) return;

  const cutoff = new Date(Date.now() - SALE_DURATION_MS);
  const staleGoods = await Good.findAll({
    where: {
      OwnerId: seller.id,
      [Op.or]: [{ createdAt: { [Op.lt]: cutoff } }, { amount: { [Op.lte]: 0 } }],
    },
  });

  const stockByName = new Map(SEED_GOODS.map(([name, , amount]) => [name, amount]));
  for (const good of staleGoods) {
    good.set('amount', stockByName.get(good.name) || 10);
    good.set('createdAt', new Date());
    good.changed('createdAt', true); // createdAt은 명시해야 갱신됨
    await good.save({ silent: true, fields: ['amount', 'createdAt'] });
  }
  if (staleGoods.length) {
    console.log(`[checkAuction] relisted ${staleGoods.length} demo goods`);
  }
}

module.exports = () => {
  relistDemoGoods().catch(console.error);                       // 기동 직후 1회
  schedule.scheduleJob('0 * * * *', () => {                     // 매시 정각
    relistDemoGoods().catch(console.error);
  });
};
