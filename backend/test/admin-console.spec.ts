import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApprovalStatus, UserRole } from '@prisma/client';
import * as crypto from 'crypto';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

function createAdminTestPrismaMock() {
  const users = new Map<string, any>();
  const sessions = new Map<string, any>();
  const roles = new Map<string, any>();
  const auditLogs: any[] = [];
  const modules = new Map<string, any>([
    ['messaging_e2ee', { id: 'mod-1', key: 'messaging_e2ee', name: 'E2EE Messaging', version: '1.0.0', enabled: true, settingsJson: {}, parents: [] }],
  ]);
  const flags = new Map<string, any>([
    ['e2ee_private_chats', { id: 'flag-1', key: 'e2ee_private_chats', enabled: true, rolloutPercent: 100, description: 'E2EE', eligibilityJson: null }],
  ]);
  const configs = new Map<string, any>();
  const plans = new Map<string, any>();
  const reports = new Map<string, any>([
    [
      'rep-1',
      {
        id: 'rep-1',
        reporterId: 'u-mod',
        targetUserId: 'u-target',
        targetType: 'USER',
        reason: 'Spam behavior',
        status: 'OPEN',
        createdAt: new Date(),
        reporter: { id: 'u-mod', email: 'mod@connectx.local', displayName: 'Moderator' },
        targetUser: { id: 'u-target', email: 'user@connectx.local', displayName: 'User', suspended: false, bannedAt: null },
      },
    ],
  ]);
  const releases = new Map<string, any>();
  const approvals = new Map<string, any>();

  const mock: any = {
    $connect: jest.fn(async () => undefined),
    $disconnect: jest.fn(async () => undefined),
    $queryRaw: jest.fn(async () => [{ '?column?': 1 }]),
    $transaction: jest.fn(async (arg: any) => (typeof arg === 'function' ? arg(mock) : Promise.all(arg))),
    user: {
      findFirst: jest.fn(async ({ where }: any) => {
        const list = Array.from(users.values());
        if (where?.OR) {
          return list.find((u) => where.OR.some((c: any) => c.email === u.email || c.username === u.username)) ?? null;
        }
        return null;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.id) return users.get(where.id) ?? null;
        if (where.email) return Array.from(users.values()).find((u) => u.email === where.email) ?? null;
        return null;
      }),
      findMany: jest.fn(async () => Array.from(users.values())),
      count: jest.fn(async () => users.size),
      create: jest.fn(async ({ data }: any) => {
        const u = { id: data.id ?? crypto.randomUUID(), ...data, suspended: false, bannedAt: null, mfaEnabled: false, createdAt: new Date() };
        users.set(u.id, u);
        return u;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const u = users.get(where.id);
        Object.assign(u, data);
        return u;
      }),
    },
    adminUser: {
      upsert: jest.fn(async ({ where, create }: any) => ({ id: crypto.randomUUID(), userId: where.userId, ...create })),
      create: jest.fn(async ({ data }: any) => ({ id: crypto.randomUUID(), ...data })),
      deleteMany: jest.fn(async () => ({ count: 1 })),
    },
    adminUserRole: { upsert: jest.fn(async () => ({})), create: jest.fn(async () => ({})) },
    notificationPreference: { create: jest.fn(async ({ data }: any) => data) },
    deviceSession: {
      create: jest.fn(async ({ data }: any) => {
        const s = { ...data, createdAt: new Date(), revokedAt: null };
        sessions.set(data.id, s);
        return s;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        const s = sessions.get(where.id);
        if (!s) return null;
        const user = users.get(s.userId);
        return { ...s, user: { ...user, customRole: null, adminUser: null } };
      }),
      findMany: jest.fn(async () => Array.from(sessions.values())),
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
    message: { count: jest.fn(async () => 42) },
    group: { count: jest.fn(async () => 3) },
    businessProfile: { count: jest.fn(async () => 2), findMany: jest.fn(async () => []) },
    callSession: { count: jest.fn(async () => 5) },
    mediaObject: { aggregate: jest.fn(async () => ({ _sum: { sizeBytes: 102400 }, _count: { id: 4 } })) },
    abuseReport: {
      count: jest.fn(async () => 1),
      findMany: jest.fn(async () => Array.from(reports.values())),
      findUnique: jest.fn(async ({ where }: any) => reports.get(where.id) ?? null),
      update: jest.fn(async ({ where, data }: any) => {
        const r = reports.get(where.id);
        Object.assign(r, data);
        return r;
      }),
    },
    approvalWorkflow: {
      count: jest.fn(async () => 0),
      findMany: jest.fn(async () => Array.from(approvals.values())),
      create: jest.fn(async ({ data }: any) => {
        const a = { id: crypto.randomUUID(), ...data, createdAt: new Date() };
        approvals.set(a.id, a);
        return a;
      }),
    },
    adminAuditLog: {
      findFirst: jest.fn(async () => auditLogs[0] ?? null),
      create: jest.fn(async ({ data }: any) => {
        const entry = { id: crypto.randomUUID(), ...data, createdAt: new Date() };
        auditLogs.unshift(entry);
        return entry;
      }),
      findMany: jest.fn(async () => auditLogs),
      count: jest.fn(async () => auditLogs.length),
    },
    customAdminRole: {
      create: jest.fn(async ({ data }: any) => {
        const r = { id: crypto.randomUUID(), ...data, createdAt: new Date() };
        roles.set(r.id, r);
        return r;
      }),
      findMany: jest.fn(async () => Array.from(roles.values())),
    },
    adminPermission: { findMany: jest.fn(async () => []) },
    featureModule: {
      findMany: jest.fn(async () => Array.from(modules.values())),
      findUnique: jest.fn(async ({ where }: any) => modules.get(where.key) ?? null),
      update: jest.fn(async ({ where, data }: any) => {
        const m = modules.get(where.key);
        Object.assign(m, data);
        return m;
      }),
    },
    featureFlag: {
      findMany: jest.fn(async () => Array.from(flags.values())),
      findUnique: jest.fn(async ({ where }: any) => flags.get(where.key) ?? null),
      upsert: jest.fn(async ({ where, update, create }: any) => {
        const existing = flags.get(where.key);
        const next = existing ? { ...existing, ...update } : { id: crypto.randomUUID(), ...create };
        flags.set(where.key, next);
        return next;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const f = flags.get(where.key);
        Object.assign(f, data);
        return f;
      }),
    },
    featureDependency: { findMany: jest.fn(async () => []), deleteMany: jest.fn(async () => ({})) },
    systemConfig: {
      findUnique: jest.fn(async ({ where }: any) => configs.get(where.key) ?? null),
      findMany: jest.fn(async () => Array.from(configs.values())),
      upsert: jest.fn(async ({ where, update, create }: any) => {
        const val = { id: crypto.randomUUID(), key: where.key, ...(configs.has(where.key) ? update : create) };
        configs.set(where.key, val);
        return val;
      }),
    },
    subscriptionPlan: {
      findMany: jest.fn(async () => Array.from(plans.values())),
      upsert: jest.fn(async ({ where, update, create }: any) => {
        const p = plans.has(where.code)
          ? { ...plans.get(where.code), ...update }
          : { id: crypto.randomUUID(), ...create };
        plans.set(where.code, p);
        return p;
      }),
    },
    businessSubscription: { findMany: jest.fn(async () => []), groupBy: jest.fn(async () => []) },
    paymentTransaction: {
      findMany: jest.fn(async () => []),
      aggregate: jest.fn(async () => ({ _sum: { amountCents: 0 }, _count: { id: 0 } })),
    },
    invoice: { findMany: jest.fn(async () => []) },
    refundRequest: { findMany: jest.fn(async () => []) },
    appRelease: {
      findMany: jest.fn(async () => Array.from(releases.values())),
      create: jest.fn(async ({ data }: any) => {
        const r = { id: crypto.randomUUID(), ...data, publishedAt: new Date() };
        releases.set(r.id, r);
        return r;
      }),
      findUnique: jest.fn(async ({ where }: any) => releases.get(where.id) ?? null),
      update: jest.fn(async ({ where, data }: any) => {
        const r = releases.get(where.id);
        Object.assign(r, data);
        return r;
      }),
    },
    notificationJob: { count: jest.fn(async () => 0) },
    backupRecord: { findMany: jest.fn(async () => []) },
    idempotencyRecord: { findUnique: jest.fn(async () => null) },
  };
  return { mock, users, auditLogs };
}

