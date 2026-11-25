# ConnectX Enterprise Backend API Reference (`/api/v1`)

Interactive OpenAPI / Swagger UI is served at **`GET /api/v1/docs`** (`GET /api/v1/docs-json` for raw OpenAPI JSON).

## REST Modules

1. **Authentication (`/api/v1/auth`)**:
   - `POST /register` — Argon2id account creation + device session + rotating refresh token
   - `POST /login` — Credential + optional TOTP MFA authentication
   - `POST /refresh` — Refresh-token rotation with replay-reuse family revocation
   - `POST /logout` — Session revocation
   - `POST /otp/request`, `POST /otp/verify`, `POST /password/reset` — Email/Mobile/Reset OTP flows
   - `POST /mfa/enroll`, `POST /mfa/activate`, `POST /mfa/disable` — RFC-6238 TOTP MFA
   - `GET /devices`, `DELETE /devices/:sessionId` — Active device/session management
2. **Users (`/api/v1/users`)**:
   - `GET /me`, `PATCH /me/profile`, `POST /me/avatar`, `PATCH /me/privacy`, `PATCH /me/presence`
   - `PUT /me/keys`, `GET /:userId/keys` — E2EE identity & signed prekey bundle registry
   - `GET /contacts`, `POST /contacts`, `DELETE /contacts/:contactId`
   - `GET /blocks`, `POST /blocks`, `DELETE /blocks/:blockedId`, `POST /reports`, `GET /:userId`
3. **Messaging (`/api/v1/messaging`)**:
   - `POST /conversations`, `GET /conversations`, `PATCH /conversations/:id/disappearing`
   - `POST /messages`, `GET /conversations/:id/messages`, `GET /conversations/:id/search`
   - `PATCH /messages/:id`, `DELETE /messages/:id`, `POST /messages/:id/reactions`
   - `PUT /messages/:id/delivered`, `PUT /messages/:id/read`, `PATCH /messages/:id/pin`, `PATCH /messages/:id/star`, `GET /starred`
   - `POST /upload`, `GET /files/:fileName` — Magic-byte validated & path-confined media uploads
4. **Groups (`/api/v1/groups`)**:
   - `POST /`, `GET /:id`, `POST /:id/members`, `DELETE /:id/members/:targetUserId`, `PUT /:id/members/:targetUserId/role`, `PATCH /:id/permissions`, `POST /:id/invite/rotate`, `POST /join/:inviteCode`, `POST /:id/announcements`
5. **Communities (`/api/v1/communities`)**:
   - `POST /`, `GET /`, `POST /:id/join`, `POST /:id/groups`, `POST /:id/announcements`, `GET /:id/announcements`, `PUT /:id/members/:targetUserId/moderation`
6. **Calling (`/api/v1/calling`)**:
   - `GET /ice-servers` — STUN + time-limited HMAC TURN credentials
   - `POST /sessions`, `POST /sessions/:id/accept`, `POST /sessions/:id/end`, `GET /history`
7. **Business (`/api/v1/business`)**:
   - `POST /profile`, `GET /profile`, `POST /verification/request`, `PATCH /rules`
   - `POST /products`, `GET /catalog`, `PATCH /products/:id/stock`
   - `POST /customers`, `GET /customers`, `POST /customers/:id/notes`
   - `PUT /quick-replies`, `GET /quick-replies`, `POST /orders`, `PATCH /orders/:id/status`, `GET /analytics`
8. **Notifications (`/api/v1/notifications`)**:
   - `GET /`, `PATCH /:id/read`, `GET /preferences`, `PUT /preferences`, `POST /push-subscriptions`, `GET /providers/status`
9. **Payments (`/api/v1/payments`)**:
   - `GET /plans`, `POST /plans`, `POST /subscribe` (`Idempotency-Key`), `POST /webhook` (Stripe signature verification), `GET /invoices`, `GET /transactions`, `POST /refunds`
10. **Administration (`/api/v1/admin`)**:
    - **A. Overview**: `GET /overview`
    - **B. User Governance**: `GET /users`, `PATCH /users/:id`, `POST /users/:id/action` (verify/suspend/ban/restore)
    - **C. Admin Management**: `GET /admins`, `POST /admins`, `PATCH /admins/:id`, `DELETE /admins/:id`, `GET /admins/login-history`
    - **D. Role & Permission Center**: `GET /roles`, `POST /roles`, `PATCH /roles/:id`, `DELETE /roles/:id`, `GET /permissions`
    - **E. Feature Control Center**: `GET /features`, `PUT /features/modules/:key`, `PUT /features/flags/:key`, `POST /features/rollback`
    - **F. Business Management**: `GET /businesses`, `POST /businesses/:id/verify`, `PATCH /businesses/:id/restrict`, `GET /businesses/:id/catalog`, `PATCH /businesses/:id/catalog/:productId`
    - **G. Content Moderation**: `GET /moderation/reports`, `POST /moderation/reports/:id/decision`
    - **H. Finance**: `GET /finance/overview`, `PUT /finance/plans`, `POST /finance/refunds`
    - **I. Notifications**: `GET /notifications`, `PUT /notifications/templates`, `POST /notifications/campaigns`
    - **J. Analytics**: `GET /analytics`, `GET /analytics/export.csv`
    - **K. System Settings**: `GET /settings`, `PUT /settings`
    - **L. Audit & Approvals**: `GET /approvals`, `POST /approvals/:id/review`, `GET /audit-logs`
    - **M. Developer Control Center**: `GET /developer/overview`, `POST /developer/releases`, `POST /developer/releases/:id/request-production`, `POST /developer/releases/:id/rollback`
    - *Zero-access E2EE enforcement*: Administrators cannot query or decrypt private conversation messages.
11. **System Management (`/api/v1/system`)**:
    - `GET /health`, `GET /announcements`, `PUT /config`, `GET /config`, `PUT /maintenance`, `PUT /feature-flags`, `GET /feature-flags`, `POST /announcements`, `POST /backups`, `GET /backups`, `GET /logs`

## Socket.IO Events (`/realtime`)
- `message:send`, `message:received`, `message:delivered`, `message:read`, `message:edited`, `message:deleted`
- `user:online`, `user:offline`, `user:typing`
- `call:incoming`, `call:accepted`, `call:ended`, `call:signal` (WebRTC SDP offer/answer & ICE candidates)
- `notification:new`
