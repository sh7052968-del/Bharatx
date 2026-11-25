'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Megaphone, Send } from 'lucide-react';
import { apiRequest } from '@/lib/api-client';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Textarea,
} from '@/components/ui/primitives';

interface NotificationCenterState {
  announcements: Array<{ id: string; title: string; body: string; severity: string; createdAt: string }>;
  templates: Array<{
    id: string;
    templateKey: string;
    channel: string;
    subjectTemplate: string;
    bodyTemplate: string;
  }>;
  recentNotifications: Array<{
    id: string;
    channel: string;
    eventType: string;
    title: string;
    deliveryStatus: string;
    createdAt: string;
  }>;
}

export function NotificationsPanel() {
  const qc = useQueryClient();
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [annSeverity, setAnnSeverity] = useState('INFO');
  const [campTitle, setCampTitle] = useState('');
  const [campBody, setCampBody] = useState('');
  const [campChannel, setCampChannel] = useState('IN_APP');
  const [campAudience, setCampAudience] = useState('ALL');
  const [tplKey, setTplKey] = useState('');
  const [tplSubject, setTplSubject] = useState('');
  const [tplBody, setTplBody] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: () => apiRequest<NotificationCenterState>('/admin/notifications'),
  });

  const annMutation = useMutation({
    mutationFn: () =>
      apiRequest('/system/announcements', {
        method: 'POST',
        body: JSON.stringify({ title: annTitle, body: annBody, severity: annSeverity }),
      }),
    onSuccess: () => {
      setMsg('System announcement / maintenance alert published.');
      setAnnTitle('');
      setAnnBody('');
      void qc.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
    onError: (err) => setMsg((err as Error).message),
  });

  const campaignMutation = useMutation({
    mutationFn: () =>
      apiRequest<{ queuedCount: number }>('/admin/notifications/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          title: campTitle,
          body: campBody,
          channel: campChannel,
          audience: campAudience,
        }),
      }),
    onSuccess: (res) => {
      setMsg(`Dispatched campaign to ${res.queuedCount} recipients.`);
      setCampTitle('');
      setCampBody('');
      void qc.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
    onError: (err) => setMsg((err as Error).message),
  });

  const templateMutation = useMutation({
    mutationFn: () =>
      apiRequest('/admin/notifications/templates', {
        method: 'PUT',
        body: JSON.stringify({
          templateKey: tplKey,
          channel: 'EMAIL',
          subjectTemplate: tplSubject,
          bodyTemplate: tplBody,
        }),
      }),
    onSuccess: () => {
      setMsg('Notification template saved.');
      setTplKey('');
      setTplSubject('');
      setTplBody('');
      void qc.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
    onError: (err) => setMsg((err as Error).message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Notifications & Campaigns</h1>
        <p className="text-xs text-muted-foreground">
          Publish maintenance alerts, manage notification templates, and dispatch multi-channel campaigns
        </p>
      </div>

      {msg && (
        <div className="rounded-md border border-primary/30 bg-accent px-3 py-2 text-xs text-accent-foreground">
          {msg}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-primary" /> Publish Announcement / Maintenance Alert
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                annMutation.mutate();
              }}
              className="space-y-3"
            >
              <Input
                required
                placeholder="Announcement title"
                value={annTitle}
                onChange={(e) => setAnnTitle(e.target.value)}
              />
              <Select value={annSeverity} onChange={(e) => setAnnSeverity(e.target.value)}>
                <option value="INFO">INFO</option>
                <option value="WARNING">MAINTENANCE ALERT</option>
                <option value="CRITICAL">CRITICAL SECURITY NOTICE</option>
              </Select>
              <Textarea
                required
                placeholder="Alert details..."
                value={annBody}
                onChange={(e) => setAnnBody(e.target.value)}
              />
              <Button type="submit" className="w-full">
                Publish Alert
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" /> Dispatch Campaign
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                campaignMutation.mutate();
              }}
              className="space-y-3"
            >
              <Input
                required
                placeholder="Campaign title"
                value={campTitle}
                onChange={(e) => setCampTitle(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-2">
                <Select value={campChannel} onChange={(e) => setCampChannel(e.target.value)}>
                  <option value="IN_APP">IN_APP</option>
                  <option value="PUSH">WEB PUSH</option>
                  <option value="EMAIL">EMAIL</option>
                </Select>
                <Select value={campAudience} onChange={(e) => setCampAudience(e.target.value)}>
                  <option value="ALL">All Users</option>
                  <option value="ADMINS">Administrators</option>
                  <option value="BUSINESS_OWNERS">Business Owners</option>
                </Select>
              </div>
              <Textarea
                required
                placeholder="Campaign message..."
                value={campBody}
                onChange={(e) => setCampBody(e.target.value)}
              />
              <Button type="submit" className="w-full">
                Queue Campaign Delivery
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" /> Upsert Notification Template
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                templateMutation.mutate();
              }}
              className="space-y-3"
            >
              <Input
                required
                placeholder="template.key.name"
                value={tplKey}
                onChange={(e) => setTplKey(e.target.value)}
              />
              <Input
                required
                placeholder="Subject template"
                value={tplSubject}
                onChange={(e) => setTplSubject(e.target.value)}
              />
              <Textarea
                required
                placeholder="Body template with {{variables}}"
                value={tplBody}
                onChange={(e) => setTplBody(e.target.value)}
              />
              <Button type="submit" variant="outline" className="w-full">
                Save Template
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Active Announcements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.announcements ?? []).map((a) => (
              <div key={a.id} className="rounded-lg border p-3 text-xs">
                <div className="flex items-center justify-between font-semibold">
                  <span>{a.title}</span>
                  <Badge variant="outline">{a.severity}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">{a.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configured Templates ({data?.templates.length ?? 0})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.templates ?? []).map((t) => (
              <div key={t.id} className="rounded-lg border p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold">{t.templateKey}</span>
                  <Badge variant="secondary">{t.channel}</Badge>
                </div>
                <div className="mt-1 font-medium">{t.subjectTemplate}</div>
                <p className="text-muted-foreground">{t.bodyTemplate}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
