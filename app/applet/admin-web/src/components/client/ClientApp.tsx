'use client';

import React, { useState } from 'react';
import {
  Building2,
  CircleDot,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Moon,
  Phone,
  Settings,
  Shield,
  ShieldCheck,
  Sun,
  Users,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ClientNavTab } from '@/lib/types';
import { Badge, Button } from '@/components/ui/primitives';
import { BusinessWorkspacePanel } from './BusinessWorkspacePanel';
import { CallsPanel } from './CallsPanel';
import { ChatsPanel } from './ChatsPanel';
import { ClientSettingsPanel } from './ClientSettingsPanel';
import { CommunitiesPanel } from './CommunitiesPanel';
import { ContactsPanel } from './ContactsPanel';
import { StatusPanel } from './StatusPanel';

interface ClientAppProps {
  onSwitchToAdmin?: () => void;
}

const CLIENT_NAV_ITEMS: Array<{
  id: ClientNavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'chats', label: 'Chats', icon: MessageSquare },
  { id: 'contacts', label: 'Contacts', icon: Users },
  { id: 'communities', label: 'Communities', icon: Building2 },
  { id: 'calls', label: 'Calls', icon: Phone },
  { id: 'business', label: 'Business Suite', icon: Building2 },
  { id: 'status', label: 'Status', icon: CircleDot },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function ClientApp({ onSwitchToAdmin }: ClientAppProps) {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<ClientNavTab>('chats');
  const [dark, setDark] = useState(false);
  const [activeCallContact, setActiveCallContact] = useState<{ id: string; type: 'VOICE' | 'VIDEO' } | null>(null);

  const isAdmin = user && user.role !== 'MEMBER';

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
  }

  function handleStartCall(userId: string, type: 'VOICE' | 'VIDEO') {
    setActiveCallContact({ id: userId, type });
    setActiveTab('calls');
  }

  function handleStartChat(userId: string) {
    setActiveTab('chats');
  }

  if (!user) return null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* 1. Slim Left App Rail (WhatsApp Business / Enterprise Style) */}
      <aside className="flex w-16 shrink-0 flex-col items-center justify-between border-r bg-card/90 py-3 z-30">
        {/* Brand Icon */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-700 text-white shadow-md shadow-emerald-700/20">
            <ShieldCheck className="h-6 w-6" />
          </div>

          {/* Navigation Tab Icons */}
          <nav className="flex flex-col items-center gap-1.5 pt-2">
            {CLIENT_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isSelected = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                  title={item.label}
                >
                  <Icon className="h-5 w-5" />
                  {/* Tooltip on hover */}
                  <span className="absolute left-14 hidden rounded-md bg-popover px-2 py-1 text-[11px] font-semibold text-popover-foreground shadow-md group-hover:block z-50 whitespace-nowrap">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Actions: Theme, Logout, User Initial */}
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Toggle theme"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => logout()}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-500/10"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>

          <div
            onClick={() => setActiveTab('settings')}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-emerald-700 text-white text-xs font-bold ring-2 ring-emerald-500/30 hover:scale-105 transition-transform"
            title={user.displayName || user.username}
          >
            {(user.displayName || user.username).charAt(0).toUpperCase()}
          </div>
        </div>
      </aside>

      {/* 2. Main Content Viewport */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="flex h-14 items-center justify-between border-b px-5 bg-card/60 backdrop-blur-sm z-20">
          <div className="flex items-center gap-3">
            <span className="text-sm font-extrabold tracking-tight text-emerald-800 dark:text-emerald-400">
              ConnectX
            </span>
            <span className="text-muted-foreground text-xs">•</span>
            <span className="text-xs font-semibold text-foreground capitalize">
              {CLIENT_NAV_ITEMS.find((t) => t.id === activeTab)?.label}
            </span>
            <Badge variant="success" className="text-[10px] px-1.5 py-0">
              Online
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            {/* If user is an Admin, provide toggle button to switch to Enterprise Admin Console */}
            {isAdmin && onSwitchToAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={onSwitchToAdmin}
                className="h-8 gap-1.5 text-xs border-emerald-700/40 text-emerald-700 hover:bg-emerald-500/10 font-semibold"
              >
                <Shield className="h-3.5 w-3.5" />
                Admin Console
              </Button>
            )}

            <div className="flex items-center gap-2 border-l pl-3 text-xs">
              <span className="font-semibold text-foreground">{user.displayName || user.username}</span>
              <Badge variant="outline" className="text-[10px] font-mono">
                {user.role}
              </Badge>
            </div>
          </div>
        </header>

        {/* Tab Panel Render Container */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'chats' && <ChatsPanel onStartCall={handleStartCall} />}
          {activeTab === 'contacts' && (
            <ContactsPanel onStartChat={handleStartChat} onStartCall={handleStartCall} />
          )}
          {activeTab === 'communities' && <CommunitiesPanel />}
          {activeTab === 'calls' && <CallsPanel />}
          {activeTab === 'business' && <BusinessWorkspacePanel />}
          {activeTab === 'status' && <StatusPanel onReplyToStatus={(u, t) => handleStartChat(u)} />}
          {activeTab === 'settings' && <ClientSettingsPanel />}
        </div>
      </main>
    </div>
  );
}
