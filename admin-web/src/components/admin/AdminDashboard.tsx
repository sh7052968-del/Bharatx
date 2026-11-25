'use client';

import React, { useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  Code2,
  CreditCard,
  Flag,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  ScrollText,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sun,
  UserCog,
  Users,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ADMIN_ROLE_LABELS, AdminModuleId, ROLE_VISIBLE_MODULES } from '@/lib/types';
import { Badge, Button } from '@/components/ui/primitives';
import { AdminsPanel } from './AdminsPanel';
import { AnalyticsPanel } from './AnalyticsPanel';
import { AuditPanel } from './AuditPanel';
import { MfaEnrollmentDialog } from './AuthGate';
import { BusinessPanel } from './BusinessPanel';
import { DeveloperPanel } from './DeveloperPanel';
import { FeaturesPanel } from './FeaturesPanel';
import { FinancePanel } from './FinancePanel';
import { ModerationPanel } from './ModerationPanel';
import { NotificationsPanel } from './NotificationsPanel';
import { OverviewPanel } from './OverviewPanel';
import { RolesPanel } from './RolesPanel';
import { SettingsPanel } from './SettingsPanel';
import { UsersPanel } from './UsersPanel';

const NAV_ITEMS: Array<{
  id: AdminModuleId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'A. Overview', icon: LayoutDashboard },
  { id: 'users', label: 'B. User Management', icon: Users },
  { id: 'admins', label: 'C. Admin Management', icon: UserCog },
  { id: 'roles', label: 'D. Roles & Permissions', icon: KeyRound },
  { id: 'features', label: 'E. Feature Control', icon: Flag },
  { id: 'business', label: 'F. Business Desk', icon: Building2 },
  { id: 'moderation', label: 'G. Moderation', icon: ShieldAlert },
  { id: 'finance', label: 'H. Finance', icon: CreditCard },
  { id: 'notifications', label: 'I. Notifications', icon: Bell },
  { id: 'analytics', label: 'J. Analytics', icon: BarChart3 },
  { id: 'settings', label: 'K. System Settings', icon: Settings },
  { id: 'audit', label: 'L. Audit Center', icon: ScrollText },
  { id: 'developer', label: 'M. Developer Control', icon: Code2 },
];

export function AdminDashboard({ onSwitchToClient }: { onSwitchToClient?: () => void } = {}) {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminModuleId>('overview');
  const [dark, setDark] = useState(false);
  const [mfaOpen, setMfaOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);

  const visibleItems = useMemo(() => {
    if (!user) return [];
    const allowed = ROLE_VISIBLE_MODULES[user.role] ?? ['overview'];
    return NAV_ITEMS.filter((item) => allowed.includes(item.id));
  }, [user]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
  }

  if (!user) return null;

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside
        className={`${
          mobileMenu ? 'fixed inset-y-0 left-0 z-40 block' : 'hidden'
        } w-64 shrink-0 border-r bg-card md:static md:block`}
      >
        <div className="flex h-16 items-center gap-2.5 border-b px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight">ConnectX Admin</div>
            <div className="text-[11px] text-muted-foreground">Enterprise Control</div>
          </div>
        </div>

        <nav className="space-y-1 p-3 overflow-y-auto max-h-[calc(100vh-8rem)]">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenu(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-medium transition ${
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t p-3 text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <span>Deterministic RBAC · No AI</span>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-card px-4 md:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenu(!mobileMenu)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <div className="text-sm font-semibold">{user.displayName}</div>
              <div className="text-xs text-muted-foreground">{user.email}</div>
            </div>
            <Badge variant="success">{ADMIN_ROLE_LABELS[user.role] ?? user.role}</Badge>
          </div>

          <div className="flex items-center gap-2">
            {onSwitchToClient && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSwitchToClient}
                className="gap-1.5 text-xs text-emerald-700 border-emerald-600/40 hover:bg-emerald-500/10 font-semibold"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                Messenger & Workspace
              </Button>
            )}
            <Button
              variant={user.mfaEnabled ? 'outline' : 'secondary'}
              size="sm"
              onClick={() => setMfaOpen(true)}
            >
              <KeyRound className="h-3.5 w-3.5" />
              {user.mfaEnabled ? 'MFA Active' : 'Enable Admin MFA'}
            </Button>
            <Button variant="outline" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={() => void logout()}>
              <LogOut className="h-3.5 w-3.5" /> Sign Out
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {activeTab === 'overview' && <OverviewPanel />}
          {activeTab === 'users' && <UsersPanel />}
          {activeTab === 'admins' && <AdminsPanel />}
          {activeTab === 'roles' && <RolesPanel />}
          {activeTab === 'features' && <FeaturesPanel />}
          {activeTab === 'business' && <BusinessPanel />}
          {activeTab === 'moderation' && <ModerationPanel />}
          {activeTab === 'finance' && <FinancePanel />}
          {activeTab === 'notifications' && <NotificationsPanel />}
          {activeTab === 'analytics' && <AnalyticsPanel />}
          {activeTab === 'settings' && <SettingsPanel />}
          {activeTab === 'audit' && <AuditPanel />}
          {activeTab === 'developer' && <DeveloperPanel />}
        </main>
      </div>

      <MfaEnrollmentDialog open={mfaOpen} onClose={() => setMfaOpen(false)} />
    </div>
  );
}
