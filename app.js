
var express = require('express');
var cookieParser = require('cookie-parser');
var cookieSession = require('cookie-session');
var http = require('http');
var fs = require('fs');
var formidable = require('formidable');
var util = require('util');
var uuid = require('node-uuid');
var cfenv = require('cfenv');
var url = require('url');
var cloudant = {
  url: "https://a03c4e43-2e1a-4f74-8ffe-ba482b7df885-bluemix:1a43a58051e0d90c8cc83fa0ff4e50ca37237b6596bb8165fbc5d521ea42111f@a03c4e43-2e1a-4f74-8ffe-ba482b7df885-bluemix.cloudant.com"
};
var cloudantLibrary = {
  url: "https://a03c4e43-2e1a-4f74-8ffe-ba482b7df885-bluemix.cloudant.com/mlibrary"
}
var nano = require('nano')(cloudant.url);
var db = nano.db.use('mlibrary');

var app = express();

app.use(cookieParser());
app.use(cookieSession({
  name: 'session',
  keys: [uuid.v4(), uuid.v4()]
}));
app.use(express.static(__dirname + '/public'));
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
  res.redirect(url.format({protocol: req.protocol, host: req.get('host'), pathname: '/list'}));
});
app.get('/book', (req, res) => {
  db.get(req.session.selectID, (err, body) => {
    if(err) throw err;
    res.render(__dirname + '/public/views/pages/book', {book : body, cover: cloudantLibrary.url + "/" + body._id + "/" + Object.keys(body._attachments)[0]});
  });
});
app.post('/book', (req, res) => {
  var form = new formidable.IncomingForm();
  form.parse(req, function (err, fields, files) {
      if(fields['doWhat'] && fields['doWhat'] == 'All') {
        req.session.selectID = null;
        res.redirect(url.format({protocol: req.protocol, host: req.get('host'), pathname: '/list'}));
      } else if (fields['doWhat']
                  && fields['doWhat'] == 'Delete'
                  && fields['selectID']
                  && fields['selectID'] != ''
                  && fields['selectRev']
                  && fields['selectRev'] != '') {
        req.session.selectID = fields['selectID'];
        db.destroy(fields['selectID'], fields['selectRev'], (err, body) => {
          if (!err) {
            console.log('Book Deleted Succeessfully!')
            res.redirect(url.format({protocol: req.protocol, host: req.get('host'), pathname: '/list'}));
          }
        });
      }
  });
});
app.get('/list', (req, res) => {
  db.view('all_docs', 'all_docs_index', (err, body) => {
    var books = [];
    if(!err) {
        body.rows.forEach((doc) => {
        books.push(doc.value);
      });
      res.render(__dirname + '/public/views/pages/list', {all_books: books});
    }
  });
});
app.post('/list', (req, res) => {
  var form = new formidable.IncomingForm();
  form.parse(req, function (err, fields, files) {
      if(fields['addbook'] && fields['addbook'] == 'Add Book') {
        res.redirect(url.format({protocol: req.protocol, host: req.get('host'), pathname: '/add'}));
      } else if (fields['selectID'] && fields['selectID'] != '') {
        req.session.selectID = fields['selectID'];
        res.redirect(url.format({protocol: req.protocol, host: req.get('host'), pathname: '/book'}));
      }
  });
});

app.get('/add', (req, res) => {
  res.render(__dirname + '/public/views/pages/add');
});
app.post('/add', (req, res) => {
  var form = new formidable.IncomingForm();
  form.uploadDir = __dirname;
  console.log("Temp Upload Folder Assigned");
  form.parse(req, function (err, fields, files) {
      if(!err) {
          if(fields['addbook'] == 'Add Book') {
            addBook(err, fields, files);
          }
      }
  });
  res.redirect(url.format({protocol: req.protocol, host: req.get('host'), pathname: '/list'}));
});

function addBook(err, fields, files) {
  fs.readFile(files['cover'].path, function(err, data) {
    if(!err) {
      db.multipart.insert(fields, [{name: files['cover'].name, data: data, content_type: files['cover'].type}], uuid.v4(), (err) => {
        if (!err) {
          console.log('Book Added Succeessfully!');
          fs.unlink(files['cover'].path, (err) => {
            if(!err) console.log("Temp upload deleted!");
          });
        }
      });
    }
  });
}

// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();
// start server on the specified port and binding host
app.listen(appEnv.port, '0.0.0.0', () => {
  // print a message when the server starts listening
  console.log("server starting on " + appEnv.url);
});
