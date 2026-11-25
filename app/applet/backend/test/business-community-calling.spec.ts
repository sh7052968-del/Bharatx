import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { UserRole, CommunityMemberRole, CallType, OrderStatus } from '@prisma/client';
import * as crypto from 'crypto';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

function createBizTestPrismaMock() {
  const users = new Map<string, any>();
  const sessions = new Map<string, any>();
  const businesses = new Map<string, any>();
  const products = new Map<string, any>();
  const customers = new Map<string, any>();
  const notes = new Map<string, any>();
  const orders = new Map<string, any>();
  const communities = new Map<string, any>();
  const communityMembers = new Map<string, any>();
  const calls = new Map<string, any>();

  const mock: any = {
    $connect: jest.fn(async () => undefined),
    $disconnect: jest.fn(async () => undefined),
    $queryRaw: jest.fn(async () => [{ '?column?': 1 }]),
    $transaction: jest.fn(async (arg: any) => (typeof arg === 'function' ? arg(mock) : Promise.all(arg))),
    user: {
      findUnique: jest.fn(async ({ where }: any) => users.get(where.id) ?? null),
    },
    deviceSession: {
      findUnique: jest.fn(async ({ where }: any) => {
        const s = sessions.get(where.id);
        if (!s) return null;
        const user = users.get(s.userId);
        return { ...s, user: { ...user, customRole: null, adminUser: null } };
      }),
    },
    systemConfig: { findUnique: jest.fn(async () => null) },
    businessProfile: {
      upsert: jest.fn(async ({ where, create, update }: any) => {
        let b = businesses.get(where.ownerId);
        if (b) {
          Object.assign(b, update);
        } else {
          b = { id: crypto.randomUUID(), ownerId: where.ownerId, verificationStatus: 'UNVERIFIED', ...create };
          businesses.set(where.ownerId, b);
        }
        return b;
      }),
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.ownerId) return businesses.get(where.ownerId) ?? null;
        if (where.id) return Array.from(businesses.values()).find((b) => b.id === where.id) ?? null;
        return null;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const b = Array.from(businesses.values()).find((item) => item.id === where.id);
        if (b) Object.assign(b, data);
        return b;
      }),
    },
    approvalWorkflow: {
      create: jest.fn(async ({ data }: any) => ({ id: crypto.randomUUID(), ...data, createdAt: new Date() })),
    },
    product: {
      create: jest.fn(async ({ data }: any) => {
        const p = { id: crypto.randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() };
        products.set(p.id, p);
        return p;
      }),
      findMany: jest.fn(async () => Array.from(products.values())),
      count: jest.fn(async () => products.size),
      findUnique: jest.fn(async ({ where }: any) => products.get(where.id) ?? null),
      update: jest.fn(async ({ where, data }: any) => {
        const p = products.get(where.id);
        if (p) Object.assign(p, data);
        return p;
      }),
    },
    customerRecord: {
      create: jest.fn(async ({ data }: any) => {
        const c = { id: crypto.randomUUID(), ...data, updatedAt: new Date(), notes: [] };
        customers.set(c.id, c);
        return c;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        const list = Array.from(customers.values()).filter((c) => c.businessId === where.businessId);
        return list.map((c) => ({ ...c, notes: Array.from(notes.values()).filter((n) => n.customerRecordId === c.id) }));
      }),
      findUnique: jest.fn(async ({ where }: any) => customers.get(where.id) ?? null),
    },
    customerNote: {
      create: jest.fn(async ({ data }: any) => {
        const n = { id: crypto.randomUUID(), ...data, createdAt: new Date() };
        notes.set(n.id, n);
        return n;
      }),
    },
    orderInquiry: {
      create: jest.fn(async ({ data }: any) => {
        const o = { id: crypto.randomUUID(), ...data, status: OrderStatus.PENDING, createdAt: new Date(), updatedAt: new Date() };
        orders.set(o.id, o);
        return o;
      }),
      findMany: jest.fn(async () => Array.from(orders.values())),
      findUnique: jest.fn(async ({ where }: any) => orders.get(where.id) ?? null),
      update: jest.fn(async ({ where, data }: any) => {
        const o = orders.get(where.id);
        if (o) Object.assign(o, data);
        return o;
      }),
    },
    community: {
      create: jest.fn(async ({ data }: any) => {
        const com = { id: crypto.randomUUID(), ...data, createdAt: new Date() };
        communities.set(com.id, com);
        return com;
      }),
      findMany: jest.fn(async () => Array.from(communities.values())),
    },
    communityMember: {
      create: jest.fn(async ({ data }: any) => {
        const cm = { id: crypto.randomUUID(), ...data, joinedAt: new Date() };
        communityMembers.set(cm.id, cm);
        return cm;
      }),
    },
    callSession: {
      create: jest.fn(async ({ data }: any) => {
        const call = { id: crypto.randomUUID(), ...data, status: CallStatus.ACTIVE, createdAt: new Date(), participants: [] };
        calls.set(call.id, call);
        return call;
      }),
      findUnique: jest.fn(async ({ where }: any) => calls.get(where.id) ?? null),
      update: jest.fn(async ({ where, data }: any) => {
        const call = calls.get(where.id);
        if (call) Object.assign(call, data);
        return call;
      }),
      findMany: jest.fn(async () => Array.from(calls.values())),
    },
  };

  return { mock, users, sessions };
}

