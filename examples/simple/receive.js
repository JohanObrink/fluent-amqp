const amqp = require('fluent-amqp')
const q = 'hello'

amqp('amqp://localhost')
  .queue(q, {durable: false})
  .subscribe()
  .each(msg => console.log(` [x] Received '${msg.string()}'`))
