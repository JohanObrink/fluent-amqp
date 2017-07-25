const amqp = require(`${process.cwd()}/lib/amqp`)

describe('Cluster', () => {
  let publisher, subscriber
  before(() => {
    host = amqp(['amqp://notlocalhost', 'amqp://alsonotlocalhost', 'amqp://localhost'])
    return host.connect()
  })
  beforeEach(() => {
    publisher = host.queue('test_cluster', {durable: false})
    subscriber = host.queue('test_cluster', {durable: false})
  })
  afterEach(() => {
    return Promise
      .all([
        publisher.delete(),
        subscriber.delete()
      ])
  })
  it('works with one responding host', () => {
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
