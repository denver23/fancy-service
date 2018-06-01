const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const shelljs = require('shelljs')
const inquirer = require('inquirer')

let packageJson = require('../../package.json')
let configJson = require('./server.config.js')
let configFile = path.resolve(__dirname, '../../config/server.config.json')
if (fs.existsSync(configFile)) {
  configJson = require(configFile)
}

const regEn = /^[A-Za-z]\w+$/
const regPort = /^[1-9]\d{3,4}$/

const release = async () => {
  const data = await inquirer.prompt([
    {
      name: 'projectName',
      message: '项目名称:',
      type: 'input',
      default: packageJson.name || '',
      validate: str => /^[A-Za-z][-\w]+$/.test(str)
    },
    {
      name: 'version',
      message: '版本号:',
      type: 'input',
      default: packageJson.version || '',
      validate: str => /[\w|.]+\w$/.test(str)
    },
    {
      name: 'description',
      message: '简介:',
      type: 'input',
      default: packageJson.description || '',
    },
    {
      name: 'author',
      message: '作者:',
      type: 'input',
      default: packageJson.author.name || '',
    },
    {
      name: 'email',
      message: '邮箱:',
      type: 'input',
      default: packageJson.author.email || '',
      validate: str => /^\w+((-\w+)|(\.\w+))*@[A-Za-z0-9]+((\.|-)[A-Za-z0-9]+)*\.[A-Za-z0-9]+$/.test(str)
    },
    {
      name: 'url',
      message: '项目网址:',
      type: 'input',
      default: packageJson.author.url || '',
    },
    {
      name: 'environment',
      message: '运行环境选择:',
      type: 'list',
      default: 'development',
      choices: [
        { name: '开发环境', value: 'development' },
        { name: '测试环境', value: 'testing' },
        { name: '生产环境', value: 'production' },
      ]
    },
    {
      name: 'port',
      message: '项目端口号:',
      type: 'input',
      default: '8282',
      validate: str => regPort.test(str)
    },
  ])

  packageJson.name = data.projectName || packageJson.name
  packageJson.version = data.version || packageJson.version
  packageJson.description = data.description || packageJson.description
  packageJson.author.name = data.author || ''
  packageJson.author.email = data.email || ''
  packageJson.author.url = data.url || ''

  console.log(chalk.green('========== update pageage.json'))
  let packageFile = path.resolve(__dirname, '../../package.json')
  fs.writeFileSync(packageFile, JSON.stringify(packageJson, null, 2), {})

  // server config
  let _config = configJson[data.environment]
  _config.port = data.port || _config.port

  // mysql
  data.mysql = await _mysql(data.environment)
  _config.mysql.port = data.mysql.port || _config.mysql.port
  _config.mysql.database = data.mysql.database || _config.mysql.database
  _config.mysql.username = data.mysql.username || _config.mysql.username
  _config.mysql.password = data.mysql.password || _config.mysql.password

  // redis
  data.redis = await _redis()
  if (data.redis) {
    _config.redis.host = data.redis.host || _config.redis.host
    _config.redis.port = data.redis.port || _config.redis.port
    _config.redis.password = data.redis.password || _config.redis.password
  } else {
    delete _config.redis
  }

  // upload
  data.upload = await _upload()
  if (data.upload) {
    _config.upload.temp = data.upload.temp || _config.upload.temp
    _config.upload.path = data.upload.path || _config.upload.path
    _config.upload.url = data.upload.url || _config.upload.url
  } else {
    delete _config.upload
  }

  // log
  data.logs = await _logs()
  _config.logs = data.logs.realpath

  console.log(chalk.green('========== generage server.config.json'))
  fs.writeFileSync(configFile, JSON.stringify(configJson, null, 2), {})
}

