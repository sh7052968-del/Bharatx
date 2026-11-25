'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Save, Trash2 } from 'lucide-react';
import { apiRequest } from '@/lib/api-client';
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from '@/components/ui/primitives';

interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
}

const MODULE_MATRIX: Array<{ module: string; key: string; actions: string[] }> = [
  { module: 'Overview', key: 'overview', actions: ['read'] },
  { module: 'Users', key: 'users', actions: ['read', 'write', 'delete'] },
  { module: 'Admins', key: 'admins', actions: ['read', 'write', 'delete'] },
  { module: 'Roles', key: 'roles', actions: ['manage'] },
  { module: 'Features', key: 'features', actions: ['read', 'write', 'approve'] },
  { module: 'Business', key: 'business', actions: ['read', 'write', 'approve'] },
  { module: 'Moderation', key: 'moderation', actions: ['read', 'write', 'approve'] },
  { module: 'Finance', key: 'finance', actions: ['read', 'write', 'approve'] },
  { module: 'Notifications', key: 'notifications', actions: ['read', 'write'] },
  { module: 'Analytics', key: 'analytics', actions: ['read', 'export'] },
  { module: 'Settings', key: 'settings', actions: ['read', 'write'] },
  { module: 'Audit', key: 'audit', actions: ['read', 'export'] },
  { module: 'Developer', key: 'developer', actions: ['read', 'write', 'approve'] },
];

export function RolesPanel() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [perms, setPerms] = useState<string[]>(['overview:read', 'users:read']);
  const [status, setStatus] = useState<string | null>(null);

  const { data: roles = [] } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => apiRequest<CustomRole[]>('/admin/roles'),
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      if (selectedId) {
        return apiRequest(`/admin/roles/${selectedId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name, description, permissions: perms }),
        });
      }
      return apiRequest('/admin/roles', {
        method: 'POST',
        body: JSON.stringify({ name, description, permissions: perms }),
      });
    },
    onSuccess: () => {
      setStatus(selectedId ? 'Updated custom role permissions.' : 'Created new custom role.');
      void qc.invalidateQueries({ queryKey: ['admin-roles'] });
    },
    onError: (err) => setStatus((err as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/admin/roles/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setSelectedId(null);
      setName('');
      setDescription('');
      setPerms(['overview:read']);
      setStatus('Deleted custom role.');
      void qc.invalidateQueries({ queryKey: ['admin-roles'] });
    },
    onError: (err) => setStatus((err as Error).message),
  });

  function loadRole(r: CustomRole) {
    setSelectedId(r.id);
    setName(r.name);
    setDescription(r.description ?? '');
    setPerms(r.permissions);
  }

  function resetNew() {
    setSelectedId(null);
    setName('');
    setDescription('');
    setPerms(['overview:read']);
  }

  function togglePerm(code: string) {
    setPerms((prev) => (prev.includes(code) ? prev.filter((p) => p !== code) : [...prev, code]));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Role & Permission Center</h1>
          <p className="text-xs text-muted-foreground">
            Configure custom roles with module-level Read, Write, Delete, Approve, and Export controls
          </p>
        </div>
        <Button variant="outline" onClick={resetNew}>
          <Plus className="h-4 w-4" /> New Role Draft
        </Button>
      </div>

      {status && (
        <div className="rounded-md border border-primary/30 bg-accent px-3 py-2 text-xs text-accent-foreground">
          {status}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Existing Roles ({roles.length})</CardTitle>
            <CardDescription>Select a role to edit permissions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {roles.map((r) => (
              <div
                key={r.id}
                onClick={() => loadRole(r)}
                className={`cursor-pointer rounded-lg border p-3 transition ${
                  selectedId === r.id ? 'border-primary bg-accent/60' : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{r.name}</span>
                  <Badge variant="outline">{r.permissions.length} perms</Badge>
                </div>
                {r.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{selectedId ? `Edit Role: ${name}` : 'Create Custom Role'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Role name (e.g. Regional Trust Officer)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                placeholder="Role scope description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="rounded-lg border divide-y">
              {MODULE_MATRIX.map((row) => (
                <div key={row.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span className="text-sm font-medium w-32">{row.module}</span>
                  <div className="flex flex-wrap gap-2">
                    {row.actions.map((act) => {
                      const code = `${row.key}:${act}`;
                      const checked = perms.includes(code);
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => togglePerm(code)}
                          className={`rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition ${
                            checked
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'bg-background text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {act}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-2">
              {selectedId ? (
                <Button variant="destructive" onClick={() => deleteMutation.mutate(selectedId)}>
                  <Trash2 className="h-4 w-4" /> Delete Role
                </Button>
              ) : (
                <span />
              )}
              <Button onClick={() => saveMutation.mutate()} disabled={!name.trim()}>
                <Save className="h-4 w-4" /> {selectedId ? 'Save Permissions' : 'Create Custom Role'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
