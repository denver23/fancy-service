const fs = require('fs')
const path = require('path')
const chalk = require('chalk')
const shelljs = require('shelljs')
const inquirer = require('inquirer')

const root = path.resolve(__dirname, '../../')
const packageJson = require('../../package.json')
let configJson = require('./server.config.js')
let configFile = `${root}/config/server.config.json`
let environment = 'development'

if (fs.existsSync(configFile)) {
  configJson = require(configFile)
}

const regEn = /^[A-Za-z]\w+$/
const regPort = /^[1-9]\d{3,4}$/
const addGitIgnore = (filepath) => {
  let had = fs.existsSync(filepath)
  if (had) return
  shelljs.exec(`touch ${filepath}`)
  shelljs.exec(`echo "*" >> ${filepath}`)
  shelljs.exec(`echo "!.gitignore" >> ${filepath}`)
}

const tips = str => {
  console.log(chalk.green(`==================== ${str}`))
}

const release = async () => {
  const baseinfo = await _baseinfo()

  // server config
  environment = baseinfo.environment
  let config = configJson[environment]
  config.port = baseinfo.port || config.port

  await _mysql(config)
  await _redis(config)
  await _upload(config)
  await _logs(config)
  await _https(config)

  tips('generage config/server.config.json')
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
      default: '8001',
      validate: str => regPort.test(str)
    },
  ])

  packageJson.name = res.projectName || packageJson.name
  packageJson.version = res.version || packageJson.version
  packageJson.description = res.description || packageJson.description
  packageJson.author.name = res.author || ''
  packageJson.author.email = res.email || ''
  packageJson.author.url = res.url || ''

  tips('update pageage.json')
  let packageFile = path.resolve(__dirname, '../../package.json')
  fs.writeFileSync(packageFile, JSON.stringify(packageJson, null, 2), {})
  return res
}

async function _mysql(config) {
  tips('mysql setting')
  let cfg = config.mysql
  let res = await inquirer.prompt([
    {
      name: 'host',
      message: 'host:',
      type: 'input',
      default: cfg.host || 'localhost',
    },
    {
      name: 'port',
      message: '端口:',
      type: 'input',
      default: cfg.port || '3306',
      validate: str => regPort.test(str)
    },
    {
      name: 'database',
      message: '数据库名:',
      type: 'input',
      default: cfg.database || 'fancy',
      validate: str => regEn.test(str)
    },
    {
      name: 'username',
      message: '数据库账号:',
      type: 'input',
      default: cfg.username || 'fancy',
      validate: str => regEn.test(str)
    },
    {
      name: 'password',
      message: '数据库账号密码:',
      type: 'password',
      default: cfg.password || 'fancy',
    },
  ])
  const isRoot = res.username === 'root'
  if (environment === 'development') {
    await _importTesting()
  }

  config.mysql = res
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
            type: 'password',
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

    shelljs.exec(`${conn} -N -e "DROP USER IF EXISTS '${res.username}'@'localhost';" 2>/dev/null`)
    shelljs.exec(`${conn} -N -e "CREATE USER ${res.username}@'localhost' IDENTIFIED BY '${res.password}'" 2>/dev/null`)
    shelljs.exec(`${conn} -N -e "GRANT ALL PRIVILEGES ON ${res.username}.* TO '${res.database}'@'localhost';" 2>/dev/null`)
  }
  function _createDatabase(connect = false) {
    let conn = connect || `mysql -u${res.username} -p${res.password} -P${res.port}`
    shelljs.exec(`${conn} -N -e "DROP DATABASE IF EXISTS ${res.database};" 2>/dev/null`)
    shelljs.exec(`${conn} -N -e "CREATE DATABASE ${res.database};" 2>/dev/null`)
    // shelljs.exec(`${conn} -N -e "show databases;"`)
    shelljs.exec(`${conn} ${res.database} < ./document/database.sql 2>/dev/null`)

    tips('import database success')
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

  tips('redis setting')
  let cfg = config.redis || {}
  let res = await inquirer.prompt([
    {
      name: 'host',
      message: 'Redis IP:',
      type: 'input',
      default: cfg.host || '127.0.0.1'
    },
    {
      name: 'port',
      message: 'Redis 端口:',
      type: 'input',
      default: cfg.port || '6379',
      validate: str => regPort.test(str)
    },
    {
      name: 'password',
      message: 'Redis 密码:',
      type: 'password',
      default: cfg.password || '',
    },
  ])
  config.redis = res
}

async function _upload(config) {
  let cfg = config.upload || {}
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

  tips('upload setting')
  let res = await inquirer.prompt([
    {
      name: 'path',
      message: '上传文件存储目录(相对项目目录):',
      type: 'input',
      default: cfg.path || './upload',
    },
    {
      name: 'temp',
      message: '上传文件临时目录(相对项目目录):',
      type: 'input',
      default: cfg.temp || './upload.temp'
    },
    {
      name: 'url',
      message: '上传文件访问URL:',
      type: 'input',
      default: cfg.url || '/',
    },
  ])

  if (environment === 'development') {
    let up = path.resolve(root, res.path)
    let temp = path.resolve(root, res.temp)
    shelljs.exec(`mkdir -p ${up} ${temp}`)
    addGitIgnore(`${temp}/.gitignore`)
  }

  config.upload.temp = res.temp || config.upload.temp
  config.upload.path = res.path || config.upload.path
  config.upload.url = res.url || config.upload.url
  return res
}

async function _logs(config) {
  tips('logs setting')
  let res = await inquirer.prompt([
    {
      name: 'path',
      message: '日志目录(相对当前目录):',
      type: 'input',
      default: config.logs || './logs',
    },
  ])

  let realpath = path.resolve(root, res.path)
  shelljs.exec(`mkdir -p ${realpath}`)
  addGitIgnore(`${realpath}/.gitignore`)

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

  tips('https setting')
  let res = await inquirer.prompt([
    {
      name: 'port',
      message: '端口:',
      type: 'input',
      default: '8002',
      validate: str => regPort.test(str)
    },
    {
      name: 'key',
      message: '私钥路径:',
      type: 'input',
      default: config.https.key || './cert/private.key',
    },
    {
      name: 'cert',
      message: '证书路径:',
      type: 'input',
      default: config.https.cert || './cert/cert.crt',
    },
  ])
  config.https = res
  return res
}

release().catch(err => {
  console.error(err)
  process.exit(1)
})
