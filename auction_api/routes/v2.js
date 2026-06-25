const express = require('express');

const { verifyToken, apiLimiter } = require('./middlewares');
const { corsCheck, createToken, testToken, getMyGoods } = require('../controllers/v2');

const router = express.Router();

router.use(corsCheck);

router.post('/token', apiLimiter, createToken);

router.get('/test', verifyToken, apiLimiter, testToken);

router.get('/mygoods', apiLimiter, verifyToken, getMyGoods);

module.exports = router;
