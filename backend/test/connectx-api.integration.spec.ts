import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import * as crypto from 'crypto';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface MockUser {
  id: string;
  email: string;
  phone: string | null;
  username: string;
  displayName: string;
  passwordHash: string;
  role: UserRole;
  customRoleId: string | null;
  customRole: { permissions: string[] } | null;
  department: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  mfaEnabled: boolean;
  mfaSecretEncrypted: string | null;
  suspended: boolean;
  readReceiptsEnabled: boolean;
}

function createInMemoryPrismaMock() {
  const users = new Map<string, MockUser>();
  const sessions = new Map<string, any>();
  const conversations = new Map<string, any>();
  const members = new Map<string, any>();
  const messages = new Map<string, any>();
  const products = new Map<string, any>();
  const orders = new Map<string, any>();
  const plans = new Map<string, any>();
  const businesses = new Map<string, any>();
  const idempotency = new Map<string, any>();
  const configs = new Map<string, any>();

  const mock: any = {
    $connect: jest.fn(async () => undefined),
    $disconnect: jest.fn(async () => undefined),
    $queryRaw: jest.fn(async () => [{ '?column?': 1 }]),
    $transaction: jest.fn(async (arg: any) => {
      if (typeof arg === 'function') return arg(mock);
      return Promise.all(arg);
    }),
    user: {
      findFirst: jest.fn(async ({ where }: any) => {
        const list = Array.from(users.values());
        if (where?.OR) {
          return list.find((u) =>
            where.OR.some((cond: any) =>
              (cond.email && u.email === cond.email) ||
              (cond.username && u.username === cond.username) ||
              (cond.phone && u.phone === cond.phone),
            ),
          ) ?? null;
        }
        return null;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.id) return users.get(where.id) ?? null;
        if (where.email) {
          return Array.from(users.values()).find((u) => u.email === where.email) ?? null;
        }
        return null;
      }),
      findMany: jest.fn(async () => Array.from(users.values())),
      count: jest.fn(async ({ where }: any = {}) => {
        const list = Array.from(users.values());
        if (where?.role) return list.filter((u) => u.role === where.role).length;
        return list.length;
      }),
      create: jest.fn(async ({ data }: any) => {
        const user: MockUser = {
          id: data.id || crypto.randomUUID(),
          email: data.email,
          phone: data.phone ?? null,
          username: data.username,
          displayName: data.displayName,
          passwordHash: data.passwordHash,
          role: data.role ?? UserRole.MEMBER,
          customRoleId: null,
          customRole: null,
          department: data.department ?? 'General',
          emailVerified: false,
          phoneVerified: false,
          mfaEnabled: false,
          mfaSecretEncrypted: null,
          suspended: false,
          readReceiptsEnabled: true,
        };
        users.set(user.id, user);
        return user;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const user = users.get(where.id);
        if (!user) throw new Error('User not found');
        Object.assign(user, data);
        return user;
      }),
    },
    notificationPreference: {
      create: jest.fn(async ({ data }: any) => data),
      upsert: jest.fn(async ({ create }: any) => create),
      findUnique: jest.fn(async () => null),
    },
    notificationRecord: {
      create: jest.fn(async ({ data }: any) => ({ id: crypto.randomUUID(), ...data, createdAt: new Date() })),
      findUnique: jest.fn(async () => null),
      update: jest.fn(async ({ data }: any) => data),
    },
    deviceSession: {
      create: jest.fn(async ({ data }: any) => {
        sessions.set(data.id, { ...data, createdAt: new Date() });
        return data;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        const s = sessions.get(where.id);
        if (!s) return null;
        return { ...s, user: users.get(s.userId) };
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const s = sessions.get(where.id);
        if (s) Object.assign(s, data);
        return s;
      }),
      updateMany: jest.fn(async ({ where, data }: any) => {
        let count = 0;
        for (const s of sessions.values()) {
          const matchFamily = !where.refreshTokenFamily || s.refreshTokenFamily === where.refreshTokenFamily;
          const matchUser = !where.userId || s.userId === where.userId;
          const matchId = !where.id || s.id === where.id;
          if (matchFamily && matchUser && matchId) {
            Object.assign(s, data);
            count++;
          }
        }
        return { count };
      }),
    },
    conversation: {
      create: jest.fn(async ({ data }: any) => {
        const id = crypto.randomUUID();
        const conv = {
          id,
          type: data.type,
          title: data.title ?? null,
          isEncrypted: data.isEncrypted,
          disappearingTtlSeconds: data.disappearingTtlSeconds ?? 0,
          createdById: data.createdById,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        conversations.set(id, conv);
        const createdMembers: any[] = [];
        for (const m of data.members.create) {
          const rec = { id: crypto.randomUUID(), conversationId: id, userId: m.userId, role: m.role };
          members.set(`${id}:${m.userId}`, rec);
          createdMembers.push(rec);
        }
        return { ...conv, members: createdMembers };
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const conv = conversations.get(where.id);
        if (conv) Object.assign(conv, data);
        return conv;
      }),
    },
    conversationMember: {
      findUnique: jest.fn(async ({ where }: any) => {
        const key = `${where.conversationId_userId.conversationId}:${where.conversationId_userId.userId}`;
        const m = members.get(key);
        if (!m) return null;
        return {
          ...m,
          conversation: { ...conversations.get(m.conversationId), group: null },
        };
      }),
      findMany: jest.fn(async () => []),
    },
    userBlock: {
      findFirst: jest.fn(async () => null),
    },
    message: {
      create: jest.fn(async ({ data }: any) => {
        const msg = { id: crypto.randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() };
        messages.set(msg.id, msg);
        return msg;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        const msg = messages.get(where.id);
        if (!msg) return null;
        const convMembers = Array.from(members.values()).filter((m) => m.conversationId === msg.conversationId);
        return { ...msg, conversation: { ...conversations.get(msg.conversationId), members: convMembers } };
      }),
      findMany: jest.fn(async ({ where }: any) =>
        Array.from(messages.values()).filter((m) => m.conversationId === where.conversationId),
      ),
      count: jest.fn(async ({ where }: any) =>
        Array.from(messages.values()).filter((m) => m.conversationId === where.conversationId).length,
      ),
      update: jest.fn(async ({ where, data }: any) => {
        const msg = messages.get(where.id);
        if (msg) Object.assign(msg, data);
        return msg;
      }),
    },
    businessProfile: {
      upsert: jest.fn(async ({ create }: any) => {
        const id = crypto.randomUUID();
        const biz = { id, verificationStatus: 'UNVERIFIED', ...create };
        businesses.set(create.ownerId, biz);
        return biz;
      }),
      findUnique: jest.fn(async ({ where }: any) => businesses.get(where.ownerId) ?? null),
    },
    product: {
      create: jest.fn(async ({ data }: any) => {
        const prod = { id: crypto.randomUUID(), ...data };
        products.set(prod.id, prod);
        return prod;
      }),
      findUnique: jest.fn(async ({ where }: any) => products.get(where.id) ?? null),
    },
    orderInquiry: {
      create: jest.fn(async ({ data }: any) => {
        const order = { id: crypto.randomUUID(), ...data };
        orders.set(order.id, order);
        return order;
      }),
    },
    subscriptionPlan: {
      findUnique: jest.fn(async ({ where }: any) => plans.get(where.id) ?? null),
      findMany: jest.fn(async () => Array.from(plans.values())),
      create: jest.fn(async ({ data }: any) => {
        const p = { id: crypto.randomUUID(), active: true, ...data };
        plans.set(p.id, p);
        return p;
      }),
    },
    systemConfig: {
      findUnique: jest.fn(async ({ where }: any) => configs.get(where.key) ?? null),
    },
    idempotencyRecord: {
      findUnique: jest.fn(async ({ where }: any) => {
        const k = where.userId_idempotencyKey_method_path;
        return idempotency.get(`${k.userId}:${k.idempotencyKey}:${k.method}:${k.path}`) ?? null;
      }),
      upsert: jest.fn(async ({ where, create }: any) => {
        const k = where.userId_idempotencyKey_method_path;
        idempotency.set(`${k.userId}:${k.idempotencyKey}:${k.method}:${k.path}`, create);
        return create;
      }),
    },
    community: {
      create: jest.fn(async ({ data }: any) => ({ id: crypto.randomUUID(), ...data, createdAt: new Date() })),
    },
    callSession: {
      create: jest.fn(async ({ data }: any) => ({ id: crypto.randomUUID(), ...data, status: 'ACTIVE', createdAt: new Date() })),
    },
  };

  return { mock, users, plans };
}

