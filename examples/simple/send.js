const amqp = require('fluent-amqp')
const q = 'hello'
const message = process.argv.slice(2).join(' ') || 'Hello World!' // passed in as args

amqp('amqp://localhost')
  .queue(q, {durable: false})
  .publish(message)
  .then(() => console.log(` [x] Sent '${message}'`))
  .then(() => {
    setTimeout(() => process.exit(0), 500)
  })
