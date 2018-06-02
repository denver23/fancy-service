const path = require('path')
const express = require('express')
const root = express.static(path.join(__dirname, '../dist'))
module.exports = [
  {
    path: '/',
    target: root,
  },
  {
    path: /^(?!\/(v1|api)).*?$/,
    target: root
  },
  {
    path: '/api/test',
    target: require('./Api/Test')
  },
  {
    path: '/v1/test',
    target: require('./Controller/Test')
  }
]
