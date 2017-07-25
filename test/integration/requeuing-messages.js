describe('Requeueing messages', () => {
  let publisher, subscriber
  beforeEach(() => {
    publisher = host.queue('test_requeueing', {durable: false})
    subscriber = host.queue('test_requeueing', {durable: false})
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
    let requeues = 0
    subscriber.subscribe({noAck: false})
      .each(msg => {
        if (requeues <= 1) {
          listener(msg.string())
          msg.nack(false, true)
          requeues++
        }
      })

    return wait(50)
      .then(() => Promise.all([
        publisher.publish('hello')
      ]))
      .then(() => wait(50))
      .then(() => {
        expect(listener)
          .calledTwice
          .calledWith('hello')
      })
  })
  describe('Requeues messages with no args passed', () => {
    let publisher, subscriber
    beforeEach(() => {
      publisher = host.queue('test_noargs', {durable: false})
      subscriber = host.queue('test_noargs', {durable: false})
    })
    afterEach(() => {
      return Promise
        .all([
          publisher.delete(),
          subscriber.delete()
        ])
    })
    it('also defaults to this behaviour if no args are passed', () => {
      const listener = spy()
      let requeues = 0
      subscriber.subscribe({noAck: false})
        .each(msg => {
          if (requeues <= 1) {
            listener(msg.string())
            msg.nack()
            requeues++
          }
        })

      return wait(50)
        .then(() => Promise.all([
          publisher.publish('hello')
        ]))
        .then(() => wait(50))
        .then(() => {
          expect(listener)
            .calledTwice
            .calledWith('hello')
        })
    })
  })
  describe('Nack without requeuing', () => {
    let publisher, subscriber
    beforeEach(() => {
      publisher = host.queue('test_norequeue', {durable: false})
      subscriber = host.queue('test_norequeue', {durable: false})
    })
    afterEach(() => {
      return Promise
        .all([
          publisher.delete(),
          subscriber.delete()
        ])
    })
    it('does not requeue if arg is passed as false', () => {
      const listener = spy()
      subscriber.subscribe({noAck: false})
        .each(msg => {
          listener(msg.string())
          msg.nack(false, false)
        })

      return wait(50)
        .then(() => Promise.all([
          publisher.publish('hello')
        ]))
        .then(() => wait(50))
        .then(() => {
          expect(listener)
            .calledOnce
            .calledWith('hello')
        })
    })
  })
})
