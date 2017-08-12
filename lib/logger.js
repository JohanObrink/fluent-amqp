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

module.exports = logger
