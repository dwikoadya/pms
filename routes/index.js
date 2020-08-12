var express = require('express');
var router = express.Router();
var bcrypt = require('bcrypt')

/* GET home page. */
module.exports = (pool) => {
  router.get('/', function (req, res, next) {
    res.render('login', { title: 'Express' });
  });

  router.post('/login', function (req, res, next) {
    pool.query('select * from users where email = $1', [req.body.email], (err, data) => {
      if (err) return data.send(err);
      if (data.rows.length == 0) return res.send('Email belum terdaftar');
      bcrypt.compare(req.body.password, data.rows[0].password, function (err, result) {
        if (err) return data.send(err);
        if (!result) return res.send("password doesn't match")

        let user = data.rows[0]
        delete user['password']
        req.session.user = user;
        res.redirect('/projects')
      });
    })
  });

  router.get('/logout', (req, res, next) => {
    req.session.destroy((err) => {
      if (err) return res.send(err)
    })
    res.redirect('/')
  })
  return router;
}