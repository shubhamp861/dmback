import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { TriggerEvent, ReplayResponse } from '../../lib/api';
import {
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  ShieldCheck,
  Search,
  MessageSquare,
  Sparkles,
  Filter,
} from 'lucide-react';

export interface TriggerEventsViewProps {
  events: TriggerEvent[];
  userRole: string;
  onReplayWebhook: (eventId: string) => Promise<ReplayResponse>;
}

export const TriggerEventsView: React.FC<TriggerEventsViewProps> = ({
  events,
  userRole,
  onReplayWebhook,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOutcome, setFilterOutcome] = useState<'all' | 'queued' | 'skipped' | 'sent'>('all');
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

  const filteredEvents = events.filter((evt) => {
    const matchesSearch =
      (evt.comment_text || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (evt.matched_keyword || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterOutcome === 'all' ? true : evt.outcome === filterOutcome;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-sky-100">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Trigger Events & Outbox Log
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-sky-50 text-sky-700 border border-sky-200/80">
              Audited Stream
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time feed of comment matching evaluations and worker dispatch queue entries.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-600 bg-sky-50/80 px-3 py-1.5 rounded-xl border border-sky-200/70">
          <span>Worker:</span>
          <span className="font-semibold text-sky-800">Active (Idempotent)</span>
        </div>
      </div>

      {replaySuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{replaySuccess.message}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search comment text or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-sky-200/80 bg-white text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-sky-50 rounded-lg text-xs font-medium border border-sky-100/80">
          <button
            onClick={() => setFilterOutcome('all')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              filterOutcome === 'all'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Events ({events.length})
          </button>
          <button
            onClick={() => setFilterOutcome('queued')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              filterOutcome === 'queued'
                ? 'bg-white text-amber-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Queued ({events.filter((e) => e.outcome === 'queued').length})
          </button>
          <button
            onClick={() => setFilterOutcome('skipped')}
            className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
              filterOutcome === 'skipped'
                ? 'bg-white text-slate-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Skipped ({events.filter((e) => e.outcome === 'skipped').length})
          </button>
        </div>
      </div>

      {/* Events Table (Ice Base Theme) */}
      <Card className="p-0 overflow-hidden border border-sky-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-sky-50/70 border-b border-sky-100 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Comment Content</th>
                <th className="py-3.5 px-4">Matched Rule</th>
                <th className="py-3.5 px-4">Outcome Status</th>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Audited Replay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100/70">
              {filteredEvents.map((evt) => (
                <tr key={evt.id} className="hover:bg-sky-50/40 transition-colors">
                  {/* Comment */}
                  <td className="py-4 px-4 sm:px-6 max-w-sm">
                    <div className="flex items-start gap-2.5">
                      <MessageSquare className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-slate-900 text-xs sm:text-sm leading-snug">
                          "{evt.comment_text || 'No comment text'}"
                        </p>
                        <p className="text-[10px] font-mono text-slate-400 mt-1">
                          Comment ID: {evt.comment_id}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Matched Keyword */}
                  <td className="py-4 px-4">
                    {evt.matched_keyword ? (
                      <span className="inline-flex items-center gap-1 font-mono text-sky-800 font-semibold bg-sky-100/70 px-2.5 py-1 rounded-md text-xs border border-sky-200/60">
                        <span>#</span>
                        <span>{evt.matched_keyword}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs">No match</span>
                    )}
                  </td>

                  {/* Outcome Status */}
                  <td className="py-4 px-4">
                    {evt.outcome === 'queued' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200/70">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Queued / Matched</span>
                      </span>
                    )}
                    {evt.outcome === 'skipped' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        <span>Skipped ({evt.reason_code})</span>
                      </span>
                    )}
                    {evt.outcome === 'sent' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/70">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Sent</span>
                      </span>
                    )}
                    {evt.outcome === 'failed' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200/70">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Failed</span>
                      </span>
                    )}
                  </td>

                  {/* Timestamp */}
                  <td className="py-4 px-4 text-xs font-mono text-slate-500 whitespace-nowrap">
                    {new Date(evt.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </td>

                  {/* Audited Replay Button */}
                  <td className="py-4 px-4 sm:px-6 text-right">
                    {canReplay ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={replayingId === evt.id}
                        onClick={() => handleReplay(evt.id)}
                        className="h-8 px-2.5 text-xs gap-1.5"
                        title="Audited Webhook Replay"
                      >
                        <RotateCcw
                          className={`w-3.5 h-3.5 ${
                            replayingId === evt.id ? 'animate-spin text-sky-600' : ''
                          }`}
                        />
                        <span>{replayingId === evt.id ? 'Replaying...' : 'Replay'}</span>
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400">Admin only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredEvents.length === 0 && (
            <div className="py-16 text-center text-slate-400">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50 text-sky-300" />
              <p className="text-sm font-medium text-slate-700">No events matched your filter</p>
              <p className="text-xs text-slate-400 mt-1">
                Post comments through the simulator or live webhook to see evaluations here.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
