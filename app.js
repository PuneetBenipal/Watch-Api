const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const cors = require('cors');
const { errorHandler, notFound } = require('./middlewares/error.middleware');
const currencyByIpMiddleware = require("./middlewares/currencyByIp")


const app = express();
const stripeCtrl = require("./controllers/stripe.ctrl")
// Middleware
app.use(logger('dev'));

app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeCtrl.webhookHandler);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(currencyByIpMiddleware());

// CORS middleware for images
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Serve uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// CORS configuration
app.use(cors({
  origin: (origin, callback) => callback(null, true),
  credentials: true
}));

// Use all routes
app.use("/api/superadmin", require("./superadmin/routes"));
app.use("/api", require("./routes"))

// items to delete
app.use('/api/checkout', require('./routes/checkout.routes'));
app.use('/webhooks', require('./routes/webhook.routes'));

// Error handler
app.use(errorHandler);
// 404 handler
app.use(notFound);

module.exports = app;