describe('ConnectX Business, Community, and Calling Integration Tests', () => {
  let app: INestApplication;
  let prismaState: ReturnType<typeof createBizTestPrismaMock>;
  let userToken: string;
  let userId: string;

  beforeAll(async () => {
    process.env.SKIP_INFRA_CONNECT = 'true';
    process.env.JWT_ACCESS_SECRET = 'super_secret_access_key_change_me_in_production_env';
    prismaState = createBizTestPrismaMock();

    userId = crypto.randomUUID();
    const user = {
      id: userId,
      email: 'merchant@connectx.test',
      username: 'merchant',
      displayName: 'Merchant User',
      role: UserRole.MEMBER,
      suspended: false,
    };
    const sid = crypto.randomUUID();
    prismaState.users.set(userId, user);
    prismaState.sessions.set(sid, {
      id: sid,
      userId,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 3600000),
    });

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaState.mock)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    const jwtService = app.get(JwtService);
    userToken = jwtService.sign(
      { sub: userId, sid, role: UserRole.MEMBER },
      { secret: 'super_secret_access_key_change_me_in_production_env', expiresIn: '1h' },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers business profile and requests verification', async () => {
    const regRes = await request(app.getHttpServer())
      .post('/api/v1/business/profile')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        businessName: 'ConnectX Global Store',
        category: 'Retail & Technology',
        description: 'Enterprise communication and commerce',
      })
      .expect(201);

    expect(regRes.body.businessName).toBe('ConnectX Global Store');

    const verifyRes = await request(app.getHttpServer())
      .post('/api/v1/business/verification')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(verifyRes.body.verificationStatus).toBe('PENDING');
  });

  it('manages product catalog and stock', async () => {
    const prodRes = await request(app.getHttpServer())
      .post('/api/v1/business/catalog')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        sku: 'CX-PROD-001',
        name: 'Enterprise License',
        priceCents: 49900,
        currency: 'USD',
        inStock: true,
      })
      .expect(201);

    expect(prodRes.body.sku).toBe('CX-PROD-001');

    const toggleRes = await request(app.getHttpServer())
      .patch(`/api/v1/business/catalog/${prodRes.body.id}/stock`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(toggleRes.body.inStock).toBe(false);
  });

  it('manages customer CRM and notes', async () => {
    const custRes = await request(app.getHttpServer())
      .post('/api/v1/business/customers')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        customerName: 'Acme Corp Buyer',
        labels: ['VIP', 'Enterprise'],
      })
      .expect(201);

    expect(custRes.body.customerName).toBe('Acme Corp Buyer');

    const noteRes = await request(app.getHttpServer())
      .post(`/api/v1/business/customers/${custRes.body.id}/notes`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        note: 'Interested in annual deployment contract',
      })
      .expect(201);

    expect(noteRes.body.note).toBe('Interested in annual deployment contract');
  });

  it('creates and manages communities', async () => {
    const comRes = await request(app.getHttpServer())
      .post('/api/v1/communities')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Enterprise ConnectX Community',
        description: 'Global business network community',
      })
      .expect(201);

    expect(comRes.body.name).toBe('Enterprise ConnectX Community');
  });

  it('initiates calling sessions', async () => {
    const callRes = await request(app.getHttpServer())
      .post('/api/v1/calling/sessions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        callType: CallType.VIDEO,
        calleeId: crypto.randomUUID(),
      })
      .expect(201);

    expect(callRes.body.callType).toBe('VIDEO');
    expect(callRes.body.status).toBe('ACTIVE');
  });
});
