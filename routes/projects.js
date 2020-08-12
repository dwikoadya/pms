var express = require('express');
var router = express.Router();
var helpers = require('../helpers/auth');
var path = require('path')
var moment = require('moment')
const { Router } = require('express');

let projectOption = {
  id: true,
  name: true,
  members: true
}


let memberOption = {
  id: true,
  name: true,
  position: true
}

let issueOption = {
  optid: true,
  optsubject: true,
  opttracker: true
}

module.exports = (pool) => {
  router.get('/', helpers.isLoggedIn, (req, res, next) => {

    let link = 'projects'
    let user = req.session.user
    let sql = `SELECT count(id) AS total from (SELECT DISTINCT projects.projectid as id FROM projects 
      LEFT JOIN members ON members.projectid = projects.projectid 
      LEFT JOIN users ON users.userid = members.userid `

    let result = []

    if (req.query.cekid && req.query.projectId) {
      result.push(`projects.projectid=${req.query.projectId}`)
    }

    if (req.query.cekname && req.query.projectName) {
      result.push(`projects.name ILIKE '%${req.query.projectName}%'`)
    }

    if (req.query.cekember && req.query.member) {
      result.push(`members.userid=${req.query.member}`)
    }

    if (result.length > 0) {
      sql += ` WHERE ${result.join(" AND ")}`
    }

    sql += `) AS projectname`;

    // console.log(sql);

    pool.query(sql, (err, totalData) => {
      if (err) return res.status(500).json({
        error: true,
        message: err
      })

      const url = req.url == '/' ? '/?page=1' : req.url
      const page = req.query.page || 1
      const limit = 3
      const offset = (page - 1) * limit
      const count = totalData.rows[0].total
      const pages = Math.ceil(count / limit);

      let sql = `SELECT DISTINCT projects.projectid, projects.name, 
      string_agg(users.firstname || ' ' || users.lastname, ', ') as member FROM projects 
      LEFT JOIN members ON members.projectid = projects.projectid
      LEFT JOIN users ON users.userid = members.userid `
      if (result.length > 0) {
        sql += ` WHERE ${result.join(" AND ")}`
      }
      sql += ` GROUP BY projects.projectid ORDER BY projectid ASC LIMIT ${limit} OFFSET ${offset}`;

      pool.query(sql, (err, dataProjects) => {
        if (err) return res.status(500).json({
          error: true,
          message: err
        })
        let fullName = `SELECT userid, concat(firstname,' ',lastname) as fullname FROM users;`

        pool.query(fullName, (err, fullNameUsers) => {
          if (err) return res.status(500).json({
            error: true,
            message: err
          })
          res.render('projects/list', {
            url,
            user,
            link,
            page,
            pages,
            result: dataProjects.rows,
            users: fullNameUsers.rows,
            option: projectOption,
            login: user
          });
        })
      })
    })
  });

  router.post('/option', helpers.isLoggedIn, (req, res) => {
    projectOption.id = req.body.checkid;
    projectOption.name = req.body.checkname;
    projectOption.members = req.body.checkmember;
    res.redirect('/projects')
  })

  router.get('/add', helpers.isLoggedIn, (req, res, next) => {
    let link = 'projects'
    let sql = `SELECT DISTINCT (userid), CONCAT(firstname, ' ', lastname) AS fullname FROM users ORDER BY fullname`
    pool.query(sql, (err, data) => {
      if (err) {
        return res.send(err)
      } else {
        res.render('projects/form', {
          data: data.rows,
          user: req.session.user,
          link
        })
      }
    })
  })

  router.post('/add', helpers.isLoggedIn, (req, res, next) => {
    let members = req.body.members;
    let sql = `INSERT INTO projects (name) values('${req.body.projectName}')`
    pool.query(sql, (err) => {
      if (err) {
        return res.send(err)
      } else {
        pool.query('SELECT projectid FROM projects ORDER BY projectid desc limit 1', (err, projectid) => {
          if (err) {
            return res.send(err)
          }
          let id = projectid.rows[0].projectid;
          let query = [];
          for (let i = 0; i < members.length; i++) {
            query.push(`(${members[i]}, ${id})`)
          }
          pool.query(`INSERT INTO members (userid, projectid) values ${query.join(',')}`, (err, data) => {
            res.redirect('/projects')
          })
        })
      }
    })
  })

  router.get('/edit/:projectid', helpers.isLoggedIn, (req, res) => {
    let id = req.params.projectid
    let link = 'projects'
    let sql = `SELECT projects.name FROM projects WHERE projects.projectid = ${id}`
    let fullName = `SELECT DISTINCT (userid), CONCAT(firstname, ' ', lastname) AS fullname FROM users ORDER BY fullname`
    let sqlmember = `SELECT members.userid, projects.name, projects.projectid FROM members LEFT JOIN projects ON members.projectid = projects.projectid WHERE projects.projectid = ${id}`


    pool.query(sql, (err, data) => {
      if (err) {
        return res.send(err);
      }
      let projectName = data.rows[0];

      pool.query(fullName, (err, member) => {
        if (err) {
          return res.send(err);
        }
        let members = member.rows;
        pool.query(sqlmember, (err, membersData) => {
          if (err) {
            return res.send(err)
          }
          let memberData = membersData.rows.map(item => item.userid)
          res.render('projects/edit', {
            login: req.session.user,
            memberData,
            projectName,
            members,
            link
          })
        })
      })
    })
  })

  router.post('/edit/:projectid', helpers.isLoggedIn, (req, res) => {
    let id = req.params.projectid
    let sql = `UPDATE projects SET name = '${req.body.editName}' WHERE projectid = ${id}`

    if (id && req.body.editName && req.body.editMembers) {
      pool.query(sql, (err) => {
        if (err) {
          return res.send(err)
        }
        let memberDelete = `DELETE FROM members WHERE projectid = ${id}`
        pool.query(memberDelete, (err) => {
          if (err) {
            return res.send(err)
          }
          let result = []
          if (typeof editMembers == 'string') {
            result.push(`(${req.body.editMembers}, ${id})`)
          } else {
            for (let i = 0; i < req.body.editMembers.length; i++) {
              result.push(`(${req.body.editMembers[i]}, ${id})`)
            }
          }

          let memberUpdate = `INSERT INTO members (userid, projectid) VALUES ${result.join(",")}`
          pool.query(memberUpdate, (err) => {
            if (err) {
              return res.send(err)
            }
            res.redirect('/projects')
          })
        })
      })
    } else {
      res.redirect(`/projects/edit/${id}`)
    }
  })

  router.get('/delete/:projectid', helpers.isLoggedIn, (req, res) => {
    const id = parseInt(req.params.projectid)
    let membersData = `DELETE FROM members WHERE projectid = ${id}`;
    pool.query(membersData, (err) => {
      if (err) {
        return res.send(err)
      }
      let projectsData = `DELETE FROM projects WHERE projectid = ${id}`;
      pool.query(projectsData, (err) => {
        if (err) {
          return res.send(err)
        }
        res.redirect('/projects')
      })
    })
  })

  router.get('/:projectid/overview', helpers.isLoggedIn, (req, res) => {
    let link = 'projects'
    let id = req.params.projectid
    let url = 'overview'
    let dataProject = `SELECT * FROM projects WHERE projectid = ${id}`

    pool.query(dataProject, (err, projectData) => {
      if (err) {
        return res.send(err)
      }
      let dataMembers = `SELECT users.firstname, users.lastname, members.role FROM members
      LEFT JOIN users ON members.userid = users.userid WHERE members.projectid = ${id}`
      pool.query(dataMembers, (err, membersData) => {
        if (err) {
          return res.send(err)
        }
        let dataIssue = `SELECT tracker, status FROM issues WHERE projectid = ${id}`
        pool.query(dataIssue, (err, issueData) => {
          if (err) return res.send(err)
          let bugOpen = 0;
          let bugTotal = 0;
          let featureOpen = 0;
          let featureTotal = 0;
          let supportOpen = 0;
          let supportTotal = 0;

          issueData.rows.forEach(element => {
            if (element.tracker == 'Bug' && element.status !== 'closed') {
              bugOpen += 1
            }
            if (element.tracker == 'Bug') {
              bugTotal += 1
            }
          })
          issueData.rows.forEach(element => {
            if (element.tracker == 'Feature' && element.status !== 'closed') {
              featureOpen += 1
            }
            if (element.tracker == 'Feature') {
              featureTotal += 1
            }
          })
          issueData.rows.forEach(element => {
            if (element.tracker == 'Support' && element.status !== 'closed') {
              supportOpen += 1
            }
            if (element.tracker == 'Bug') {
              supportTotal += 1
            }
          })
          res.render('projects/overview/view', {
            id,
            link,
            url,
            bugOpen,
            bugTotal,
            featureOpen,
            featureTotal,
            supportOpen,
            supportTotal,
            login: req.session.user,
            data: projectData.rows[0],
            members: membersData.rows
          })
        })
      })
    })
  })

  router.get('/:projectid/members', helpers.isLoggedIn, (req, res) => {
    let id = req.params.projectid;
    let link = 'projects'
    let url = 'members'
    let sql = `SELECT COUNT(member) AS total FROM(SELECT members.userid FROM members
      JOIN users ON members.userid = users.userid WHERE members.projectid = ${id}`

    let result = [];

    if (req.query.cekid && req.query.memberId) {
      result.push(`members.id = ${req.query.memberId}`)
    }

    if (req.query.cekname && req.query.memberName) {
      result.push(`CONCAT(users.firstname, ' ', users.lastname) LIKE '%${req.query.memberName}%'`)
    }

    if (req.query.cekposition && req.query.position) {
      result.push(`members.role = '${req.query.position}'`)
    }

    if (result.length > 0) {
      sql += ` AND ${result.join(' AND ')}`
    }
    sql += `) AS member`

    pool.query(sql, (err, totalData) => {
      if (err) {
        return res.send(err)
      }

      const pageUrl = (req.url == `/${id}/members`) ? `/${id}/members/?page=1` : req.url;
      const page = req.query.page || 1;
      const limit = 3
      const offset = (page - 1) * limit
      const count = totalData.rows[0].total
      const pages = Math.ceil(count / limit);


      let dataMember = `SELECT users.userid, projects.name, projects.projectid, members.id, members.role, 
        CONCAT(users.firstname,' ',users.lastname) AS fullname FROM members
        LEFT JOIN projects ON projects.projectid = members.projectid
        LEFT JOIN users ON users.userid = members.userid WHERE members.projectid = ${id}`
      if (result.length > 0) {
        dataMember += ` AND ${result.join(' AND ')}`
      }

      dataMember += ` ORDER BY members.role ASC`
      dataMember += ` LIMIT ${limit} OFFSET ${offset}`

      pool.query(dataMember, (err, memberData) => {
        if (err) {
          return res.send(err)
        }
        let dataProjects = `SELECT * FROM projects WHERE projectid = ${id}`
        pool.query(dataProjects, (err, projectsData) => {
          if (err) {
            return res.send(err)
          }
          res.render('projects/members/list', {
            id,
            url,
            link,
            pages,
            page,
            pageUrl,
            project: projectsData.rows[0],
            members: memberData.rows,
            option: memberOption,
            login: req.session.user
          })
        })
      })
    })
  })

  router.post('/:projectid/members/option', helpers.isLoggedIn, (req, res) => {
    const id = req.params.projectid;

    memberOption.id = req.body.optid;
    memberOption.name = req.body.optname;
    memberOption.position = req.body.optposition;
    res.redirect(`/projects/${id}/members`)
  })

  router.get('/:projectid/members/add', helpers.isLoggedIn, (req, res) => {
    const id = req.params.projectid;
    const link = 'projects';
    const url = 'members'
    let dataProjects = `SELECT * FROM projects WHERE projectid = ${id}`
    pool.query(dataProjects, (err, projectsData) => {
      if (err) {
        return res.send(err)
      }
      let dataMembers = `SELECT userid, CONCAT(firstname, ' ', lastname) AS fullname FROM users WHERE userid NOT IN (SELECT userid FROM members WHERE projectid = ${id})`
      pool.query(dataMembers, (err, membersData) => {
        if (err) {
          return res.send(err)
        }
        res.render('projects/members/add', {
          id,
          link,
          url,
          members: membersData.rows,
          project: projectsData.rows[0],
          login: req.session.user
        })
      })
    })
  })

  router.post('/:projectid/members/add', helpers.isLoggedIn, (req, res) => {
    const id = req.params.projectid;
    pool.query(`INSERT INTO members(userid, role, projectid) VALUES ($1, $2, $3)`, [req.body.memberBoolean, req.body.position, id], (err) => {
      if (err) {
        return res.send(err)
      }
      res.redirect(`/projects/${id}/members`)
    })
  })

  router.get('/:projectid/members/:id', helpers.isLoggedIn, (req, res) => {
    let projectid = req.params.projectid
    let id = req.params.id
    let link = 'projects'
    let url = 'members'
    let dataMember = `SELECT members.id, CONCAT(users.firstname, ' ',users.lastname) AS fullname, members.role FROM members
    LEFT JOIN users ON members.userid = users.userid WHERE projectid = ${projectid} AND id = ${id}`

    pool.query(dataMember, (err, memberData) => {
      if (err) {
        return res.send(err)
      }
      let dataProjects = `SELECT * FROM projects WHERE projectid = ${projectid}`
      pool.query(dataProjects, (err, projectsData) => {
        if (err) {
          return res.send(err)
        }
        res.render('projects/members/edit', {
          id,
          link,
          url,
          member: memberData.rows[0],
          project: projectsData.rows,
          login: req.session.user
        })
      })
    })
  })

  router.post('/:projectid/members/:id', helpers.isLoggedIn, (req, res) => {
    let projectid = req.params.projectid;
    let id = req.params.id;
    let position = req.body.editPosition

    pool.query(`UPDATE members SET role = '${position}' WHERE id = ${id}`, (err) => {
      if (err) {
        return res.send(err)
      }
      res.redirect(`/projects/${projectid}/members`)
    })
  })

  router.get('/:projectid/members/:id/delete', helpers.isLoggedIn, (req, res) => {
    let projectid = req.params.projectid;
    let id = req.params.id;

    pool.query(`DELETE FROM members WHERE projectid = ${projectid} AND id = ${id}`, (err) => {
      if (err) {
        return res.send(err)
      }
      res.redirect(`/projects/${projectid}/members`)
    })
  })

  router.get('/:projectid/issues', helpers.isLoggedIn, (req, res) => {
    let id = req.params.projectid
    let link = 'projects'
    let url = 'issues'
    let sql = `SELECT * FROM projects WHERE projectid = ${id}`

    let result = [];
    let search = "";

    if (req.query.cekid && req.query.issueId) {
      result.push(`issues.issueid = ${req.query.issueId}`)
    }

    if (req.query.ceksubject && req.query.issueSubject) {
      result.push(`issues.subject ILIKE '%${req.query.issueSubject}%'`)
    }

    if (req.query.cektracker && req.query.issueTracker) {
      result.push(`issues.tracker = '${req.query.issueTracker}'`)
    }

    if (result.length > 0) {
      search += ` AND ${result.join(' AND ')}`
    }

    let sqlTotal = `SELECT COUNT(issueid) AS total FROM issues WHERE projectid = ${id} ${search}`

    pool.query(sql, (err, dataProject) => {
      if (err) {
        return res.send(err)
      }
      let project = dataProject.rows[0];
      pool.query(sqlTotal, (err, totalData) => {
        if (err) {
          return res.send(err)
        }
        let total = totalData.rows[0].total;

        const pageUrl = req.url == `/${id}/issues` ? `/${id}/issues/?page=1` : req.url;

        const page = req.query.page || 1;
        const limit = 3;
        const offset = (page - 1) * limit;
        const pages = Math.ceil(total / limit);

        let dataIssue = `SELECT issues.*, CONCAT(users.firstname, ' ', users.lastname) AS authorname FROM issues
        LEFT JOIN users ON issues.author = users.userid WHERE issues.projectid = ${id} ${search}
        ORDER BY issues.issueid ASC LIMIT ${limit} OFFSET ${offset}`

        pool.query(dataIssue, (err, issueData) => {
          if (err) {
            return res.send(err)
          }
          let issues = issueData.rows

          let dataAssignee = `SELECT users.userid, CONCAT(firstname, ' ', lastname) AS fullname FROM members
          LEFT JOIN users ON members.userid = users.userid WHERE projectid = ${id}`

          pool.query(dataAssignee, (err, assigneeData) => {
            if (err) {
              return res.send(err)
            }
            let assignee = assigneeData.rows
            res.render('projects/issues/list', {
              project,
              issues,
              assignee,
              id,
              link,
              url,
              page,
              pages,
              pageUrl,
              login: req.session.user,
              option: issueOption,
            })
          })
        })
      })
    })
  })

  router.post('/:projectid/issues', helpers.isLoggedIn, (req, res) => {
    const id = req.params.projectid

    issueOption.optid = req.body.optid
    issueOption.optsubject = req.body.optsubject
    issueOption.opttracker = req.body.opttracker

    res.redirect(`/projects/${id}/issues`)
  })

  router.get('/:projectid/issues/add', helpers.isLoggedIn, (req, res) => {
    let id = req.params.projectid
    let link = 'projects'
    const url = 'issues'

    let sql = `SELECT * FROM projects WHERE projectid = ${id}`;
    pool.query(sql, (err, projectData) => {
      if (err) {
        return res.send(err)
      }
      let dataMembers = `SELECT users.userid, CONCAT(users.firstname, ' ', users.lastname) AS fullname FROM members
      LEFT JOIN users ON members.userid = users.userid WHERE projectid = ${id}`
      pool.query(dataMembers, (err, memberData) => {
        if (err) {
          return res.send(err)
        }
        res.render('projects/issues/add', {
          id,
          link,
          url,
          project: projectData.rows[0],
          members: memberData.rows,
          login: req.session.user
        })
      })
    })
  })

  router.post('/:projectid/issues/add', helpers.isLoggedIn, (req, res) => {
    let id = parseInt(req.params.projectid)
    let user = req.session.user

    let file = req.files.file;
    let filename = file.name.toLowerCase().replace('', Date.now()).split(' ').join('-');
    let sql = `INSERT INTO issues(projectid, tracker, subject, description, status, priority, assignee, startdate, duedate, estimatedtime, done, files, author, createddate)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`
    let value = [id, req.body.tracker, req.body.subjectIssue, req.body.description, req.body.status, req.body.priority, parseInt(req.body.assignee), req.body.startDate, req.body.dueDate, parseInt(req.body.estimatedTime), parseInt(req.body.done), filename, user.userid]

    pool.query(sql, value, (err) => {
      if (err) {
        return res.send(err)
      }
      file.mv(path.join(__dirname, '..', 'public', 'upload', filename), (err) => {
        if (err) {
          return res.send(err)
        }
        res.redirect(`/projects/${id}/issues`)
      })
    })
  })

  router.get('/:projectid/issues/edit/:id', helpers.isLoggedIn, (req, res) => {
    let id = req.params.projectid;
    let issueid = req.params.id;
    let link = 'projects';
    let url = 'issues'

    let dataProject = `SELECT * FROM projects WHERE projectid = ${id}`;
    pool.query(dataProject, (err, projectData) => {
      if (err) {
        return res.send(err)
      }
      let dataIssue = `SELECT issues.*, CONCAT(users.firstname, ' ', users.lastname) AS authorname FROM issues
      LEFT JOIN users ON  issues.author = users.userid WHERE projectid = ${id} AND issueid = ${issueid}`;

      pool.query(dataIssue, (err, issueData) => {
        if (err) {
          return res.send(err)
        }
        let dataMembers = `SELECT users.userid, CONCAT(users.firstname, ' ', users.lastname) AS fullname FROM members
        LEFT JOIN users ON members.userid = users.userid WHERE projectid = ${id}`

        pool.query(dataMembers, (err, membersData) => {
          if (err) {
            return res.send(err)
          }
          let dataParent = `SELECT subject, tracker, issueid FROM issues WHERE projectid = ${id}`

          pool.query(dataParent, (err, parentData) => {
            if (err) {
              return res.send(err)
            }
            res.render('projects/issues/edit', {
              id,
              link,
              url,
              moment,
              project: projectData.rows[0],
              issue: issueData.rows[0],
              members: membersData.rows,
              parent: parentData.rows,
              login: req.session.user
            })
          })
        })
      })
    })
  })

  router.post('/:projectid/issues/edit/:id', helpers.isLoggedIn, (req, res) => {
    let id = parseInt(req.params.projectid);
    let issueid = parseInt(req.params.id);
    let formEdit = req.body;
    let user = req.session.user;

    let title = `${formEdit.subjectIssue}#${issueid}(${formEdit.tracker}):${formEdit.description}`
    let dataActivity = `INSERT INTO activity (time, title, description, author, projectid)
    VALUES(NOW(), $1, $2, $3, $4)`
    let value = [title, formEdit.description, user.userid, id]

    if (req.files) {
      let file = req.files.file
      let filename = file.name.toLowerCase().replace("", Date.now()).split(" ").join("-")
      let dataUpdate = `UPDATE issues SET 
      subject = $1, 
      description = $2, 
      status = $3, 
      priority = $4, 
      assignee = $5, 
      duedate = $6, 
      done = $7, 
      parenttask = $8, 
      spenttime = $9, 
      targetversion = $10, 
      files = $11, 
      updateddate = $12 ${formEdit.status == 'closed' ? `, closeddate = NOW() ` : " "} 
      WHERE issueid = $13`
      let values = [formEdit.subjectIssue, formEdit.description, formEdit.status, formEdit.priority, parseInt(formEdit.assignee), formEdit.dueDate, parseInt(formEdit.done), parseInt(formEdit.parenttask), parseInt(formEdit.spenttime), formEdit.target, filename, 'NOW()', issueid]

      pool.query(dataUpdate, values, (err) => {
        if (err) {
          return res.send(err)
        }
        file.mv(path.join(__dirname, "..", "public", "upload", filename), (err) => {
          if (err) {
            return res.send(err)
          }
          pool.query(dataActivity, value, (err) => {
            if (err) return res.send(err)
            res.redirect(`/projects/${id}/issues`)
          })
        })
      })
    } else {
      let dataUpdate = `UPDATE issues SET subject = $1, description = $2, status = $3, priority = $4, assignee = $5, duedate = $6, done = $7, parenttask = $8, spenttime = $9, targetversion = $10, updateddate = $11 ${formEdit.status == 'closed' ? `, closeddate = NOW() ` : " "} WHERE issueid = $12`
      let values = [formEdit.subjectIssue, formEdit.description, formEdit.status, formEdit.priority, parseInt(formEdit.assignee), formEdit.dueDate, parseInt(formEdit.done), parseInt(formEdit.perenttask), parseInt(formEdit.spenttime), formEdit.target, 'NOW()', issueid]
      pool.query(dataUpdate, values, (err) => {
        if (err) {
          return res.send(err)
        }
        res.redirect(`/projects/${id}/issues`)
      })
    }
  })

  router.get(`/:projectid/issues/delete/:id`, helpers.isLoggedIn, (req, res) => {
    let id = req.params.projectid;
    let issueid = req.params.id;

    let dataDelete = `DELETE FROM issues WHERE projectid = $1 AND issueid = $2`
    pool.query(dataDelete, [id, issueid], (err) => {
      if (err) {
        return res.send(err)
      }
      res.redirect(`/projects/${id}/issues`)
    })
  })

  router.get('/:projectid/activity', helpers.isLoggedIn, (req, res) => {
    let id = req.params.projectid;
    const link = 'projects';
    const url = 'activity';

    let dataProject = `SELECT * FROM projects WHERE projectid = ${id}`
    pool.query(dataProject, (err, projectData) => {
      if (err) {
        return res.send(err)
      }
      let project = projectData.rows[0];
      let dataActivity = `SELECT activity.*, CONCAT(users.firstname,' ',users.lastname) AS authorname,
        (time AT TIME ZONE 'Asia/Jakarta'):: time AS timeactivity, 
        (time AT TIME ZONE 'Asia/Jakarta'):: date AS dateactivity
        FROM activity
        LEFT JOIN users ON activity.author = users.userid WHERE projectid= ${id} 
        ORDER BY dateactivity DESC, timeactivity DESC`

      pool.query(dataActivity, (err, activityData) => {
        if (err) return res.send(err)
        let activity = activityData.rows;

        activity.forEach(element => {
          element.dateactivity = moment(element.dateactivity).format('YYYY-MM-DD')
          element.timeactivity = moment(element.timeactivity, 'HH:mm:ss.SSS').format('HH:mm');
          console.log(element.dateactivity)
          if (element.dateactivity == moment().format('YYYY-MM-DD')) {
            element.dateactivity = 'Today'
          } else if (element.dateactivity == moment().subtract(1, 'days').format('YYYY-MM-DD')) {
            element.dateactivity = 'Yesterday'
          } else {
            element.dateactivity = moment(element.dateactivity).format('MMMM Do, YYYY')
          }
        })
        res.render(`projects/activity/view`, {
          moment,
          activity,
          link,
          url,
          id,
          project,
          login: req.session.user
        })
      })
    })
  })

  return router
}