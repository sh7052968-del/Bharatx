'use client';

import React, { useEffect, useState } from 'react';
import {
  Ban,
  MessageSquare,
  Phone,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserPlus,
  Video,
  X,
} from 'lucide-react';
import { UserContact, Paginated } from '@/lib/types';
import { apiRequest } from '@/lib/api-client';
import { Badge, Button, Card, Input } from '@/components/ui/primitives';

interface ContactsPanelProps {
  onStartChat: (userId: string) => void;
  onStartCall: (userId: string, type: 'VOICE' | 'VIDEO') => void;
}

export function ContactsPanel({ onStartChat, onStartCall }: ContactsPanelProps) {
  const [contacts, setContacts] = useState<UserContact[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<Array<{ id: string; blockedId: string; reason?: string }>>([]);
  const [activeTab, setActiveTab] = useState<'contacts' | 'blocked'>('contacts');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [modalError, setModalError] = useState('');

  async function loadContacts() {
    try {
      setLoading(true);
      const res = await apiRequest<Paginated<UserContact>>('/users/contacts?page=1&limit=100');
      setContacts(res.items || []);
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadBlocked() {
    try {
      const res = await apiRequest<Array<{ id: string; blockedId: string; reason?: string }>>('/users/blocks');
      setBlockedUsers(res || []);
    } catch {
      setBlockedUsers([]);
    }
  }

  useEffect(() => {
    loadContacts();
    loadBlocked();
  }, []);

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    if (!newUserId.trim()) return;
    setModalError('');
    try {
      await apiRequest('/users/contacts', {
        method: 'POST',
        body: JSON.stringify({
          contactUserId: newUserId.trim(),
          nickname: newNickname.trim() || undefined,
        }),
      });
      setShowAddModal(false);
      setNewUserId('');
      setNewNickname('');
      loadContacts();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Failed to add contact');
    }
  }

  async function handleRemoveContact(contactId: string) {
    if (!confirm('Remove this contact?')) return;
    try {
      await apiRequest(`/users/contacts/${contactId}`, { method: 'DELETE' });
      setContacts((prev) => prev.filter((c) => c.id !== contactId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Cannot remove contact');
    }
  }

  async function handleBlockUser(contactUserId: string) {
    const reason = prompt('Reason for blocking this user (optional):');
    try {
      await apiRequest('/users/blocks', {
        method: 'POST',
        body: JSON.stringify({ blockedId: contactUserId, reason: reason || 'Blocked by user' }),
      });
      alert('User has been blocked');
      loadBlocked();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Cannot block user');
    }
  }

  async function handleUnblockUser(blockedId: string) {
    try {
      await apiRequest(`/users/blocks/${blockedId}`, { method: 'DELETE' });
      setBlockedUsers((prev) => prev.filter((b) => b.blockedId !== blockedId));
      alert('User unblocked');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Cannot unblock user');
    }
  }

  const filteredContacts = contacts.filter((c) => {
    const name = c.nickname || c.contactUser?.displayName || c.contactUser?.username || '';
    const email = c.contactUser?.email || '';
    return name.toLowerCase().includes(search.toLowerCase()) || email.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between border-b p-4 bg-card/60">
        <div>
          <h2 className="text-base font-bold tracking-tight">Contacts & Address Book</h2>
          <p className="text-xs text-muted-foreground">Manage your private enterprise contacts and connections</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border p-0.5 bg-background">
            <button
              type="button"
              onClick={() => setActiveTab('contacts')}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === 'contacts' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground'
              }`}
            >
              Contacts ({contacts.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('blocked')}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                activeTab === 'blocked' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground'
              }`}
            >
              Blocked ({blockedUsers.length})
            </button>
          </div>
          <Button
            size="sm"
            onClick={() => setShowAddModal(true)}
            className="bg-emerald-700 text-white hover:bg-emerald-800 gap-1.5"
          >
            <UserPlus className="h-4 w-4" /> Add Contact
          </Button>
        </div>
      </div>

      {/* Search Input Bar */}
      {activeTab === 'contacts' && (
        <div className="border-b px-4 py-2 bg-card/30">
          <div className="relative max-w-md">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts by name or email..."
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>
      )}

      {/* Main Content List */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'contacts' ? (
          loading ? (
            <div className="py-12 text-center text-xs text-muted-foreground">Loading contacts...</div>
          ) : filteredContacts.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No contacts found. Click <strong>Add Contact</strong> to connect with colleagues or partners.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredContacts.map((c) => {
                const name = c.nickname || c.contactUser?.displayName || c.contactUser?.username;
                const isOnline = c.contactUser?.presenceStatus === 'ONLINE';

                return (
                  <Card key={c.id} className="p-4 flex flex-col justify-between hover:border-emerald-600/40 transition-colors">
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600/15 text-emerald-700 font-bold text-sm">
                            {name?.charAt(0).toUpperCase()}
                            {isOnline && (
                              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-foreground">{name}</div>
                            <div className="text-[11px] text-muted-foreground">{c.contactUser?.email}</div>
                          </div>
                        </div>
                        <Badge variant={isOnline ? 'success' : 'outline'} className="text-[10px] px-1.5 py-0">
                          {c.contactUser?.presenceStatus || 'OFFLINE'}
                        </Badge>
                      </div>

                      {c.nickname && (
                        <div className="mt-2 text-[10px] text-muted-foreground">
                          Nickname: <span className="font-medium text-foreground">{c.nickname}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t pt-3">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-emerald-700 hover:bg-emerald-500/10"
                          title="Send Message"
                          onClick={() => onStartChat(c.contactUserId)}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-emerald-700 hover:bg-emerald-500/10"
                          title="Voice Call"
                          onClick={() => onStartCall(c.contactUserId, 'VOICE')}
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-emerald-700 hover:bg-emerald-500/10"
                          title="Video Call"
                          onClick={() => onStartCall(c.contactUserId, 'VIDEO')}
                        >
                          <Video className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-amber-600 hover:bg-amber-500/10"
                          title="Block User"
                          onClick={() => handleBlockUser(c.contactUserId)}
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-500 hover:bg-red-500/10"
                          title="Remove Contact"
                          onClick={() => handleRemoveContact(c.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )
        ) : (
          /* Blocked tab */
          <div className="max-w-xl mx-auto space-y-3">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
              <ShieldAlert className="inline mr-1.5 h-4 w-4" />
              Blocked users cannot send you messages, initiate calls, or see your online presence status.
            </div>

            {blockedUsers.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">You have no blocked users.</div>
            ) : (
              blockedUsers.map((b) => (
                <Card key={b.id} className="p-3.5 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold">User ID: {b.blockedId}</div>
                    <div className="text-[11px] text-muted-foreground">Reason: {b.reason || 'None specified'}</div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs text-emerald-700 border-emerald-600"
                    onClick={() => handleUnblockUser(b.blockedId)}
                  >
                    Unblock
                  </Button>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      {/* MODAL: Add Contact */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Add New Contact</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {modalError && <div className="text-xs text-red-500">{modalError}</div>}
            <form onSubmit={handleAddContact} className="space-y-3">
              <div>
                <label className="text-xs font-medium">User ID (UUID of contact)</label>
                <Input
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  placeholder="Paste user UUID..."
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium">Nickname (Optional)</label>
                <Input
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  placeholder="e.g. Finance Lead, Alice C."
                  className="mt-1"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-emerald-700 text-white">
                  Add to Contacts
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
