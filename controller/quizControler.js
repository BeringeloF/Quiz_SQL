const Quiz = require('../models/quizModel');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const multer = require('multer');
const sharp = require('sharp');
const pool = require('../db/db.js');
const slugify = require('slugify');
const valuesStr = require('../utils/getInsertManyValStr.js');
const util = require('util');
exports.getAllQuiz = catchAsync(async (req, res, next) => {
  const quizzes = (await pool.query('SELECT * FROM quiz;')).rows;

  console.log(quizzes);

  await res.status(200).json({
    status: 'success',
    results: quizzes.length,
    data: {
      quizzes,
    },
  });
});
exports.getQuiz = catchAsync(async (req, res, next) => {
  const quiz = await Quiz.findById(req.params.quizId);

  if (quiz.length === 0)
    return next(new AppError('no quiz found with that id!', 404));

  res.status(200).json({
    status: 'success',
    data: {
      quiz,
    },
  });
});

//Este filtro serve pra garantir que os unicos files que estao sendo carregados sao imagens
const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(new AppError('Not an image!, please upload only images', 400), false);
  }
};

//Agora para salvar apenas na memoria com um buffer nos fazer assim
//Entao a imagem estara salva em req.file.buffer

const multerStorage = multer.memoryStorage();

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadQuizImage = upload.single('imageCover');

//Agora nos iremos processar o foto para deixa-la no formato em que queremos, neste caso um quadrado, para isso nos usares o sharp
exports.resizeQuizImage = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  req.file.filename = `user-${req.user.user_id}-${Date.now()}.jpeg`;

  await sharp(req.file.buffer)
    .resize(500, 500)
    .toFormat('jpeg') //Serve para converter a imagem para um tipo especifico
    .jpeg({ quality: 90 }) //disponivel para imagens jpeg, aceita um objeto de opcoes entre elas quality que serve para especificar a qualidade da imagem
    .toFile(`public/img/${req.file.filename}`); //Serve para  salvar o imagem processada no destino que especificarmos
  console.log(req.file.buffer);
  next();
});

