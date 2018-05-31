'use strict'
const fs = require('fs')
const path = require('path')
const log4js = require('log4js')
const shelljs = require('shelljs')

const server = path.resolve(__dirname, './')
console.log(server)
const root = path.resolve(__dirname, '../logs')
const DEBUG = process.env.NODE_ENV !== 'production'

shelljs.exec(`rsync -a --include='*/' --exclude='*' ${server}/ ${root}/`)
// rm -irf !(.gitkeep)

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

add('Api')
add('Controller')

log4js.configure({
  appenders,
  categories,
  replaceConsole: true,
})

module.exports = category => log4js.getLogger(category)

function add(dirname) {
  let list = []
  try {
    let ta = `${root}/${dirname}`
    fs.existsSync(ta) || fs.mkdirSync(ta)
    list = fs.readdirSync(path.resolve(__dirname, `./${dirname}`))
  } catch (error) {
    console.log(error)
  }

  list.forEach((ele, index) => {
    if (ele === 'Controller.class.js') return
    let name = [dirname, path.basename(ele, '.js')].join('/')

    appenders[name] = {
      type: 'dateFile',
      filename: `${root}/${name}`,
      pattern: '.yyyyMMdd.log',
      alwaysIncludePattern: true,
      maxLogSize: 1024,
    }

    let arr = [name]
    DEBUG && arr.push('console')

    categories[name] = {
      appenders: arr,
      level: DEBUG ? 'debug' : 'warn',
    }
  })
}


