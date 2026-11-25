const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { test, before, after, beforeEach } = require("node:test");
const fs = require("node:fs");

let testEnv;
const PROJECT_ID = process.env.GCP_PROJECT || "demo-no-project";
const ALICE_UID = "alice_123";
const BOB_UID = "bob_456";
const ADMIN_UID = "admin_001";
const BOOTSTRAP_EMAIL = "sh7052968@gmail.com";

const [emulatorHost, emulatorPortStr] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085").split(":");
const emulatorPort = parseInt(emulatorPortStr, 10);

const pastDate = (offsetMs = 5000) => new Date(Date.now() - offsetMs);
const futureDate = () => new Date(Date.now() + 60000);

before(async () => {
  const rules = fs.readFileSync("./firestore.rules", "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules, host: emulatorHost, port: emulatorPort },
  });
});

after(async () => { if (testEnv) await testEnv.cleanup(); });
beforeEach(async () => { if (testEnv) await testEnv.clearFirestore(); });

test("Unauthenticated users cannot read or write any collection", async () => {
  const unauth = testEnv.unauthenticatedContext().firestore();
  await assertFails(unauth.collection("users").doc(ALICE_UID).get());
  await assertFails(unauth.collection("conversations").where("memberUids", "array-contains", ALICE_UID).get());
  await assertFails(unauth.collection("calls").where("memberUids", "array-contains", ALICE_UID).get());
  await assertFails(unauth.collection("statuses").where("visibility", "==", "WORKSPACE").get());
  await assertFails(unauth.collection("support_tickets").where("userId", "==", ALICE_UID).get());
});

test("Users collection: PII isolation, settings update, no self-escalation", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID, { email: "alice@example.com", email_verified: true }).firestore();
  const bobDb = testEnv.authenticatedContext(BOB_UID, { email: "bob@example.com", email_verified: true }).firestore();
  const realAdminDb = testEnv.authenticatedContext(ADMIN_UID, { email: BOOTSTRAP_EMAIL, email_verified: true }).firestore();
  const ts = pastDate();

  await assertFails(
    aliceDb.collection("users").doc(ALICE_UID).set({
      userId: ALICE_UID, displayName: "Alice", email: "alice@example.com", role: "ADMIN",
      presenceStatus: "ONLINE", awayMessageEnabled: false, awayMessageText: "", greetingText: "",
      createdAt: ts, updatedAt: ts,
    })
  );

  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).set({
      userId: ALICE_UID, displayName: "Alice", email: "alice@example.com", role: "MEMBER",
      department: "Support", presenceStatus: "ONLINE", businessName: "Alice Studio",
      businessCategory: "Design", verifiedBusiness: false, awayMessageEnabled: false,
      awayMessageText: "Away", greetingText: "Hi", languageCode: "hi", themeMode: "DARK",
      twoFactorEnabled: true, notificationsEnabled: true, lastSeenVisible: true,
      createdAt: ts, updatedAt: ts,
    })
  );

  await assertFails(bobDb.collection("users").doc(ALICE_UID).get());
  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).update({
      languageCode: "as", themeMode: "LIGHT", updatedAt: pastDate(1000),
    })
  );

  await assertSucceeds(
    realAdminDb.collection("users").doc(ADMIN_UID).set({
      userId: ADMIN_UID, displayName: "Admin", email: BOOTSTRAP_EMAIL, role: "ADMIN",
      presenceStatus: "ONLINE", awayMessageEnabled: false, awayMessageText: "", greetingText: "",
      createdAt: ts, updatedAt: ts,
    })
  );
  await assertSucceeds(
    realAdminDb.collection("users").doc(ALICE_UID).update({
      role: "BUSINESS_MANAGER", verifiedBusiness: true, updatedAt: pastDate(500),
    })
  );
});

test("Conversations & Messages: edit/pin/star/react and archive/mute/disappearing settings", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const bobDb = testEnv.authenticatedContext(BOB_UID).firestore();
  const ts = pastDate();

  await assertSucceeds(
    aliceDb.collection("conversations").doc("conv_1").set({
      title: "Team Ops", type: "GROUP", ownerId: ALICE_UID, memberUids: [ALICE_UID, BOB_UID],
      lastMessageText: "Hello", lastSenderId: ALICE_UID, lastMessageAt: ts,
      status: "OPEN", priority: "NORMAL", labels: [], archivedByUids: [], mutedByUids: [],
      disappearingHours: 24, createdAt: ts, updatedAt: ts,
    })
  );

  await assertSucceeds(
    bobDb.collection("conversations").doc("conv_1").update({
      mutedByUids: [BOB_UID], disappearingHours: 168, updatedAt: pastDate(1000),
    })
  );

  await assertSucceeds(
    bobDb.collection("conversations").doc("conv_1").collection("messages").doc("m_1").set({
      conversationId: "conv_1", senderId: BOB_UID, senderName: "Bob", body: "Initial text",
      messageType: "TEXT", memberUids: [ALICE_UID, BOB_UID], createdAt: pastDate(1000),
    })
  );

  // Sender can edit own message; Alice cannot edit Bob's body
  await assertSucceeds(
    bobDb.collection("conversations").doc("conv_1").collection("messages").doc("m_1").update({
      body: "Edited text", edited: true,
    })
  );
  await assertFails(
    aliceDb.collection("conversations").doc("conv_1").collection("messages").doc("m_1").update({
      body: "Hijack", edited: true,
    })
  );

  // Any member can pin, star, or react
  await assertSucceeds(
    aliceDb.collection("conversations").doc("conv_1").collection("messages").doc("m_1").update({
      pinned: true, starredByUids: [ALICE_UID], reactions: ["👍:" + ALICE_UID],
    })
  );
});