describe('ConnectX Enterprise Backend Integration Tests', () => {
  let app: INestApplication;
  let prismaMock: ReturnType<typeof createInMemoryPrismaMock>;

  beforeAll(async () => {
    process.env.SKIP_DB_CONNECT = 'true';
    process.env.SKIP_INFRA_CONNECT = 'true';
    process.env.BOOTSTRAP_SUPER_ADMIN_EMAIL = 'admin@connectx.test';
    delete process.env.STRIPE_SECRET_KEY;

    prismaMock = createInMemoryPrismaMock();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock.mock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('serves /api/v1/system/health and generates complete OpenAPI spec', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/system/health').expect(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.dependencies.postgresql).toBe('CONNECTED');

    const swaggerConfig = new DocumentBuilder().setTitle('ConnectX').setVersion('1.0.0').build();
    const doc = SwaggerModule.createDocument(app, swaggerConfig);
    expect(Object.keys(doc.paths).length).toBeGreaterThan(40);
  });

  it('enforces Argon2id registration, refresh-token rotation + replay revocation, E2EE admin isolation, and Stripe fail-closed checkout', async () => {
    // 1. Register Admin & two regular members
    const adminReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'admin@connectx.test',
        username: 'super_admin',
        displayName: 'Super Admin',
        password: 'StrongPassword#2026',
      })
      .expect(201);
    expect(adminReg.body.user.role).toBe('SUPER_ADMIN');
    const adminToken = adminReg.body.accessToken as string;

    const aliceReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'alice@connectx.test',
        username: 'alice_dev',
        displayName: 'Alice',
        password: 'StrongPassword#2026',
      })
      .expect(201);
    const aliceToken = aliceReg.body.accessToken as string;
    const aliceRefresh1 = aliceReg.body.refreshToken as string;

    const bobReg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'bob@connectx.test',
        username: 'bob_dev',
        displayName: 'Bob',
        password: 'StrongPassword#2026',
      })
      .expect(201);
    const bobId = bobReg.body.user.id as string;

    // 2. Refresh-token rotation + replay attack detection
    const rotated = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: aliceRefresh1 })
      .expect(201);
    expect(rotated.body.refreshToken).not.toBe(aliceRefresh1);

    // Replaying the old refresh token MUST fail with 401 and revoke the family
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: aliceRefresh1 })
      .expect(401);

    // Re-login Alice cleanly
    const aliceLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'alice@connectx.test', password: 'StrongPassword#2026' })
      .expect(201);
    const freshAliceToken = aliceLogin.body.accessToken as string;

    // 3. RBAC check: MEMBER blocked from /api/v1/admin/users, SUPER_ADMIN allowed
    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${freshAliceToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // 4. E2EE private conversation & strict Admin isolation
    const convRes = await request(app.getHttpServer())
      .post('/api/v1/messaging/conversations')
      .set('Authorization', `Bearer ${freshAliceToken}`)
      .send({ type: 'PRIVATE', memberIds: [bobId], isEncrypted: true })
      .expect(201);
    const convId = convRes.body.id as string;

    // Plaintext on encrypted private chat is rejected
    await request(app.getHttpServer())
      .post('/api/v1/messaging/messages')
      .set('Authorization', `Bearer ${freshAliceToken}`)
      .send({ conversationId: convId, plaintextBody: 'secret plaintext' })
      .expect(400);

    // Ciphertext succeeds
    const msgRes = await request(app.getHttpServer())
      .post('/api/v1/messaging/messages')
      .set('Authorization', `Bearer ${freshAliceToken}`)
      .send({
        conversationId: convId,
        ciphertext: 'U2FsdGVkX1+encryptedCiphertext==',
        nonce: 'nonce_123456',
      })
      .expect(201);
    expect(msgRes.body.plaintextBody).toBeNull();
    expect(msgRes.body.ciphertext).toBe('U2FsdGVkX1+encryptedCiphertext==');

    // SUPER_ADMIN cannot read Alice & Bob's private E2EE conversation messages
    await request(app.getHttpServer())
      .get(`/api/v1/messaging/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403);

    // 5. Business deterministic order total calculation
    await request(app.getHttpServer())
      .post('/api/v1/business/profile')
      .set('Authorization', `Bearer ${freshAliceToken}`)
      .send({ businessName: 'Alice Cloud Ltd', category: 'SaaS' })
      .expect(201);

    const prodRes = await request(app.getHttpServer())
      .post('/api/v1/business/products')
      .set('Authorization', `Bearer ${freshAliceToken}`)
      .send({ sku: 'CX-PRO-1', name: 'Pro Seat', priceCents: 2500 })
      .expect(201);

    const orderRes = await request(app.getHttpServer())
      .post('/api/v1/business/orders')
      .set('Authorization', `Bearer ${freshAliceToken}`)
      .set('Idempotency-Key', 'order-key-1')
      .send({ productId: prodRes.body.id, quantity: 3 })
      .expect(201);
    expect(orderRes.body.totalCents).toBe(7500);

    // 6. Community creation & calling signaling
    const commRes = await request(app.getHttpServer())
      .post('/api/v1/communities')
      .set('Authorization', `Bearer ${freshAliceToken}`)
      .send({ name: 'Alice Community', description: 'Enterprise Hub' })
      .expect(201);
    expect(commRes.body.name).toBe('Alice Community');

    const callRes = await request(app.getHttpServer())
      .post('/api/v1/calling/sessions')
      .set('Authorization', `Bearer ${freshAliceToken}`)
      .send({ callType: 'VIDEO', inviteeIds: [adminReg.body.user.id] })
      .expect(201);
    expect(callRes.body.callType).toBe('VIDEO');

    // 7. Paid subscription fails closed (503) when STRIPE_SECRET_KEY is not configured
    const planRes = await request(app.getHttpServer())
      .post('/api/v1/payments/plans')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'GROWTH_PRO',
        name: 'Growth Pro',
        monthlyPriceCents: 2900,
        features: ['CRM', 'Catalog'],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/payments/subscribe')
      .set('Authorization', `Bearer ${freshAliceToken}`)
      .send({ planId: planRes.body.id })
      .expect(503);
  });
});
