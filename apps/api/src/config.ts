import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4000),
  API_BODY_LIMIT_BYTES: z.coerce.number().default(50 * 1024 * 1024),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  AUTH_EMAIL: z.string().email().default('demo@cogtree.local'),
  AUTH_PASSWORD: z.string().min(1).default('demo-password'),
  AUTH_DISPLAY_NAME: z.string().min(1).default('CogTree Demo'),
})

export const config = envSchema.parse(process.env)
