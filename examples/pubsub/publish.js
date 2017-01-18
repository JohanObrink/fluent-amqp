const amqp = require('fluent-amqp')
const ex = 'logs'
const exchangeType = 'fanout'
const message = process.argv.slice(2).join(' ') || 'Hello World!'

amqp('amqp://localhost')
  .exchange(ex, exchangeType, {durable: false})
  .publish(message)
  .then(() => console.log(` [x] Sent '${message}'`))
  .then(() => {
    setTimeout(() => process.exit(0), 500)
  })
