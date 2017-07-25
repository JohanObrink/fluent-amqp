describe('Routing', () => {
  let publisher, subscriber1, subscriber2, subscriber3
  beforeEach(() => {
    publisher = host
      .exchange('test_exchange_routing', 'direct', {durable: false})

    subscriber1 = host
      .exchange('test_exchange_routing', 'direct', {durable: false})
      .queue('test_subscriber1', {exclusive: false})

    subscriber2 = host
      .exchange('test_exchange_routing', 'direct', {durable: false})
      .queue('test_subscriber2', {exclusive: false})

    subscriber3 = host
      .exchange('test_exchange_routing', 'direct', {durable: false})
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
