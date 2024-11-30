const express = require('express');
const viewControler = require('../controller/viewControler');
const authControler = require('../controller/authControler');
const { validateSearchQuery } = require('../middleware/validate');
const { csrfProtection } = require('../middleware/csrfProtection');

const router = express.Router();

router.get(
  '/',
  authControler.isLoggedIn,
  validateSearchQuery,
  viewControler.getOverview
);

router.get(
  '/quiz/:slug',
  authControler.isLoggedIn,
  csrfProtection,
  viewControler.getQuizPage
);

router.get('/login', authControler.isLoggedIn, viewControler.getLoginForm);
router.get('/singup', authControler.isLoggedIn, viewControler.getSingupForm);

router.get(
  '/userDetails',
  authControler.protect,
  csrfProtection,
  viewControler.getUserDetails
);

router.get(
  '/createQuiz',
  authControler.protect,
  csrfProtection,
  viewControler.getCreateQuizForm
);

// router.get("/error", viewControler.getError);
router.get(
  '/manageQuiz',
  authControler.protect,
  csrfProtection,
  viewControler.getManageQuiz
);
router.get(
  '/editQuiz/:quizId',
  authControler.protect,
  csrfProtection,
  viewControler.getEditQuiz
);

router.get(
  '/changePassword',
  csrfProtection,
  authControler.protect,
  viewControler.getChangePassword
);

router.get(
  '/top-five-most-popular',
  authControler.isLoggedIn,
  viewControler.getFiveMostPopular
);

module.exports = router;
