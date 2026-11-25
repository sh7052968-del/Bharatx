'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Check, ShieldAlert } from 'lucide-react';
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
  Table,
  Td,
  Th,
} from '@/components/ui/primitives';

interface ReportRow {
  id: string;
  targetType: string;
  reason: string;
  status: string;
  resolutionNotes: string | null;
  createdAt: string;
  reporter: { email: string; displayName: string };
  targetUser: { email: string; displayName: string; suspended: boolean; bannedAt: string | null };
}

export function ModerationPanel() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [targetFilter, setTargetFilter] = useState('ALL');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const { data: reports = [] } = useQuery({
    queryKey: ['admin-moderation', statusFilter, targetFilter],
    queryFn: () =>
      apiRequest<ReportRow[]>(
        `/admin/moderation/reports?status=${statusFilter}&targetType=${targetFilter}`,
      ),
  });

  const decideMutation = useMutation({
    mutationFn: ({
      id,
      decision,
    }: {
      id: string;
      decision: 'DISMISS' | 'WARN' | 'SUSPEND_TARGET' | 'BAN_TARGET';
    }) =>
      apiRequest(`/admin/moderation/reports/${id}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision, notes: notes.trim() || undefined }),
      }),
    onSuccess: (_, v) => {
      setMsg(`Recorded moderation decision: ${v.decision}`);
      setNotes('');
      void qc.invalidateQueries({ queryKey: ['admin-moderation'] });
      void qc.invalidateQueries({ queryKey: ['admin-overview'] });
    },
    onError: (err) => setMsg((err as Error).message),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Content Moderation</h1>
          <p className="text-xs text-muted-foreground">
            Review user reports, group reports, and business complaints with immutable moderation audit trails
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={targetFilter} onChange={(e) => setTargetFilter(e.target.value)}>
            <option value="ALL">All Report Types</option>
            <option value="USER">User Reports</option>
            <option value="GROUP">Group Reports</option>
            <option value="BUSINESS">Business Complaints</option>
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="OPEN">Open Queue</option>
            <option value="RESOLVED">Resolved</option>
            <option value="DISMISSED">Dismissed</option>
            <option value="ALL">All History</option>
          </Select>
        </div>
      </div>

      {msg && (
        <div className="rounded-md border border-primary/30 bg-accent px-3 py-2 text-xs text-accent-foreground">
          {msg}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Moderation Queue ({reports.length})</CardTitle>
            <Input
              className="max-w-xs"
              placeholder="Optional decision note..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <thead>
              <tr>
                <Th>Type</Th>
                <Th>Reported Target</Th>
                <Th>Reason & Reporter</Th>
                <Th>Status</Th>
                <Th>Decisions</Th>
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <Badge variant="outline">{r.targetType}</Badge>
                  </Td>
                  <Td>
                    <div className="font-medium">{r.targetUser.displayName}</div>
                    <div className="text-xs text-muted-foreground">{r.targetUser.email}</div>
                  </Td>
                  <Td>
                    <div className="text-sm">{r.reason}</div>
                    <div className="text-xs text-muted-foreground">
                      Filed by {r.reporter.email} · {new Date(r.createdAt).toLocaleDateString()}
                    </div>
                  </Td>
                  <Td>
                    <Badge
                      variant={
                        r.status === 'OPEN'
                          ? 'warning'
                          : r.status === 'RESOLVED'
                            ? 'success'
                            : 'secondary'
                      }
                    >
                      {r.status}
                    </Badge>
                  </Td>
                  <Td>
                    {r.status === 'OPEN' ? (
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => decideMutation.mutate({ id: r.id, decision: 'DISMISS' })}
                        >
                          Dismiss
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => decideMutation.mutate({ id: r.id, decision: 'WARN' })}
                        >
                          <Check className="h-3.5 w-3.5" /> Warn
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            decideMutation.mutate({ id: r.id, decision: 'SUSPEND_TARGET' })
                          }
                        >
                          <ShieldAlert className="h-3.5 w-3.5" /> Suspend
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() =>
                            decideMutation.mutate({ id: r.id, decision: 'BAN_TARGET' })
                          }
                        >
                          <Ban className="h-3.5 w-3.5" /> Ban
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {r.resolutionNotes ?? r.status}
                      </span>
                    )}
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
