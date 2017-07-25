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
