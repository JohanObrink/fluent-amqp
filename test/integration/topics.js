describe('Topics', () => {
  let publisher, subscriber1, subscriber2, subscriber3, subscriber4
  beforeEach(() => {
    publisher = host
      .exchange('test_exchange_topic', 'topic', {durable: false})

    subscriber1 = host
      .exchange('test_exchange_topic', 'topic', {durable: false})
      .queue('test_subscriber1', {exclusive: false})

    subscriber2 = host
      .exchange('test_exchange_topic', 'topic', {durable: false})
      .queue('test_subscriber2', {exclusive: false})

    subscriber3 = host
      .exchange('test_exchange_topic', 'topic', {durable: false})
      .queue('test_subscriber3', {exclusive: false})

    subscriber4 = host
      .exchange('test_exchange_topic', 'topic', {durable: false})
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
