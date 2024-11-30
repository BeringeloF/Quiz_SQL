const app = require('./app');
const dotenv = require('dotenv');
const pool = require('./db/db.js');

dotenv.config({ path: './config.env' });

const port = process.env.PORT || 3000;

const server = app.listen(port, '127.0.0.1', () => {
  console.log('server running on port ' + port);
});

process.on('unhandledRejection', async (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message, err.stack);
  await pool.end();
  server.close(() => {
    process.exit(1);
  });
});

process.on('SIGTERM', async () => {
  console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
  await pool.end();
  server.close(() => {
    console.log('💥 Process terminated!');
  });
});
