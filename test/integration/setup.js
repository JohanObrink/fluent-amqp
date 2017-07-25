const amqp = require(`${process.cwd()}/lib/amqp`)
const chai = require('chai')
const expect = chai.expect
const {spy, stub, match} = require('sinon')
chai.use(require('sinon-chai'))

const wait = (duration = 0) =>
  new Promise(resolve =>
    setTimeout(() =>
      resolve(), duration))

Object.assign(global, {expect, spy, stub, match, wait})

before(() => {
  global.host = amqp('amqp://localhost')
  return host.connect()
})
after(() => {
  return host.close()
})
