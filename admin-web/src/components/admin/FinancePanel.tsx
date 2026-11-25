'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, DollarSign, FileSpreadsheet, RotateCcw } from 'lucide-react';
import { apiRequest } from '@/lib/api-client';
import { formatCurrencyCents } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Table,
  Td,
  Th,
} from '@/components/ui/primitives';

interface FinanceOverview {
  summary: {
    grossRevenueCents: number;
    successfulTransactions: number;
    activeSubscriptions: number;
    pendingRefunds: number;
  };
  plans: Array<{
    id: string;
    code: string;
    name: string;
    monthlyPriceCents: number;
    currency: string;
    active: boolean;
  }>;
  transactions: Array<{
    id: string;
    provider: string;
    amountCents: number;
    currency: string;
    status: string;
    createdAt: string;
    user: { email: string; displayName: string };
  }>;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    amountCents: number;
    currency: string;
    status: string;
    issuedAt: string;
    user: { email: string };
  }>;
  refunds: Array<{
    id: string;
    transactionId: string;
    reason: string;
    status: string;
    transaction: { amountCents: number; currency: string };
  }>;
}

export function FinancePanel() {
  const qc = useQueryClient();
  const [planCode, setPlanCode] = useState('');
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState('2900');
  const [msg, setMsg] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ['admin-finance'],
    queryFn: () => apiRequest<FinanceOverview>('/admin/finance/overview'),
  });

  const planMutation = useMutation({
    mutationFn: () =>
      apiRequest('/admin/finance/plans', {
        method: 'PUT',
        body: JSON.stringify({
          code: planCode.trim().toUpperCase(),
          name: planName.trim(),
          monthlyPriceCents: Number(planPrice),
          features: ['Verified business tier', 'Enterprise SLA support'],
        }),
      }),
    onSuccess: () => {
      setMsg('Subscription plan saved.');
      setPlanCode('');
      setPlanName('');
      void qc.invalidateQueries({ queryKey: ['admin-finance'] });
    },
    onError: (err) => setMsg((err as Error).message),
  });

  const refundMutation = useMutation({
    mutationFn: (transactionId: string) =>
      apiRequest('/admin/finance/refunds', {
        method: 'POST',
        body: JSON.stringify({ transactionId, reason: 'Finance Admin initiated refund review' }),
      }),
    onSuccess: () => {
      setMsg('Refund submitted to Approval Queue.');
      void qc.invalidateQueries({ queryKey: ['admin-finance'] });
      void qc.invalidateQueries({ queryKey: ['admin-approvals'] });
    },
    onError: (err) => setMsg((err as Error).message),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Finance & Billing</h1>
        <p className="text-xs text-muted-foreground">
          Manage subscription plans, payment transactions, invoices, refund workflows, and revenue reports
        </p>
      </div>

      {msg && (
        <div className="rounded-md border border-primary/30 bg-accent px-3 py-2 text-xs text-accent-foreground">
          {msg}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Gross Revenue</CardDescription>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrencyCents(data?.summary.grossRevenueCents ?? 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Succeeded Charges</CardDescription>
            <CreditCard className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.summary.successfulTransactions ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Active Subscriptions</CardDescription>
            <FileSpreadsheet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.summary.activeSubscriptions ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardDescription>Pending Refunds</CardDescription>
            <RotateCcw className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.summary.pendingRefunds ?? 0}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Subscription Plans</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.plans ?? []).map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border p-2.5 text-xs">
                <div>
                  <div className="font-semibold">
                    {p.name} ({p.code})
                  </div>
                  <div className="text-muted-foreground">
                    {formatCurrencyCents(p.monthlyPriceCents, p.currency)}/mo
                  </div>
                </div>
                <Badge variant={p.active ? 'success' : 'secondary'}>
                  {p.active ? 'Active' : 'Archived'}
                </Badge>
              </div>
            ))}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                planMutation.mutate();
              }}
              className="space-y-2 border-t pt-3"
            >
              <div className="text-xs font-semibold">Upsert Plan Tier</div>
              <Input
                required
                placeholder="PLAN_CODE"
                value={planCode}
                onChange={(e) => setPlanCode(e.target.value)}
              />
              <Input
                required
                placeholder="Plan Display Name"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
              />
              <Input
                required
                type="number"
                min={0}
                placeholder="Monthly Price (cents)"
                value={planPrice}
                onChange={(e) => setPlanPrice(e.target.value)}
              />
              <Button type="submit" size="sm" className="w-full">
                Save Plan
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Payment Transactions & Invoices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <thead>
                <tr>
                  <Th>Customer</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                  <Th>Action</Th>
                </tr>
              </thead>
              <tbody>
                {(data?.transactions ?? []).map((tx) => (
                  <tr key={tx.id}>
                    <Td>
                      <div>{tx.user.email}</div>
                      <div className="text-xs text-muted-foreground">{tx.provider}</div>
                    </Td>
                    <Td className="font-semibold">
                      {formatCurrencyCents(tx.amountCents, tx.currency)}
                    </Td>
                    <Td>
                      <Badge variant={tx.status === 'SUCCEEDED' ? 'success' : 'outline'}>
                        {tx.status}
                      </Badge>
                    </Td>
                    <Td>
                      {tx.status === 'SUCCEEDED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => refundMutation.mutate(tx.id)}
                        >
                          Request Refund
                        </Button>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <div className="border-t pt-3">
              <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                Recent Invoices ({data?.invoices.length ?? 0}) & Refunds ({data?.refunds.length ?? 0})
              </div>
              <div className="space-y-1.5 text-xs">
                {(data?.invoices ?? []).slice(0, 5).map((inv) => (
                  <div key={inv.id} className="flex justify-between rounded border px-2.5 py-1.5">
                    <span>
                      {inv.invoiceNumber} · {inv.user.email}
                    </span>
                    <span className="font-semibold">
                      {formatCurrencyCents(inv.amountCents, inv.currency)} ({inv.status})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
