const express = require('express');
const { renderLogin, createDomain } = require('../controllers/index');

const router = express.Router();

router.get('/', renderLogin);

router.post('/domain', createDomain);

module.exports = router;
