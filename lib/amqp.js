const {connect} = require('amqplib')
const _ = require('highland')
const connections = {}
const contexts = {}

const MAX_TIMEOUT = 5000

const logLevels = {
  'none': 0,
  'error': 1,
  'warn': 2,
  'info': 3,
  'debug': 4
}
let logLevel = logLevels[process.env.LOG_LEVEL]
if (logLevel === undefined) {
  logLevel = logLevels.error
}

const logger = {
  debug: (...args) => {
    if (logLevel < logLevels.debug) {
      return
    }
    console.log(...args)
  },
  info: (...args) => {
    if (logLevel < logLevels.info) {
      return
    }
    console.log(...args)
  },
  warn: (...args) => {
    if (logLevel < logLevels.warn) {
      return
    }
    args = args.map(a => {
      return a instanceof Error ? a.toString() : a
    })
    console.warn(...args)
  },
  error: (...args) => {
    if (logLevel < logLevels.error) {
      return
    }
    console.error(...args)
  }
}

function timeout (delay = 0) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve()
    }, delay)
  })
}

function getConnection (url, wait = 500) {
  if (!connections[url]) {
    logger.debug(`amqp.connect('${url}')`)
    connections[url] = connect(url)
      .then(connection => {
        connection.once('error', (err) => {
          logger.warn(err)
        })
        connection.once('close', () => {
          connections[url] = null
        })
        return connection
      })
      .catch(err => {
        connections[url] = null
        logger.warn(err)
        return timeout(wait)
          .then(() => getConnection(url, Math.min(wait * 2, MAX_TIMEOUT)))
      })
  }
  return connections[url]
}

function createContext (options) {
  const key = JSON.stringify(options)
  if (!contexts[key]) {
    contexts[key] = getConnection(options.url)
      .then(connection => logger.debug('connection.createChannel()') || connection.createChannel()
        .then(channel => {
          connection.once('close', () => {
            contexts[key] = null
          })
          const context = {connection, channel}
          if (options.exchangeName) {
            context.exchangeName = options.exchangeName
            logger.debug(`channel.assertExchange('${options.exchangeName}', '${options.exchangeType}', ${JSON.stringify(options.exchangeOptions)})`)
            channel.assertExchange(options.exchangeName, options.exchangeType, options.exchangeOptions)
          }
          if (options.queueOptions) {
            context.queueName = options.queueName
            logger.debug(`channel.assertQueue('${options.queueName}', ${JSON.stringify(options.queueOptions)})`)
            return channel
              .assertQueue(options.queueName, options.queueOptions)
              .then(({queue}) => Object.assign(context, {queue}))
          }
          return context
        })
      )
  }
  return contexts[key]
}

function serialize (msg) {
  if (msg instanceof Buffer) {
    return msg
  } else if (typeof msg === 'string') {
    return Buffer.from(msg)
  } else {
    return Buffer.from(JSON.stringify(msg))
  }
}

function closeConnection () {
  if (!this.ctx || !this.ctx.connection) {
    return Promise.resolve()
  } else {
    logger.debug(`connection.close()`)
    return this.ctx.connection.close()
  }
}

function deleteExchange () {
  if (!this.ctx || !this.ctx.channel || !this.ctx.exchangeName) {
    return Promise.resolve()
  } else {
    logger.debug(`channel.deleteExchange('${this.ctx.exchangeName}')`)
    return this.ctx.channel.deleteExchange(this.ctx.exchangeName)
  }
}

function deleteQueue () {
  if (!this.ctx || !this.ctx.channel || !this.ctx.queueName) {
    return Promise.resolve()
  } else {
    logger.debug(`channel.deleteQueue('${this.ctx.queueName}')`)
    return this.ctx.channel.deleteQueue(this.ctx.queueName)
  }
}

function host (url) {
  const options = {url}
  return {
    options,
    exchange,
    queue,
    close: closeConnection,
    connect: () => getConnection(url)
  }
}

function exchange (exchangeName, exchangeType, exchangeOptions) {
  const options = Object.assign({exchangeName, exchangeType, exchangeOptions}, this.options)
  return {options, queue, publish, delete: deleteExchange}
}

function queue (queueName, queueOptions = {exclusive: !queueName}) {
  const options = Object.assign({queueName, queueOptions}, this.options)
  return {options, publish, subscribe, delete: deleteQueue}
}

function publish (msg, topicOrOptions) {
  const {options} = this

  return createContext(options)
    .then(ctx => {
      this.ctx = ctx

      if (ctx.exchangeName) {
        const topic = topicOrOptions || ''
        logger.debug(`channel.publish('${ctx.exchangeName}', '${topic}', '${msg}')`)
        return ctx.channel.publish(ctx.exchangeName, topic, serialize(msg))
      } else {
        const options = topicOrOptions || {}
        logger.debug(`channel.sendToQueue('${ctx.queueName}', '${msg}', ${JSON.stringify(options)})`)
        return ctx.channel.sendToQueue(ctx.queueName, serialize(msg), options)
      }
    })
}

function createStreamingContext (consumer, options, stream) {
  createContext(options)
    .then(ctx => {
      consumer.ctx = ctx
      ctx.connection.once('close', () => createStreamingContext(consumer, options, stream))

      if (ctx.exchangeName) {
        let bindTo
        if (options.consumeTopics instanceof Array) {
          bindTo = options.consumeTopics
        } else if (typeof options.consumeTopics === 'string') {
          bindTo = [options.consumeTopics]
        } else {
          bindTo = ['']
        }
        bindTo
          .forEach(topic => {
            logger.debug(`channel.bindQueue('${ctx.queue}', '${ctx.exchangeName}', '${topic}')`)
            ctx.channel.bindQueue(ctx.queue, ctx.exchangeName, topic)
          })
      }

      logger.debug(`channel.consume('${ctx.queueName}')`)
      ctx.channel.consume(ctx.queueName, (msg) => {
        if (!msg && stream.next) {
          stream.next([])
        } else if (stream.push) {
          stream.push(null, Object.assign(msg, {
            string: () => msg.content.toString(),
            json: () => JSON.parse(msg.content.toString()),
            number: () => parseFloat(msg.content.toString()),
            ack: () => ctx.channel.ack(msg),
            nack: () => ctx.channel.nack(msg)
          }))
        }
      }, options.consumeOptions)
    })
}

function subscribe (consumeOptions = {noAck: true}, consumeTopics = '') {
  if (consumeOptions instanceof Array || typeof consumeOptions === 'string') {
    consumeTopics = consumeOptions
    consumeOptions = {}
  }
  const options = Object.assign({consumeOptions, consumeTopics}, this.options)

  if (!this.ctx) {
    this.ctx = 'pending'
    this.stream = _((push, next) => {
      this.stream.push = push
      this.stream.next = next
    })
    createStreamingContext(this, options, this.stream)
  }
  return this.stream
}

module.exports = host
