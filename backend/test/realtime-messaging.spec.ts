import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ConversationType, MessageType, UserRole } from '@prisma/client';
import * as crypto from 'crypto';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

function createMessagingTestPrismaMock() {
  const users = new Map<string, any>();
  const sessions = new Map<string, any>();
  const conversations = new Map<string, any>();
  const members = new Map<string, any>();
  const messages = new Map<string, any>();
  const receipts = new Map<string, any>();
  const reactions = new Map<string, any>();
  const starred = new Map<string, any>();

  const mock: any = {
    $connect: jest.fn(async () => undefined),
    $disconnect: jest.fn(async () => undefined),
    $queryRaw: jest.fn(async () => [{ '?column?': 1 }]),
    $transaction: jest.fn(async (arg: any) => (typeof arg === 'function' ? arg(mock) : Promise.all(arg))),
    user: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.id) return users.get(where.id) ?? null;
        if (where.email) return Array.from(users.values()).find((u) => u.email === where.email) ?? null;
        return null;
      }),
      findFirst: jest.fn(async () => null),
      update: jest.fn(async ({ where, data }: any) => {
        const u = users.get(where.id);
        Object.assign(u, data);
        return u;
      }),
    },
    deviceSession: {
      findUnique: jest.fn(async ({ where }: any) => {
        const s = sessions.get(where.id);
        if (!s) return null;
        const user = users.get(s.userId);
        return { ...s, user: { ...user, customRole: null, adminUser: null } };
      }),
    },
    userBlock: { findFirst: jest.fn(async () => null) },
    systemConfig: { findUnique: jest.fn(async () => null) },
    conversation: {
      create: jest.fn(async ({ data }: any) => {
        const c = {
          id: crypto.randomUUID(),
          type: data.type,
          title: data.title ?? null,
          isEncrypted: data.isEncrypted ?? true,
          disappearingTtlSeconds: data.disappearingTtlSeconds ?? 0,
          createdById: data.createdById,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        conversations.set(c.id, c);
        for (const m of data.members.create) {
          const mem = { id: crypto.randomUUID(), conversationId: c.id, ...m, joinedAt: new Date() };
          members.set(`${c.id}_${m.userId}`, mem);
        }
        return c;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        const uid = where?.members?.some?.userId;
        const list = Array.from(conversations.values());
        if (uid) {
          return list.filter((c) => members.has(`${c.id}_${uid}`));
        }
        return list;
      }),
      count: jest.fn(async () => conversations.size),
      findUnique: jest.fn(async ({ where }: any) => conversations.get(where.id) ?? null),
      update: jest.fn(async ({ where, data }: any) => {
        const c = conversations.get(where.id);
        Object.assign(c, data);
        return c;
      }),
    },
    conversationMember: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.conversationId_userId) {
          const mem = members.get(`${where.conversationId_userId.conversationId}_${where.conversationId_userId.userId}`);
          if (!mem) return null;
          const conv = conversations.get(mem.conversationId);
          return { ...mem, conversation: { ...conv, group: null } };
        }
        return null;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        const uid = where?.userId;
        return Array.from(members.values()).filter((m) => m.userId === uid);
      }),
    },
    message: {
      create: jest.fn(async ({ data }: any) => {
        const msg = {
          id: crypto.randomUUID(),
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        messages.set(msg.id, msg);
        return msg;
      }),
      findUnique: jest.fn(async ({ where, include }: any) => {
        const msg = messages.get(where.id);
        if (!msg) return null;
        if (include?.conversation) {
          const conv = conversations.get(msg.conversationId);
          const convMembers = Array.from(members.values()).filter((m) => m.conversationId === msg.conversationId);
          return { ...msg, conversation: { ...conv, members: convMembers } };
        }
        return msg;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const m = messages.get(where.id);
        Object.assign(m, data);
        return m;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        const list = Array.from(messages.values());
        if (where?.conversationId) {
          return list.filter((m) => m.conversationId === where.conversationId && !m.deletedAt);
        }
        return list;
      }),
      count: jest.fn(async () => messages.size),
    },
    messageReceipt: {
      upsert: jest.fn(async ({ where, update, create }: any) => {
        const key = `${where.messageId_userId.messageId}_${where.messageId_userId.userId}`;
        const existing = receipts.get(key);
        const next = existing ? { ...existing, ...update } : { id: crypto.randomUUID(), ...create };
        receipts.set(key, next);
        return next;
      }),
    },
    messageReaction: {
      findUnique: jest.fn(async ({ where }: any) => {
        if (where.messageId_userId_emoji) {
          const { messageId, userId, emoji } = where.messageId_userId_emoji;
          return Array.from(reactions.values()).find((r) => r.messageId === messageId && r.userId === userId && r.emoji === emoji) ?? null;
        }
        return null;
      }),
      create: jest.fn(async ({ data }: any) => {
        const r = { id: crypto.randomUUID(), ...data, createdAt: new Date() };
        reactions.set(r.id, r);
        return r;
      }),
      delete: jest.fn(async ({ where }: any) => {
        reactions.delete(where.id);
        return {};
      }),
    },
    starredMessage: {
      findUnique: jest.fn(async ({ where }: any) => {
        const { messageId, userId } = where.messageId_userId;
        return Array.from(starred.values()).find((s) => s.messageId === messageId && s.userId === userId) ?? null;
      }),
      create: jest.fn(async ({ data }: any) => {
        const s = { id: crypto.randomUUID(), ...data, createdAt: new Date() };
        starred.set(s.id, s);
        return s;
      }),
      delete: jest.fn(async ({ where }: any) => {
        starred.delete(where.id);
        return {};
      }),
    },
    notificationPreference: {
      create: jest.fn(async ({ data }: any) => data),
      findUnique: jest.fn(async () => ({ messageAlerts: true, callAlerts: true, groupAlerts: true })),
    },
    notificationRecord: {
      create: jest.fn(async ({ data }: any) => ({ id: crypto.randomUUID(), ...data, createdAt: new Date() })),
      findUnique: jest.fn(async () => null),
      update: jest.fn(async ({ data }: any) => data),
    },
    notificationJob: { create: jest.fn(async () => ({})) },
    pushSubscription: { findMany: jest.fn(async () => []) },
  };

  return { mock, users, sessions };
}

