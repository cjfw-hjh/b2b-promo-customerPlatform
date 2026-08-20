const express = require('express');
const morgan = require('morgan');
const session = require('./config/session');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(morgan('dev'));
app.use(session);
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', require('./routes/authRoutes'));

app.use(errorHandler);

module.exports = app;