test("Contacts, Devices, CRM Customer Notes, Subscription & Invoices: strict owner isolation", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const bobDb = testEnv.authenticatedContext(BOB_UID).firestore();
  const ts = pastDate();

  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).collection("contacts").doc("c1").set({
      userId: ALICE_UID, contactUid: BOB_UID, displayName: "Bob", handle: "bob",
      department: "Ops", note: "Partner", blocked: false, createdAt: ts, updatedAt: ts,
    })
  );
  await assertFails(bobDb.collection("users").doc(ALICE_UID).collection("contacts").get());

  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).collection("devices").doc("d1").set({
      userId: ALICE_UID, deviceName: "Pixel 9", platform: "Android 16", trusted: true,
      createdAt: ts, updatedAt: ts,
    })
  );

  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).collection("customer_notes").doc("n1").set({
      userId: ALICE_UID, customerName: "Acme Corp", label: "VIP", note: "Net 30",
      createdAt: ts, updatedAt: ts,
    })
  );

  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).collection("subscription").doc("current").set({
      userId: ALICE_UID, planId: "GROWTH", planName: "Growth Pro", monthlyPriceCents: 2900,
      status: "ACTIVE", createdAt: ts, updatedAt: ts,
    })
  );
  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).collection("invoices").doc("inv_1").set({
      userId: ALICE_UID, invoiceNumber: "INV-2026-001", planName: "Growth Pro",
      amountCents: 2900, status: "PAID", createdAt: ts,
    })
  );
  await assertFails(
    aliceDb.collection("users").doc(ALICE_UID).collection("invoices").doc("inv_1").update({ amountCents: 0 })
  );
});

test("Calls, Statuses, and Support Tickets: member isolation & terminal locks", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  const bobDb = testEnv.authenticatedContext(BOB_UID).firestore();
  const charlieDb = testEnv.authenticatedContext("charlie_789").firestore();
  const ts = pastDate();

  // Calls
  await assertSucceeds(
    aliceDb.collection("calls").doc("call_1").set({
      callerId: ALICE_UID, callerName: "Alice", calleeId: BOB_UID, calleeName: "Bob",
      callType: "VIDEO", status: "RINGING", durationSeconds: 0,
      memberUids: [ALICE_UID, BOB_UID], createdAt: ts, updatedAt: ts,
    })
  );
  await assertFails(charlieDb.collection("calls").doc("call_1").get());
  await assertSucceeds(
    bobDb.collection("calls").doc("call_1").update({
      status: "ENDED", durationSeconds: 120, updatedAt: pastDate(1000),
    })
  );
  // Ended call cannot be modified
  await assertFails(
    bobDb.collection("calls").doc("call_1").update({
      status: "ACTIVE", durationSeconds: 150, updatedAt: pastDate(500),
    })
  );

  // Statuses
  await assertSucceeds(
    aliceDb.collection("statuses").doc("st_1").set({
      authorId: ALICE_UID, authorName: "Alice", text: "Shipping ConnectX v2",
      mediaType: "TEXT", visibility: "WORKSPACE", reactionsCount: 0,
      memberUids: [ALICE_UID], createdAt: ts, updatedAt: ts,
    })
  );
  await assertSucceeds(bobDb.collection("statuses").where("visibility", "==", "WORKSPACE").get());
  await assertSucceeds(
    bobDb.collection("statuses").doc("st_1").update({
      reactionsCount: 1, updatedAt: pastDate(500),
    })
  );

  // Support Tickets
  await assertSucceeds(
    aliceDb.collection("support_tickets").doc("tk_1").set({
      userId: ALICE_UID, userName: "Alice", subject: "SSO check", category: "Security",
      description: "Need SAML domain verification", priority: "HIGH", status: "OPEN",
      createdAt: ts, updatedAt: ts,
    })
  );
  await assertFails(bobDb.collection("support_tickets").doc("tk_1").get());
  await assertFails(
    aliceDb.collection("support_tickets").doc("tk_1").set({
      userId: ALICE_UID, userName: "Alice", subject: "Bad", category: "Tech",
      description: "Future ts", priority: "LOW", status: "OPEN",
      createdAt: futureDate(), updatedAt: futureDate(),
    })
  );
});
