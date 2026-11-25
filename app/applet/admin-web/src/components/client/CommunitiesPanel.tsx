'use client';

import React, { useEffect, useState } from 'react';
import {
  Bell,
  Building,
  CheckCircle2,
  ExternalLink,
  FolderTree,
  Megaphone,
  Plus,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { Community, Paginated } from '@/lib/types';
import { apiRequest } from '@/lib/api-client';
import { Badge, Button, Card, Input } from '@/components/ui/primitives';

export function CommunitiesPanel() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [activeCommunity, setActiveCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);
  const [showLinkGroupModal, setShowLinkGroupModal] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [linkGroupId, setLinkGroupId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  async function loadCommunities() {
    try {
      setLoading(true);
      const res = await apiRequest<Paginated<Community>>('/communities?page=1&limit=50');
      setCommunities(res.items || []);
      if (!activeCommunity && res.items?.length > 0) {
        setActiveCommunity(res.items[0]);
      }
    } catch {
      setCommunities([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCommunities();
  }, []);

  async function handleCreateCommunity(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setErrorMsg('');
    try {
      const res = await apiRequest<Community>('/communities', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });
      setShowCreateModal(false);
      setName('');
      setDescription('');
      setCommunities((prev) => [res, ...prev]);
      setActiveCommunity(res);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to create community');
    }
  }

  async function handlePostAnnouncement(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCommunity || !annTitle.trim() || !annContent.trim()) return;
    try {
      await apiRequest(`/communities/${activeCommunity.id}/announcements`, {
        method: 'POST',
        body: JSON.stringify({
          title: annTitle.trim(),
          content: annContent.trim(),
        }),
      });
      setShowAnnounceModal(false);
      setAnnTitle('');
      setAnnContent('');
      alert('Announcement published successfully');
      loadCommunities();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Cannot publish announcement');
    }
  }

  async function handleLinkGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCommunity || !linkGroupId.trim()) return;
    try {
      await apiRequest(`/communities/${activeCommunity.id}/groups`, {
        method: 'POST',
        body: JSON.stringify({ groupId: linkGroupId.trim() }),
      });
      setShowLinkGroupModal(false);
      setLinkGroupId('');
      alert('Group linked to community');
      loadCommunities();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to link group');
    }
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* 1. Left List of Communities */}
      <div className="flex w-80 shrink-0 flex-col border-r bg-card/60">
        <div className="flex items-center justify-between border-b p-4">
          <div>
            <h2 className="text-base font-bold tracking-tight">Communities</h2>
            <p className="text-[11px] text-muted-foreground">Organizational hubs & departments</p>
          </div>
          <Button
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="h-8 bg-emerald-700 text-white hover:bg-emerald-800 gap-1 px-2.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" /> New
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border/40">
          {loading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Loading communities...</div>
          ) : communities.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No communities yet. Click <strong>+ New</strong> to establish a community.
            </div>
          ) : (
            communities.map((c) => {
              const isSelected = activeCommunity?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setActiveCommunity(c)}
                  className={`flex cursor-pointer items-center gap-3 p-3.5 transition-colors ${
                    isSelected ? 'bg-emerald-500/10 border-l-4 border-emerald-600' : 'hover:bg-accent/40'
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-700/15 text-emerald-700 font-bold text-sm">
                    <Building className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-foreground">{c.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {c.description || 'Enterprise group community'}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Community Main Detail View */}
      {activeCommunity ? (
        <div className="flex flex-1 flex-col overflow-y-auto bg-background p-6 space-y-6">
          {/* Header Card */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border bg-card p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600/15 text-emerald-700">
                <Building className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground">{activeCommunity.name}</h2>
                  <Badge variant="success" className="text-[10px]">Active Hub</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground max-w-xl">
                  {activeCommunity.description || 'Enterprise multi-group community with announcement channels.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowLinkGroupModal(true)}
                className="gap-1.5 text-xs"
              >
                <FolderTree className="h-3.5 w-3.5" /> Link Group
              </Button>
              <Button
                size="sm"
                onClick={() => setShowAnnounceModal(true)}
                className="bg-emerald-700 text-white hover:bg-emerald-800 gap-1.5 text-xs"
              >
                <Megaphone className="h-3.5 w-3.5" /> Post Announcement
              </Button>
            </div>
          </div>

          {/* Announcements Feed Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Megaphone className="h-4 w-4 text-emerald-600" /> Community Broadcast Announcements
              </h3>
            </div>

            {activeCommunity.announcements && activeCommunity.announcements.length > 0 ? (
              <div className="space-y-3">
                {activeCommunity.announcements.map((a) => (
                  <Card key={a.id} className="p-4 border-l-4 border-emerald-600">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-foreground">{a.title}</h4>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(a.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">{a.content}</p>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-6 text-center text-xs text-muted-foreground">
                No announcements broadcasted yet. Click <strong>Post Announcement</strong> to inform all members.
              </Card>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
          <Building className="h-10 w-10 text-emerald-600 mb-2" />
          <h3 className="text-sm font-bold text-foreground">Select a Community</h3>
          <p className="mt-1 text-xs">Explore departments and linked group discussions.</p>
        </div>
      )}

      {/* MODAL: Create Community */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Create Enterprise Community</h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {errorMsg && <div className="text-xs text-red-500">{errorMsg}</div>}
            <form onSubmit={handleCreateCommunity} className="space-y-3">
              <div>
                <label className="text-xs font-medium">Community Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Asia-Pacific Operations Hub"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Primary objective and scope..."
                  className="mt-1 w-full rounded-md border bg-background p-2 text-xs"
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-emerald-700 text-white">
                  Create Community
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: Post Announcement */}
      {showAnnounceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Broadcast Announcement</h3>
              <button type="button" onClick={() => setShowAnnounceModal(false)} className="text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handlePostAnnouncement} className="space-y-3">
              <div>
                <label className="text-xs font-medium">Title</label>
                <Input
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="Announcement headline..."
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium">Content</label>
                <textarea
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  placeholder="Full text of notice..."
                  className="mt-1 w-full rounded-md border bg-background p-2 text-xs"
                  rows={4}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAnnounceModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-emerald-700 text-white">
                  Publish Notice
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: Link Group */}
      {showLinkGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Link Group to Community</h3>
              <button type="button" onClick={() => setShowLinkGroupModal(false)} className="text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleLinkGroup} className="space-y-3">
              <div>
                <label className="text-xs font-medium">Group ID (UUID)</label>
                <Input
                  value={linkGroupId}
                  onChange={(e) => setLinkGroupId(e.target.value)}
                  placeholder="UUID of group to link..."
                  className="mt-1"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowLinkGroupModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-emerald-700 text-white">
                  Link Group
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
