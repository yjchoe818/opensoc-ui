var _ = require('lodash');
var http = require('http');
var https = require('https');
var fs = require('fs');
var path = require('path');

var express = require('express');

var connect = require('connect');
var flash = require('connect-flash');

var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var cookieSession = require('cookie-session');
var csurf = require('csurf');
var helmet = require('helmet');

var passport = require('passport');
var ldapauth = require('passport-ldapauth');

var esProxy = require('./modules/es-proxy');
var login = require('./modules/login');
var pcap = require('./modules/pcap');

var config = require('./config');

var app = express();
app.set('view engine', 'jade');
app.set('views', path.join(__dirname, 'views/'));

// Use Helmet to secure Express apps by setting various HTTP headers
app.use(helmet());

// Cookie middleware
app.use(connect.logger('dev'));
app.use(flash());
app.use(cookieParser());
app.use(cookieSession({
  secret: config.secret,
  cookie: {
    maxAge: 1 * 24 * 60 * 60 * 1000, // 1-day sessions
    secure: true // Ensure cookies are only sent over HTTPS
  }
}));

if (config.auth) {
  app.use(passport.initialize());
  app.use(passport.session());
}

app.use("/__es", esProxy(config));

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(csurf()); // Add CSRF protection

// Setup routes
if (config.auth) {
  login(app, config);
}

pcap(app, config);

app.get('/config.js', function (req, res) {
  if (config.auth && !req.user) {
    res.send(403, 'Forbidden!');
    return;
  }

  res.sendFile('config-kibana.js', {root: __dirname});
});

// Serve static assets
app.use(connect.static(path.join(__dirname, config.static)));

// Start server
if (process.env.NODE_ENV != 'TEST') {
  console.log('Starting server on port', config.port, '...');
  var serverOptions = {
    key: fs.readFileSync('path/to/your/private-key.pem'),
    cert: fs.readFileSync('path/to/your/certificate.pem')
  };
  var server = https.createServer(serverOptions, app);
  server.listen(config.port, config.host);  
}

exports.app = app;