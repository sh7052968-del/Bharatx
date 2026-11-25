'use client';

import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Clock,
  Eye,
  Laptop,
  Lock,
  LogOut,
  Moon,
  Palette,
  Shield,
  Smartphone,
  Sun,
  Trash2,
  User,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { apiRequest } from '@/lib/api-client';
import { Badge, Button, Card, Input } from '@/components/ui/primitives';
import { MfaEnrollmentDialog } from '@/components/admin/AuthGate';

interface DeviceSession {
  id: string;
  deviceName?: string;
  platform?: string;
  ipAddress?: string;
  createdAt: string;
  expiresAt: string;
}

export function ClientSettingsPanel() {
  const { user, refreshUserFlags, logout } = useAuth();

  // Profile Form states
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [department, setDepartment] = useState('General');
  const [profileSaved, setProfileSaved] = useState(false);

  // Privacy toggles
  const [showLastSeen, setShowLastSeen] = useState(true);
  const [showProfilePhoto, setShowProfilePhoto] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);
  const [privacySaved, setPrivacySaved] = useState(false);

  // Security / 2FA & Sessions
  const [mfaOpen, setMfaOpen] = useState(false);
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    loadPrivacyAndSessions();
  }, []);

  async function loadPrivacyAndSessions() {
    try {
      setLoadingSessions(true);
      const me = await apiRequest<{
        displayName?: string;
        username?: string;
        department?: string;
        showLastSeen?: boolean;
        showProfilePhoto?: boolean;
        readReceiptsEnabled?: boolean;
      }>('/users/me');

      if (me) {
        if (me.displayName) setDisplayName(me.displayName);
        if (me.username) setUsername(me.username);
        if (me.department) setDepartment(me.department);
        if (me.showLastSeen !== undefined) setShowLastSeen(me.showLastSeen);
        if (me.showProfilePhoto !== undefined) setShowProfilePhoto(me.showProfilePhoto);
        if (me.readReceiptsEnabled !== undefined) setReadReceipts(me.readReceiptsEnabled);
      }

      const sess = await apiRequest<DeviceSession[]>('/users/sessions');
      setSessions(sess || []);
    } catch {
      // Ignored
    } finally {
      setLoadingSessions(false);
    }
  }

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiRequest('/users/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({ displayName: displayName.trim(), username: username.trim(), department: department.trim() }),
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
      refreshUserFlags();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Cannot update profile');
    }
  }

  async function handleUpdatePrivacy() {
    try {
      await apiRequest('/users/me/privacy', {
        method: 'PATCH',
        body: JSON.stringify({
          showLastSeen,
          showProfilePhoto,
          readReceiptsEnabled: readReceipts,
        }),
      });
      setPrivacySaved(true);
      setTimeout(() => setPrivacySaved(false), 3000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Cannot update privacy');
    }
  }

  async function handleRevokeSession(sessionId: string) {
    if (!confirm('Revoke this device session?')) return;
    try {
      await apiRequest(`/users/sessions/${sessionId}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Cannot revoke session');
    }
  }

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-background p-6 space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Account & App Settings</h2>
        <p className="text-xs text-muted-foreground">Manage profile, security, end-to-end privacy, and active devices</p>
      </div>

      {/* 1. Profile Settings */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 border-b pb-3">
          <User className="h-5 w-5 text-emerald-600" />
          <h3 className="text-sm font-bold">Profile Information</h3>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold">Display Name</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold">Username</label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1"
                required
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold">Department / Team</label>
            <Input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {profileSaved && (
              <span className="text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Profile updated successfully!
              </span>
            )}
            <div className="ml-auto">
              <Button type="submit" size="sm" className="bg-emerald-700 text-white hover:bg-emerald-800">
                Save Profile
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {/* 2. Privacy Settings */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 border-b pb-3">
          <Eye className="h-5 w-5 text-emerald-600" />
          <h3 className="text-sm font-bold">Privacy & Visibility Preferences</h3>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold">Show Last Seen & Online Presence</div>
              <div className="text-[11px] text-muted-foreground">Allow your contacts to see when you are active</div>
            </div>
            <input
              type="checkbox"
              checked={showLastSeen}
              onChange={(e) => setShowLastSeen(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <div>
              <div className="text-xs font-semibold">Show Profile Photo</div>
              <div className="text-[11px] text-muted-foreground">Visible to registered team contacts</div>
            </div>
            <input
              type="checkbox"
              checked={showProfilePhoto}
              onChange={(e) => setShowProfilePhoto(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center justify-between border-t pt-3">
            <div>
              <div className="text-xs font-semibold">Read Receipts (Double Checkmarks)</div>
              <div className="text-[11px] text-muted-foreground">Send and receive read confirmation ticks</div>
            </div>
            <input
              type="checkbox"
              checked={readReceipts}
              onChange={(e) => setReadReceipts(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          {privacySaved && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Privacy settings applied!
            </span>
          )}
          <div className="ml-auto">
            <Button
              type="button"
              size="sm"
              onClick={handleUpdatePrivacy}
              className="bg-emerald-700 text-white hover:bg-emerald-800"
            >
              Apply Privacy Rules
            </Button>
          </div>
        </div>
      </Card>

      {/* 3. Security & Two-Factor Authentication */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-600" />
            <h3 className="text-sm font-bold">Two-Factor Authentication (2FA)</h3>
          </div>
          <Badge variant={user?.mfaEnabled ? 'success' : 'outline'} className="text-[10px]">
            {user?.mfaEnabled ? 'MFA Protected' : 'MFA Disabled'}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground">
          Enhance your account security with Time-based One-Time Password (TOTP) verification using Google Authenticator
          or any standard authenticator application.
        </p>

        <Button
          type="button"
          size="sm"
          onClick={() => setMfaOpen(true)}
          className="bg-emerald-700 text-white hover:bg-emerald-800"
        >
          {user?.mfaEnabled ? 'Re-enroll / View 2FA Secret' : 'Enable Two-Factor Authentication'}
        </Button>
      </Card>

      {/* 4. Active Sessions & Devices */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 border-b pb-3">
          <Laptop className="h-5 w-5 text-emerald-600" />
          <h3 className="text-sm font-bold">Active Device Sessions</h3>
        </div>

        {loadingSessions ? (
          <div className="text-xs text-muted-foreground">Loading sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="text-xs text-muted-foreground">Current session is active in browser memory.</div>
        ) : (
          <div className="divide-y">
            {sessions.map((sess) => (
              <div key={sess.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
                    {sess.deviceName || 'Web Client'} ({sess.platform || 'Browser'})
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    IP: {sess.ipAddress || '127.0.0.1'} • Created {new Date(sess.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-500 border-red-500/30 hover:bg-red-500/10 h-7 text-xs"
                  onClick={() => handleRevokeSession(sess.id)}
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Revoke
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* 5. Appearance & Theme */}
      <Card className="p-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-emerald-600" />
          <div>
            <h3 className="text-sm font-bold">Interface Theme</h3>
            <p className="text-[11px] text-muted-foreground">Toggle between Light and Dark mode appearance</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={toggleTheme} className="gap-1.5 text-xs">
          {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {isDark ? 'Switch to Light' : 'Switch to Dark'}
        </Button>
      </Card>

      {/* 6. Logout */}
      <div className="pt-2 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => logout()}
          className="text-red-600 border-red-600/30 hover:bg-red-600/10 gap-1.5 text-xs"
        >
          <LogOut className="h-4 w-4" /> Sign Out of ConnectX
        </Button>
      </div>

      {/* MFA Modal */}
      {mfaOpen && <MfaEnrollmentDialog onClose={() => setMfaOpen(false)} />}
    </div>
  );
}
