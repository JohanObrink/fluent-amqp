describe('Publish/Subscribe', () => {
  let publisher, subscriber1, subscriber2
  beforeEach(() => {
    publisher = host
      .exchange('test_exchange_publish', 'fanout', {durable: false})

    subscriber1 = host
      .exchange('test_exchange_publish', 'fanout', {durable: false})
      .queue('test_listener', {exclusive: false})

    subscriber2 = host
      .exchange('test_exchange_publish', 'fanout', {durable: false})
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