async function _mysql(environment = 'development') {
  let res = await inquirer.prompt([
    {
      name: 'port',
      message: 'Mysql端口:',
      type: 'input',
      default: '3306',
      validate: str => regPort.test(str)
    },
    {
      name: 'database',
      message: '数据库名:',
      type: 'input',
      default: 'fancy',
      validate: str => regEn.test(str)
    },
    {
      name: 'username',
      message: '数据库账号:',
      type: 'input',
      default: 'fancy',
      validate: str => regEn.test(str)
    },
    {
      name: 'password',
      message: '数据库账号密码:',
      type: 'input',
      default: 'fancy',
    },
  ])
  const isRoot = res.username === 'root'
  if (environment === 'development') {
    await _importTesting()
  }
  return res

  async function _importTesting() {
    let ask = [
      {
        name: 'isImport',
        message: '是否导入测试数据:',
        type: 'confirm',
        default: true,
      },
    ]
    if (!isRoot) {
      ask.push(
        {
          name: 'userIsExist',
          message: `账号${res.username}是否已存在`,
          type: 'confirm',
          default: false,
        },
      )
    }

    let data = await inquirer.prompt(ask)
    if (data.isImport) {
      if (!isRoot && !data.userIsExist) {
        let rooter = await inquirer.prompt([
          {
            name: 'name',
            message: '数据库管理员账号:',
            type: 'input',
            default: 'root',
          },
          {
            name: 'psw',
            message: '数据库管理员密码:',
            type: 'input',
            default: '123123',
          },
        ])
        _createUser(rooter.name, rooter.psw)
      } else {
        _createDatabase()
      }
    }
  }

  function _createUser(root, psw) {
    let conn = `mysql -u${root} -p${psw} -P${res.port}`
    _createDatabase(conn)

    shelljs.exec(`${conn} -N -e "DROP USER IF EXISTS '${res.username}'@'localhost';"`)
    shelljs.exec(`${conn} -N -e "CREATE USER ${res.username}@'localhost' IDENTIFIED BY '${res.password}'"`)
    shelljs.exec(`${conn} -N -e "GRANT ALL PRIVILEGES ON ${res.username}.* TO '${res.database}'@'localhost';"`)
  }
  function _createDatabase(connect = false) {
    console.log(chalk.green('========== import database'))

    let conn = connect || `mysql -u${res.username} -p${res.password} -P${res.port}`
    shelljs.exec(`${conn} -N -e "DROP DATABASE IF EXISTS ${res.database};"`)
    shelljs.exec(`${conn} -N -e "CREATE DATABASE ${res.database};"`)
    // shelljs.exec(`${conn} -N -e "show databases;"`)
    shelljs.exec(`${conn} ${res.database} < ./document/database.sql`)
  }
}

async function _redis() {
  let answer = await inquirer.prompt([{
    name: 'yn',
    message: '配置Redis:',
    type: 'confirm',
    default: false,
  }])
  if (!answer.yn) return null

  let res = await inquirer.prompt([
    {
      name: 'host',
      message: 'Redis IP:',
      type: 'input',
      default: '127.0.0.1'
    },
    {
      name: 'port',
      message: 'Redis 端口:',
      type: 'input',
      default: '6379',
      validate: str => regPort.test(str)
    },
    {
      name: 'password',
      message: 'Redis 密码:',
      type: 'input',
      default: '',
    },
  ])
  return res
}

async function _upload() {
  let answer = await inquirer.prompt([{
    name: 'yn',
    message: '配置上传路径:',
    type: 'confirm',
    default: true,
  }])
  if (!answer.yn) return null

  let res = await inquirer.prompt([
    {
      name: 'uploadPath',
      message: '上传文件存储目录(相对当前目录):',
      type: 'input',
      default: 'upload',
    },
    {
      name: 'uploadTmp',
      message: '上传文件临时目录(相对当前目录):',
      type: 'input',
      default: 'upload.temp'
    },
    {
      name: 'uploadUrl',
      message: '上传文件访问URL:',
      type: 'input',
      default: '/',
    },
  ])
  return res
}

async function _logs() {
  let res = await inquirer.prompt([
    {
      name: 'logPath',
      message: '日志目录(相对当前目录):',
      type: 'input',
      default: 'logs',
      validate: str => regEn.test(str)
    },
  ])
  let realpath = path.resolve(__dirname, '../../' + res.logPath)
  shelljs.exec(`mkdir ${realpath}`)
  shelljs.exec(`touch ${realpath}/.gitkeep`)

  res.realpath = realpath
  return res
}

release().catch(err => {
  console.error(err)
  process.exit(1)
})
