const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// DATABASE_URL(예: Neon/Render의 postgres://...)이 있으면 그것을 우선 사용하고,
// 없으면 개별 DB_* 환경변수를 사용한다. 로컬 테스트는 DB_DIALECT=sqlite 로 가능.
function fromUrl(url) {
  const u = new URL(url);
  return {
    username: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
    host: u.hostname,
    port: u.port || 5432,
    dialect: 'postgres',
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false },
    },
  };
}

const base = process.env.DATABASE_URL
  ? fromUrl(process.env.DATABASE_URL)
  : {
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD,
      host: process.env.DB_HOST || '127.0.0.1',
      port: process.env.DB_PORT || 5432,
      dialect: process.env.DB_DIALECT || 'postgres',
      storage: process.env.DB_STORAGE || path.join(__dirname, '..', 'dev.sqlite'),  // sqlite 전용
    };

module.exports = {
  development: {
    ...base,
    database: base.database || process.env.DB_DATABASE || 'jukini_development',
  },
  test: {
    ...base,
    database: base.database || process.env.DB_TEST_DATABASE || 'jukini_test',
  },
  production: {
    ...base,
    database: base.database || process.env.DB_DATABASE || 'jukini_production',
    logging: false,
  },
};
