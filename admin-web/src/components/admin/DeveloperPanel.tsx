'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, DatabaseBackup, GitBranch, RotateCcw, ShieldCheck } from 'lucide-react';
import { apiRequest } from '@/lib/api-client';
import { formatBytes } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Select,
  Table,
  Td,
  Th,
} from '@/components/ui/primitives';

interface DeveloperOverview {
  modules: Array<{ id: string; key: string; name: string; version: string; enabled: boolean }>;
  releases: Array<{
    id: string;
    platform: string;
    version: string;
    buildNumber: number;
    stage: string;
    minSupported: boolean;
    checksumSha256: string | null;
    publishedAt: string;
  }>;
  jobs: {
    queuedNotificationJobs: number;
    failedNotificationJobs: number;
    rabbitMqStatus: string;
  };
  apiHealth: { status: string; nodeVersion: string; uptimeSeconds: number };
  backups: Array<{
    id: string;
    backupType: string;
    status: string;
    checksumSha256: string;
    sizeBytes: number;
    createdAt: string;
  }>;
  controlledReleasePolicy: string;
}

export function DeveloperPanel() {
  const qc = useQueryClient();
  const [platform, setPlatform] = useState('BACKEND');
  const [version, setVersion] = useState('2.1.0');
  const [buildNumber, setBuildNumber] = useState('210');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['admin-developer'],
    queryFn: () => apiRequest<DeveloperOverview>('/admin/developer/overview'),
  });

  const createReleaseMutation = useMutation({
    mutationFn: () =>
      apiRequest('/admin/developer/releases', {
        method: 'POST',
        body: JSON.stringify({
          platform,
          version,
          buildNumber: Number(buildNumber),
          releaseNotes: notes,
        }),
      }),
    onSuccess: () => {
      setMsg('Registered controlled release artifact on STAGING.');
      setNotes('');
      void qc.invalidateQueries({ queryKey: ['admin-developer'] });
    },
    onError: (err) => setMsg((err as Error).message),
  });

  const promoteMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/admin/developer/releases/${id}/request-production`, { method: 'POST' }),
    onSuccess: () => {
      setMsg('Submitted release for Super Admin production approval in Audit Center.');
      void qc.invalidateQueries({ queryKey: ['admin-approvals'] });
    },
    onError: (err) => setMsg((err as Error).message),
  });

  const rollbackMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/admin/developer/releases/${id}/rollback`, { method: 'POST' }),
    onSuccess: () => {
      setMsg('Release rolled back.');
      void qc.invalidateQueries({ queryKey: ['admin-developer'] });
    },
    onError: (err) => setMsg((err as Error).message),
  });

  const backupMutation = useMutation({
    mutationFn: () => apiRequest('/system/backups', { method: 'POST' }),
    onSuccess: () => {
      setMsg('Verified PostgreSQL metadata backup manifest created.');
      void qc.invalidateQueries({ queryKey: ['admin-developer'] });
    },
    onError: (err) => setMsg((err as Error).message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Developer Control Center</h1>
          <p className="text-xs text-muted-foreground">
            Module version registry, background queue health, staged release approvals, and verified rollbacks
          </p>
        </div>
        <Badge variant="success" className="gap-1">
          <ShieldCheck className="h-3.5 w-3.5" /> Controlled Code Releases Only
        </Badge>
      </div>

      {msg && (
        <div className="rounded-md border border-primary/30 bg-accent px-3 py-2 text-xs text-accent-foreground">
          {msg}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>API Runtime Health</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">{data?.apiHealth.status ?? '—'}</div>
            <div className="text-xs text-muted-foreground">
              {data?.apiHealth.nodeVersion} · Uptime {data?.apiHealth.uptimeSeconds ?? 0}s
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Background Queues</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold">
              {data?.jobs.queuedNotificationJobs ?? 0} queued / {data?.jobs.failedNotificationJobs ?? 0} failed
            </div>
            <div className="text-xs text-muted-foreground">
              RabbitMQ: {data?.jobs.rabbitMqStatus ?? '—'}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Database Backup Snapshot</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" onClick={() => backupMutation.mutate()} className="w-full">
              <DatabaseBackup className="h-4 w-4" /> Trigger Verified Backup Manifest
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" /> Register Staging Release
            </CardTitle>
            <CardDescription>
              Artifacts require verified Git/CI deployment & Super Admin approval to reach Production
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createReleaseMutation.mutate();
              }}
              className="space-y-3"
            >
              <Select value={platform} onChange={(e) => setPlatform(e.target.value)}>
                <option value="BACKEND">BACKEND</option>
                <option value="ADMIN_WEB">ADMIN_WEB</option>
                <option value="ANDROID">ANDROID</option>
              </Select>
              <Input
                required
                placeholder="SemVer e.g. 2.1.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
              />
              <Input
                required
                type="number"
                placeholder="Build number"
                value={buildNumber}
                onChange={(e) => setBuildNumber(e.target.value)}
              />
              <Input
                required
                placeholder="Controlled release changelog notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <Button type="submit" className="w-full">
                Stage Release Candidate
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Release Pipeline & Deployment History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <thead>
                <tr>
                  <Th>Artifact</Th>
                  <Th>Stage</Th>
                  <Th>SHA-256</Th>
                  <Th>Controls</Th>
                </tr>
              </thead>
              <tbody>
                {(data?.releases ?? []).map((rel) => (
                  <tr key={rel.id}>
                    <Td>
                      <div className="font-semibold">
                        {rel.platform} v{rel.version}
                      </div>
                      <div className="text-xs text-muted-foreground">Build #{rel.buildNumber}</div>
                    </Td>
                    <Td>
                      <Badge
                        variant={
                          rel.stage === 'PRODUCTION'
                            ? 'success'
                            : rel.stage === 'ROLLED_BACK'
                              ? 'destructive'
                              : 'warning'
                        }
                      >
                        {rel.stage}
                      </Badge>
                    </Td>
                    <Td className="font-mono text-[11px] text-muted-foreground">
                      {rel.checksumSha256 ? `${rel.checksumSha256.slice(0, 12)}…` : '—'}
                    </Td>
                    <Td>
                      <div className="flex gap-1.5">
                        {rel.stage === 'STAGING' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => promoteMutation.mutate(rel.id)}
                          >
                            <ArrowUpRight className="h-3.5 w-3.5" /> Request Prod Approval
                          </Button>
                        )}
                        {rel.stage !== 'ROLLED_BACK' && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => rollbackMutation.mutate(rel.id)}
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Rollback
                          </Button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <div className="mt-4 border-t pt-3 space-y-1.5">
              <div className="text-xs font-semibold uppercase text-muted-foreground">
                Verified Backup Manifests ({data?.backups.length ?? 0})
              </div>
              {(data?.backups ?? []).slice(0, 4).map((b) => (
                <div key={b.id} className="flex justify-between text-xs border rounded px-2.5 py-1.5">
                  <span>
                    {b.backupType} · {formatBytes(b.sizeBytes)}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {b.checksumSha256.slice(0, 14)}…
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
