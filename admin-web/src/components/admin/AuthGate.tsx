'use client';

import React, { useState } from 'react';
import { KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { apiRequest } from '@/lib/api-client';
import { useAuth } from '@/lib/auth-context';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Modal } from '@/components/ui/primitives';

export function AuthGate() {
  const { login, registerFirstAdmin } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password, mfaCode.trim() || undefined);
      } else {
        await registerFirstAdmin({ email, username, displayName, password });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-emerald-100/60 dark:from-emerald-950/60 dark:via-background dark:to-emerald-950/30 p-4">
      <Card className="w-full max-w-md border-emerald-200/80 dark:border-emerald-900 shadow-lg">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">ConnectX Admin Console</CardTitle>
                <CardDescription>Enterprise Multi-Admin Governance</CardDescription>
              </div>
            </div>
            <Badge variant="success">RBAC + MFA</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex rounded-lg bg-muted p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                mode === 'login' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              Admin Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                mode === 'register' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
              }`}
            >
              First-Run Bootstrap
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium">Display Name</label>
                  <Input
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Principal Security Admin"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium">Username</label>
                  <Input
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="superadmin"
                  />
                </div>
              </>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium">Administrator Email</label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@connectx.enterprise"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium">Password</label>
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
              />
            </div>

            {mode === 'login' && (
              <div>
                <label className="mb-1 flex items-center gap-1.5 text-xs font-medium">
                  <KeyRound className="h-3.5 w-3.5 text-primary" /> TOTP MFA Code (if enrolled)
                </label>
                <Input
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="6-digit authenticator code"
                  maxLength={6}
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              <Lock className="h-4 w-4" />
              {loading
                ? 'Authenticating...'
                : mode === 'login'
                  ? 'Sign In to Admin Console'
                  : 'Create Bootstrap Super Admin'}
            </Button>
          </form>

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Sessions are held strictly in memory with rotating refresh tokens. E2EE private message
            content is never accessible from admin APIs.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function MfaEnrollmentDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { refreshUserFlags } = useAuth();
  const [secret, setSecret] = useState<string | null>(null);
  const [otpAuthUrl, setOtpAuthUrl] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function initMfaSetup() {
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await apiRequest<{ secret: string; otpauthUri: string }>('/auth/mfa/enroll', {
        method: 'POST',
      });
      setSecret(res.secret);
      setOtpAuthUrl(res.otpauthUri);
    } catch (err) {
      setStatusMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function verifyAndEnable(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatusMsg(null);
    try {
      await apiRequest('/auth/mfa/activate', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      await refreshUserFlags();
      setStatusMsg('MFA verified and enforced for this administrator account.');
      setSecret(null);
      setCode('');
    } catch (err) {
      setStatusMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} title="Administrator TOTP MFA Security" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">
          ConnectX administrators are strongly required to protect privileged governance sessions with
          RFC-6238 TOTP Multi-Factor Authentication.
        </p>

        {statusMsg && (
          <div className="rounded-md border border-primary/30 bg-accent px-3 py-2 text-xs text-accent-foreground">
            {statusMsg}
          </div>
        )}

        {!secret ? (
          <Button onClick={initMfaSetup} disabled={loading} className="w-full">
            {loading ? 'Generating TOTP Secret...' : 'Generate New TOTP MFA Secret'}
          </Button>
        ) : (
          <form onSubmit={verifyAndEnable} className="space-y-3">
            <div className="rounded-lg border bg-muted p-3 text-xs space-y-1">
              <div className="font-semibold">Authenticator Key (Base32):</div>
              <code className="block break-all font-mono text-primary">{secret}</code>
              {otpAuthUrl && (
                <div className="pt-1 text-[11px] text-muted-foreground break-all">{otpAuthUrl}</div>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Enter 6-digit verification code</label>
              <Input
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="123456"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Verifying...' : 'Verify & Enable Admin MFA'}
            </Button>
          </form>
        )}
      </div>
    </Modal>
  );
}
