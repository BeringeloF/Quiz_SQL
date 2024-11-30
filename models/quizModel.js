const pool = require('../db/db.js');

class Quiz {
  static async findById(id, columns = false) {
    return (
      await pool.query(
        `SELECT ${columns ? columns : '*'} FROM quiz WHERE quiz_id = $1`,
        [id]
      )
    ).rows[0];
  }
}

module.exports = Quiz;
