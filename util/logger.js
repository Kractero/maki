import pino from 'pino'

export const logger = pino({
  level: process.env.PINO_LOG_LEVEL || 'trace',
  bindings: () => {
    return {
      node_version: process.version,
    }
  },
  transport: {
    targets: [
      { level: 'info', target: 'pino/file', options: { destination: 'app.log' } },
      { level: 'error', target: 'pino/file', options: { destination: 'error.log' } },
      {
        target: 'pino/file',
        options: { destination: 1 },
      },
    ],
  },
})
