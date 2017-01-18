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
  .each(msg => console.log(` [x] Received ${msg.string()}`))
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

// recieve
amqp('amqp://localhost')
  .queue(q, {durable: true})
  .subscribe({prefetch: 1})
  .each(msg => {
    console.log(` [x] Received ${msg.string()}`)
    msg.ack()
  })
```