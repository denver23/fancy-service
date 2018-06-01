'use strict'
const path = require('path')
const glob = require('glob')
const log4js = require('log4js')

const config = require('../config/server')
const savepath = config.logs
const DEBUG = process.env.NODE_ENV !== 'production'

console.log(path.relative(__dirname, '/logs'))

// const shelljs = require('shelljs')
// shelljs.exec(`rsync -a --include='*/' --exclude='*' ${server}/ ${savepath}/`)
// rm -irf !(.gitkeep)

const sepReg = new RegExp(path.sep, 'g')

const appenders = {
  console: {
    type: 'console'
  },
  Model: {
    type: 'dateFile',
    filename: `${savepath}/Model`,
    pattern: '.yyyyMMdd.log',
    alwaysIncludePattern: true,
    maxLogSize: 1024,
  },
}
const categories = {
  default: {
    appenders: ['console'],
    level: 'info'
  },
  Model: {
    appenders: ['Model', 'console'],
    level: DEBUG ? 'debug' : 'warn',
  }
}

add('Api')
add('Controller')

log4js.configure({
  appenders,
  categories,
  replaceConsole: true,
})

module.exports = filename => {
  let category = getName(filename)
  return log4js.getLogger(category)
}

function getName(to) {
  return path.basename(path.relative(__dirname, to).replace(sepReg, '.'), '.js')
}

function add(directory) {
  let list = glob.sync(`/${directory}/**/*.js`, { root: __dirname })
  list.forEach(v => {
    let name = getName(v)

    appenders[name] = {
      type: 'dateFile',
      filename: `${savepath}/${name}`,
      pattern: '.yyyyMMdd.log',
      alwaysIncludePattern: true,
      maxLogSize: 1024,
    }

    categories[name] = {
      appenders: DEBUG ? [name, 'console'] : [name],
      level: DEBUG ? 'debug' : 'warn',
    }
  })
}
