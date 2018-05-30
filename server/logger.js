'use strict'
const fs = require('fs')
const path = require('path')
const log4js = require('log4js')

const root = path.resolve(__dirname, '../logs')
const DEBUG = process.env.NODE_ENV === 'development'

const appenders = {
  console: {
    type: 'console'
  },
  Model: {
    type: 'dateFile',
    filename: `${root}/Model`,
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

log4js.configure({
  appenders,
  categories,
  replaceConsole: true,
})

console.log(appenders)

module.exports = (name, category = '') => {
  let cname = name
  if (!appenders[cname]) {
    appenders[cname] = {
      type: 'dateFile',
      filename: `${root}/${name}`,
      pattern: '.yyyyMMdd.log',
      alwaysIncludePattern: true,
      maxLogSize: 1024,
    }
    categories[cname] = {
      appenders: [cname],
      level: DEBUG ? 'debug' : 'warn',
    }
  }
  console.log(cname)
  return log4js.getLogger(cname)
}

function getByDirectory(dirname, prefix = '') {
  let pa = fs.readdirSync(path.resolve(__dirname, `./${dirname}`))
  pa.forEach((ele, index) => {
    let name = path.basename(ele, '.js')
    let cname = prefix + name

    appenders[cname] = {
      type: 'dateFile',
      filename: `${root}/${dirname}/${name}`,
      pattern: '.yyyyMMdd.log',
      alwaysIncludePattern: true,
      maxLogSize: 1024,
    }

    let arr = [name]
    DEBUG && arr.push('console')

    categories[cname] = {
      appenders: arr,
      level: DEBUG ? 'debug' : 'warn',
    }
  })
}
