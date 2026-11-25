'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Package, ShieldAlert, XCircle } from 'lucide-react';
import { apiRequest } from '@/lib/api-client';
import { formatCurrencyCents } from '@/lib/utils';
import { Paginated } from '@/lib/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Modal,
  Select,
  Table,
  Td,
  Th,
} from '@/components/ui/primitives';

interface BusinessRow {
  id: string;
  businessName: string;
  category: string;
  verificationStatus: 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  restricted: boolean;
  restrictionReason: string | null;
  owner: { id: string; email: string; displayName: string };
  _count?: { products: number; orders: number };
}

interface CatalogProduct {
  id: string;
  sku: string;
  name: string;
  priceCents: number;
  currency: string;
  inStock: boolean;
}

export function BusinessPanel() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [catalogBiz, setCatalogBiz] = useState<BusinessRow | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const path =
    statusFilter === 'ALL'
      ? '/admin/businesses?limit=50'
      : `/admin/businesses?limit=50&status=${statusFilter}`;

  const { data } = useQuery({
    queryKey: ['admin-businesses', statusFilter],
    queryFn: () => apiRequest<Paginated<BusinessRow>>(path),
  });

  const { data: products = [] } = useQuery({
    queryKey: ['admin-business-catalog', catalogBiz?.id],
    enabled: Boolean(catalogBiz),
    queryFn: () => apiRequest<CatalogProduct[]>(`/admin/businesses/${catalogBiz!.id}/catalog`),
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'VERIFIED' | 'REJECTED' }) =>
      apiRequest(`/admin/businesses/${id}/verify`, {
        method: 'POST',
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      setMsg('Business verification updated.');
      void qc.invalidateQueries({ queryKey: ['admin-businesses'] });
    },
    onError: (err) => setMsg((err as Error).message),
  });

  const restrictMutation = useMutation({
    mutationFn: ({ id, restricted }: { id: string; restricted: boolean }) =>
      apiRequest(`/admin/businesses/${id}/restrict`, {
        method: 'PATCH',
        body: JSON.stringify({ restricted, reason: restricted ? 'Policy compliance review' : undefined }),
      }),
    onSuccess: () => {
      setMsg('Business restriction status updated.');
      void qc.invalidateQueries({ queryKey: ['admin-businesses'] });
    },
    onError: (err) => setMsg((err as Error).message),
  });

  const moderateSkuMutation = useMutation({
    mutationFn: ({ bizId, prodId, inStock }: { bizId: string; prodId: string; inStock: boolean }) =>
      apiRequest(`/admin/businesses/${bizId}/catalog/${prodId}`, {
        method: 'PATCH',
        body: JSON.stringify({ inStock }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin-business-catalog'] });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Business Management</h1>
          <p className="text-xs text-muted-foreground">
            Verify business entities, inspect & moderate product catalogs, and manage merchant restrictions
          </p>
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="ALL">All Verification States</option>
          <option value="PENDING">Pending Verification</option>
          <option value="VERIFIED">Verified</option>
          <option value="REJECTED">Rejected</option>
          <option value="UNVERIFIED">Unverified</option>
        </Select>
      </div>

      {msg && (
        <div className="rounded-md border border-primary/30 bg-accent px-3 py-2 text-xs text-accent-foreground">
          {msg}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Business Directory</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <thead>
              <tr>
                <Th>Business</Th>
                <Th>Owner</Th>
                <Th>Verification & Status</Th>
                <Th>Catalog / Orders</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((b) => (
                <tr key={b.id}>
                  <Td>
                    <div className="font-medium">{b.businessName}</div>
                    <div className="text-xs text-muted-foreground">{b.category}</div>
                  </Td>
                  <Td>
                    <div>{b.owner.displayName}</div>
                    <div className="text-xs text-muted-foreground">{b.owner.email}</div>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      <Badge
                        variant={
                          b.verificationStatus === 'VERIFIED'
                            ? 'success'
                            : b.verificationStatus === 'REJECTED'
                              ? 'destructive'
                              : 'warning'
                        }
                      >
                        {b.verificationStatus}
                      </Badge>
                      {b.restricted && <Badge variant="destructive">Restricted</Badge>}
                    </div>
                  </Td>
                  <Td className="text-xs">
                    {b._count?.products ?? 0} SKUs · {b._count?.orders ?? 0} orders
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      {b.verificationStatus !== 'VERIFIED' && (
                        <Button
                          size="sm"
                          onClick={() => verifyMutation.mutate({ id: b.id, status: 'VERIFIED' })}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </Button>
                      )}
                      {b.verificationStatus === 'PENDING' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => verifyMutation.mutate({ id: b.id, status: 'REJECTED' })}
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => setCatalogBiz(b)}>
                        <Package className="h-3.5 w-3.5" /> Catalog
                      </Button>
                      <Button
                        size="sm"
                        variant={b.restricted ? 'secondary' : 'destructive'}
                        onClick={() =>
                          restrictMutation.mutate({ id: b.id, restricted: !b.restricted })
                        }
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                        {b.restricted ? 'Lift Restriction' : 'Restrict'}
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>

      <Modal
        open={Boolean(catalogBiz)}
        title={`Catalog Moderation: ${catalogBiz?.businessName ?? ''}`}
        onClose={() => setCatalogBiz(null)}
      >
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {products.length === 0 ? (
            <p className="text-xs text-muted-foreground">No active catalog SKUs.</p>
          ) : (
            products.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border p-2.5 text-xs">
                <div>
                  <div className="font-semibold">
                    {p.name} ({p.sku})
                  </div>
                  <div className="text-muted-foreground">
                    {formatCurrencyCents(p.priceCents, p.currency)}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={p.inStock ? 'outline' : 'default'}
                  onClick={() =>
                    catalogBiz &&
                    moderateSkuMutation.mutate({
                      bizId: catalogBiz.id,
                      prodId: p.id,
                      inStock: !p.inStock,
                    })
                  }
                >
                  {p.inStock ? 'Disable SKU' : 'Enable SKU'}
                </Button>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}
