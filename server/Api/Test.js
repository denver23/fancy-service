'use strict'
const express = require('express')
const router = express.Router()
// log
const logger = require('../logger')(__filename)
// model
const TestModel = require('../Model/Test.class')(logger)

class Application extends require('./Controller.class') {
  constructor(req, response, action) {
    super(req, response)
    this.user = null
    this[action]()
  }

  getList() {
    let {
      page = 1,
      perpage = 20,
    } = this.post

    _promise.call(this).then(
      res => this.send(res),
      err => this.sendError({ code: '000', msg: err }) && logger.error(err)
    )

    async function _promise() {
      let res = await TestModel.getList({
        page,
        perpage: Math.min(perpage, 100),
        order: 'utime desc',
        count: true,
      })

      return {
        code: '100',
        data: res.data,
        pages: res.pages,
      }
    }
  }
}

router.post('/getList', (req, res) => new Application(req, res, 'getList'))
router.get('/getList', (req, res) => new Application(req, res, 'getList'))

module.exports = router
