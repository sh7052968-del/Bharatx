'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Building2,
  Database,
  HardDrive,
  Lock,
  MessageSquare,
  PhoneCall,
  RefreshCw,
  Server,
  Users,
  UsersRound,
} from 'lucide-react';
import { apiRequest } from '@/lib/api-client';
import { formatBytes } from '@/lib/utils';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives';

interface OverviewResponse {
  metrics: {
    totalUsers: number;
    activeUsers: number;
    onlineUsers: number;
    totalMessages: number;
    totalGroups: number;
    totalBusinesses: number;
    totalCalls: number;
    storageBytes: number;
    openReports: number;
    pendingApprovals: number;
  };
  serverHealth: {
    status: string;
    postgresql: string;
    redis: string;
    rabbitmq: string;
    uptimeSeconds: number;
    memoryRssBytes: number;
  };
  systemActivity: Array<{
    id: string;
    category: string;
    action: string;
    targetType: string;
    summary: string;
    createdAt: string;
    actor?: { email: string; displayName: string; role: string };
  }>;
  e2eeBoundary: string;
}

export function OverviewPanel() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: () => apiRequest<OverviewResponse>('/admin/overview'),
  });

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading telemetry...</div>;
  if (error) {
    return (
      <Card className="border-destructive/40">
        <CardContent className="pt-5 text-sm text-destructive">
          {(error as Error).message}
        </CardContent>
      </Card>
    );
  }
  if (!data) return null;

  const cards = [
    { label: 'Total Users', value: data.metrics.totalUsers, icon: Users, note: 'Registered non-deleted accounts' },
    { label: 'Active Users (24h)', value: data.metrics.activeUsers, icon: Activity, note: 'Seen within 24 hours' },
    { label: 'Online Now', value: data.metrics.onlineUsers, icon: Users, note: 'Active WebSocket presence' },
    { label: 'Total Messages (Count)', value: data.metrics.totalMessages, icon: MessageSquare, note: 'E2EE payloads never readable' },
    { label: 'Total Groups', value: data.metrics.totalGroups, icon: UsersRound, note: 'Active group workspaces' },
    { label: 'Total Businesses', value: data.metrics.totalBusinesses, icon: Building2, note: 'Verified & pending accounts' },
    { label: 'Total Calls', value: data.metrics.totalCalls, icon: PhoneCall, note: 'Voice, video & group calls' },
    { label: 'Storage Usage', value: formatBytes(data.metrics.storageBytes), icon: HardDrive, note: 'Verified media objects' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Platform Overview</h1>
          <p className="text-xs text-muted-foreground">
            Real-time deterministic ConnectX metrics, infrastructure health, and audit stream
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" className="gap-1">
            <Lock className="h-3 w-3" /> {data.e2eeBoundary}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh Telemetry
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardDescription className="font-medium">{item.label}</CardDescription>
                <Icon className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{item.value}</div>
                <p className="mt-1 text-[11px] text-muted-foreground">{item.note}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" /> Server & Data Health
            </CardTitle>
            <CardDescription>Live backend dependency status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span>Cluster Status</span>
              <Badge variant={data.serverHealth.status === 'HEALTHY' ? 'success' : 'destructive'}>
                {data.serverHealth.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Database className="h-3.5 w-3.5 text-muted-foreground" /> PostgreSQL
              </span>
              <Badge variant="outline">{data.serverHealth.postgresql}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Redis Cache</span>
              <Badge variant="outline">{data.serverHealth.redis}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>RabbitMQ Broker</span>
              <Badge variant="outline">{data.serverHealth.rabbitmq}</Badge>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
              <span>Uptime: {data.serverHealth.uptimeSeconds}s</span>
              <span>RSS: {formatBytes(data.serverHealth.memoryRssBytes)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent System & Admin Activity</CardTitle>
            <CardDescription>
              Open Reports: {data.metrics.openReports} · Pending Approvals:{' '}
              {data.metrics.pendingApprovals}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {data.systemActivity.length === 0 ? (
                <p className="text-xs text-muted-foreground">No administrative events recorded yet.</p>
              ) : (
                data.systemActivity.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
                  >
                    <div>
                      <div className="font-semibold">
                        {ev.action}{' '}
                        <span className="font-normal text-muted-foreground">({ev.targetType})</span>
                      </div>
                      <div className="text-muted-foreground">{ev.summary}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        Actor: {ev.actor?.email ?? 'System'}
                      </div>
                    </div>
                    <Badge variant="secondary">{ev.category}</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
