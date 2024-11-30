const pool = require('../db/db.js');
const bcrypt = require('bcryptjs');
const AppError = require('../utils/appError');
class User {
  static async create(name, email, password, passwordConfirm) {
    try {
      if (password !== passwordConfirm)
        throw new AppError('passwords do not match!', 400);
      const hashedPassword = await bcrypt.hash(password, 12);
      return (
        await pool.query(
          'INSERT INTO users(name, email, password) VALUES($1, $2, $3) RETURNING user_id, name, email',
          [name, email, hashedPassword]
        )
      ).rows[0];
    } catch (err) {
      throw err;
    }
  }

  static async correctPassword(candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword);
  }

  static async findById(id, columns) {
    return (
      await pool.query(
        `SELECT ${columns ? columns : '*'} FROM users WHERE user_id = $1`,
        [id]
      )
    ).rows[0];
  }

  static changedPasswordAfter(JWTTimestamp, passwordChangedAt) {
    //Primeiro checar se a senha foi mudada
    if (passwordChangedAt) {
      const changedTimestamp = parseInt(passwordChangedAt.getTime() / 1000);

      //retornar true se a data em que token foi criado é menor do que a data em que a senha foi modificada
      //e neste caso como o token foi emitido antes da senha ser modificada nos NAO iremos liberar o acesso
      //CASO RETORNE FALSE, NESTE CASO NOS IREMOS LEBERAR O ACESSO, ja que o token foi emitido depois da senha ser alterada
      return JWTTimestamp < changedTimestamp;
    }

    //Por padrao retorna false
    return false;
  }

  static async increseExpAndLevel(difficulty, correctAnswers, user, client) {
    try {
      let exp = user.exp;
      let level = user.level;

      if (difficulty === 'easy') {
        exp += 5 * correctAnswers;
      }

      if (difficulty === 'medium') {
        exp += 10 * correctAnswers;
      }

      if (difficulty === 'hard') {
        exp += 15 * correctAnswers;
      }

      if (Math.floor(exp / 100) > 0) level = Math.floor(exp / 100);
      console.log(exp, level, 'first', difficulty);

      const quiz = await client.query(
        'UPDATE users SET exp = $1, level = $2 WHERE user_id = $3 RETURNING exp, level',
        [exp, level, user.user_id]
      );
      console.log(quiz);
    } catch (err) {
      throw err;
    }
  }
}
/*
userSchema.pre('save', async function (next) {
  //em todo documento nos temos acesso a uma propriedade chamada isModified() que diz se documeto foi modificado

  if (!this.isModified('password')) next();
  //é aqui onde é feito a criptografia da senha, nos usamo hash que aceita como primeiro parametro a string e como segundo
  //pode pode ser dizer o nivel da criptografia que é padra ser 10 quanto maior o numero melhor a segurança mais tambem
  //vai necessitar mais uso do cpu
  this.password = bcrypt.hash(this.password, 12);

  //delete passwordConfirm field
  this.passwordConfirm = undefined;
  next();
});

userSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'history.quiz',
    select: 'name difficulty category author',
  });

  next();
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || this.isNew) return next();

  //Aqui nos usamos menos 1000 ms pois, o servidor pode demorar um tempo para chegar ate esta parte, emtao para que o codigo funcione corrretamente
  //Nos tiramos um segundo para garantir
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  //Primeiro checar se a senha foi mudada
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000);

    //retornar true se a data em que token foi criado é menor do que a data em que a senha foi modificada
    //e neste caso como o token foi emitido antes da senha ser modificada nos NAO iremos liberar o acesso
    //CASO RETORNE FALSE, NESTE CASO NOS IREMOS LEBERAR O ACESSO, ja que o token foi emitido depois da senha ser alterada
    return JWTTimestamp < changedTimestamp;
  }

  //Por padrao retorna false
  return false;
};

userSchema.methods.increseExpAndLevel = function (
  difficulty,
  correctAnswers
) {
  if (difficulty === 'easy') {
    this.exp += 5 * correctAnswers;
  }

  if (difficulty === 'medium') {
    this.exp += 10 * correctAnswers;
  }

  if (difficulty === 'hard') {
    this.exp += 15 * correctAnswers;
  }

  if (Math.floor(this.exp / 100) > 0) this.level = Math.floor(this.exp / 100);
};

*/

module.exports = User;
