const Quiz = require('../models/quizModel');
const AppError = require('../utils/appError');
const pool = require('../db/db.js');

exports.getOverview = async (req, res, next) => {
  let page = (+req.query.page || 1) - 1;

  if (page < 0) page = 0;

  const skip = 9 * page;

  const queryText = `
    SELECT quiz.*, users.photo, users.name AS author_name FROM quiz 
    JOIN users ON quiz.author_id = users.user_id
    ORDER BY created_at LIMIT 10
    OFFSET $1
    `;
  const quizzes = (await pool.query(queryText, [skip])).rows;
  if (quizzes.length === 0) {
    return next(
      new AppError('Oops! The page you are looking for does not exist.', 404)
    );
  }

  page++;

  let lastPage;

  if (quizzes.length < 10) {
    lastPage = true;
  }

  res.status(200).render('overview', {
    title: 'Quiz Overview',
    quizzes: quizzes.slice(0, 9),
    page,
    lastPage,
  });
};

exports.getQuizPage = async (req, res, next) => {
  const id = (
    await pool.query('SELECT quiz_id FROM quiz WHERE slug = $1', [
      req.params.slug,
    ])
  ).rows[0].quiz_id;

  let quizQuestions = (
    await pool.query(`SELECT (fn_get_questions_related_data($1)).*`, [id])
  ).rows;

  quizQuestions = quizQuestions.map((q) => {
    q.all_answers = q.all_answers.split(', ');
    q.correct_answer = q.all_answers.indexOf(q.correct_answer);
    return q;
  });

  res.status(200).render('quiz', {
    title: 'Quiz',
    quizQuestions,
    quizId: id,
    slug: req.params.slug,
  });
};

exports.getLoginForm = async (req, res, next) => {
  res.status(200).render('login', {
    title: 'Login',
  });
};

exports.getSingupForm = async (req, res, next) => {
  res.status(200).render('singup', {
    title: 'Sing Up',
  });
};

exports.getUserDetails = async (req, res, next) => {
  const queryText = `
    SELECT q.name, cqh.correct_answers, cqh.total_questions, cqh.completed_at, cqh.user_id
    FROM completed_quiz_history cqh
    JOIN quiz q
    ON q.quiz_id = cqh.quiz_id
    WHERE user_id = $1`;

  const history = (await pool.query(queryText, [req.user.user_id])).rows;

  res.status(200).render('userDetails', {
    title: 'Account',
    history,
  });
};

exports.getChangePassword = async (req, res, next) => {
  res.status(200).render('changePassword', {
    title: 'Change Password',
  });
};

exports.getCreateQuizForm = async (req, res, next) => {
  res.status(200).render('createQuiz', {
    title: 'Create your own quiz',
  });
};

exports.getManageQuiz = async (req, res, next) => {
  let page = (+req.query.page || 1) - 1;

  if (page < 0) page = 0;

  const skip = 10 * page;
  const isAdmin = req.user.role === 'admin';
  const queryText = `
    SELECT quiz.image_cover, quiz.name, users.name AS author_name, quiz.quiz_id FROM quiz 
    JOIN users ON quiz.author_id = users.user_id
  ${
    !isAdmin ? `WHERE author_id = ${req.user.user_id}` : ''
  } ORDER BY quiz.created_at ASC LIMIT 11  OFFSET $1
  `;
  const quizzes = (await pool.query(queryText, [skip])).rows;

  if (quizzes.length === 0) {
    return next(
      new AppError('Oops! The page you are looking for does not exist.', 404)
    );
  }

  page++;

  let lastPage;

  if (quizzes.length < 11) {
    lastPage = true;
  }

  res.status(200).render('manageQuiz', {
    title: 'Manage Quizzes',
    quizzes: quizzes.slice(0, 10),
    lastPage,
    page,
  });
};

exports.getEditQuiz = async (req, res, next) => {
  const quiz = await Quiz.findById(req.params.quizId);

  const questions = (
    await pool.query(`SELECT (fn_get_questions_related_data($1)).*`, [
      req.params.quizId,
    ])
  ).rows;

  quiz.questions = questions.map((q) => {
    q.all_answers = q.all_answers.split(', ');
    q.correct_answer = q.all_answers.indexOf(q.correct_answer);
    return q;
  });

  res.status(200).render('editQuiz', {
    title: 'Edit Quiz',
    quiz,
  });
};

exports.getFiveMostPopular = async (req, res, next) => {
  const quizzes = (
    await pool.query(`SELECT quiz.*, users.photo, users.name AS author_name FROM quiz 
    JOIN users ON quiz.author_id = users.user_id ORDER BY views DESC LIMIT 5`)
  ).rows;
  res.status(200).render('overview', {
    title: 'Five most popular quizzes',
    quizzes,
    lastPage: true,
  });
};
