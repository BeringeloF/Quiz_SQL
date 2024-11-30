const User = require('../models/userModel');
const Quiz = require('../models/quizModel');
const multer = require('multer');
const sharp = require('sharp');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const valueString = require('../utils/getInsertManyValStr');
const pool = require('../db/db.js');

exports.getAllUsers = catchAsync(async (req, res, next) => {
  const users = pool.query(
    'SELECT name, email, level, exp, photo, role, created_at FROM users'
  ).rows;

  res.status(200).json({
    status: 'success',
    results: users.length,
    data: {
      users,
    },
  });
});

exports.getUser = catchAsync(async (req, res, next) => {
  const queryText =
    'SELECT name, email, level, exp, photo, role, created_at FROM users WHERE user_id = $1';
  const user = (await pool.query(queryText, [req.params.userId])).rows[0];

  if (!user) return next(new AppError('User not found', 404));

  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
});

exports.deleteUser = catchAsync(async (req, res, next) => {
  if (req.user._id !== req.params.userId || req.user.role !== 'admin')
    return next(
      new AppError('you do not have permission to perform this action!', 403)
    );

  await User.findByIdAndDelete(req.params.userId);

  res.status(200).json({
    status: 'success',
    data: null,
  });
});

exports.updateUser = catchAsync(async (req, res, next) => {
  if (req.body.password || req.body.passwordConfirm)
    return next(
      new AppError(
        'this route is not supposed to be used to change password!',
        400
      )
    );

  if (req.user.user_id !== req.params.userId && req.user.role !== 'admin')
    return next(
      new AppError('you do not have permission to perform this action!', 403)
    );

  const { email, name } = req.body;
  const queryText = `UPDATE users SET email = $1, name = $2 WHERE user_id = $3`;

  const user = (await pool.query(queryText, [email, name, req.params.userId]))
    .rows[0];

  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
});

const multerStorage = multer.memoryStorage();

// const multerStorage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, "public/img/");
//   },
//   filename: (req, file, cb) => {
//     const ext = file.mimetype.split("/")[1];
//     cb(null, `user-${req.user.id}-${Date.now()}.${ext}`);
//   },
// });

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image!, please upload only images', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadUserImage = upload.single('photo');

//Agora nos iremos processar o foto para deixa-la no formato em que queremos, neste caso um quadrado, para isso nos usares o sharp
exports.resizeUserImage = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  req.file.filename = `user-${req.user._id}-${Date.now()}.jpeg`;

  await sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat('jpeg') //Serve para converter a imagem para um tipo especifico
    .jpeg({ quality: 90 }) //disponivel para imagens jpeg, aceita um objeto de opcoes entre elas quality que serve para especificar a qualidade da imagem
    .toFile(`public/img/${req.file.filename}`); //Serve para  salvar o imagem processada no destino que especificarmos

  next();
});

exports.updateMe = catchAsync(async (req, res, next) => {
  if (req.body.password || req.body.passwordConfirm)
    return next(
      new AppError(
        'this route is not suposed to be used to change password!',
        400
      )
    );

  let photo;

  if (req.file) photo = req.file.filename;
  else return next(new AppError('Cound not process your image!', 500));

  const queryText = `UPDATE users SET photo = $1 WHERE user_id = $2 RETURNING name, photo`;

  const user = (await pool.query(queryText, [photo, req.user.user_id])).rows[0];

  console.log('chegou aqui', user);
  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
});

exports.saveQuizHistory = catchAsync(async (req, res, next) => {
  const { quizId, correctAnswers, totalQuestions } = req.body;

  const quiz = await Quiz.findById(quizId);

  if (!quiz)
    return next(new AppError('cound find a quiz with that quiz id', 404));

  const queryText = `INSERT INTO completed_quiz_history(quiz_id, user_id, correct_answers, total_questions, completed_at) VALUES${valueString(
    1,
    5
  )}`;

  let date = new Date();
  const values = [
    quiz.quiz_id,
    req.user.user_id,
    correctAnswers,
    totalQuestions,
    date.toISOString(),
  ];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(queryText, values);

    await User.increseExpAndLevel(
      quiz.difficulty,
      correctAnswers,
      req.user,
      client
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error while saving history quiz!');
    throw err;
  } finally {
    client.release();
  }
});
