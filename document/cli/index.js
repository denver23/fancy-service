const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const shelljs = require('shelljs')
const inquirer = require('inquirer')

const root = path.resolve(__dirname, '../../')
const packageJson = require('../../package.json')
let configJson = require('./server.config.js')
let configFile = `${root}/config/server.config.json`

if (fs.existsSync(configFile)) {
  configJson = require(configFile)
}

const regEn = /^[A-Za-z]\w+$/
const regPort = /^[1-9]\d{3,4}$/

const release = async () => {
  const baseinfo = await _baseinfo()

  // server config
  let config = configJson[baseinfo.environment]
  config.port = baseinfo.port || config.port

  await _mysql(config, baseinfo.environment)
  await _redis(config)
  await _upload(config)
  await _logs(config)
  // await _https(config)

  console.log(chalk.green('========== generage server.config.json'))
  fs.writeFileSync(configFile, JSON.stringify(configJson, null, 2), {})
}

async function _baseinfo() {
  let res = await inquirer.prompt([
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

  packageJson.name = res.projectName || packageJson.name
  packageJson.version = res.version || packageJson.version
  packageJson.description = res.description || packageJson.description
  packageJson.author.name = res.author || ''
  packageJson.author.email = res.email || ''
  packageJson.author.url = res.url || ''

  console.log(chalk.green('========== update pageage.json'))
  let packageFile = path.resolve(__dirname, '../../package.json')
  fs.writeFileSync(packageFile, JSON.stringify(packageJson, null, 2), {})
  return res
}

async function _mysql(config, environment = 'development') {
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

  config.mysql.port = res.port || config.mysql.port
  config.mysql.database = res.database || config.mysql.database
  config.mysql.username = res.username || config.mysql.username
  config.mysql.password = res.password || config.mysql.password
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

async function _redis(config) {
  let answer = await inquirer.prompt([{
    name: 'yn',
    message: '配置Redis:',
    type: 'confirm',
    default: false,
  }])

  if (!answer.yn) {
    delete config.redis
    return null
  }

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

  config.redis.host = res.host || config.redis.host
  config.redis.port = res.port || config.redis.port
  config.redis.password = res.password || config.redis.password
  return res
}

async function _upload(config) {
  let answer = await inquirer.prompt([{
    name: 'yn',
    message: '配置上传路径:',
    type: 'confirm',
    default: true,
  }])
  if (!answer.yn) {
    delete config.upload
    return null
  }

  let res = await inquirer.prompt([
    {
      name: 'path',
      message: '上传文件存储目录(相对项目目录):',
      type: 'input',
      default: './upload',
    },
    {
      name: 'temp',
      message: '上传文件临时目录(相对项目目录):',
      type: 'input',
      default: './upload.temp'
    },
    {
      name: 'url',
      message: '上传文件访问URL:',
      type: 'input',
      default: '/',
    },
  ])

  config.upload.temp = res.temp || config.upload.temp
  config.upload.path = res.path || config.upload.path
  config.upload.url = res.url || config.upload.url
  return res
}

async function _logs(config) {
  let res = await inquirer.prompt([
    {
      name: 'path',
      message: '日志目录(相对当前目录):',
      type: 'input',
      default: config.logs || './logs',
    },
  ])

  let realpath = path.resolve(root, res.path)
  let ignore = `${realpath}/.gitignore`
  shelljs.exec(`mkdir -p ${realpath}`)
  shelljs.exec(`touch ${ignore}`)
  shelljs.exec(`echo "*" >> ${ignore}`)
  shelljs.exec(`echo "!.gitignore" >> ${ignore}`)

  config.logs = res.path
  return res
}

async function _https(config) {
  let answer = await inquirer.prompt([{
    name: 'yn',
    message: '配置https:',
    type: 'confirm',
    default: false,
  }])
  if (!answer.yn) {
    config.https = false
    return null
  }

  let res = await inquirer.prompt([
    {
      name: 'port',
      message: 'https端口:',
      type: 'input',
      default: '8989',
      validate: str => regPort.test(str)
    },
    {
      name: 'key',
      message: '私钥路径:',
      type: 'input',
      default: 'cert/private.key',
    },
    {
      name: 'cert',
      message: '证书路径:',
      type: 'input',
      default: 'cert/cert.crt',
    },
  ])
  config.https = res
  return res
}

release().catch(err => {
  console.error(err)
  process.exit(1)
})
