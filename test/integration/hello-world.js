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
      .then(() => wait(100))
      .then(() => {
        expect(listener)
          .calledTwice
          .calledWith('hello')
          .calledWith('world')
      })
  })
})
