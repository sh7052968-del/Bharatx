# ConnectX Enterprise Production Deployment & Launch Guide

This document provides the complete end-to-end production deployment guide, cloud infrastructure requirements, hosting instructions, domain configuration, monitoring, disaster recovery, and production launch checklist for ConnectX.

---

## 1. Server & Cloud Infrastructure Requirements

### Minimum Production Hardware Sizing
- **API Application Node (Node.js/NestJS)**: 2 vCPUs, 4 GB RAM, 40 GB SSD.
- **PostgreSQL Database Node**: 4 vCPUs, 8 GB RAM, 100 GB NVMe SSD with automated daily EBS/disk snapshots.
- **Redis Cache & Pub/Sub Node**: 2 vCPUs, 4 GB RAM (AOF persistence enabled).
- **RabbitMQ Enterprise Message Broker**: 2 vCPUs, 4 GB RAM.
- **TURN/STUN Signaling Server (Coturn)**: 1 vCPU, 2 GB RAM with public UDP port range (3478, 49152-65535).

---

## 2. Environment Variable Templates (`backend/.env.production`)

Never commit production secrets to source control. Use managed secret storage (AWS Secrets Manager, GCP Secret Manager, or HashiCorp Vault) and inject environment variables securely at runtime.

```env
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://app.connectx.com,https://admin.connectx.com
COOKIE_SECRET=generate_random_64_char_hex_string
JWT_ACCESS_SECRET=generate_random_64_char_hex_string
JWT_REFRESH_SECRET=generate_random_64_char_hex_string
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
ENCRYPTION_MASTER_KEY=generate_random_32_byte_base64_string
DATABASE_URL=postgresql://connectx_prod:secure_password@postgres-cluster.internal:5432/connectx?schema=public&sslmode=require
REDIS_URL=redis://:redis_password@redis-cluster.internal:6379
RABBITMQ_URL=amqp://connectx_rabbit:rabbit_password@rabbitmq-cluster.internal:5672
UPLOAD_DIR=/app/uploads
MAX_UPLOAD_BYTES=52428800
STUN_URL=stun:turn.connectx.com:3478
TURN_URL=turn:turn.connectx.com:3478
TURN_SECRET=secure_turn_auth_secret
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
SMTP_FROM=noreply@connectx.com
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
BOOTSTRAP_SUPER_ADMIN_EMAIL=admin@connectx.com
```

---

## 3. Production Deployment Architecture & Dockerfiles

The backend uses a multi-stage Dockerfile (`backend/Dockerfile`) optimized for Alpine Linux:
- **Builder stage**: Compiles TypeScript using NestJS CLI and generates Prisma client.
- **Runner stage**: Lightweight production image running under a non-root `node` user with automated database migrations (`prisma migrate deploy`).

---

## 4. NGINX Reverse Proxy & TLS Setup

NGINX (`backend/nginx/nginx.conf`) acts as the secure TLS termination proxy, handling HTTP/2, WebSocket upgrades for Socket.IO, security headers (HSTS, CSP, X-Frame-Options), and rate limiting.

### TLS Setup with Let's Encrypt (Certbot)
```bash
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d app.connectx.com -d admin.connectx.com
```

---

## 5. Database Migration & Restoration Procedures

### Database Migration Deployment
Run migrations during CI/CD pipeline or deployment initialization:
```bash
npx prisma migrate deploy
```

### Automated Backups Script (`/opt/connectx/backup.sh`)
```bash
#!/bin/bash
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/var/backups/connectx"
mkdir -p $BACKUP_DIR
pg_dump -U connectx -h postgres-cluster.internal connectx > "$BACKUP_DIR/connectx_$TIMESTAMP.sql"
gzip "$BACKUP_DIR/connectx_$TIMESTAMP.sql"
# Upload to S3-compatible object storage
aws s3 cp "$BACKUP_DIR/connectx_$TIMESTAMP.sql.gz" s3://connectx-backup-bucket/database/
find $BACKUP_DIR -type f -mtime +7 -delete
```

### Database Restoration Procedure
```bash
gunzip < /var/backups/connectx/connectx_YYYYMMDD_HHMMSS.sql.gz | psql -U connectx -h postgres-cluster.internal connectx
```

---

## 6. Redis & RabbitMQ Persistence Configuration

- **Redis**: Configured with append-only file persistence (`--appendonly yes`) in `docker-compose.yml` to guarantee zero message queue loss on restart.
- **RabbitMQ**: Persistent exchanges and message queues with durable acknowledgments (`QUEUE_MESSAGE_DELIVERY`).

---

## 7. Health Checks, Monitoring & Centralized Logs

- **Health Check Endpoint**: `GET /api/v1/system/health` verifies PostgreSQL connectivity, Redis ping, RabbitMQ status, and disk storage.
- **Prometheus & Grafana**: Scrapes metrics from `/metrics` and Redis/Postgres exporters.
- **Structured Logging**: NestJS structured JSON logging piped to CloudWatch / Datadog / ELK stack.

---

## 8. CI/CD Pipeline (GitHub Actions `.github/workflows/deploy.yml`)

```yaml
name: ConnectX Production CI/CD
on:
  push:
    branches: [ main ]
jobs:
  test-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Use Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Install dependencies & Test
        run: |
          cd backend
          npm ci
          npm test
      - name: Build and Push Docker Image
        run: |
          docker build -t registry.connectx.com/connectx-backend:latest ./backend
          docker push registry.connectx.com/connectx-backend:latest
      - name: Deploy to Kubernetes Cluster
        run: |
          kubectl rollout restart deployment/connectx-backend
```

---

## 9. Deployment Rollback & Disaster Recovery

### Rollback Procedure
If a deployment regression occurs:
```bash
kubectl rollout undo deployment/connectx-backend
```

### Disaster Recovery RPO & RTO
- **RPO (Recovery Point Objective)**: < 1 hour (via hourly automated database snapshots and transaction logs).
- **RTO (Recovery Time Objective)**: < 30 minutes (via automated Kubernetes cluster redeployment and S3 database restoration).

---

## 10. Production Launch Checklist

- [ ] Domain names (`connectx.com`, `api.connectx.com`) DNS configured with Cloudflare proxy/WAF.
- [ ] TLS certificates generated and verified via Certbot.
- [ ] Production environment variables injected securely (Zero secrets in code).
- [ ] PostgreSQL backups tested and restoration verified.
- [ ] Redis AOF persistence and RabbitMQ durability verified.
- [ ] Rate limiting and CORS restrictions verified.
- [ ] Health check endpoint returning `200 OK` across all service dependencies.
- [ ] Monitoring dashboards and alerting rules active in Grafana.
