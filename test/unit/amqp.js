const chai = require('chai')
const expect = chai.expect
const {spy, stub, useFakeTimers} = require('sinon')
const proxyquire = require('proxyquire')
const {EventEmitter} = require('events')
chai.use(require('sinon-chai'))

function tick (num = 1) {
  if (num <= 1) {
    return Promise.resolve()
  }
  return Array(num - 1)
    .fill('')
    .reduce((p) => p.then(() => Promise.resolve()), Promise.resolve())
}

describe('lib/amqp', () => {
  let amqplib, amqp, clock
  let connection, channel, queue
  let host
  beforeEach(() => {
    clock = useFakeTimers()

    host = 'amqp://localhost'

    queue = {}
    channel = {
      assertExchange: stub(),
      assertQueue: stub().resolves(queue),
      bindQueue: stub(),
      consume: stub(),
      on: stub(),
      publish: stub().resolves(),
      sendToQueue: stub().resolves()
    }
    connection = Object.assign(new EventEmitter(), {
      createChannel: stub().resolves(channel)
    })
    spy(connection, 'once')
    amqplib = {
      connect: stub().resolves(connection)
    }
    amqp = proxyquire(`${process.cwd()}/lib/amqp`, {
      'amqplib': amqplib
    })
  })
  afterEach(() => {
    clock.restore()
    connection.once.restore()
  })
  describe('publish', () => {
    describe('Hello World', () => {
      it('creates a connection', () => {
        amqp(host)
          .queue('hello', {durable: false})
          .publish('Hello')

        expect(amqplib.connect)
          .calledOnce
          .calledWith(host)
      })
      it('creates a channel', () => {
        return amqp(host)
          .queue('hello', {durable: false})
          .publish('Hello')
          .then(() => {
            expect(connection.createChannel)
              .calledOnce
          })
      })
      it('asserts a queue', () => {
        return amqp(host)
          .queue('hello', {durable: false})
          .publish('Hello')
          .then(() => {
            expect(channel.assertQueue)
              .calledOnce
              .calledWith('hello', {durable: false})
          })
      })
      it('sends the message to the queue', () => {
        return amqp(host)
          .queue('hello', {durable: false})
          .publish('Hello')
          .then(() => {
            expect(channel.sendToQueue)
              .calledOnce
              .calledWith('hello', Buffer.from('Hello'))
          })
      })
      it('serializes the message correctly', () => {
        return amqp(host)
          .queue('hello', {durable: false})
          .publish({msg: 'Hello'})
          .then(() => {
            expect(channel.sendToQueue)
              .calledOnce
              .calledWith('hello', Buffer.from('{"msg":"Hello"}'))
          })
      })
      it('retries in 1/2 seconds if the connection fails', () => {
        amqplib.connect.rejects('error')
        amqp(host)
          .queue('hello', {durable: false})
          .publish({msg: 'Hello'})

        return tick(2)
          .then(() => {
            expect(channel.sendToQueue).not.called

            amqplib.connect.resolves(connection)
            clock.tick(500)
          })
          .then(() => tick(10))
          .then(() => {
            expect(channel.sendToQueue).calledOnce
          })
      })
      it('then retries in 1 seconds if the connection fails again', () => {
        amqplib.connect.rejects('error')
        amqp(host)
          .queue('hello', {durable: false})
          .publish({msg: 'Hello'})

        return tick(2)
          .then(() => {
            clock.tick(500)
          })
          .then(() => tick(8))
          .then(() => {
            expect(channel.sendToQueue).not.called
          })
          .then(() => tick(8))
          .then(() => {
            amqplib.connect.resolves(connection)
            clock.tick(1000)
          })
          .then(() => tick(20))
          .then(() => {
            expect(channel.sendToQueue).calledOnce
          })
      })
    })
    describe('Publish/Subscribe', () => {
      describe('publish', () => {
        beforeEach(() => {
          amqp(host)
            .exchange('hello', 'fanout', {durable: false})
            .publish('Hello', 'greeting')
          return tick(10)
        })
        it('creates a connection', () => {
          expect(amqplib.connect)
            .calledOnce
            .calledWith(host)
        })
        it('creates a channel', () => {
          expect(connection.createChannel)
            .calledOnce
        })
        it('asserts an exchange', () => {
          expect(channel.assertExchange)
            .calledOnce
            .calledWith('hello', 'fanout', {durable: false})
        })
        it('publishes to the exchange', () => {
          expect(channel.publish)
            .calledOnce
            .calledWith('hello', 'greeting', Buffer.from('Hello'))
        })
      })
      describe('subscribe', () => {
        beforeEach(() => {
          amqp(host)
            .exchange('hello', 'fanout', {durable: false})
            .queue('listener', {exclusive: false})
            .subscribe()
          return tick(10)
        })
        it('creates a connection', () => {
          expect(amqplib.connect)
            .calledOnce
            .calledWith(host)
        })
        it('creates a channel', () => {
          expect(connection.createChannel)
            .calledOnce
        })
        it('asserts an exchange', () => {
          expect(channel.assertExchange)
            .calledOnce
            .calledWith('hello', 'fanout', {durable: false})
        })
        it('asserts a queue', () => {
          expect(channel.assertQueue)
            .calledOnce
            .calledWith('listener', {exclusive: false})
        })
        it('consumes queue', () => {
          expect(channel.consume)
            .calledOnce
            .calledWith('listener')
        })
        it('rebuilds its context on disconnect', () => {
          connection.emit('close')
          return tick(5)
            .then(() => {
              expect(amqplib.connect).calledTwice
              expect(amqplib.connect.lastCall).calledWith(host)

              expect(connection.createChannel).calledTwice

              expect(channel.assertExchange).calledTwice
              expect(channel.assertExchange.lastCall).calledWith('hello', 'fanout', {durable: false})
            })
        })
      })
    })
  })
})
