'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Plus, ShieldOff, Trash2 } from 'lucide-react';
import { apiRequest } from '@/lib/api-client';
import { ADMIN_ROLE_LABELS, AdminRole } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Modal,
  Select,
  Table,
  Td,
  Th,
} from '@/components/ui/primitives';

interface AdminRow {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  department: string;
  mfaEnabled: boolean;
  customRoleId: string | null;
  customRole?: { id: string; name: string } | null;
  adminUser?: { active: boolean } | null;
}

interface LoginSessionRow {
  id: string;
  deviceName: string;
  platform: string;
  ipAddress: string | null;
  revokedAt: string | null;
  createdAt: string;
  user: { email: string; displayName: string; role: AdminRole; mfaEnabled: boolean };
}

export function AdminsPanel() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AdminRole>('PLATFORM_ADMIN');
  const [department, setDepartment] = useState('Operations');
  const [customRoleId, setCustomRoleId] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const { data: admins = [] } = useQuery({
    queryKey: ['admin-roster'],
    queryFn: () => apiRequest<AdminRow[]>('/admin/admins'),
  });

  const { data: customRoles = [] } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => apiRequest<Array<{ id: string; name: string }>>('/admin/roles'),
  });

  const { data: loginHistory = [] } = useQuery({
    queryKey: ['admin-login-history'],
    queryFn: () => apiRequest<LoginSessionRow[]>('/admin/admins/login-history'),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiRequest('/admin/admins', {
        method: 'POST',
        body: JSON.stringify({
          email,
          displayName,
          temporaryPassword: password,
          role,
          department,
          ...(customRoleId ? { customRoleId } : {}),
        }),
      }),
    onSuccess: () => {
      setMsg('Administrator account created.');
      setCreateOpen(false);
      setEmail('');
      setDisplayName('');
      setPassword('');
      void qc.invalidateQueries({ queryKey: ['admin-roster'] });
    },
    onError: (err) => setMsg((err as Error).message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      apiRequest(`/admin/admins/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setMsg('Administrator privileges updated.');
      void qc.invalidateQueries({ queryKey: ['admin-roster'] });
    },
    onError: (err) => setMsg((err as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/admin/admins/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      setMsg('Administrator access removed and sessions revoked.');
      void qc.invalidateQueries({ queryKey: ['admin-roster'] });
    },
    onError: (err) => setMsg((err as Error).message),
  });

  const adminLevelOptions: AdminRole[] = [
    'SUPER_ADMIN',
    'PLATFORM_ADMIN',
    'SECURITY_ADMIN',
    'BUSINESS_ADMIN',
    'FINANCE_ADMIN',
    'CONTENT_MODERATOR',
    'SUPPORT_ADMIN',
    'CUSTOM_ADMIN',
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Management</h1>
          <p className="text-xs text-muted-foreground">
            Manage all 8 ConnectX administrator tiers, custom role bindings, access restrictions, and login history
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> Create Administrator
        </Button>
      </div>

      {msg && (
        <div className="rounded-md border border-primary/30 bg-accent px-3 py-2 text-xs text-accent-foreground">
          {msg}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Administrator Roster</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <thead>
              <tr>
                <Th>Administrator</Th>
                <Th>Admin Level</Th>
                <Th>Custom Role</Th>
                <Th>MFA & Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => {
                const isActive = a.adminUser ? a.adminUser.active : true;
                return (
                  <tr key={a.id}>
                    <Td>
                      <div className="font-medium">{a.displayName}</div>
                      <div className="text-xs text-muted-foreground">
                        {a.email} · {a.department}
                      </div>
                    </Td>
                    <Td>
                      <Select
                        value={a.role}
                        onChange={(e) =>
                          updateMutation.mutate({ id: a.id, payload: { role: e.target.value } })
                        }
                      >
                        {adminLevelOptions.map((r) => (
                          <option key={r} value={r}>
                            {ADMIN_ROLE_LABELS[r]}
                          </option>
                        ))}
                      </Select>
                    </Td>
                    <Td>
                      <Select
                        value={a.customRoleId ?? ''}
                        onChange={(e) =>
                          updateMutation.mutate({
                            id: a.id,
                            payload: { customRoleId: e.target.value || null },
                          })
                        }
                      >
                        <option value="">None (Role Defaults)</option>
                        {customRoles.map((cr) => (
                          <option key={cr.id} value={cr.id}>
                            {cr.name}
                          </option>
                        ))}
                      </Select>
                    </Td>
                    <Td>
                      <div className="flex gap-1.5">
                        <Badge variant={a.mfaEnabled ? 'success' : 'warning'}>
                          {a.mfaEnabled ? 'MFA Active' : 'MFA Unset'}
                        </Badge>
                        <Badge variant={isActive ? 'outline' : 'destructive'}>
                          {isActive ? 'Enabled' : 'Restricted'}
                        </Badge>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateMutation.mutate({ id: a.id, payload: { active: !isActive } })
                          }
                        >
                          {isActive ? (
                            <>
                              <ShieldOff className="h-3.5 w-3.5" /> Restrict
                            </>
                          ) : (
                            <>
                              <Lock className="h-3.5 w-3.5" /> Enable
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteMutation.mutate(a.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </Button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Administrator Login History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <thead>
              <tr>
                <Th>Administrator</Th>
                <Th>Client / Platform</Th>
                <Th>IP Address</Th>
                <Th>Session State</Th>
                <Th>Timestamp</Th>
              </tr>
            </thead>
            <tbody>
              {loginHistory.map((s) => (
                <tr key={s.id}>
                  <Td>
                    <div className="font-medium">{s.user.email}</div>
                    <div className="text-xs text-muted-foreground">{ADMIN_ROLE_LABELS[s.user.role]}</div>
                  </Td>
                  <Td>
                    {s.deviceName} ({s.platform})
                  </Td>
                  <Td className="font-mono text-xs">{s.ipAddress ?? '—'}</Td>
                  <Td>
                    <Badge variant={s.revokedAt ? 'destructive' : 'success'}>
                      {s.revokedAt ? 'Revoked' : 'Active'}
                    </Badge>
                  </Td>
                  <Td className="text-xs text-muted-foreground">
                    {new Date(s.createdAt).toLocaleString()}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Modal open={createOpen} title="Provision New Administrator" onClose={() => setCreateOpen(false)}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
          className="space-y-3"
        >
          <Input
            type="email"
            required
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            required
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <Input
            type="password"
            required
            minLength={8}
            placeholder="Temporary password (min 8 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Select value={role} onChange={(e) => setRole(e.target.value as AdminRole)}>
            {adminLevelOptions.map((r) => (
              <option key={r} value={r}>
                {ADMIN_ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          />
          <Select value={customRoleId} onChange={(e) => setCustomRoleId(e.target.value)}>
            <option value="">Optional Custom Role Template</option>
            {customRoles.map((cr) => (
              <option key={cr.id} value={cr.id}>
                {cr.name}
              </option>
            ))}
          </Select>
          <Button type="submit" className="w-full" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Provisioning...' : 'Create Administrator'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
