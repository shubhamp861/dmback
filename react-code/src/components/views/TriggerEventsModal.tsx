import React, { useState } from 'react';
import { Sheet } from '../ui/Sheet';
import { Button } from '../ui/Button';
import { TriggerEvent, ReplayResponse } from '../../lib/api';
import {
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Hash,
  Send,
  MessageSquare,
} from 'lucide-react';

export interface TriggerEventsModalProps {
  isOpen: boolean;
  onClose: () => void;
  automationName: string;
  automationId: string;
  events: TriggerEvent[];
  userRole: string;
  onReplayWebhook: (eventId: string) => Promise<ReplayResponse>;
}

export const TriggerEventsModal: React.FC<TriggerEventsModalProps> = ({
  isOpen,
  onClose,
  automationName,
  automationId,
  events,
  userRole,
  onReplayWebhook,
}) => {
  const [replayingId, setReplayingId] = useState<string | null>(null);
  const [replaySuccess, setReplaySuccess] = useState<{ id: string; message: string } | null>(null);

  const canReplay = userRole === 'owner' || userRole === 'admin';

  const handleReplay = async (eventId: string) => {
    setReplayingId(eventId);
    try {
      const res = await onReplayWebhook(eventId);
      setReplaySuccess({
        id: eventId,
        message: `Replay accepted (Request ID: ${res.id.slice(0, 8)}... - Status: pending)`,
      });
      setTimeout(() => setReplaySuccess(null), 4000);
    } catch {
      // handled
    } finally {
      setReplayingId(null);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Automation Trigger Events & Activity Log"
      description={`Real-time comment matching and dispatch events for "${automationName}".`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4">
        {/* Backend Note Banner (API Contract Compliance) */}
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-slate-800">
              Backend Processing Note (API-AUTH-MAPPING v1)
            </p>
            <p className="text-slate-500 leading-relaxed">
              Matching events marked <span className="font-semibold text-indigo-700">"Queued / Matched"</span> have successfully satisfied keyword rules and are recorded in the idempotent dispatch outbox.
            </p>
          </div>
        </div>

        {replaySuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{replaySuccess.message}</span>
          </div>
        )}

        {/* Events Table */}
        <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-4">Comment & Match</th>
                  <th className="py-2.5 px-3">Keyword</th>
                  <th className="py-2.5 px-3">Outcome</th>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-4 text-right">Audited Replay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 max-w-xs">
                      <div className="flex items-start gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-slate-900 leading-snug">
                            "{evt.comment_text || 'No comment text'}"
                          </p>
                          <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                            ID: {evt.comment_id}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      {evt.matched_keyword ? (
                        <span className="font-mono text-indigo-700 font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/50">
                          #{evt.matched_keyword}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      {evt.outcome === 'queued' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60">
                          <Clock className="w-3 h-3" />
                          Queued / Matched
                        </span>
                      )}
                      {evt.outcome === 'skipped' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          Skipped ({evt.reason_code})
                        </span>
                      )}
                      {evt.outcome === 'sent' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          <CheckCircle2 className="w-3 h-3" />
                          Sent
                        </span>
                      )}
                      {evt.outcome === 'failed' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200/60">
                          <AlertTriangle className="w-3 h-3" />
                          Failed
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                      {new Date(evt.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {canReplay ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={replayingId === evt.id}
                          onClick={() => handleReplay(evt.id)}
                          className="h-7 px-2 text-[11px] gap-1"
                          title="POST /v1/webhook-events/:id/replay"
                        >
                          <RotateCcw
                            className={`w-3 h-3 ${replayingId === evt.id ? 'animate-spin' : ''}`}
                          />
                          <span>{replayingId === evt.id ? 'Replaying...' : 'Replay'}</span>
                        </Button>
                      ) : (
                        <span
                          className="text-[10px] text-slate-400"
                          title="Requires Owner or Admin role"
                        >
                          Admin only
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {events.length === 0 && (
              <div className="py-12 text-center text-slate-400">
                <FileText className="w-6 h-6 mx-auto mb-2 opacity-60" />
                <p>No trigger events recorded for this automation yet.</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <p className="text-[11px] text-slate-400">
            Automations ID: <code className="font-mono">{automationId}</code>
          </p>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Sheet>
  );
};