describe('ConnectX Multi-Admin Super Admin APIs (Integration)', () => {
  let app: INestApplication;
  let prismaState: ReturnType<typeof createAdminTestPrismaMock>;
  let superToken: string;
  let financeToken: string;
  let modToken: string;

  beforeAll(async () => {
    process.env.SKIP_INFRA_CONNECT = 'true';
    process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL = 'super@connectx.test';
    prismaState = createAdminTestPrismaMock();

    const modRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaState.mock)
      .compile();

    app = modRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    // 1. Bootstrap Super Admin
    const regSuper = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'super@connectx.test',
        username: 'superadmin',
        displayName: 'Super Admin',
        password: 'Password123!',
      })
      .expect(201);
    superToken = regSuper.body.accessToken;

    // 2. Provision Finance Admin & Content Moderator
    await request(app.getHttpServer())
      .post('/api/v1/admin/admins')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        email: 'finance@connectx.test',
        displayName: 'Finance Admin',
        temporaryPassword: 'Password123!',
        role: UserRole.FINANCE_ADMIN,
        department: 'Finance',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/admin/admins')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        email: 'mod@connectx.test',
        displayName: 'Content Moderator',
        temporaryPassword: 'Password123!',
        role: UserRole.CONTENT_MODERATOR,
        department: 'TrustSafety',
      })
      .expect(201);

    // Target user for moderation
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'user@connectx.local',
        username: 'targetuser',
        displayName: 'Target User',
        password: 'Password123!',
      })
      .expect(201);

    const loginFin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'finance@connectx.test', password: 'Password123!' })
      .expect(201);
    financeToken = loginFin.body.accessToken;

    const loginMod = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'mod@connectx.test', password: 'Password123!' })
      .expect(201);
    modToken = loginMod.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves overview aggregate metrics without exposing E2EE message payloads', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/overview')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    expect(res.body.metrics.totalMessages).toBe(42);
    expect(res.body.e2eeBoundary).toBe('AGGREGATE_METADATA_ONLY');
  });

  it('enforces strict RBAC separation between Finance Admin, Content Moderator, and Super Admin', async () => {
    // Finance Admin CAN upsert subscription plans
    await request(app.getHttpServer())
      .put('/api/v1/admin/finance/plans')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({
        code: 'PRO_PLUS',
        name: 'Pro Plus',
        monthlyPriceCents: 4900,
        features: ['Priority SLA'],
      })
      .expect(200);

    // Finance Admin CANNOT create admins or register releases
    await request(app.getHttpServer())
      .post('/api/v1/admin/admins')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({
        email: 'hacker@connectx.test',
        displayName: 'Rogue',
        temporaryPassword: 'Password123!',
        role: UserRole.SUPER_ADMIN,
      })
      .expect(403);

    // Content Moderator CAN decide reports, CANNOT access finance
    await request(app.getHttpServer())
      .post('/api/v1/admin/moderation/reports/rep-1/decision')
      .set('Authorization', `Bearer ${modToken}`)
      .send({ decision: 'WARN', notes: 'First warning issued' })
      .expect(201);

    await request(app.getHttpServer())
      .get('/api/v1/admin/finance/overview')
      .set('Authorization', `Bearer ${modToken}`)
      .expect(403);
  });

  it('supports feature flag updates with snapshot rollback and tamper-evident SHA-256 audit chain', async () => {
    await request(app.getHttpServer())
      .put('/api/v1/admin/features/flags/e2ee_private_chats')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ enabled: false, rolloutPercent: 50 })
      .expect(200);

    const featState = await request(app.getHttpServer())
      .get('/api/v1/admin/features')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);

    expect(featState.body.history.length).toBeGreaterThan(0);
    const snapshotId = featState.body.history[0].id;

    await request(app.getHttpServer())
      .post('/api/v1/admin/features/rollback')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ snapshotId })
      .expect(201);

    const csvRes = await request(app.getHttpServer())
      .get('/api/v1/admin/analytics/export.csv')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);
    expect(csvRes.text).toContain('total_messages_count_only,42');

    const auditRes = await request(app.getHttpServer())
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${superToken}`)
      .expect(200);
    expect(auditRes.body.tamperEvidentChainActive).toBe(true);
    expect(auditRes.body.items[0].entryHash).toBeTruthy();
    expect(auditRes.body.items[0].previousHash).toBeTruthy();
  });
});
