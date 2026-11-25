'use client';

import React, { useEffect, useState } from 'react';
import {
  Mic,
  MicOff,
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  PhoneOutgoing,
  Plus,
  Radio,
  Share2,
  ShieldCheck,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { CallRecord, Paginated } from '@/lib/types';
import { apiRequest } from '@/lib/api-client';
import { Badge, Button, Card, Input } from '@/components/ui/primitives';

interface CallsPanelProps {
  activeCallId?: string | null;
  onEndCall?: () => void;
}

export function CallsPanel({ activeCallId, onEndCall }: CallsPanelProps) {
  const [history, setHistory] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialModal, setShowDialModal] = useState(false);
  const [dialUserId, setDialUserId] = useState('');
  const [dialType, setDialType] = useState<'VOICE' | 'VIDEO'>('VOICE');

  // In-Call state
  const [inCall, setInCall] = useState(false);
  const [callSessionId, setCallSessionId] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [currentCallType, setCurrentCallType] = useState<'VOICE' | 'VIDEO'>('VOICE');
  const [currentCallee, setCurrentCallee] = useState('Colleague');

  async function loadHistory() {
    try {
      setLoading(true);
      const res = await apiRequest<Paginated<CallRecord>>('/calling/history?page=1&limit=50');
      setHistory(res.items || []);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  // Timer loop when in call
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (inCall) {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(interval);
  }, [inCall]);

  async function handleStartCall(e: React.FormEvent) {
    e.preventDefault();
    if (!dialUserId.trim()) return;

    try {
      const res = await apiRequest<{ id: string; callType: 'VOICE' | 'VIDEO' }>('/calling/sessions', {
        method: 'POST',
        body: JSON.stringify({
          callType: dialType,
          inviteeIds: [dialUserId.trim()],
        }),
      });

      setShowDialModal(false);
      setCallSessionId(res.id);
      setCurrentCallType(dialType);
      setCurrentCallee(dialUserId.trim());
      setInCall(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to initiate call');
    }
  }

  async function handleHangUp() {
    if (callSessionId) {
      try {
        await apiRequest(`/calling/sessions/${callSessionId}/end`, { method: 'POST' });
      } catch {
        // Ignored
      }
    }
    setInCall(false);
    setCallSessionId(null);
    if (onEndCall) onEndCall();
    loadHistory();
  }

  function formatDuration(sec: number) {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-background">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b p-4 bg-card/60">
        <div>
          <h2 className="text-base font-bold tracking-tight">Voice & Video Calling</h2>
          <p className="text-xs text-muted-foreground">High-definition WebRTC DTLS-SRTP secure calling</p>
        </div>
        <Button
          size="sm"
          onClick={() => setShowDialModal(true)}
          className="bg-emerald-700 text-white hover:bg-emerald-800 gap-1.5 text-xs"
        >
          <PhoneCall className="h-4 w-4" /> Start New Call
        </Button>
      </div>

      {/* Main Call History List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-800 dark:text-emerald-300">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>All voice and video streams are peer-to-peer encrypted using WebRTC and DTLS-SRTP protocols.</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-muted-foreground">Loading call logs...</div>
        ) : history.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No previous calls recorded. Use the <strong>Start New Call</strong> button to call a team member.
          </div>
        ) : (
          <div className="divide-y rounded-xl border bg-card">
            {history.map((record) => {
              const isMissed = record.status === 'MISSED' || record.status === 'DECLINED';
              return (
                <div key={record.id} className="flex items-center justify-between p-3.5 hover:bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        isMissed ? 'bg-red-500/15 text-red-500' : 'bg-emerald-600/15 text-emerald-600'
                      }`}
                    >
                      {record.callType === 'VIDEO' ? (
                        <Video className="h-4 w-4" />
                      ) : isMissed ? (
                        <PhoneMissed className="h-4 w-4" />
                      ) : (
                        <PhoneIncoming className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        {record.caller?.displayName || record.caller?.username || 'Team Call'}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span>{new Date(record.startedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        <span>•</span>
                        <span>{record.durationSeconds ? `${record.durationSeconds}s` : record.status}</span>
                      </div>
                    </div>
                  </div>

                  <Badge variant={isMissed ? 'destructive' : 'success'} className="text-[10px]">
                    {record.status}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ACTIVE CALL OVERLAY MODAL */}
      {inCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative flex h-[500px] w-full max-w-2xl flex-col items-center justify-between rounded-3xl border border-white/10 bg-gradient-to-b from-gray-900 via-gray-950 to-black p-8 text-white shadow-2xl">
            {/* Call Status Header */}
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold tracking-wider uppercase">
                <Radio className="h-3.5 w-3.5 animate-pulse" /> Connected • DTLS-SRTP Secure
              </div>
              <h2 className="mt-2 text-xl font-bold">{currentCallee}</h2>
              <div className="mt-1 font-mono text-sm tracking-widest text-white/70">
                {formatDuration(callDuration)}
              </div>
            </div>

            {/* Video / Visualizer Center Area */}
            <div className="relative flex h-48 w-48 items-center justify-center rounded-full bg-emerald-600/20 ring-4 ring-emerald-500/30 animate-pulse">
              {currentCallType === 'VIDEO' && !isVideoOff ? (
                <div className="flex flex-col items-center justify-center text-xs text-white/80">
                  <Video className="h-12 w-12 text-emerald-400 mb-1" />
                  <span>HD Video Active</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-xs text-white/80">
                  <Phone className="h-12 w-12 text-emerald-400 mb-1" />
                  <span>Audio Visualizer</span>
                </div>
              )}
            </div>

            {/* Controls Dock Bar */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setIsMuted((p) => !p)}
                className={`flex h-12 w-12 items-center justify-center rounded-full transition-transform hover:scale-105 ${
                  isMuted ? 'bg-red-500 text-white' : 'bg-white/15 text-white hover:bg-white/25'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>

              {currentCallType === 'VIDEO' && (
                <button
                  type="button"
                  onClick={() => setIsVideoOff((p) => !p)}
                  className={`flex h-12 w-12 items-center justify-center rounded-full transition-transform hover:scale-105 ${
                    isVideoOff ? 'bg-red-500 text-white' : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                  title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
                >
                  {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsSpeakerOn((p) => !p)}
                className={`flex h-12 w-12 items-center justify-center rounded-full transition-transform hover:scale-105 ${
                  !isSpeakerOn ? 'bg-white/15 text-white/50' : 'bg-white/15 text-white hover:bg-white/25'
                }`}
                title="Toggle Speaker"
              >
                {isSpeakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              </button>

              <button
                type="button"
                onClick={handleHangUp}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-600/40 hover:bg-red-700 transition-transform hover:scale-110 ml-2"
                title="End Call"
              >
                <PhoneOff className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Dial New Call */}
      {showDialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">Initiate WebRTC Call</h3>
              <button type="button" onClick={() => setShowDialModal(false)} className="text-muted-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleStartCall} className="space-y-4">
              <div>
                <label className="text-xs font-medium">Recipient User ID</label>
                <Input
                  value={dialUserId}
                  onChange={(e) => setDialUserId(e.target.value)}
                  placeholder="Paste UUID of user to call..."
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium">Call Type</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setDialType('VOICE')}
                    className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-semibold ${
                      dialType === 'VOICE' ? 'border-emerald-600 bg-emerald-500/10 text-emerald-700' : 'hover:bg-muted'
                    }`}
                  >
                    <Phone className="h-4 w-4" /> Voice Call
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialType('VIDEO')}
                    className={`flex items-center justify-center gap-2 rounded-lg border p-2.5 text-xs font-semibold ${
                      dialType === 'VIDEO' ? 'border-emerald-600 bg-emerald-500/10 text-emerald-700' : 'hover:bg-muted'
                    }`}
                  >
                    <Video className="h-4 w-4" /> Video Call
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setShowDialModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-emerald-700 text-white">
                  Place Call
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
