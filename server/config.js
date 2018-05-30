const config = require('../config/server')
const env = process.env.NODE_ENV

const cookiePrefix = 'fancy_'
const upload = config.upload
const signExpire = 3600 * 2

const res = {
  development: {
    upload,
    cookiePrefix,
    signExpire,
  },
  testing: {
    upload,
    cookiePrefix,
    signExpire,
  },
  production: {
    upload,
    cookiePrefix,
    signExpire,
  }
}

module.exports = res[env]
