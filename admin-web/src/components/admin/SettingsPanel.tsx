'use client';

import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { apiRequest } from '@/lib/api-client';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Select, Switch } from '@/components/ui/primitives';

interface SystemSettingsState {
  branding: {
    appName?: string;
    logoUrl?: string;
    appIconUrl?: string;
    primaryColor?: string;
    accentColor?: string;
    splashHeadline?: string;
  };
  localization: { defaultLanguage?: string };
  privacy: { e2eeRequiredForPrivateChats?: boolean; defaultDisappearingSeconds?: number };
  notifications: { pushEnabled?: boolean; emailAlertsEnabled?: boolean };
  maintenanceMode: { enabled?: boolean; reason?: string | null };
}

export function SettingsPanel() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => apiRequest<SystemSettingsState>('/admin/settings'),
  });

  const [appName, setAppName] = useState('ConnectX');
  const [logoUrl, setLogoUrl] = useState('');
  const [appIconUrl, setAppIconUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#0D6E52');
  const [accentColor, setAccentColor] = useState('#10B981');
  const [splashHeadline, setSplashHeadline] = useState('');
  const [defaultLanguage, setDefaultLanguage] = useState('en');
  const [e2eeRequired, setE2eeRequired] = useState(true);
  const [disappearingSeconds, setDisappearingSeconds] = useState('0');
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(true);
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceReason, setMaintenanceReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setAppName(data.branding.appName ?? 'ConnectX');
    setLogoUrl(data.branding.logoUrl ?? '');
    setAppIconUrl(data.branding.appIconUrl ?? '');
    setPrimaryColor(data.branding.primaryColor ?? '#0D6E52');
    setAccentColor(data.branding.accentColor ?? '#10B981');
    setSplashHeadline(data.branding.splashHeadline ?? '');
    setDefaultLanguage(data.localization.defaultLanguage ?? 'en');
    setE2eeRequired(Boolean(data.privacy.e2eeRequiredForPrivateChats ?? true));
    setDisappearingSeconds(String(data.privacy.defaultDisappearingSeconds ?? 0));
    setPushEnabled(Boolean(data.notifications.pushEnabled ?? true));
    setEmailAlertsEnabled(Boolean(data.notifications.emailAlertsEnabled ?? true));
    setMaintenanceEnabled(Boolean(data.maintenanceMode.enabled ?? false));
    setMaintenanceReason(data.maintenanceMode.reason ?? '');
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequest('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          branding: { appName, logoUrl, appIconUrl, primaryColor, accentColor, splashHeadline },
          localization: { defaultLanguage, supported: ['en', 'hi', 'as'] },
          privacy: {
            e2eeRequiredForPrivateChats: e2eeRequired,
            defaultDisappearingSeconds: Number(disappearingSeconds) || 0,
          },
          notifications: { pushEnabled, emailAlertsEnabled },
          maintenanceEnabled,
          maintenanceReason: maintenanceReason || undefined,
        }),
      }),
    onSuccess: () => {
      setMsg('System settings persisted to PostgreSQL app_settings.');
      void qc.invalidateQueries({ queryKey: ['admin-settings'] });
      void qc.invalidateQueries({ queryKey: ['admin-overview'] });
    },
    onError: (err) => setMsg((err as Error).message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">System Settings</h1>
          <p className="text-xs text-muted-foreground">
            Configure ConnectX branding, splash assets, localization, privacy defaults, notifications, and maintenance mode
          </p>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          <Save className="h-4 w-4" /> Save All Settings
        </Button>
      </div>

      {msg && (
        <div className="rounded-md border border-primary/30 bg-accent px-3 py-2 text-xs text-accent-foreground">
          {msg}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Branding & Splash Configuration</CardTitle>
            <CardDescription>White-label naming, icons, colors, and splash headline</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium">App Name</label>
              <Input value={appName} onChange={(e) => setAppName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Logo URL</label>
                <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">App Icon URL</label>
                <Input value={appIconUrl} onChange={(e) => setAppIconUrl(e.target.value)} placeholder="https://..." />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Primary Color</label>
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Accent Color</label>
                <Input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">Splash Screen Headline</label>
              <Input value={splashHeadline} onChange={(e) => setSplashHeadline(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operations, Localization & Privacy</CardTitle>
            <CardDescription>Maintenance mode, language defaults, and E2EE baseline</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="text-sm font-medium">Maintenance Mode</div>
                <div className="text-xs text-muted-foreground">
                  Blocks non-Super Admin API traffic with HTTP 503
                </div>
              </div>
              <Switch checked={maintenanceEnabled} onCheckedChange={setMaintenanceEnabled} />
            </div>
            {maintenanceEnabled && (
              <Input
                placeholder="Maintenance banner reason..."
                value={maintenanceReason}
                onChange={(e) => setMaintenanceReason(e.target.value)}
              />
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Default Language</label>
                <Select value={defaultLanguage} onChange={(e) => setDefaultLanguage(e.target.value)}>
                  <option value="en">English (en)</option>
                  <option value="hi">Hindi (hi)</option>
                  <option value="as">Assamese (as)</option>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Default Disappearing TTL (sec)</label>
                <Input
                  type="number"
                  min={0}
                  value={disappearingSeconds}
                  onChange={(e) => setDisappearingSeconds(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Enforce E2EE for Private Chats</span>
              <Switch checked={e2eeRequired} onCheckedChange={setE2eeRequired} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Browser Push Notifications Enabled</span>
              <Switch checked={pushEnabled} onCheckedChange={setPushEnabled} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span>Operational Email Alerts Enabled</span>
              <Switch checked={emailAlertsEnabled} onCheckedChange={setEmailAlertsEnabled} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
