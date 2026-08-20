const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { isLoggedIn, isNotLoggedIn } = require('./middlewares');
const {
  renderMain,
  renderJoin,
  renderGood,
  createGood,
  renderAuction,
  bid,
  renderList,
  renderLookup
} = require('../controllers/index');

const router = express.Router();

router.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});

router.get('/', renderMain);

router.get('/join', isNotLoggedIn, renderJoin);

router.get('/good', isLoggedIn, renderGood);

const uploadDir = path.join(__dirname, '..', 'uploads');
try {
  fs.readdirSync(uploadDir);
} catch (error) {
  console.error('uploads 폴더가 없어 uploads 폴더를 생성합니다.');
  fs.mkdirSync(uploadDir);
}

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const upload = multer({
  storage: multer.diskStorage({
    destination(req, file, cb) {
      cb(null, uploadDir);
    },
    filename(req, file, cb) {
      // 원본 파일명을 신뢰하지 않고 확장자만 취해 안전한 이름을 생성
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `good_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`);
    },
  }),
  fileFilter(req, file, cb) {
    // 이미지 외 파일 업로드 차단 (HTML 업로드를 통한 stored XSS 방지)
    if (ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일(jpg, png, gif, webp)만 업로드할 수 있습니다.'));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post('/good', isLoggedIn, (req, res, next) => {
  upload.single('img')(req, res, (err) => {
    if (err) {
      return res.redirect(`/good?error=${encodeURIComponent(err.message)}`);
    }
    next();
  });
}, createGood);

router.get('/good/:id', isLoggedIn, renderAuction);

router.post('/good/:id/bid', isLoggedIn, bid);

router.get('/list', isLoggedIn, renderList);

router.get('/lookup', isLoggedIn, renderLookup);

module.exports = router;