exports.createQuiz = catchAsync(async (req, res, next) => {
  //checkin if there is a image if so, set the imageCover propertie
  if (req.file) req.body.imageCover = req.file.filename;

  console.log(req.user);
  // if the authorName and the user propertie exist, if not set it by the user info
  if (req.user && !req.body.author)
    req.body.author = { authorName: req.user.name, user: req.user._id };

  if (req.headers['content-type'].includes('multipart/form-data')) {
    req.body.questions = JSON.parse(
      req.body.questions[req.body.questions.length - 1]
    );
  }
  const client = await pool.connect();
  try {
    const { body } = req;
    await client.query('BEGIN');

    let queryText = `INSERT INTO quiz(name, description, image_cover, author_id, difficulty, category, slug)
  VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING *`;

    let values = [
      body.name,
      body.description,
      body.imageCover,
      req.user.user_id,
      body.difficulty,
      body.category,
      `${slugify(body.name, { lower: true })}-${Date.now()}`,
    ];

    const quiz = (await client.query(queryText, values)).rows[0];
    const quizId = quiz.quiz_id;

    const placeholder = valuesStr(body.questions.length, 2);

    queryText = `INSERT INTO question_tb(quiz_id, question) VALUES${placeholder} RETURNING question_id`;
    values = [];

    body.questions.forEach((q) => {
      values.push(quizId, q.question);
    });

    const questionsIds = (await client.query(queryText, values)).rows.map(
      (q) => q.question_id
    );

    const totalAnswersNum = body.questions.reduce((a, c) => {
      a += c.answers.length;
      return a;
    }, 0);

    queryText = `INSERT INTO answer_tb(question_id, answer)
  VALUES${valuesStr(totalAnswersNum, 2)} RETURNING question_id, answer_id
  `;
    values = [];

    body.questions.forEach((q, i) => {
      q.answers.forEach((ans) => values.push(questionsIds[i], ans));
    });

    const answers = (await client.query(queryText, values)).rows;

    queryText = `INSERT INTO question_correct_answer(question_id, answer_id)
  VALUES${placeholder}
  `;

    values = [];

    const correctAnswer = body.questions.map((q) => q.correctAnswer);

    const obj = answers.reduce((acc, val) => {
      const key = val.question_id;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(val.answer_id);
      return acc;
    }, {});

    correctAnswer.forEach((indexCorAns, i) => {
      const key = questionsIds[i];
      values.push(questionsIds[i], obj[key][indexCorAns]);
    });

    await client.query(queryText, values);
    await client.query('COMMIT');
    quiz.questions = body.questions;

    res.status(201).json({
      status: 'success',
      message: 'quiz created successfuly!',
      data: {
        quiz,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error while creating quiz!');
    throw err;
  } finally {
    client.release();
  }
});

exports.increseViewsCount = catchAsync(async (req, res, next) => {
  const quiz = await Quiz.findById(req.params.quizId, 'views, quiz_id');
  if (!quiz) return next(new AppError('cound not find this quiz', 404));
  quiz.views++;
  await pool.query('UPDATE quiz SET views = $1 WHERE quiz_id = $2', [
    quiz.views,
    quiz.quiz_id,
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      quiz,
    },
  });
});

exports.updateQuiz = catchAsync(async (req, res, next) => {
  //making sure that this field will keep its current value when updating the quiz
  req.body.createdAt = undefined;

  if (!Array.isArray(req.body.questions) && req.body.questions !== undefined) {
    req.body.questions = JSON.parse(req.body.questions);
  }

  const quiz = await Quiz.findById(req.params.quizId, 'quiz_id, image_cover');
  const client = await pool.connect();
  if (req.file) req.body.imageCover = req.file.filename;
  else req.body.imageCover = quiz.image_cover;

  try {
    await client.query('BEGIN');
    const { body } = req;

    let values = [
      body.name,
      body.description,
      body.category,
      body.imageCover,
      body.difficulty,
      quiz.quiz_id,
    ];

    let queryText =
      'UPDATE quiz SET name = $1, description = $2, category = $3, image_cover = $4, difficulty = $5 WHERE quiz_id = $6 RETURNING *';

    let updatedQuiz = (await client.query(queryText, values)).rows[0];

    queryText = `DELETE FROM question_tb WHERE quiz_id = $1`;
    await client.query(queryText, [quiz.quiz_id]);

    queryText = `INSERT INTO question_tb(quiz_id, question) VALUES${valuesStr(
      body.questions.length,
      2
    )} RETURNING question_id`;
    values = [];

    body.questions.forEach((q) => {
      values.push(quiz.quiz_id, q.question);
    });

    const questionsIds = (await client.query(queryText, values)).rows.map(
      (q) => q.question_id
    );

    const totalAnswersNum = body.questions.reduce((a, c) => {
      a += c.answers.length;
      return a;
    }, 0);

    queryText = `INSERT INTO answer_tb(question_id, answer)
  VALUES${valuesStr(totalAnswersNum, 2)} RETURNING question_id, answer_id
  `;
    values = [];

    body.questions.forEach((q, i) => {
      q.answers.forEach((ans) => values.push(questionsIds[i], ans));
    });

    const answers = (await client.query(queryText, values)).rows;

    queryText = `INSERT INTO question_correct_answer(question_id, answer_id)
  VALUES${valuesStr(body.questions.length, 2)}
  `;

    values = [];

    const correctAnswer = body.questions.map((q) => q.correctAnswer);

    const obj = answers.reduce((acc, val) => {
      const key = val.question_id;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(val.answer_id);
      return acc;
    }, {});

    correctAnswer.forEach((indexCorAns, i) => {
      const key = questionsIds[i];
      values.push(questionsIds[i], obj[key][indexCorAns]);
    });

    await client.query(queryText, values);
    await client.query('COMMIT');
    console.log(updatedQuiz);
    updatedQuiz.questions = body.questions;
    res.status(200).json({
      status: 'success',
      data: {
        quiz: updatedQuiz,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error while updating quiz!');
    throw err;
  } finally {
    client.release();
  }
});

exports.deleteQuiz = catchAsync(async (req, res, next) => {
  const authorId = await Quiz.findById(req.params.quizId, 'author_id');

  if (req.user.role !== 'admin' && authorId !== req.user.user_id)
    return next('you do not have permision to perform this action', 401);

  await pool.query('DELETE quiz WHERE quiz_id = $1', [req.params.quizId]);

  res.status(204).json({
    status: 'success',
    data: null,
  });
});

//{ $text: { $search: "your search text" } }
