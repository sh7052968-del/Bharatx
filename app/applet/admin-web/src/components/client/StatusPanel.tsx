'use client';

import React, { useEffect, useState } from 'react';
import {
  Clock,
  Eye,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  Plus,
  Send,
  Smile,
  Sparkles,
  Type,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { StatusUpdate } from '@/lib/types';
import { Badge, Button, Card, Input } from '@/components/ui/primitives';

interface StatusPanelProps {
  onReplyToStatus?: (userId: string, text: string) => void;
}

const BG_GRADIENTS = [
  'from-emerald-600 to-teal-800',
  'from-blue-600 to-indigo-900',
  'from-purple-600 to-pink-800',
  'from-amber-600 to-red-800',
  'from-slate-700 to-black',
];

export function StatusPanel({ onReplyToStatus }: StatusPanelProps) {
  const { user } = useAuth();
  const [myStatuses, setMyStatuses] = useState<StatusUpdate[]>([]);
  const [contactStatuses, setContactStatuses] = useState<StatusUpdate[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeStory, setActiveStory] = useState<StatusUpdate | null>(null);
  const [storyProgress, setStoryProgress] = useState(0);

  // Form states
  const [statusType, setStatusType] = useState<'TEXT' | 'IMAGE'>('TEXT');
  const [textContent, setTextContent] = useState('');
  const [selectedBg, setSelectedBg] = useState(BG_GRADIENTS[0]);
  const [replyText, setReplyText] = useState('');

  // Initial mock seeded statuses (in-memory for demo / client persistence)
  useEffect(() => {
    const now = Date.now();
    const mockMy: StatusUpdate[] = [
      {
        id: 'status_my_1',
        userId: user?.id || 'me',
        userName: user?.displayName || 'My Status',
        type: 'TEXT',
        content: 'Excited about the ConnectX Enterprise platform launch! 🚀',
        background: BG_GRADIENTS[0],
        createdAt: new Date(now - 3600000).toISOString(),
        expiresAt: new Date(now + 82800000).toISOString(),
        viewsCount: 14,
      },
    ];

    const mockOthers: StatusUpdate[] = [
      {
        id: 'status_other_1',
        userId: 'contact_alice',
        userName: 'Alice Cooper',
        type: 'TEXT',
        content: 'Hosting quarterly security review meeting at 2:00 PM UTC.',
        background: BG_GRADIENTS[1],
        createdAt: new Date(now - 7200000).toISOString(),
        expiresAt: new Date(now + 79200000).toISOString(),
        viewsCount: 28,
      },
      {
        id: 'status_other_2',
        userId: 'contact_bob',
        userName: 'Bob Builder',
        type: 'TEXT',
        content: 'New production cluster deployments are live and verified healthy. ✅',
        background: BG_GRADIENTS[2],
        createdAt: new Date(now - 14400000).toISOString(),
        expiresAt: new Date(now + 72000000).toISOString(),
        viewsCount: 32,
      },
    ];

    setMyStatuses(mockMy);
    setContactStatuses(mockOthers);
  }, [user]);

  // Auto-advancing story timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeStory) {
      setStoryProgress(0);
      interval = setInterval(() => {
        setStoryProgress((prev) => {
          if (prev >= 100) {
            setActiveStory(null);
            return 0;
          }
          return prev + 2;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [activeStory]);

  function handleCreateStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!textContent.trim()) return;

    const newStatus: StatusUpdate = {
      id: 'status_' + Date.now(),
      userId: user?.id || 'me',
      userName: user?.displayName || 'My Status',
      type: statusType,
      content: textContent.trim(),
      background: selectedBg,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      viewsCount: 0,
    };

    setMyStatuses((prev) => [newStatus, ...prev]);
    setShowAddModal(false);
    setTextContent('');
  }

  function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim() || !activeStory) return;
    if (onReplyToStatus) {
      onReplyToStatus(activeStory.userId, `Replying to status "${activeStory.content}": ${replyText.trim()}`);
    } else {
      alert(`Reply sent: "${replyText.trim()}"`);
    }
    setReplyText('');
    setActiveStory(null);
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-4 bg-card/60">
        <div>
          <h2 className="text-base font-bold tracking-tight">Status & Stories</h2>
          <p className="text-xs text-muted-foreground">Ephemeral 24-hour business and social updates</p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowAddModal(true)}
          className="bg-emerald-700 text-white hover:bg-emerald-800 gap-1.5 text-xs"
        >
          <Plus className="h-4 w-4" /> Add Status
        </Button>
      </div>

      {/* Main List */}
      <div className="flex-1 overflow-y-auto p-4 max-w-2xl mx-auto w-full space-y-6">
        {/* My Status Section */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">My Status</h3>
          <Card className="p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                onClick={() => myStatuses.length > 0 && setActiveStory(myStatuses[0])}
                className="relative flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-emerald-600/15 text-emerald-700 font-bold ring-2 ring-emerald-500 p-0.5 hover:scale-105 transition-transform"
              >
                <div className="flex h-full w-full items-center justify-center rounded-full bg-emerald-700 text-white text-xs">
                  {user?.displayName?.charAt(0).toUpperCase() || 'M'}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold text-foreground">My Status</div>
                <div className="text-[11px] text-muted-foreground">
                  {myStatuses.length > 0
                    ? `${myStatuses.length} update(s) • ${myStatuses[0].viewsCount} views`
                    : 'Tap to add status update'}
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddModal(true)}
              className="text-xs text-emerald-700 border-emerald-600"
            >
              Update
            </Button>
          </Card>
        </div>

        {/* Recent Updates from Contacts */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Recent Contact Updates (24h)
          </h3>
          <div className="space-y-2">
            {contactStatuses.map((s) => (
              <Card
                key={s.id}
                onClick={() => setActiveStory(s)}
                className="p-3.5 flex items-center justify-between cursor-pointer hover:border-emerald-600/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-full ring-2 ring-emerald-500 p-0.5">
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white font-bold text-xs">
                      {s.userName.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-foreground">{s.userName}</div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>•</span>
                      <span>Expires in 24 hours</span>
                    </div>
                  </div>
                </div>

                <Badge variant="outline" className="text-[10px]">
                  View Update
                </Badge>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* FULLSCREEN STORY VIEWER MODAL */}
      {activeStory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <div className="relative flex h-[580px] w-full max-w-sm flex-col justify-between rounded-3xl overflow-hidden shadow-2xl border border-white/10">
            {/* Top Progress Bar */}
            <div className="absolute top-0 inset-x-0 z-20 p-3 bg-gradient-to-b from-black/60 to-transparent">
              <div className="h-1 w-full rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-100 ease-linear"
                  style={{ width: `${storyProgress}%` }}
                />
              </div>

              {/* User info & close */}
              <div className="mt-3 flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20 font-bold text-xs">
                    {activeStory.userName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-tight">{activeStory.userName}</div>
                    <div className="text-[10px] opacity-75">
                      {new Date(activeStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveStory(null)}
                  className="rounded-full p-1 hover:bg-white/20"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Story Content Canvas Area */}
            <div
              className={`flex h-full w-full items-center justify-center p-6 text-center text-white bg-gradient-to-br ${
                activeStory.background || BG_GRADIENTS[0]
              }`}
            >
              <div className="text-lg font-bold leading-relaxed px-4 break-words">{activeStory.content}</div>
            </div>

            {/* Bottom Controls / Reply Bar */}
            <div className="absolute bottom-0 inset-x-0 z-20 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
              {activeStory.userId === user?.id ? (
                <div className="flex items-center justify-center gap-1.5 text-xs text-white/90">
                  <Eye className="h-4 w-4" />
                  <span>{activeStory.viewsCount} viewers</span>
                </div>
              ) : (
                <form onSubmit={handleSendReply} className="flex items-center gap-2">
                  <Input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Reply to status..."
                    className="h-9 flex-1 bg-black/40 border-white/20 text-white text-xs placeholder:text-white/60"
                  />
                  <Button type="submit" size="sm" className="h-9 bg-emerald-600 text-white px-3">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Add Status */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Create 24-Hour Status</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStatus} className="space-y-4">
              <div>
                <label className="text-xs font-medium">Status Text Message</label>
                <textarea
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="What's happening on your desk?..."
                  className="mt-1 w-full rounded-md border bg-background p-2.5 text-xs"
                  rows={4}
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium">Background Color Style</label>
                <div className="flex items-center gap-2 mt-1.5">
                  {BG_GRADIENTS.map((grad) => (
                    <button
                      key={grad}
                      type="button"
                      onClick={() => setSelectedBg(grad)}
                      className={`h-7 w-7 rounded-full bg-gradient-to-tr ${grad} ${
                        selectedBg === grad ? 'ring-2 ring-emerald-500 scale-110' : 'opacity-80'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-emerald-700 text-white">
                  Publish (24h)
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
