import pino from "pino";

export const logger = pino({
  level: process.env.PINO_LOG_LEVEL || 'trace',
  bindings: () => {
    return {
      node_version: process.version,
    };
  },
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  transport: {
    target: 'pino/file',
    options: { destination: 'app.log' },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});