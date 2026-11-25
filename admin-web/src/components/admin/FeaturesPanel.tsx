'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, RotateCcw, Save, Sliders } from 'lucide-react';
import { apiRequest } from '@/lib/api-client';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Modal,
  Switch,
  Textarea,
} from '@/components/ui/primitives';

interface FeatureState {
  modules: Array<{
    id: string;
    key: string;
    name: string;
    description: string | null;
    version: string;
    enabled: boolean;
    settingsJson: Record<string, unknown> | null;
    parents: Array<{ dependsOnModule: { key: string; name: string } }>;
  }>;
  flags: Array<{
    id: string;
    key: string;
    enabled: boolean;
    description: string | null;
    rolloutPercent: number;
    eligibilityJson: Record<string, unknown> | null;
  }>;
  history: Array<{
    id: string;
    targetType: 'MODULE' | 'FLAG';
    targetKey: string;
    changedById: string;
    changedAt: string;
  }>;
}

export function FeaturesPanel() {
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const [editModuleKey, setEditModuleKey] = useState<string | null>(null);
  const [modVersion, setModVersion] = useState('1.0.0');
  const [modSettings, setModSettings] = useState('{}');
  const [modDeps, setModDeps] = useState('');
  const [newFlagKey, setNewFlagKey] = useState('');
  const [newFlagDesc, setNewFlagDesc] = useState('');
  const [newFlagEligibility, setNewFlagEligibility] = useState('{"roles":["SUPER_ADMIN","PLATFORM_ADMIN"]}');

  const { data } = useQuery({
    queryKey: ['admin-features'],
    queryFn: () => apiRequest<FeatureState>('/admin/features'),
  });

  const moduleMutation = useMutation({
    mutationFn: ({ key, payload }: { key: string; payload: Record<string, unknown> }) =>
      apiRequest(`/admin/features/modules/${key}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setMsg('Module configuration updated.');
      setEditModuleKey(null);
      void qc.invalidateQueries({ queryKey: ['admin-features'] });
    },
    onError: (err) => setMsg((err as Error).message),
  });

  const flagMutation = useMutation({
    mutationFn: ({ key, payload }: { key: string; payload: Record<string, unknown> }) =>
      apiRequest(`/admin/features/flags/${key}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setMsg('Feature flag updated.');
      setNewFlagKey('');
      setNewFlagDesc('');
      void qc.invalidateQueries({ queryKey: ['admin-features'] });
    },
    onError: (err) => setMsg((err as Error).message),
  });

  const rollbackMutation = useMutation({
    mutationFn: (snapshotId: string) =>
      apiRequest('/admin/features/rollback', {
        method: 'POST',
        body: JSON.stringify({ snapshotId }),
      }),
    onSuccess: () => {
      setMsg('Rolled back configuration snapshot cleanly.');
      void qc.invalidateQueries({ queryKey: ['admin-features'] });
    },
    onError: (err) => setMsg((err as Error).message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Feature Control Center</h1>
        <p className="text-xs text-muted-foreground">
          Control module enablement, dependencies, versioning, rollout percentages, eligibility rules, and snapshots
        </p>
      </div>

      {msg && (
        <div className="rounded-md border border-primary/30 bg-accent px-3 py-2 text-xs text-accent-foreground">
          {msg}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Core Platform Modules</CardTitle>
            <CardDescription>Toggle modules, dependencies, versions & runtime settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.modules ?? []).map((m) => (
              <div key={m.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold text-sm">
                      {m.name} <Badge variant="outline">v{m.version}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">{m.key}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditModuleKey(m.key);
                        setModVersion(m.version);
                        setModSettings(JSON.stringify(m.settingsJson ?? {}, null, 2));
                        setModDeps(m.parents.map((p) => p.dependsOnModule.key).join(','));
                      }}
                    >
                      <Sliders className="h-3.5 w-3.5" /> Configure
                    </Button>
                    <Switch
                      checked={m.enabled}
                      ariaLabel={`Toggle ${m.name}`}
                      onCheckedChange={(enabled) =>
                        moduleMutation.mutate({ key: m.key, payload: { enabled } })
                      }
                    />
                  </div>
                </div>
                {m.parents.length > 0 && (
                  <div className="text-[11px] text-muted-foreground">
                    Depends on: {m.parents.map((p) => p.dependsOnModule.key).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Feature Flags & Rollout Controls</CardTitle>
            <CardDescription>Adjust progressive rollout % and user eligibility</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.flags ?? []).map((f) => (
              <div key={f.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-mono text-xs font-semibold">{f.key}</div>
                    {f.description && (
                      <div className="text-xs text-muted-foreground">{f.description}</div>
                    )}
                  </div>
                  <Switch
                    checked={f.enabled}
                    ariaLabel={`Toggle flag ${f.key}`}
                    onCheckedChange={(enabled) =>
                      flagMutation.mutate({
                        key: f.key,
                        payload: { enabled, rolloutPercent: f.rolloutPercent },
                      })
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Rollout:</span>
                  {[0, 25, 50, 100].map((pct) => (
                    <Button
                      key={pct}
                      size="sm"
                      variant={f.rolloutPercent === pct ? 'default' : 'outline'}
                      onClick={() =>
                        flagMutation.mutate({
                          key: f.key,
                          payload: { enabled: f.enabled, rolloutPercent: pct },
                        })
                      }
                    >
                      {pct}%
                    </Button>
                  ))}
                </div>
              </div>
            ))}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                let eligibilityJson: Record<string, unknown> = {};
                try {
                  eligibilityJson = JSON.parse(newFlagEligibility) as Record<string, unknown>;
                } catch {
                  setMsg('Invalid eligibility JSON format.');
                  return;
                }
                flagMutation.mutate({
                  key: newFlagKey.trim(),
                  payload: {
                    enabled: true,
                    rolloutPercent: 100,
                    description: newFlagDesc.trim() || undefined,
                    eligibilityJson,
                  },
                });
              }}
              className="rounded-lg border border-dashed p-3 space-y-2"
            >
              <div className="text-xs font-semibold">Add / Upsert Feature Flag</div>
              <Input
                required
                placeholder="flag_key_snake_case"
                value={newFlagKey}
                onChange={(e) => setNewFlagKey(e.target.value)}
              />
              <Input
                placeholder="Flag description"
                value={newFlagDesc}
                onChange={(e) => setNewFlagDesc(e.target.value)}
              />
              <Input
                placeholder='Eligibility JSON e.g. {"roles":["SUPER_ADMIN"]}'
                value={newFlagEligibility}
                onChange={(e) => setNewFlagEligibility(e.target.value)}
              />
              <Button type="submit" size="sm" className="w-full">
                Save Feature Flag
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> Configuration Change History & Rollback
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data?.history ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No configuration snapshots recorded yet.</p>
          ) : (
            data?.history.map((snap) => (
              <div
                key={snap.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
              >
                <div>
                  <span className="font-semibold">
                    {snap.targetType}: {snap.targetKey}
                  </span>
                  <span className="ml-2 text-muted-foreground">
                    {new Date(snap.changedAt).toLocaleString()}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => rollbackMutation.mutate(snap.id)}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Roll Back
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Modal
        open={Boolean(editModuleKey)}
        title={`Configure Module: ${editModuleKey ?? ''}`}
        onClose={() => setEditModuleKey(null)}
      >
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium">Module Version</label>
            <Input value={modVersion} onChange={(e) => setModVersion(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">
              Dependencies (comma-separated module keys)
            </label>
            <Input value={modDeps} onChange={(e) => setModDeps(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium">Settings JSON</label>
            <Textarea value={modSettings} onChange={(e) => setModSettings(e.target.value)} />
          </div>
          <Button
            className="w-full"
            onClick={() => {
              if (!editModuleKey) return;
              try {
                const parsed = JSON.parse(modSettings || '{}') as Record<string, unknown>;
                moduleMutation.mutate({
                  key: editModuleKey,
                  payload: {
                    version: modVersion,
                    settingsJson: parsed,
                    dependsOnKeys: modDeps
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                });
              } catch {
                setMsg('Module settings must be valid JSON.');
              }
            }}
          >
            <Save className="h-4 w-4" /> Save Module Configuration
          </Button>
        </div>
      </Modal>
    </div>
  );
}
