const express = require('express');

const { verifyToken, deprecated } = require('./middlewares');
const { createToken, testToken, getMyGoods } = require('../controllers/v1');

const router = express.Router();

router.use(deprecated);

router.post('/token', createToken);

router.get('/test', verifyToken, testToken);

router.get('/mygoods', verifyToken, getMyGoods);

module.exports = router;
