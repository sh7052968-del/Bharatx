'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Download, FileText } from 'lucide-react';
import { apiRequest } from '@/lib/api-client';
import { formatBytes } from '@/lib/utils';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/primitives';

interface AnalyticsResponse {
  totals: {
    users: number;
    messages: number;
    businesses: number;
    mediaObjects: number;
    storageBytes: number;
  };
  subscriptions: Array<{ status: string; _count: { id: number } }>;
  userGrowth7d: Array<{ date: string; newUsers: number }>;
}

export function AnalyticsPanel() {
  const [msg, setMsg] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ['admin-analytics'],
    queryFn: () => apiRequest<AnalyticsResponse>('/admin/analytics'),
  });

  async function handleExportCsv() {
    try {
      const csv = await apiRequest<string>('/admin/analytics/export.csv');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `connectx-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg('Exported CSV analytics report.');
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  function handleExportPdf() {
    window.print();
  }

  const maxGrowth = Math.max(1, ...(data?.userGrowth7d.map((d) => d.newUsers) ?? [1]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Deterministic Analytics</h1>
          <p className="text-xs text-muted-foreground">
            Aggregate user growth, daily activity, message counts, subscription stats, and storage reports
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <Button variant="outline" onClick={handleExportCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button onClick={handleExportPdf}>
            <FileText className="h-4 w-4" /> Export PDF
          </Button>
        </div>
      </div>

      {msg && (
        <div className="rounded-md border border-primary/30 bg-accent px-3 py-2 text-xs text-accent-foreground">
          {msg}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Users</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{data?.totals.users ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Message Volume (Count)</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{data?.totals.messages ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Business Growth</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{data?.totals.businesses ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Media Objects</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{data?.totals.mediaObjects ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Storage Consumed</CardDescription>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {formatBytes(data?.totals.storageBytes ?? 0)}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> 7-Day User Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-44 items-end gap-3 pt-4">
              {(data?.userGrowth7d ?? []).map((pt) => {
                const heightPct = Math.max(8, Math.round((pt.newUsers / maxGrowth) * 100));
                return (
                  <div key={pt.date} className="flex flex-1 flex-col items-center gap-2">
                    <span className="text-xs font-semibold">{pt.newUsers}</span>
                    <div
                      className="w-full max-w-[44px] rounded-t-md bg-primary transition-all"
                      style={{ height: `${heightPct}%` }}
                    />
                    <span className="text-[11px] text-muted-foreground">{pt.date.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subscription Distribution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.subscriptions ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No subscription records yet.</p>
            ) : (
              data?.subscriptions.map((s) => (
                <div key={s.status} className="flex items-center justify-between rounded-lg border p-2.5 text-sm">
                  <Badge variant="outline">{s.status}</Badge>
                  <span className="font-bold">{s._count.id}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
