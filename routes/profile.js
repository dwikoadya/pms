var express = require('express');
var router = express.Router();
var helpers = require('../helpers/auth');
const bcrypt = require('bcrypt')
const saltRounds = 10

module.exports = (pool) => {
    router.get('/', helpers.isLoggedIn, (req, res, next) => {
        let link = 'profile'
        let user = req.session.user
        let sql = `SELECT * FROM users WHERE email = $1`
        pool.query(sql, [user.email], (err, data) => {
            if (err) {
                return res.send(err)
            } else {
                res.render('profile/view', {
                    link,
                    user,
                    data: data.rows[0],
                    user: req.session.user
                })
            }
        })
    })

    router.post('/', helpers.isLoggedIn, (req, res) => {
        let user = req.session.user

        const { password, position, type} = req.body

        bcrypt.hash(password, saltRounds, (err, hash) => {
            if (err) return res.send(err)
            let sql = `UPDATE users SET password = '${hash}', position = '${position}', type = '${type}' WHERE email = '${user.email}'`
            pool.query(sql, (err) => {
                if (err) return res.send(err)
            })
            res.redirect('/projects')
        })
    })

    return router
}