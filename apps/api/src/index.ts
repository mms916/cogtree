import 'dotenv/config'

import { createApp } from './app.js'
import { config } from './config.js'

const app = createApp()

app
  .listen({ host: '0.0.0.0', port: config.PORT })
  .then(() => {
    app.log.info(`API server running at http://localhost:${config.PORT}`)
  })
  .catch((error) => {
    app.log.error(error)
    process.exit(1)
  })
