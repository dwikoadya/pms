var express = require('express');
var router = express.Router();
var helpers = require('../helpers/auth');
const bcrypt = require('bcrypt');
const saltRounds = 10;

let cekoption = {
  Id: true,
  Name: true,
  Email: true,
  Position: true,
  Type: true,
  Role: true
}

module.exports = (pool) => {
  /* GET users listing. */
  router.get('/', helpers.isLoggedIn, (req, res) => {
    let link = 'users'
    let result = [];
    let search = ""

    if (req.query.cekid && req.query.usersId) {
      result.push(`userid = ${parseInt(req.query.usersId)}`)
    }

    if (req.query.cekname && req.query.usersName) {
      result.push(`CONCAT(firstname, ' ', lastname) ILIKE '%${req.query.usersName}%'`)
    }

    if (req.query.cekemail && req.query.usersEmail) {
      result.push(`email = '${req.query.usersEmail}'`)
    }

    if (req.query.cekposition && req.query.usersPosition) {
      result.push(`position = '${req.query.usersPosition}'`)
    }

    if (req.query.cektype && req.query.usersType) {
      result.push(`type = '${req.query.usersType}'`)
    }


    if (result.length > 0) {
      search += ` WHERE ${result.join(' AND ')}`
    }

    let dataUser = `SELECT COUNT (userid) AS total FROM users ${search}`

    pool.query(dataUser, (err, userData) => {
      if (err) return res.send(err)
      let total = userData.rows[0].total
      const url = req.url == '/' ? '/?page=1' : req.url;
      const page = req.query.page || 1;
      const limit = 3;
      const offset = (page - 1) * limit;
      let pages = Math.ceil(total / limit)
      let queryData = `SELECT userid, email, CONCAT(firstname, ' ', lastname) AS fullname, position, type, role
      FROM users ${search} ORDER BY userid ASC LIMIT ${limit} OFFSET ${offset}`

      pool.query(queryData, (err, dataQuery) => {
        if (err) return res.send(err)
        res.render('users/list', {
          link,
          pages,
          page,
          url,
          users: dataQuery.rows,
          option: cekoption,
          login: req.session.user
        })
      })
    })
  });

  router.post('/', helpers.isLoggedIn, (req, res) => {
    cekoption.Id = req.body.checkid
    cekoption.Name = req.body.checkname
    cekoption.Email = req.body.checkemail
    cekoption.Position = req.body.checkposition
    cekoption.Type = req.body.checktype
    cekoption.Role = req.body.checkrole

    res.redirect('/users')
  })

  router.get('/add', helpers.isLoggedIn, (req, res) => {
    const link = 'users';
    res.render('users/add', {
      link,
      login: req.session.user
    })
  })

  router.post('/add', helpers.isLoggedIn, (req, res) => {
    bcrypt.hash(req.body.password, saltRounds, (err, hash) => {
      if (err) return res.send(err)

      let data = `INSERT INTO users(firstname, lastname, email, password, position, type, role) VALUES ($1, $2, $3, $4, $5, $6, $7)`
      let values = [req.body.firstName, req.body.lastName, req.body.email, hash, req.body.position, req.body.type, req.body.role]
      pool.query(data, values, (err) => {
        if (err) return res.send(err)
        res.redirect('/users')
      })
    })
  })

  router.get('/edit/:id', helpers.isLoggedIn, (req, res) => {
    let link = 'users';
    let id = req.params.id;
    let data = `SELECT * FROM users WHERE userid = ${id}`
    pool.query(data, (err, sql) => {
      if (err) return res.send(err)
      res.render('users/edit', {
        link,
        sql: sql.rows[0],
        login: req.session.user
      })
    })
  })

  router.post('/edit/:id', helpers.isLoggedIn, (req, res) => {
    let id = req.params.id;
    bcrypt.hash(req.body.password, saltRounds, (err, hash) => {
      if (err) return res.send(err)

      let dataUpdate = `UPDATE users SET firstname=$1, lastname=$2, password=$3, position=$4, type=$5, role=$6 WHERE userid=$7`
      let values = [req.body.firstName, req.body.lastName, hash, req.body.position, req.body.type, req.body.role, id]

      pool.query(dataUpdate, values, (err) => {
        if (err) return res.send(err)
        res.redirect('/users')
      })
    })
  })

  router.get('/delete/:id', helpers.isLoggedIn, (req, res) => {
    let id = req.params.id;
    let deleteData =  `DELETE FROM users WHERE userid=$1`

    pool.query(deleteData, [id], (err) => {
      if (err) return res.send(err)
      res.redirect('/users')
    })
  })


  return router;
}

