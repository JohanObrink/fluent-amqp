const chai = require('chai')
const expect = chai.expect
const {spy, match} = require('sinon')
chai.use(require('sinon-chai'))

const amqp = require(`${process.cwd()}/lib/amqp`)

function wait (duration = 0) {
  return new Promise(resolve => {
    setTimeout(() => resolve(), duration)
  })
}

let host
before(() => {
  host = amqp('amqp://localhost')
  return host.connect()
})
after(() => {
  return host.close()
})

describe('integration: amqp', () => {
  describe('Hello World', () => {
    let publisher, subscriber
    beforeEach(() => {
      publisher = host.queue('test_hello', {durable: false})
      subscriber = host.queue('test_hello', {durable: false})
    })
    afterEach(() => {
      return Promise
        .all([
          publisher.delete(),
          subscriber.delete()
        ])
    })
    it('works', () => {
      const listener = spy()
      subscriber.subscribe()
        .each(msg => listener(msg.string()))

      return wait(50)
        .then(() => publisher.publish('hello'))
        .then(() => publisher.publish('world'))
        .then(() => wait(50))
        .then(() => {
          expect(listener)
            .calledTwice
            .calledWith('hello')
            .calledWith('world')
        })
    })
  })
  describe('Work queues', () => {
    let publisher, worker1, worker2
    beforeEach(() => {
      publisher = host.queue('test_tasks', {durable: true})
      worker1 = host.queue('test_tasks', {durable: true})
      worker2 = host.queue('test_tasks', {durable: true})
    })
    afterEach(() => {
      return Promise
        .all([
          publisher.delete(),
          worker1.delete(),
          worker2.delete()
        ])
    })
    it('works', () => {
      const listener1 = spy()
      worker1
        .subscribe({prefetch: 1, noAck: false})
        .each(msg => listener1(msg.string() || msg.ack()))
      const listener2 = spy()
      worker2
        .subscribe({prefetch: 1, noAck: false})
        .each(msg => listener2(msg.string() || msg.ack()))

      return wait(50)
        .then(() => publisher.publish('hello', {persistent: true}))
        .then(() => publisher.publish('world', {persistent: true}))
        .then(() => publisher.publish('yay!', {persistent: true}))
        .then(() => wait(50))
        .then(() => {
          expect(listener1)
            .calledTwice
            .calledWith('hello')
            .calledWith('yay!')

          expect(listener2)
            .calledOnce
            .calledWith('world')
        })
    })
  })
  describe('Exchange', () => {
    let publisher, subscriber
    beforeEach(() => {
      publisher = host
        .exchange('test_exchange', 'fanout', {durable: false})

      subscriber = host
        .exchange('test_exchange', 'fanout', {durable: false})
        .queue()
    })
    afterEach(() => {
      return Promise
        .all([
          publisher.delete(),
          subscriber.delete()
        ])
    })
    it('can send a message with options', () => {
      const listener = spy()
      subscriber.subscribe()
        .each(msg => listener(msg))

      return wait(50)
        .then(() => publisher.publish('hello', {
          contentType: 'application/json',
          headers: {'x-delay': 10000}
        }))
        .then(() => wait(50))
        .then(() => {
          expect(listener)
            .calledOnce
            .calledWith(match({
              properties: {
                contentType: 'application/json',
                headers: {'x-delay': 10000}
              }
            }))
        })
    })
  })
  describe('Publish/Subscribe', () => {
    let publisher, subscriber1, subscriber2
    beforeEach(() => {
      publisher = host
        .exchange('test_exchange', 'fanout', {durable: false})

      subscriber1 = host
        .exchange('test_exchange', 'fanout', {durable: false})
        .queue('test_listener', {exclusive: false})

      subscriber2 = host
        .exchange('test_exchange', 'fanout', {durable: false})
        .queue('', {exclusive: true})
    })
    afterEach(() => {
      return Promise
        .all([
          publisher.delete(),
          subscriber1.delete(),
          subscriber2.delete()
        ])
    })
    it('works', () => {
      const listener1 = spy()
      subscriber1.subscribe()
        .each(msg => listener1(msg.string()))

      const listener2 = spy()
      subscriber2.subscribe()
        .each(msg => listener2(msg.string()))

      return wait(50)
        .then(() => publisher.publish('hello'))
        .then(() => publisher.publish('world'))
        .then(() => wait(50))
        .then(() => {
          expect(listener1)
            .calledTwice
            .calledWith('hello')
            .calledWith('world')

          expect(listener2)
            .calledTwice
            .calledWith('hello')
            .calledWith('world')
        })
    })
  })
  describe('Routing', () => {
    let publisher, subscriber1, subscriber2, subscriber3
    beforeEach(() => {
      publisher = host
        .exchange('test_exchange', 'direct', {durable: false})

      subscriber1 = host
        .exchange('test_exchange', 'direct', {durable: false})
        .queue('test_subscriber1', {exclusive: false})

      subscriber2 = host
        .exchange('test_exchange', 'direct', {durable: false})
        .queue('test_subscriber2', {exclusive: false})

      subscriber3 = host
        .exchange('test_exchange', 'direct', {durable: false})
        .queue('test_subscriber3', {exclusive: false})
    })
    afterEach(() => {
      return Promise
        .all([
          publisher.delete(),
          subscriber1.delete(),
          subscriber2.delete(),
          subscriber3.delete()
        ])
    })
    it('works', () => {
      const listener1 = spy()
      subscriber1
        .subscribe(['info', 'warning'])
        .each(msg => listener1(msg.string()))

      const listener2 = spy()
      subscriber2
        .subscribe(['warning', 'error'])
        .each(msg => listener2(msg.string()))

      const listener3 = spy()
      subscriber3
        .subscribe()
        .each(msg => listener3(msg.string()))

      return wait(200)
        .then(() => Promise.all([
          publisher.publish('hello', 'info'),
          publisher.publish('look out', 'warning'),
          publisher.publish('b0rk', 'error')
        ]))
        .then(() => wait(500))
        .then(() => {
          expect(listener1, 'listener1')
            .calledTwice
            .calledWith('hello')
            .calledWith('look out')

          expect(listener2, 'listener2')
            .calledTwice
            .calledWith('look out')
            .calledWith('b0rk')

          expect(listener3, 'listener3')
            .not.called
        })
    })
  })
  describe('Topics', () => {
    let publisher, subscriber1, subscriber2, subscriber3, subscriber4
    beforeEach(() => {
      publisher = host
        .exchange('test_exchange', 'topic', {durable: false})

      subscriber1 = host
        .exchange('test_exchange', 'topic', {durable: false})
        .queue('test_subscriber1', {exclusive: false})

      subscriber2 = host
        .exchange('test_exchange', 'topic', {durable: false})
        .queue('test_subscriber2', {exclusive: false})

      subscriber3 = host
        .exchange('test_exchange', 'topic', {durable: false})
        .queue('test_subscriber3', {exclusive: false})

      subscriber4 = host
        .exchange('test_exchange', 'topic', {durable: false})
        .queue('test_subscriber4', {exclusive: false})
    })
    afterEach(() => {
      return Promise
        .all([
          publisher.delete(),
          subscriber1.delete(),
          subscriber2.delete(),
          subscriber3.delete(),
          subscriber4.delete()
        ])
    })
    it('works', () => {
      const listener1 = spy()
      subscriber1
        .subscribe('trips.*')
        .each(msg => listener1(msg.string()))

      const listener2 = spy()
      subscriber2
        .subscribe(['trips.create', 'trips.delete'])
        .each(msg => listener2(msg.string()))

      const listener3 = spy()
      subscriber3
        .subscribe('*.delete')
        .each(msg => listener3(msg.string()))

      const listener4 = spy()
      subscriber4
        .subscribe('#')
        .each(msg => listener4(msg.string()))

      return wait(200)
        .then(() => Promise.all([
          publisher.publish('create trip', 'trips.create'),
          publisher.publish('update trip', 'trips.update'),
          publisher.publish('delete trip', 'trips.delete'),
          publisher.publish('create user', 'users.create'),
          publisher.publish('delete user', 'users.delete')
        ]))
        .then(() => wait(500))
        .then(() => {
          expect(listener1, 'listener1')
            .calledThrice
            .calledWith('create trip')
            .calledWith('update trip')
            .calledWith('delete trip')

          expect(listener2, 'listener2')
            .calledTwice
            .calledWith('create trip')
            .calledWith('delete trip')

          expect(listener3, 'listener3')
            .calledTwice
            .calledWith('delete trip')
            .calledWith('delete user')

          expect(listener4.callCount, 'listener4').to.equal(5)
          expect(listener4, 'listener4')
            .calledWith('create trip')
            .calledWith('update trip')
            .calledWith('delete trip')
            .calledWith('create user')
            .calledWith('delete user')
        })
    })
  })
  describe('Connecting to cluster', () => {
    let publisher, subscriber
    before(() => {
      host = amqp(['amqp://notlocalhost', 'amqp://notlocalhost', 'amqp://localhost'])
      return host.connect()
    })
    beforeEach(() => {
      publisher = host.queue('test_hello', {durable: false})
      subscriber = host.queue('test_hello', {durable: false})
    })
    afterEach(() => {
      return Promise
        .all([
          publisher.delete(),
          subscriber.delete()
        ])
    })
    it('works', () => {
      const listener = spy()
      subscriber.subscribe()
        .each(msg => listener(msg.string()))

      return wait(50)
        .then(() => publisher.publish('hello'))
        .then(() => publisher.publish('world'))
        .then(() => wait(50))
        .then(() => {
          expect(listener)
            .calledTwice
            .calledWith('hello')
            .calledWith('world')
        })
    })
  })
})
