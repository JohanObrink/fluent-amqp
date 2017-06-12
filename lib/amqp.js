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

function getConnection (options, wait = 500, index = 0) {
  if (!connections[options.connection]) {
    if (Array.isArray(options.url)) {
      options.connection = options.url[index]
    } else {
      options.connection = options.url
    }

    logger.debug(`amqp.connect('${options.connection}')`)
    connections[options.connection] = connect(options.connection)
      .then(connection => {
        connection.once('error', (err) => {
          logger.warn(err)
        })
        connection.once('close', () => {
          connections[options.connection] = null
          options.connected = false
        })
        options.connected = true
        return connection
      })
      .catch(err => {
        connections[options.connection] = null
        options.connected = false
        logger.warn(err)
        return timeout(wait)
          .then(() => getConnection(options, Math.min(wait * 2, MAX_TIMEOUT), (index >= options.url.length - 1) ? 0 : index + 1))
      })
  }
  return connections[options.connection]
}

function createContext (options) {
  const key = JSON.stringify(options)
  if (!contexts[key]) {
    contexts[key] = getConnection(options)
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
  if (!this.options || !this.options.connection || !connections[this.options.connection]) {
    return Promise.resolve()
  } else {
    logger.debug(`connection.close()`)
    return connections[this.options.connection]
      .then(connection => {
        connection.removeAllListeners('close')
        connection.removeAllListeners('error')
        connection.once('close', () => {
          logger.debug(`connection closed`)
        })
        return connection
          .close()
          .catch(() => {})
          .then(() => {
            connections[this.options.connection] = null
            this.options.connected = true
          })
      })
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
  if (!this.ctx || !this.ctx.channel || !this.ctx.queue) {
    return Promise.resolve()
  } else {
    logger.debug(`channel.deleteQueue('${this.ctx.queue}')`)
    return this.ctx.channel.deleteQueue(this.ctx.queue)
  }
}

function host (url) {
  const options = {url}
  return {
    options,
    exchange,
    queue,
    close: closeConnection,
    connect: () => getConnection(options)
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

function publish (msg, topic = '', opts = {}) {
  const {options} = this

  if (topic && topic instanceof Object) {
    opts = topic
    topic = ''
  }

  return createContext(options)
    .then(ctx => {
      this.ctx = ctx

      if (ctx.exchangeName) {
        logger.debug(`channel.publish('${ctx.exchangeName}', '${topic}', '${msg}')`)
        return ctx.channel.publish(ctx.exchangeName, topic, serialize(msg), opts)
      } else {
        logger.debug(`channel.sendToQueue('${ctx.queueName}', '${msg}', ${JSON.stringify(options)})`)
        return ctx.channel.sendToQueue(ctx.queueName, serialize(msg), opts)
      }
    })
}

function createStreamingContext (consumer, options, stream) {
  createContext(options)
    .then(ctx => {
      consumer.ctx = ctx
      ctx.connection.once('close', () => console.log('reconnect') || createStreamingContext(consumer, options, stream))

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

  if (!this.stream) {
    this.stream = _((push, next) => {
      this.stream.push = push
      this.stream.next = next
    })
  }
  if (!this.ctx) {
    this.ctx = 'pending'
    createStreamingContext(this, options, this.stream)
  }
  return this.stream
}

module.exports = host
