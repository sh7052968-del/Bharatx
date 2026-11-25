'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CheckCircle2, RotateCcw, Search, ShieldAlert } from 'lucide-react';
import { apiRequest } from '@/lib/api-client';
import { ADMIN_ROLE_LABELS, AdminRole, Paginated } from '@/lib/types';
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

interface UserRow {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: AdminRole;
  department: string;
  suspended: boolean;
  bannedAt: string | null;
  banReason: string | null;
  emailVerified: boolean;
  mfaEnabled: boolean;
  _count?: { reportsReceived: number };
}

export function UsersPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [role, setRole] = useState('ALL');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<UserRow | null>(null);
  const [banReason, setBanReason] = useState('');

  const queryStr = new URLSearchParams({
    ...(search ? { search } : {}),
    ...(status !== 'ALL' ? { status } : {}),
    ...(role !== 'ALL' ? { role } : {}),
    limit: '50',
  }).toString();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', search, status, role],
    queryFn: () => apiRequest<Paginated<UserRow>>(`/admin/users?${queryStr}`),
  });

  const actionMutation = useMutation({
    mutationFn: ({
      id,
      action,
      reason,
    }: {
      id: string;
      action: 'VERIFY' | 'SUSPEND' | 'BAN' | 'RESTORE';
      reason?: string;
    }) =>
      apiRequest(`/admin/users/${id}/action`, {
        method: 'POST',
        body: JSON.stringify({ action, reason }),
      }),
    onSuccess: (_, vars) => {
      setFeedback(`Executed ${vars.action} successfully.`);
      setBanTarget(null);
      setBanReason('');
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
      void qc.invalidateQueries({ queryKey: ['admin-overview'] });
    },
    onError: (err) => setFeedback((err as Error).message),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
        <p className="text-xs text-muted-foreground">
          Search, filter, verify, suspend, ban, and restore accounts (zero access to private E2EE messages)
        </p>
      </div>

      {feedback && (
        <div className="rounded-md border border-primary/30 bg-accent px-3 py-2 text-xs text-accent-foreground">
          {feedback}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search email, username, or display name..."
                className="pl-8"
              />
            </div>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="VERIFIED">Email Verified</option>
              <option value="UNVERIFIED">Unverified</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="BANNED">Banned</option>
            </Select>
            <Select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="ALL">All Roles</option>
              {(Object.keys(ADMIN_ROLE_LABELS) as AdminRole[]).map((r) => (
                <option key={r} value={r}>
                  {ADMIN_ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading users...</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>User</Th>
                  <Th>Role / Dept</Th>
                  <Th>Status</Th>
                  <Th>Reports</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {(data?.items ?? []).map((u) => (
                  <tr key={u.id} className="hover:bg-muted/40">
                    <Td>
                      <div className="font-medium">{u.displayName}</div>
                      <div className="text-xs text-muted-foreground">
                        {u.email} · @{u.username}
                      </div>
                    </Td>
                    <Td>
                      <Badge variant="outline">{ADMIN_ROLE_LABELS[u.role] ?? u.role}</Badge>
                      <div className="mt-1 text-xs text-muted-foreground">{u.department}</div>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {u.bannedAt ? (
                          <Badge variant="destructive">Banned</Badge>
                        ) : u.suspended ? (
                          <Badge variant="warning">Suspended</Badge>
                        ) : (
                          <Badge variant="success">Active</Badge>
                        )}
                        {u.emailVerified && <Badge variant="secondary">Verified</Badge>}
                        {u.mfaEnabled && <Badge variant="outline">MFA</Badge>}
                      </div>
                    </Td>
                    <Td>
                      <Badge variant={(u._count?.reportsReceived ?? 0) > 0 ? 'warning' : 'outline'}>
                        {u._count?.reportsReceived ?? 0} reports
                      </Badge>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        {!u.emailVerified && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => actionMutation.mutate({ id: u.id, action: 'VERIFY' })}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" /> Verify
                          </Button>
                        )}
                        {!u.suspended && !u.bannedAt ? (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => actionMutation.mutate({ id: u.id, action: 'SUSPEND' })}
                            >
                              <ShieldAlert className="h-3.5 w-3.5" /> Suspend
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setBanTarget(u)}
                            >
                              <Ban className="h-3.5 w-3.5" /> Ban
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => actionMutation.mutate({ id: u.id, action: 'RESTORE' })}
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Restore
                          </Button>
                        )}
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal
        open={Boolean(banTarget)}
        title={`Ban Account: ${banTarget?.email ?? ''}`}
        onClose={() => setBanTarget(null)}
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Banning revokes all active sessions immediately and prevents future sign-in until
            explicitly restored.
          </p>
          <Input
            value={banReason}
            onChange={(e) => setBanReason(e.target.value)}
            placeholder="Reason for ban (recorded in audit log)"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBanTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                banTarget &&
                actionMutation.mutate({ id: banTarget.id, action: 'BAN', reason: banReason })
              }
            >
              Confirm Permanent Ban
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
