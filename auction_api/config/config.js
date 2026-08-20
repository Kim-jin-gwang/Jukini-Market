require('dotenv').config();

const base = {
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  dialect: process.env.DB_DIALECT || 'mysql',
};

module.exports = {
  development: {
    ...base,
    database: process.env.DB_DATABASE || 'database_development',
  },
  test: {
    ...base,
    database: process.env.DB_TEST_DATABASE || 'database_test',
  },
  production: {
    ...base,
    database: process.env.DB_DATABASE || 'database_production',
    logging: false,
  },
};
