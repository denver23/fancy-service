'use strict'
class Model extends require('./Model.class') {
  constructor(logger) {
    super('test', false, logger || false)
  }
}

module.exports = logger => new Model(logger)
