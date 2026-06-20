/**
 * Environment configuration with safe development defaults.
 *
 * Every value resolves to something that works out of the box so the gateway runs with
 * zero setup, while still being overridable via environment variables for deployment.
 */
import process from 'node:process';

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  mlServiceUrl: process.env.ML_SERVICE_URL ?? 'http://localhost:8000',
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  accessTokenTtlMin: Number(process.env.ACCESS_TOKEN_TTL_MIN ?? 15),
  refreshTokenTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 7),
  jwtPrivateKeyPath: process.env.JWT_PRIVATE_KEY_PATH ?? './keys/jwt_private.pem',
  jwtPublicKeyPath: process.env.JWT_PUBLIC_KEY_PATH ?? './keys/jwt_public.pem',
};

export const isProd = env.nodeEnv === 'production';
