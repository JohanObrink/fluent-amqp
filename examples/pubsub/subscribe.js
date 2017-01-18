const amqp = require('fluent-amqp')
const ex = 'logs'
const exchangeType = 'fanout'
const q = process.argv[2] || ''   // name of listener queue passed in as arg
const exclusive = !q              // if name is set, set queue to non exclusive - ie. does not die with connection

amqp('amqp://localhost')
  .exchange(ex, exchangeType, {durable: false})
  .queue(q, {exclusive})
  .subscribe()
  .each(msg => {
    console.log(` [x] Received '${msg.string()}'`)
    msg.ack()
  })
