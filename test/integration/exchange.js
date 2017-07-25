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
