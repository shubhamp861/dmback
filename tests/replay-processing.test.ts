import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../src/db.js';
import { dispatchWebhookReplays, processWebhookReplay } from '../src/processing.js';

function database() {
  const methods = {
    getWebhookReplayForProcessing: vi.fn().mockResolvedValue({ id: 'replay', webhookEventId: 'stored-event', workspaceId: 'stored-workspace', processed: false }),
    getWebhookPayload: vi.fn().mockResolvedValue({ object: 'instagram', entry: [{ id: 'ig-account', changes: [
      { field: 'comments', value: { id: 'comment', text: 'guide please' } }
    ] }] }),
    listLiveAutomations: vi.fn().mockResolvedValue([{ id: 'automation', igAccountId: 'account', status: 'live',
      keywordRules: [{ value: 'guide', mode: 'contains' }], exclusions: [] }]),
    insertTriggerEvent: vi.fn().mockResolvedValue(true), markWebhookProcessed: vi.fn().mockResolvedValue(undefined),
    markWebhookReplayProcessed: vi.fn().mockResolvedValue(undefined), markWebhookReplayProcessingFailed: vi.fn().mockResolvedValue(undefined),
    claimWebhookReplays: vi.fn().mockResolvedValue([{ id: 'replay-1', webhookEventId: 'event-1' }, { id: 'replay-2', webhookEventId: 'event-2' }]),
    markWebhookReplayDispatched: vi.fn().mockResolvedValue(undefined), markWebhookReplayDispatchFailed: vi.fn().mockResolvedValue(undefined)
  };
  return { methods, instance: methods as unknown as Database };
}

describe('workspace-scoped replay processor', () => {
  it('uses authoritative stored workspace/event IDs and scopes both reads and writes', async () => {
    const { methods, instance } = database();
    await processWebhookReplay(instance, 'replay');
    expect(methods.getWebhookPayload).toHaveBeenCalledWith('stored-event');
    expect(methods.listLiveAutomations).toHaveBeenCalledWith('ig-account', 'stored-workspace');
    expect(methods.insertTriggerEvent).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: 'stored-workspace', outcome: 'queued' }));
    expect(methods.markWebhookReplayProcessed).toHaveBeenCalledWith('replay');
  });

  it('treats an already completed replay as a successful no-op', async () => {
    const { methods, instance } = database();
    methods.getWebhookReplayForProcessing.mockResolvedValueOnce({ id: 'replay', webhookEventId: 'stored-event', workspaceId: 'stored-workspace', processed: true });
    await processWebhookReplay(instance, 'replay');
    expect(methods.getWebhookPayload).not.toHaveBeenCalled();
    expect(methods.insertTriggerEvent).not.toHaveBeenCalled();
    expect(methods.markWebhookReplayProcessingFailed).not.toHaveBeenCalled();
  });

  it('does not bypass trigger idempotency when a trigger was already claimed', async () => {
    const { methods, instance } = database();
    methods.insertTriggerEvent.mockResolvedValueOnce(false);
    await processWebhookReplay(instance, 'replay');
    expect(methods.markWebhookReplayProcessed).toHaveBeenCalledWith('replay');
    expect(methods.markWebhookReplayProcessingFailed).not.toHaveBeenCalled();
  });

  it('rejects a replay when its stored payload ownership no longer validates', async () => {
    const { methods, instance } = database();
    methods.getWebhookReplayForProcessing.mockResolvedValueOnce(undefined);
    await expect(processWebhookReplay(instance, 'replay')).rejects.toThrow('not eligible');
    expect(methods.getWebhookPayload).not.toHaveBeenCalled();
    expect(methods.insertTriggerEvent).not.toHaveBeenCalled();
    expect(methods.markWebhookReplayProcessingFailed).toHaveBeenCalledWith('replay');
  });

  it('leaves failed work retryable and never marks it complete', async () => {
    const { methods, instance } = database();
    methods.insertTriggerEvent.mockRejectedValueOnce(new Error('synthetic database failure'));
    methods.markWebhookReplayProcessingFailed.mockRejectedValueOnce(new Error('secondary failure'));
    await expect(processWebhookReplay(instance, 'replay')).rejects.toThrow('synthetic database failure');
    expect(methods.markWebhookReplayProcessed).not.toHaveBeenCalled();
    expect(methods.markWebhookProcessed).not.toHaveBeenCalled();
  });

  it('persists dispatch failure and recovers the same replay ID on a later poll', async () => {
    const { methods, instance } = database();
    methods.claimWebhookReplays.mockResolvedValue([{ id: 'replay-1', webhookEventId: 'event-1' }]);
    const queue = { enqueueReplay: vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined) };
    await dispatchWebhookReplays(instance, queue);
    expect(methods.markWebhookReplayDispatchFailed).toHaveBeenCalledWith('replay-1');
    expect(methods.markWebhookReplayDispatched).not.toHaveBeenCalled();
    await dispatchWebhookReplays(instance, queue);
    expect(queue.enqueueReplay).toHaveBeenNthCalledWith(2, { webhookEventId: 'event-1', replayId: 'replay-1' });
    expect(methods.markWebhookReplayDispatched).toHaveBeenCalledExactlyOnceWith('replay-1');
  });

  it('does not let a reporting failure prevent subsequent durable dispatches', async () => {
    const { methods, instance } = database();
    const queue = { enqueueReplay: vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined) };
    await dispatchWebhookReplays(instance, queue, () => { throw new Error('reporter failure'); });
    expect(methods.markWebhookReplayDispatchFailed).toHaveBeenCalledWith('replay-1');
    expect(methods.markWebhookReplayDispatched).toHaveBeenCalledWith('replay-2');
  });
});
