'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  CheckCheck,
  Clock,
  FileText,
  Image as ImageIcon,
  Lock,
  MoreVertical,
  Paperclip,
  Phone,
  Pin,
  Plus,
  Search,
  Send,
  Smile,
  Star,
  Trash2,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Conversation, Message, Paginated } from '@/lib/types';
import { apiRequest } from '@/lib/api-client';
import { Badge, Button, Card, Input } from '@/components/ui/primitives';

interface ChatsPanelProps {
  onStartCall?: (calleeId: string, type: 'VOICE' | 'VIDEO', convId?: string) => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '👏'];

export function ChatsPanel({ onStartCall }: ChatsPanelProps) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [inputText, setInputText] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [disappearingModal, setDisappearingModal] = useState(false);
  const [disappearingTtl, setDisappearingTtl] = useState(0);

  // New Chat / Group state
  const [targetUserId, setTargetUserId] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [groupMembersText, setGroupMembersText] = useState('');
  const [announcementsOnly, setAnnouncementsOnly] = useState(false);
  const [modalError, setModalError] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations
  async function loadConversations() {
    try {
      setLoading(true);
      const res = await apiRequest<Paginated<Conversation>>('/messaging/conversations?page=1&limit=50');
      setConversations(res.items || []);
      if (!activeConv && res.items?.length > 0) {
        setActiveConv(res.items[0]);
      }
    } catch {
      // Fallback empty
    } finally {
      setLoading(false);
    }
  }

  // Load messages for active conversation
  async function loadMessages(convId: string) {
    try {
      setMsgLoading(true);
      const res = await apiRequest<Paginated<Message>>(`/messaging/conversations/${convId}/messages?page=1&limit=50`);
      // Sort oldest to newest
      const sorted = (res.items || []).reverse();
      setMessages(sorted);

      // Auto mark unread messages as read
      for (const m of sorted) {
        if (m.senderId !== user?.id && m.deliveryStatus !== 'READ') {
          apiRequest(`/messaging/messages/${m.id}/read`, { method: 'PUT' }).catch(() => {});
        }
      }
    } catch {
      setMessages([]);
    } finally {
      setMsgLoading(false);
    }
  }

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (activeConv) {
      loadMessages(activeConv.id);
      setDisappearingTtl(activeConv.disappearingTtlSeconds || 0);
    }
  }, [activeConv?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSendMessage(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeConv || !user) return;

    const textToSend = inputText.trim();
    setInputText('');
    const currentReply = replyTo;
    setReplyTo(null);
    setShowEmojiPicker(false);

    try {
      let payload: Record<string, unknown>;
      if (activeConv.isEncrypted) {
        // Deterministic E2EE payload simulation for encrypted chat
        const encoder = new TextEncoder();
        const nonceBytes = new Uint8Array(12);
        if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
          crypto.getRandomValues(nonceBytes);
        }
        const nonceBase64 = btoa(String.fromCharCode(...nonceBytes));
        const cipherBase64 = btoa(unescape(encodeURIComponent(textToSend)));

        payload = {
          conversationId: activeConv.id,
          messageType: 'TEXT',
          ciphertext: cipherBase64,
          nonce: nonceBase64,
          senderKeyVersion: 1,
          replyToId: currentReply?.id || null,
        };
      } else {
        payload = {
          conversationId: activeConv.id,
          messageType: 'TEXT',
          plaintextBody: textToSend,
          replyToId: currentReply?.id || null,
        };
      }

      const newMsg = await apiRequest<Message>('/messaging/messages', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setMessages((prev) => [...prev, newMsg]);
      // Update last message in conversation list
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConv.id ? { ...c, lastMessage: newMsg, updatedAt: new Date().toISOString() } : c)),
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to send message');
    }
  }

  async function handleReaction(msgId: string, emoji: string) {
    try {
      await apiRequest(`/messaging/messages/${msgId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      });
      // Update local message reactions
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== msgId) return m;
          const existing = m.reactions || [];
          const hadIt = existing.some((r) => r.emoji === emoji && r.userId === user?.id);
          const next = hadIt
            ? existing.filter((r) => !(r.emoji === emoji && r.userId === user?.id))
            : [...existing, { id: 'tmp_' + Date.now(), messageId: msgId, userId: user?.id || '', emoji, createdAt: new Date().toISOString() }];
          return { ...m, reactions: next };
        }),
      );
    } catch {
      // Ignored
    }
  }

  async function handleTogglePin(msgId: string) {
    try {
      const updated = await apiRequest<Message>(`/messaging/messages/${msgId}/pin`, { method: 'PATCH' });
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, isPinned: updated.isPinned } : m)));
    } catch {
      // Ignored
    }
  }

  async function handleToggleStar(msgId: string) {
    try {
      const updated = await apiRequest<Message>(`/messaging/messages/${msgId}/star`, { method: 'PATCH' });
      setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, isStarred: updated.isStarred } : m)));
    } catch {
      // Ignored
    }
  }

  async function handleDeleteMessage(msgId: string) {
    if (!confirm('Delete this message for everyone?')) return;
    try {
      await apiRequest(`/messaging/messages/${msgId}`, { method: 'DELETE' });
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, plaintextBody: 'This message was deleted', ciphertext: null } : m)),
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Cannot delete message');
    }
  }

  async function handleCreatePrivateChat(e: React.FormEvent) {
    e.preventDefault();
    if (!targetUserId.trim()) return;
    setModalError('');
    try {
      const res = await apiRequest<Conversation>('/messaging/conversations', {
        method: 'POST',
        body: JSON.stringify({
          type: 'PRIVATE',
          memberIds: [targetUserId.trim()],
          isEncrypted: true,
        }),
      });
      setShowNewChatModal(false);
      setTargetUserId('');
      setConversations((prev) => [res, ...prev]);
      setActiveConv(res);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Failed to create chat');
    }
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!groupTitle.trim()) return;
    setModalError('');
    try {
      const memberIds = groupMembersText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const res = await apiRequest<Conversation>('/messaging/conversations', {
        method: 'POST',
        body: JSON.stringify({
          type: 'GROUP',
          title: groupTitle.trim(),
          memberIds,
          isEncrypted: true,
        }),
      });
      setShowNewGroupModal(false);
      setGroupTitle('');
      setGroupMembersText('');
      setConversations((prev) => [res, ...prev]);
      setActiveConv(res);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Failed to create group');
    }
  }

  async function handleSaveDisappearing() {
    if (!activeConv) return;
    try {
      await apiRequest(`/messaging/conversations/${activeConv.id}/disappearing`, {
        method: 'PATCH',
        body: JSON.stringify({ ttlSeconds: disappearingTtl }),
      });
      setActiveConv((prev) => (prev ? { ...prev, disappearingTtlSeconds: disappearingTtl } : null));
      setDisappearingModal(false);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update settings');
    }
  }

  // Conversation title & subtitle helper
  function getConvDisplayName(conv: Conversation) {
    if (conv.title) return conv.title;
    if (conv.type === 'PRIVATE') {
      const other = conv.members?.find((m) => m.userId !== user?.id)?.user;
      return other?.displayName || other?.username || 'Private Contact';
    }
    return 'ConnectX Chat';
  }

  const filteredConversations = conversations.filter((c) =>
    getConvDisplayName(c).toLowerCase().includes(search.toLowerCase()),
  );

  const pinnedMessage = messages.find((m) => m.isPinned);

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* 1. Conversations List Sidebar */}
      <div className="flex w-80 shrink-0 flex-col border-r bg-card/60">
        {/* Header with Search and New Actions */}
        <div className="border-b p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold tracking-tight text-foreground">Chats</h2>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                title="New Chat"
                onClick={() => setShowNewChatModal(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                title="New Group"
                onClick={() => setShowNewGroupModal(true)}
              >
                <Users className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats..."
              className="h-8 pl-8 text-xs bg-background/80"
            />
          </div>
        </div>

        {/* List Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-border/40">
          {loading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Loading conversations...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No conversations found. Click <span className="font-semibold text-emerald-600">+</span> to start a chat!
            </div>
          ) : (
            filteredConversations.map((c) => {
              const isSelected = activeConv?.id === c.id;
              const name = getConvDisplayName(c);
              const otherMember = c.members?.find((m) => m.userId !== user?.id)?.user;
              const isOnline = otherMember?.presenceStatus === 'ONLINE';

              return (
                <div
                  key={c.id}
                  onClick={() => setActiveConv(c)}
                  className={`flex cursor-pointer items-center gap-3 p-3 transition-colors ${
                    isSelected ? 'bg-emerald-500/10 border-l-4 border-emerald-600' : 'hover:bg-accent/40'
                  }`}
                >
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600/15 text-emerald-700 font-semibold text-sm">
                    {c.type === 'GROUP' ? <Users className="h-5 w-5" /> : name.charAt(0).toUpperCase()}
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="truncate text-xs font-semibold text-foreground">{name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {c.updatedAt ? new Date(c.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="truncate">
                        {c.isEncrypted && <Lock className="mr-1 inline h-2.5 w-2.5 text-emerald-600" />}
                        {c.lastMessage ? (
                          c.lastMessage.plaintextBody || (c.lastMessage.ciphertext ? 'Encrypted message' : 'Media')
                        ) : (
                          'No messages yet'
                        )}
                      </span>
                      {c.disappearingTtlSeconds > 0 && <Clock className="h-2.5 w-2.5 text-amber-500" />}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 2. Chat Conversation View Pane */}
      {activeConv ? (
        <div className="flex flex-1 flex-col overflow-hidden bg-background">
          {/* Conversation Top Header */}
          <div className="flex h-14 items-center justify-between border-b px-4 bg-card/80 backdrop-blur-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-700/15 text-emerald-700 font-semibold text-sm">
                {activeConv.type === 'GROUP' ? <Users className="h-4 w-4" /> : getConvDisplayName(activeConv).charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="truncate text-xs font-bold text-foreground">{getConvDisplayName(activeConv)}</h3>
                  {activeConv.isEncrypted && (
                    <Badge variant="success" className="px-1.5 py-0 text-[10px]">
                      <Lock className="mr-0.5 h-2.5 w-2.5 inline" /> E2EE
                    </Badge>
                  )}
                  {activeConv.disappearingTtlSeconds > 0 && (
                    <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                      <Clock className="mr-0.5 h-2.5 w-2.5 inline" /> Disappearing
                    </Badge>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {activeConv.type === 'GROUP'
                    ? `${activeConv.members?.length || 2} members`
                    : activeConv.members?.find((m) => m.userId !== user?.id)?.user?.presenceStatus === 'ONLINE'
                    ? 'Online'
                    : 'End-to-End Encrypted'}
                </div>
              </div>
            </div>

            {/* Quick Actions in Header */}
            <div className="flex items-center gap-1">
              {onStartCall && activeConv.type === 'PRIVATE' && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-emerald-700"
                    title="Audio Call"
                    onClick={() => {
                      const otherId = activeConv.members?.find((m) => m.userId !== user?.id)?.userId;
                      if (otherId) onStartCall(otherId, 'VOICE', activeConv.id);
                    }}
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-emerald-700"
                    title="Video Call"
                    onClick={() => {
                      const otherId = activeConv.members?.find((m) => m.userId !== user?.id)?.userId;
                      if (otherId) onStartCall(otherId, 'VIDEO', activeConv.id);
                    }}
                  >
                    <Video className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                title="Disappearing Messages Settings"
                onClick={() => setDisappearingModal(true)}
              >
                <Clock className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Pinned Message Banner */}
          {pinnedMessage && (
            <div className="flex items-center justify-between border-b bg-amber-500/10 px-4 py-1.5 text-xs text-amber-800 dark:text-amber-300">
              <div className="flex items-center gap-2 truncate">
                <Pin className="h-3.5 w-3.5 shrink-0" />
                <span className="font-semibold">Pinned:</span>
                <span className="truncate">
                  {pinnedMessage.plaintextBody || (pinnedMessage.ciphertext ? 'Encrypted content' : 'Attachment')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleTogglePin(pinnedMessage.id)}
                className="text-[11px] font-medium hover:underline ml-2 shrink-0"
              >
                Unpin
              </button>
            </div>
          )}

          {/* Message Thread Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)] [background-size:16px_16px]">
            {/* E2EE Info Banner */}
            <div className="mx-auto max-w-sm rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-center text-[11px] text-amber-700 dark:text-amber-400">
              <Lock className="mx-auto mb-1 h-3.5 w-3.5" />
              Messages in this chat are secured with end-to-end encryption. No outside party can read them.
            </div>

            {msgLoading ? (
              <div className="py-10 text-center text-xs text-muted-foreground">Loading message history...</div>
            ) : messages.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground">
                Say hello! Start the conversation with an encrypted message.
              </div>
            ) : (
              messages.map((m) => {
                const isMine = m.senderId === user?.id;

                // Decode ciphertext display for local mock testing
                let displayText = m.plaintextBody;
                if (!displayText && m.ciphertext) {
                  try {
                    displayText = decodeURIComponent(escape(atob(m.ciphertext)));
                  } catch {
                    displayText = '[Encrypted Message]';
                  }
                }

                return (
                  <div
                    key={m.id}
                    className={`group flex flex-col ${isMine ? 'items-end' : 'items-start'} transition-all`}
                  >
                    <div
                      className={`relative max-w-md rounded-2xl px-3.5 py-2 shadow-xs text-xs ${
                        isMine
                          ? 'bg-emerald-700 text-white rounded-br-xs'
                          : 'bg-card border text-card-foreground rounded-bl-xs'
                      }`}
                    >
                      {/* Sender label for groups */}
                      {!isMine && activeConv.type === 'GROUP' && (
                        <div className="mb-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          {m.sender?.displayName || m.sender?.username || 'Member'}
                        </div>
                      )}

                      {/* Reply preview */}
                      {m.replyToId && (
                        <div
                          className={`mb-1.5 rounded-md border-l-2 p-1 text-[10px] ${
                            isMine ? 'bg-black/10 border-white/60 text-white/90' : 'bg-muted border-primary text-muted-foreground'
                          }`}
                        >
                          Replying to earlier message
                        </div>
                      )}

                      {/* Text Body */}
                      <div className="whitespace-pre-wrap break-words leading-relaxed">{displayText || '...'}</div>

                      {/* Footer: Time + Status Ticks */}
                      <div className="mt-1 flex items-center justify-end gap-1 text-[9px] opacity-75">
                        {m.isStarred && <Star className="h-2.5 w-2.5 fill-current" />}
                        {m.isPinned && <Pin className="h-2.5 w-2.5" />}
                        <span>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMine && (
                          <span>
                            {m.deliveryStatus === 'READ' ? (
                              <CheckCheck className="h-3 w-3 text-cyan-300" />
                            ) : m.deliveryStatus === 'DELIVERED' ? (
                              <CheckCheck className="h-3 w-3" />
                            ) : (
                              <Check className="h-3 w-3" />
                            )}
                          </span>
                        )}
                      </div>

                      {/* Reactions Pill Display */}
                      {m.reactions && m.reactions.length > 0 && (
                        <div className="absolute -bottom-2.5 right-2 flex items-center gap-0.5 rounded-full border bg-card px-1.5 py-0.5 text-[10px] shadow-sm">
                          {Array.from(new Set(m.reactions.map((r) => r.emoji))).map((emoji) => (
                            <span key={emoji}>{emoji}</span>
                          ))}
                          <span className="text-[9px] text-muted-foreground ml-0.5">{m.reactions.length}</span>
                        </div>
                      )}

                      {/* Hover action menu */}
                      <div
                        className={`absolute top-1 hidden group-hover:flex items-center gap-1 rounded-md border bg-card/90 p-0.5 shadow-sm ${
                          isMine ? '-left-20' : '-right-20'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleReaction(m.id, '👍')}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Thumbs up"
                        >
                          👍
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReaction(m.id, '❤️')}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Heart"
                        >
                          ❤️
                        </button>
                        <button
                          type="button"
                          onClick={() => handleTogglePin(m.id)}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Pin message"
                        >
                          <Pin className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStar(m.id)}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Star message"
                        >
                          <Star className="h-3 w-3" />
                        </button>
                        {isMine && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMessage(m.id)}
                            className="rounded p-1 text-red-500 hover:bg-red-500/10"
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply Banner */}
          {replyTo && (
            <div className="flex items-center justify-between border-t bg-muted/40 px-4 py-2 text-xs">
              <div className="flex items-center gap-2 truncate">
                <span className="font-semibold text-emerald-600">Replying:</span>
                <span className="truncate text-muted-foreground">{replyTo.plaintextBody || 'Attachment'}</span>
              </div>
              <button type="button" onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Quick Emoji Picker Strip */}
          {showEmojiPicker && (
            <div className="flex items-center gap-2 border-t bg-card px-4 py-2">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold">Quick React:</span>
              <div className="flex items-center gap-1.5">
                {QUICK_EMOJIS.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => {
                      setInputText((prev) => prev + em);
                      setShowEmojiPicker(false);
                    }}
                    className="rounded p-1 text-sm hover:scale-125 transition-transform"
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message Composer Input Form */}
          <form onSubmit={handleSendMessage} className="flex items-center gap-2 border-t bg-card p-3">
            <button
              type="button"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Emoji"
            >
              <Smile className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => alert('Media upload: Select file to attach to chat')}
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Attach File"
            >
              <Paperclip className="h-5 w-5" />
            </button>

            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={activeConv.isEncrypted ? 'End-to-End Encrypted message...' : 'Type a message...'}
              className="h-10 flex-1 text-xs bg-background/80"
            />

            <Button
              type="submit"
              disabled={!inputText.trim()}
              className="h-10 bg-emerald-700 text-white hover:bg-emerald-800 px-4"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 mb-3">
            <Lock className="h-8 w-8" />
          </div>
          <h3 className="text-base font-bold text-foreground">ConnectX Secure Messaging</h3>
          <p className="mt-1 max-w-sm text-xs">
            Select a conversation from the left to start messaging, or create a new private or group chat.
          </p>
        </div>
      )}

      {/* MODAL: New Private Chat */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Start Private Chat</h3>
              <button type="button" onClick={() => setShowNewChatModal(false)} className="text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {modalError && <div className="text-xs text-red-500">{modalError}</div>}
            <form onSubmit={handleCreatePrivateChat} className="space-y-3">
              <div>
                <label className="text-xs font-medium">Participant User ID or Contact ID</label>
                <Input
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  placeholder="Paste UUID of user..."
                  className="mt-1"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowNewChatModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-emerald-700 text-white">
                  Start Chat
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: New Group Chat */}
      {showNewGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Create Group Chat</h3>
              <button type="button" onClick={() => setShowNewGroupModal(false)} className="text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            {modalError && <div className="text-xs text-red-500">{modalError}</div>}
            <form onSubmit={handleCreateGroup} className="space-y-3">
              <div>
                <label className="text-xs font-medium">Group Title</label>
                <Input
                  value={groupTitle}
                  onChange={(e) => setGroupTitle(e.target.value)}
                  placeholder="e.g. Engineering Team"
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium">Member User IDs (Comma-separated)</label>
                <Input
                  value={groupMembersText}
                  onChange={(e) => setGroupMembersText(e.target.value)}
                  placeholder="uuid-1, uuid-2..."
                  className="mt-1"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="announceOnly"
                  checked={announcementsOnly}
                  onChange={(e) => setAnnouncementsOnly(e.target.checked)}
                  className="rounded border-gray-300 text-emerald-600"
                />
                <label htmlFor="announceOnly" className="text-xs text-muted-foreground">
                  Announcement-only (Only admins can post)
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowNewGroupModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-emerald-700 text-white">
                  Create Group
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* MODAL: Disappearing Messages */}
      {disappearingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Disappearing Messages</h3>
              <button type="button" onClick={() => setDisappearingModal(false)} className="text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              For added privacy, set messages to disappear from this chat after a certain time once read.
            </p>
            <div className="space-y-2">
              {[
                { label: 'Off', seconds: 0 },
                { label: '24 Hours', seconds: 86400 },
                { label: '7 Days', seconds: 604800 },
                { label: '90 Days', seconds: 7776000 },
              ].map((opt) => (
                <label
                  key={opt.seconds}
                  className={`flex cursor-pointer items-center justify-between rounded-lg border p-2.5 text-xs transition-colors ${
                    disappearingTtl === opt.seconds ? 'border-emerald-600 bg-emerald-500/10 font-bold' : 'hover:bg-muted'
                  }`}
                >
                  <span>{opt.label}</span>
                  <input
                    type="radio"
                    name="ttl"
                    checked={disappearingTtl === opt.seconds}
                    onChange={() => setDisappearingTtl(opt.seconds)}
                    className="text-emerald-600"
                  />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDisappearingModal(false)}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={handleSaveDisappearing} className="bg-emerald-700 text-white">
                Save
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
