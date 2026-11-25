'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, FileCheck2, Search, ShieldCheck, X } from 'lucide-react';
import { apiRequest } from '@/lib/api-client';
import { Paginated } from '@/lib/types';
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

interface AuditRow {
  id: string;
  category: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  ipAddress: string | null;
  previousHash: string | null;
  entryHash: string | null;
  createdAt: string;
  actor?: { email: string; role: string };
}

interface ApprovalRow {
  id: string;
  workflowType: string;
  targetId: string;
  requestedById: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  notes: string | null;
  createdAt: string;
}

export function AuditPanel() {
  const qc = useQueryClient();
  const [category, setCategory] = useState('ALL');
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const { data: logsData } = useQuery({
    queryKey: ['admin-audit-logs', category, search],
    queryFn: () =>
      apiRequest<Paginated<AuditRow> & { tamperEvidentChainActive: boolean }>(
        `/admin/audit-logs?limit=50&category=${category}${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
  });

  const { data: approvalsData } = useQuery({
    queryKey: ['admin-approvals'],
    queryFn: () => apiRequest<Paginated<ApprovalRow>>('/admin/approvals?limit=30'),
  });

  const reviewMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'APPROVED' | 'REJECTED' }) =>
      apiRequest(`/admin/approvals/${id}/review`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_, v) => {
      setMsg(`Approval workflow marked ${v.status}.`);
      void qc.invalidateQueries({ queryKey: ['admin-approvals'] });
      void qc.invalidateQueries({ queryKey: ['admin-audit-logs'] });
    },
    onError: (err) => setMsg((err as Error).message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit & Approval Center</h1>
          <p className="text-xs text-muted-foreground">
            Tamper-evident SHA-256 hash-chained audit logs and dual-control approval history
          </p>
        </div>
        <Badge variant="success" className="gap-1">
          <ShieldCheck className="h-3.5 w-3.5" /> SHA-256 Chain Active
        </Badge>
      </div>

      {msg && (
        <div className="rounded-md border border-primary/30 bg-accent px-3 py-2 text-xs text-accent-foreground">
          {msg}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCheck2 className="h-4 w-4 text-primary" /> Sensitive Operation Approvals
          </CardTitle>
          <CardDescription>
            Business verifications, refund requests, and Super Admin production release promotions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <thead>
              <tr>
                <Th>Workflow Type</Th>
                <Th>Target & Notes</Th>
                <Th>Status</Th>
                <Th>Decision</Th>
              </tr>
            </thead>
            <tbody>
              {(approvalsData?.items ?? []).map((a) => (
                <tr key={a.id}>
                  <Td className="font-semibold text-xs">{a.workflowType}</Td>
                  <Td className="text-xs">
                    <div className="font-mono">{a.targetId}</div>
                    {a.notes && <div className="text-muted-foreground">{a.notes}</div>}
                  </Td>
                  <Td>
                    <Badge
                      variant={
                        a.status === 'APPROVED'
                          ? 'success'
                          : a.status === 'REJECTED'
                            ? 'destructive'
                            : 'warning'
                      }
                    >
                      {a.status}
                    </Badge>
                  </Td>
                  <Td>
                    {a.status === 'PENDING' ? (
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          onClick={() => reviewMutation.mutate({ id: a.id, status: 'APPROVED' })}
                        >
                          <Check className="h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reviewMutation.mutate({ id: a.id, status: 'REJECTED' })}
                        >
                          <X className="h-3.5 w-3.5" /> Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Finalized</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Immutable Audit Stream</CardTitle>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filter actions..."
                  className="pl-8"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="ALL">All Categories</option>
                <option value="ADMIN_ACTION">Admin Activity</option>
                <option value="PERMISSION_CHANGE">Permission Changes</option>
                <option value="SECURITY_EVENT">Security Events</option>
                <option value="FEATURE_CONFIG">Feature Config History</option>
                <option value="APPROVAL">Approval History</option>
                <option value="DEVELOPER">Developer Releases</option>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <thead>
              <tr>
                <Th>Category / Action</Th>
                <Th>Actor</Th>
                <Th>Summary</Th>
                <Th>Integrity Hash</Th>
                <Th>Timestamp</Th>
              </tr>
            </thead>
            <tbody>
              {(logsData?.items ?? []).map((log) => (
                <tr key={log.id}>
                  <Td>
                    <Badge variant="outline">{log.category}</Badge>
                    <div className="mt-1 font-semibold text-xs">{log.action}</div>
                  </Td>
                  <Td className="text-xs">{log.actor?.email ?? 'System'}</Td>
                  <Td className="text-xs max-w-xs">{log.summary}</Td>
                  <Td className="font-mono text-[11px] text-muted-foreground">
                    {log.entryHash ? `${log.entryHash.slice(0, 14)}…` : '—'}
                  </Td>
                  <Td className="text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