describe('ConnectX Real-Time Messaging & E2EE Engine', () => {
  let app: INestApplication;
  let prismaState: ReturnType<typeof createMessagingTestPrismaMock>;
  let aliceToken: string;
  let bobToken: string;
  let aliceId: string;
  let bobId: string;
  let convId: string;

  beforeAll(async () => {
    process.env.SKIP_INFRA_CONNECT = 'true';
    process.env.JWT_ACCESS_SECRET = 'super_secret_access_key_change_me_in_production_env';
    prismaState = createMessagingTestPrismaMock();

    // Seed mock users
    aliceId = crypto.randomUUID();
    bobId = crypto.randomUUID();

    const aliceUser = {
      id: aliceId,
      email: 'alice@connectx.test',
      username: 'alice',
      displayName: 'Alice Cooper',
      passwordHash: 'hash',
      role: UserRole.MEMBER,
      suspended: false,
      readReceiptsEnabled: true,
    };
    const bobUser = {
      id: bobId,
      email: 'bob@connectx.test',
      username: 'bob',
      displayName: 'Bob Builder',
      passwordHash: 'hash',
      role: UserRole.MEMBER,
      suspended: false,
      readReceiptsEnabled: true,
    };

    const aliceSid = crypto.randomUUID();
    const bobSid = crypto.randomUUID();

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

    // We can mock session and jwt verification or register through auth
    const jwtService = app.get(JwtService);

    // Register users in mock map
    prismaState.users.set(aliceId, aliceUser);
    prismaState.users.set(bobId, bobUser);

    prismaState.sessions.set(aliceSid, {
      id: aliceSid,
      userId: aliceId,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 3600000),
    });
    prismaState.sessions.set(bobSid, {
      id: bobSid,
      userId: bobId,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 3600000),
    });

    const accessSecret = 'super_secret_access_key_change_me_in_production_env';
    aliceToken = jwtService.sign({ sub: aliceId, sid: aliceSid, role: UserRole.MEMBER }, { secret: accessSecret, expiresIn: '1h' });
    bobToken = jwtService.sign({ sub: bobId, sid: bobSid, role: UserRole.MEMBER }, { secret: accessSecret, expiresIn: '1h' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates private conversation and enforces E2EE ciphertext-only invariant', async () => {
    const convRes = await request(app.getHttpServer())
      .post('/api/v1/messaging/conversations')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        type: ConversationType.PRIVATE,
        memberIds: [bobId],
      })
      .expect(201);

    convId = convRes.body.id;
    expect(convRes.body.isEncrypted).toBe(true);

    // Attempting to send plaintext on an E2EE conversation must fail
    await request(app.getHttpServer())
      .post('/api/v1/messaging/messages')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        conversationId: convId,
        messageType: MessageType.TEXT,
        plaintextBody: 'Secret plaintext that must be rejected',
      })
      .expect(400);

    // Sending valid E2EE ciphertext + nonce succeeds
    const cipherText = crypto.randomBytes(32).toString('base64');
    const nonce = crypto.randomBytes(12).toString('base64');

    const msgRes = await request(app.getHttpServer())
      .post('/api/v1/messaging/messages')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({
        conversationId: convId,
        messageType: MessageType.TEXT,
        ciphertext: cipherText,
        nonce,
        senderKeyVersion: 1,
      })
      .expect(201);

    expect(msgRes.body.ciphertext).toBe(cipherText);
    expect(msgRes.body.plaintextBody).toBeNull();
  });

  it('handles offline queue delivery receipt, read receipt, and reaction flows', async () => {
    const messagesList = await request(app.getHttpServer())
      .get(`/api/v1/messaging/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(200);

    const messageId = messagesList.body.items[0].id;

    // Bob marks delivered
    await request(app.getHttpServer())
      .put(`/api/v1/messaging/messages/${messageId}/delivered`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(200);

    // Bob marks read
    await request(app.getHttpServer())
      .put(`/api/v1/messaging/messages/${messageId}/read`)
      .set('Authorization', `Bearer ${bobToken}`)
      .expect(200);

    // Bob adds reaction
    const reactRes = await request(app.getHttpServer())
      .post(`/api/v1/messaging/messages/${messageId}/reactions`)
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ emoji: '👍' })
      .expect(201);

    expect(reactRes.body.reacted).toBe(true);
  });
});
