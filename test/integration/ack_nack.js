describe('Ack/Nack with reconnect', function () {
  let publisher, subscriber
  beforeEach(() => {
    publisher = host.queue('test_ack_nack', {durable: false})
    subscriber = host.queue('test_ack_nack', {durable: false})
  })
  afterEach(() => {
    return Promise
      .all([
        publisher.delete(),
        subscriber.delete()
      ])
  })
  it('reconnects for ack', (done) => {
    publisher.publish('hello')

    subscriber
      .subscribe({noAck: false})
      .take(1)
      .each(msg => {
        subscriber.ctx.connection
          .close()
          .then(() => {
            msg
              .ack()
              .then(() => wait(50).then(() => done()))
              .catch(err => {
                try {
                  expect(err).to.not.exist
                } catch (err2) {
                  done(err2)
                }
              })
          })
      })
  })
  it('reconnects for nack', (done) => {
    publisher.publish('hello')

    subscriber
      .subscribe({noAck: false})
      .take(1)
      .each(msg => {
        subscriber.ctx.connection
          .close()
          .then(() => {
            msg
              .nack()
              .then(() => wait(50).then(() => done()))
              .catch(err => {
                try {
                  expect(err).to.not.exist
                } catch (err2) {
                  done(err2)
                }
              })
          })
      })
  })
})
