# fluent-amqp
Fluent syntax for amqp (Rabbit MQ) with (highland) streaming messages and automatic reconnect.

## Install
```bash
npm install --save fluent-amqp
```

## Use

The code examples here show how to implement the tutorials on https://www.rabbitmq.com using `fluent-amqp`

### 1 "Hello World"

[https://www.rabbitmq.com/tutorials/tutorial-five-javascript.html](https://www.rabbitmq.com/tutorials/tutorial-five-javascript.html)

```javascript
const amqp = require('fluent-amqp')
const q = 'hello'
const message = 'Hello World!'

// send
amqp('amqp://localhost')
  .queue(q, {durable: false})
  .publish(message)
  .then(() => console.log(` [x] Sent '${message}'`))

// recieve
amqp('amqp://localhost')
  .queue(q, {durable: false})
  .subscribe()
  .each(msg => console.log(` [x] Received '${msg.string()}'`))
```

#### ...with JSON

```javascript
const amqp = require('fluent-amqp')
const q = 'hello'
const message = {some: 'payload'}

// send
amqp('amqp://localhost')
  .queue(q, {durable: false})
  .publish(message)
  .then(() => console.log(` [x] Sent '${message}'`))

// recieve
amqp('amqp://localhost')
  .queue(q, {durable: false})
  .subscribe()
  .each(msg => console.log(' [x] Received', msg.json()))
```

### 2 Work queues

[https://www.rabbitmq.com/tutorials/tutorial-two-javascript.html](https://www.rabbitmq.com/tutorials/tutorial-two-javascript.html)

```javascript
const amqp = require('fluent-amqp')
const q = 'task_queue'
const message = 'Hello World!'

// send
amqp('amqp://localhost')
  .queue(q, {durable: true})
  .publish(message, {persistent: true})
  .then(() => console.log(` [x] Sent '${message}'`))

// worker
amqp('amqp://localhost')
  .queue(q, {durable: true})
  .subscribe({prefetch: 1, noAck: false})
  .each(msg => {
    console.log(` [x] Received '${msg.string()}'`)
    msg.ack()
  })
```

### 3 Publish/Subscribe

[https://www.rabbitmq.com/tutorials/tutorial-three-javascript.html](https://www.rabbitmq.com/tutorials/tutorial-three-javascript.html)

```javascript
const amqp = require('fluent-amqp')
const ex = 'logs'
const exchangeType = 'fanout'
const message = 'Hello World!'

// publish
amqp('amqp://localhost')
  .exchange(ex, exchangeType, {durable: false})
  .publish(message)
  .then(() => console.log(` [x] Sent '${message}'`))

// subscribe
amqp('amqp://localhost')
  .exchange(ex, exchangeType, {durable: false})
  .queue(q, {durable: true})
  .subscribe()
  .each(msg => {
    console.log(` [x] Received '${msg.string()}'`)
    msg.ack()
  })
```

### 4 Routing

[https://www.rabbitmq.com/tutorials/tutorial-four-javascript.html](https://www.rabbitmq.com/tutorials/tutorial-four-javascript.html)

```javascript
const amqp = require('fluent-amqp')
const ex = 'direct_logs'
const exchangeType = 'direct'
const message = 'Hello World!'
const severity = 'info'

// send
amqp('amqp://localhost')
  .exchange(ex, exchangeType, {durable: false})
  .publish(message, severity)
  .then(() => console.log(` [x] Sent '${message}'`))

// recieve
amqp('amqp://localhost')
  .exchange(ex, exchangeType, {durable: false})
  .queue()
  .subscribe([severity])
  .each(msg => {
    console.log(` [x] Received [${msg.fields.routingKey}] '${msg.string()}'`)
    msg.ack()
  })
```

### 5 Topics

[https://www.rabbitmq.com/tutorials/tutorial-five-javascript.html](https://www.rabbitmq.com/tutorials/tutorial-five-javascript.html)

```javascript
const amqp = require('fluent-amqp')
const ex = 'topic_logs'
const exchangeType = 'topic'
const message = 'Hello World!'
const topic = 'anonymous.info'

// send
amqp('amqp://localhost')
  .exchange(ex, exchangeType, {durable: false})
  .publish(message, topic)
  .then(() => console.log(` [x] Sent '${message}'`))

// recieve
amqp('amqp://localhost')
  .exchange(ex, exchangeType, {durable: false})
  .queue()
  .subscribe(['anonymous.*'])
  .each(msg => {
    console.log(` [x] Received [${msg.fields.routingKey}] '${msg.string()}'`)
    msg.ack()
  })
```

### 6 RPC

[https://www.rabbitmq.com/tutorials/tutorial-six-javascript.html](https://www.rabbitmq.com/tutorials/tutorial-six-javascript.html)

Coming later...

### Connecting to a cluster

If you are using a cluster and want the client to iterate between the different servers as soon as one fails or becomes unresponsive,
just add them as an array.

```javascript
amqp(['amqp://host1', 'amqp://host2', 'amqp://host3'])
```

### Piping

You can pipe messages from one Highland stream to rabbit using:

```javascript
const events = _(['event 1', 'event 2', 'event 3'])
const queue = amqp(url).queue('events', {durable: true})
events.pipe(queue)
```
