import * as crypto from 'crypto';

export interface ConnectXConfig {
  nodeEnv: string;
  port: number;
  corsOrigins: string[];
  cookieSecret: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessExpiresIn: string;
  jwtRefreshExpiresIn: string;
  encryptionMasterKey: Buffer;
  databaseUrl: string;
  redisUrl: string;
  rabbitmqUrl: string;
  uploadDir: string;
  maxUploadBytes: number;
  stunUrl: string;
  turnUrl: string;
  turnSecret: string;
  turnCredentialTtlSec: number;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  vapidSubject: string;
  vapidPublicKey: string;
  vapidPrivateKey: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  bootstrapSuperAdminEmail: string;
}

const EPHEMERAL_ACCESS_SECRET = crypto.randomBytes(32).toString('hex');
const EPHEMERAL_REFRESH_SECRET = crypto.randomBytes(32).toString('hex');
const EPHEMERAL_COOKIE_SECRET = crypto.randomBytes(32).toString('hex');
const EPHEMERAL_ENCRYPTION_KEY = crypto.randomBytes(32);

export function loadConfig(): ConnectXConfig {
  const rawCors = (process.env.CORS_ORIGIN || 'http://localhost:3001')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const rawMasterKey = process.env.ENCRYPTION_MASTER_KEY?.trim();
  const encryptionMasterKey =
    rawMasterKey && rawMasterKey.length >= 32
      ? crypto.createHash('sha256').update(rawMasterKey).digest()
      : EPHEMERAL_ENCRYPTION_KEY;

  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
    corsOrigins: rawCors,
    cookieSecret: process.env.COOKIE_SECRET?.trim() || EPHEMERAL_COOKIE_SECRET,
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET?.trim() || EPHEMERAL_ACCESS_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET?.trim() || EPHEMERAL_REFRESH_SECRET,
    jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    encryptionMasterKey,
    databaseUrl: process.env.DATABASE_URL || '',
    redisUrl: process.env.REDIS_URL || '',
    rabbitmqUrl: process.env.RABBITMQ_URL || '',
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    maxUploadBytes: parseInt(process.env.MAX_UPLOAD_BYTES || '26214400', 10),
    stunUrl: process.env.STUN_URL || 'stun:stun.l.google.com:19302',
    turnUrl: process.env.TURN_URL?.trim() || '',
    turnSecret: process.env.TURN_SECRET?.trim() || '',
    turnCredentialTtlSec: parseInt(process.env.TURN_CREDENTIAL_TTL_SEC || '3600', 10),
    smtpHost: process.env.SMTP_HOST?.trim() || '',
    smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
    smtpUser: process.env.SMTP_USER?.trim() || '',
    smtpPass: process.env.SMTP_PASS?.trim() || '',
    smtpFrom: process.env.SMTP_FROM?.trim() || '',
    vapidSubject: process.env.VAPID_SUBJECT?.trim() || '',
    vapidPublicKey: process.env.VAPID_PUBLIC_KEY?.trim() || '',
    vapidPrivateKey: process.env.VAPID_PRIVATE_KEY?.trim() || '',
    stripeSecretKey: process.env.STRIPE_SECRET_KEY?.trim() || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || '',
    bootstrapSuperAdminEmail: (process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL || '').trim().toLowerCase(),
  };
}
