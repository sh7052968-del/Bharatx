'use client';

import React, { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Building2,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  MessageSquare,
  Package,
  Plus,
  Settings,
  ShoppingBag,
  Tag,
  UserCheck,
  Users,
  X,
  Zap,
} from 'lucide-react';
import {
  BusinessProfile,
  CustomerRecord,
  OrderInquiry,
  Paginated,
  ProductItem,
  QuickReply,
} from '@/lib/types';
import { apiRequest } from '@/lib/api-client';
import { formatCurrencyCents } from '@/lib/utils';
import { Badge, Button, Card, Input } from '@/components/ui/primitives';

type BusinessTab = 'catalog' | 'customers' | 'orders' | 'automations' | 'profile';

export function BusinessWorkspacePanel() {
  const [profile, setProfile] = useState<BusinessProfile | null>(null);
  const [activeTab, setActiveTab] = useState<BusinessTab>('catalog');
  const [loading, setLoading] = useState(true);

  // Catalog state
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [sku, setSku] = useState('');
  const [productName, setProductName] = useState('');
  const [priceCents, setPriceCents] = useState(2500);
  const [productDesc, setProductDesc] = useState('');

  // CRM Customers state
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [custName, setCustName] = useState('');
  const [custLabels, setCustLabels] = useState('VIP, Enterprise');
  const [noteText, setNoteText] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  // Orders state
  const [orders, setOrders] = useState<OrderInquiry[]>([]);

  // Automations & Quick Replies state
  const [greeting, setGreeting] = useState('');
  const [away, setAway] = useState('');
  const [workingHours, setWorkingHours] = useState('Mon-Fri 09:00 - 18:00');
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [showAddReplyModal, setShowAddReplyModal] = useState(false);
  const [qrShortcut, setQrShortcut] = useState('');
  const [qrMessage, setQrMessage] = useState('');

  // Register Business Form state
  const [bizName, setBizName] = useState('');
  const [bizCat, setBizCat] = useState('Technology & SaaS');
  const [bizDesc, setBizDesc] = useState('');

  async function loadBusinessData() {
    try {
      setLoading(true);
      const biz = await apiRequest<BusinessProfile>('/business/profile');
      setProfile(biz);
      setGreeting(biz.greetingMessage || 'Hello! Thank you for contacting us. How can we help you today?');
      setAway(biz.awayMessage || 'We are currently offline outside our working hours. We will reply as soon as possible.');
      setWorkingHours(biz.workingHours || 'Mon-Fri 09:00 - 18:00');

      // Load products, customers, quick replies
      const [catRes, custRes, qrRes] = await Promise.allSettled([
        apiRequest<Paginated<ProductItem>>('/business/catalog?page=1&limit=50'),
        apiRequest<CustomerRecord[]>('/business/customers'),
        apiRequest<QuickReply[]>('/business/quick-replies'),
      ]);

      if (catRes.status === 'fulfilled') setProducts(catRes.value.items || []);
      if (custRes.status === 'fulfilled') setCustomers(custRes.value || []);
      if (qrRes.status === 'fulfilled') setQuickReplies(qrRes.value || []);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBusinessData();
  }, []);

  async function handleRegisterBusiness(e: React.FormEvent) {
    e.preventDefault();
    if (!bizName.trim()) return;
    try {
      const res = await apiRequest<BusinessProfile>('/business/profile', {
        method: 'POST',
        body: JSON.stringify({
          businessName: bizName.trim(),
          category: bizCat.trim(),
          description: bizDesc.trim() || undefined,
        }),
      });
      setProfile(res);
      alert('Business account activated!');
      loadBusinessData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Registration failed');
    }
  }

  async function handleRequestVerification() {
    try {
      const updated = await apiRequest<BusinessProfile>('/business/verification/request', { method: 'POST' });
      setProfile(updated);
      alert('Verification request submitted for admin review.');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Cannot request verification');
    }
  }

  async function handleCreateProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!sku.trim() || !productName.trim()) return;
    try {
      const res = await apiRequest<ProductItem>('/business/products', {
        method: 'POST',
        body: JSON.stringify({
          sku: sku.trim(),
          name: productName.trim(),
          priceCents: Number(priceCents),
          currency: 'USD',
          description: productDesc.trim() || undefined,
        }),
      });
      setShowAddProductModal(false);
      setSku('');
      setProductName('');
      setProductDesc('');
      setProducts((prev) => [res, ...prev]);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to add product');
    }
  }

  async function handleToggleStock(productId: string) {
    try {
      const updated = await apiRequest<ProductItem>(`/business/products/${productId}/stock`, { method: 'PATCH' });
      setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, inStock: updated.inStock } : p)));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Cannot toggle stock');
    }
  }

  async function handleAddCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!custName.trim()) return;
    try {
      const labels = custLabels
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await apiRequest<CustomerRecord>('/business/customers', {
        method: 'POST',
        body: JSON.stringify({ customerName: custName.trim(), labels }),
      });
      setShowAddCustomerModal(false);
      setCustName('');
      setCustomers((prev) => [res, ...prev]);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Cannot add customer');
    }
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomerId || !noteText.trim()) return;
    try {
      await apiRequest(`/business/customers/${selectedCustomerId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ note: noteText.trim() }),
      });
      setNoteText('');
      setSelectedCustomerId(null);
      // Reload customers to get fresh notes
      const updated = await apiRequest<CustomerRecord[]>('/business/customers');
      setCustomers(updated);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Cannot add note');
    }
  }

  async function handleSaveAutomations(e: React.FormEvent) {
    e.preventDefault();
    try {
      const updated = await apiRequest<BusinessProfile>('/business/rules', {
        method: 'PATCH',
        body: JSON.stringify({
          greetingMessage: greeting.trim(),
          awayMessage: away.trim(),
          workingHours: workingHours.trim(),
        }),
      });
      setProfile(updated);
      alert('Automated business rules updated successfully!');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Cannot save rules');
    }
  }

  async function handleAddQuickReply(e: React.FormEvent) {
    e.preventDefault();
    if (!qrShortcut.trim() || !qrMessage.trim()) return;
    try {
      const res = await apiRequest<QuickReply>('/business/quick-replies', {
        method: 'PUT',
        body: JSON.stringify({
          shortcut: qrShortcut.trim(),
          message: qrMessage.trim(),
        }),
      });
      setShowAddReplyModal(false);
      setQrShortcut('');
      setQrMessage('');
      setQuickReplies((prev) => [...prev.filter((q) => q.shortcut !== res.shortcut), res]);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Cannot save quick reply');
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-xs text-muted-foreground">Loading Business Workspace...</div>;
  }

  // If no business profile registered yet, show registration card
  if (!profile) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6 bg-background">
        <Card className="w-full max-w-lg p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-700">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold">Register Business Workspace</h2>
              <p className="text-xs text-muted-foreground">Enable product catalogs, customer CRM, and automations</p>
            </div>
          </div>

          <form onSubmit={handleRegisterBusiness} className="space-y-4">
            <div>
              <label className="text-xs font-semibold">Business Name</label>
              <Input
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
                placeholder="e.g. Acme Enterprise Solutions"
                className="mt-1"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold">Business Category</label>
              <Input
                value={bizCat}
                onChange={(e) => setBizCat(e.target.value)}
                placeholder="e.g. IT Services, Retail, Consulting"
                className="mt-1"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold">Description</label>
              <textarea
                value={bizDesc}
                onChange={(e) => setBizDesc(e.target.value)}
                placeholder="Brief business summary..."
                className="mt-1 w-full rounded-md border bg-background p-2 text-xs"
                rows={3}
              />
            </div>
            <Button type="submit" className="w-full bg-emerald-700 text-white hover:bg-emerald-800">
              Activate Business Workspace
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Top Banner with Business Status & Verification */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b p-4 bg-card/60 gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-700/15 text-emerald-700 font-bold">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">{profile.businessName}</h2>
              <Badge
                variant={profile.verificationStatus === 'VERIFIED' ? 'success' : 'outline'}
                className="text-[10px]"
              >
                {profile.verificationStatus === 'VERIFIED' && <BadgeCheck className="inline mr-1 h-3 w-3" />}
                {profile.verificationStatus}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{profile.category} • {profile.description || 'Enterprise workspace'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {profile.verificationStatus === 'UNVERIFIED' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRequestVerification}
              className="text-xs text-emerald-700 border-emerald-600"
            >
              Request Official Verification
            </Button>
          )}

          {/* Sub tabs switcher */}
          <div className="flex rounded-md border p-0.5 bg-background">
            {(
              [
                { id: 'catalog', label: 'Catalog', icon: ShoppingBag },
                { id: 'customers', label: 'CRM', icon: Users },
                { id: 'automations', label: 'Automations', icon: Zap },
              ] as const
            ).map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 rounded px-3 py-1 text-xs font-medium transition-colors ${
                    activeTab === t.id ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Tab Area */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* 1. CATALOG TAB */}
        {activeTab === 'catalog' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Product & Service Catalog</h3>
                <p className="text-xs text-muted-foreground">Manage offerings shared with customers in messaging</p>
              </div>
              <Button
                size="sm"
                onClick={() => setShowAddProductModal(true)}
                className="bg-emerald-700 text-white hover:bg-emerald-800 gap-1.5 text-xs"
              >
                <Plus className="h-4 w-4" /> Add Product
              </Button>
            </div>

            {products.length === 0 ? (
              <Card className="p-8 text-center text-xs text-muted-foreground">
                No products published. Click <strong>Add Product</strong> to populate your business catalog.
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((p) => (
                  <Card key={p.id} className="p-4 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <Badge variant="outline" className="text-[10px] font-mono">{p.sku}</Badge>
                          <h4 className="mt-1 text-xs font-bold text-foreground">{p.name}</h4>
                        </div>
                        <Badge variant={p.inStock ? 'success' : 'destructive'} className="text-[10px]">
                          {p.inStock ? 'In Stock' : 'Out of Stock'}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{p.description || 'No description provided.'}</p>
                      <div className="mt-3 text-sm font-bold text-emerald-700">
                        {formatCurrencyCents(p.priceCents, p.currency)}
                      </div>
                    </div>

                    <div className="mt-4 border-t pt-3 flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleStock(p.id)}
                        className="text-[11px] h-7"
                      >
                        {p.inStock ? 'Mark Out of Stock' : 'Mark In Stock'}
                      </Button>
                      <Button
                        size="sm"
                        className="bg-emerald-700 text-white text-[11px] h-7"
                        onClick={() => alert(`Share product ${p.name} directly into active chat`)}
                      >
                        Share to Chat
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. CUSTOMERS CRM TAB */}
        {activeTab === 'customers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Customer Relationships (CRM)</h3>
                <p className="text-xs text-muted-foreground">Manage client leads, labels, and interaction history</p>
              </div>
              <Button
                size="sm"
                onClick={() => setShowAddCustomerModal(true)}
                className="bg-emerald-700 text-white hover:bg-emerald-800 gap-1.5 text-xs"
              >
                <Plus className="h-4 w-4" /> Add Customer
              </Button>
            </div>

            {customers.length === 0 ? (
              <Card className="p-8 text-center text-xs text-muted-foreground">
                No customer records yet. Add client leads to organize notes and tags.
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {customers.map((c) => (
                  <Card key={c.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600/15 text-emerald-700 font-bold text-xs">
                          {c.customerName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-foreground">{c.customerName}</h4>
                          <span className="text-[10px] text-muted-foreground">
                            Added {new Date(c.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-[11px] h-7"
                        onClick={() => setSelectedCustomerId(c.id)}
                      >
                        Add Note
                      </Button>
                    </div>

                    {/* Labels */}
                    <div className="flex flex-wrap gap-1">
                      {c.labels.map((lbl) => (
                        <Badge key={lbl} variant="outline" className="text-[10px] bg-accent/30">
                          <Tag className="mr-1 h-2.5 w-2.5 inline" /> {lbl}
                        </Badge>
                      ))}
                    </div>

                    {/* Notes timeline */}
                    {c.notes && c.notes.length > 0 && (
                      <div className="rounded-md border bg-muted/30 p-2 space-y-1.5 text-[11px]">
                        <div className="font-semibold text-muted-foreground text-[10px]">Recent Notes:</div>
                        {c.notes.slice(0, 3).map((n) => (
                          <div key={n.id} className="border-b last:border-b-0 pb-1 text-foreground/80">
                            • {n.note}
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. AUTOMATIONS & QUICK REPLIES TAB */}
        {activeTab === 'automations' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <Card className="p-5 space-y-4">
              <div className="flex items-center gap-2 border-b pb-3">
                <Zap className="h-5 w-5 text-emerald-600" />
                <div>
                  <h3 className="text-sm font-bold">Rule-Based Messaging Automations</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Deterministic greeting and away messages (Strictly conventional rules, No AI).
                  </p>
                </div>
              </div>

              <form onSubmit={handleSaveAutomations} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold">Standard Working Hours</label>
                  <Input
                    value={workingHours}
                    onChange={(e) => setWorkingHours(e.target.value)}
                    placeholder="e.g. Mon-Fri 09:00 - 18:00"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold">Automated Greeting Message</label>
                  <textarea
                    value={greeting}
                    onChange={(e) => setGreeting(e.target.value)}
                    className="mt-1 w-full rounded-md border bg-background p-2 text-xs"
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold">Automated Away Message (Outside working hours)</label>
                  <textarea
                    value={away}
                    onChange={(e) => setAway(e.target.value)}
                    className="mt-1 w-full rounded-md border bg-background p-2 text-xs"
                    rows={3}
                  />
                </div>
                <Button type="submit" className="bg-emerald-700 text-white hover:bg-emerald-800">
                  Save Automation Rules
                </Button>
              </form>
            </Card>

            {/* Quick Replies */}
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="text-sm font-bold">Quick Replies (/shortcut)</h3>
                  <p className="text-[11px] text-muted-foreground">Predefined canned responses for fast support</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowAddReplyModal(true)}
                  className="bg-emerald-700 text-white hover:bg-emerald-800 text-xs gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Shortcut
                </Button>
              </div>

              {quickReplies.length === 0 ? (
                <div className="py-4 text-center text-xs text-muted-foreground">No quick replies created.</div>
              ) : (
                <div className="divide-y">
                  {quickReplies.map((qr) => (
                    <div key={qr.shortcut} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-mono font-bold text-emerald-700">{qr.shortcut}</span>
                        <p className="text-muted-foreground mt-0.5">{qr.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* MODAL: Add Product */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Add Catalog Product</h3>
              <button type="button" onClick={() => setShowAddProductModal(false)} className="text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateProduct} className="space-y-3">
              <div>
                <label className="text-xs font-medium">SKU (Stock Keeping Unit)</label>
                <Input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="e.g. CX-LICENSE-01"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium">Product Name</label>
                <Input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Enterprise License"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium">Price in Cents (e.g. 49900 = $499.00)</label>
                <Input
                  type="number"
                  value={priceCents}
                  onChange={(e) => setPriceCents(Number(e.target.value))}
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium">Description</label>
                <textarea
                  value={productDesc}
                  onChange={(e) => setProductDesc(e.target.value)}
                  placeholder="Product specifications..."
                  className="mt-1 w-full rounded-md border bg-background p-2 text-xs"
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddProductModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-emerald-700 text-white">
                  Publish Product
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: Add Customer */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Add CRM Customer</h3>
              <button type="button" onClick={() => setShowAddCustomerModal(false)} className="text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddCustomer} className="space-y-3">
              <div>
                <label className="text-xs font-medium">Customer / Client Name</label>
                <Input
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="e.g. Acme Procurement Dept"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium">Labels (Comma-separated)</label>
                <Input
                  value={custLabels}
                  onChange={(e) => setCustLabels(e.target.value)}
                  placeholder="VIP, Lead, Enterprise..."
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddCustomerModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-emerald-700 text-white">
                  Save Customer
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: Add Customer Note */}
      {selectedCustomerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Add Customer Note</h3>
              <button type="button" onClick={() => setSelectedCustomerId(null)} className="text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddNote} className="space-y-3">
              <div>
                <label className="text-xs font-medium">Note</label>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Enter call notes or contract details..."
                  className="mt-1 w-full rounded-md border bg-background p-2 text-xs"
                  rows={4}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedCustomerId(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-emerald-700 text-white">
                  Add Note
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: Add Quick Reply */}
      {showAddReplyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Create Quick Reply</h3>
              <button type="button" onClick={() => setShowAddReplyModal(false)} className="text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleAddQuickReply} className="space-y-3">
              <div>
                <label className="text-xs font-medium">Shortcut (e.g. /pricing)</label>
                <Input
                  value={qrShortcut}
                  onChange={(e) => setQrShortcut(e.target.value)}
                  placeholder="/pricing"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium">Canned Response</label>
                <textarea
                  value={qrMessage}
                  onChange={(e) => setQrMessage(e.target.value)}
                  placeholder="Full text sent when shortcut is selected..."
                  className="mt-1 w-full rounded-md border bg-background p-2 text-xs"
                  rows={3}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddReplyModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-emerald-700 text-white">
                  Save Shortcut
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
