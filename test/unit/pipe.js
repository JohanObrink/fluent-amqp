const chai = require('chai')
const expect = chai.expect
const {spy, stub} = require('sinon')
const proxyquire = require('proxyquire')
const {EventEmitter} = require('events')
chai.use(require('sinon-chai'))

const spec = require('stream-spec')
const {createRandomStream, createPauseStream} = require('stream-tester')

const _ = require('highland')

describe('pipe', () => {
  let amqplib, amqp
  let connection, channel, queue
  let queueStream

  beforeEach(() => {
    queue = {}
    channel = {
      assertExchange: stub(),
      assertQueue: stub().resolves(queue),
      bindQueue: stub(),
      consume: stub(),
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

    queueStream = amqp('amqp://host').queue('events', {durable: true}).stream()
  })
  it('conforms to stream spec', () => {
    spec(queueStream)
      .duplex({strict: true})
      .validateOnExit()
  })
  it('handles pauses and errors', (done) => {
    const random = createRandomStream(() => (`line ${Math.random()}\n`), 1000)

    random
      .pipe(queueStream)
      .pipe(createPauseStream())

    random.on('close', () => done())
  })
  it('writes to queue', (done) => {
    const random = createRandomStream(() => (`line ${Math.random()}\n`), 1000)

    random
      .pipe(queueStream)
      .pipe(createPauseStream())

    random.on('close', () => {
      try {
        expect(channel.sendToQueue.callCount, 'numberOfCalls').to.equal(1000)
        done()
      } catch (err) {
        done(err)
      }
    })
  })
  it('handles a highland stream', (done) => {
    const events = _(['event 1', 'event 2', 'event 3'])
    events.pipe(queueStream)

    events.done(() => {
      setTimeout(() => {
        try {
          expect(channel.sendToQueue)
            .calledThrice

          const args = channel.sendToQueue
            .args.map(([q, buf, props]) => ({q, msg: buf.toString()}))

          expect(args[0]).to.eql({q: 'events', msg: 'event 1'})
          expect(args[1]).to.eql({q: 'events', msg: 'event 2'})
          expect(args[2]).to.eql({q: 'events', msg: 'event 3'})

          done()
        } catch (err) {
          done(err)
        }
      }, 0)
    })
  })
})
