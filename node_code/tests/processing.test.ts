import { describe, expect, it, vi } from 'vitest';
import type { Database } from '../src/db.js';
import { dispatchWebhookOutbox, processWebhookEvent } from '../src/processing.js';

describe('reusable worker processing', () => {
  function database() {
    const methods = {
      getWebhookPayload: vi.fn().mockResolvedValue({ object: 'instagram', entry: [{ id: 'ig-account', changes: [
        { field: 'comments', value: { id: 'comment', text: 'guide please' } }
      ] }] }),
      listLiveAutomations: vi.fn().mockResolvedValue([{ id: 'automation', igAccountId: 'account', status: 'live',
        keywordRules: [{ value: 'guide', mode: 'contains' }], exclusions: [] }]),
      insertTriggerEvent: vi.fn().mockResolvedValue(true), markWebhookProcessed: vi.fn().mockResolvedValue(undefined),
      claimWebhookOutbox: vi.fn().mockResolvedValue([{ webhookEventId: 'event-1' }, { webhookEventId: 'event-2' }]),
      markWebhookDispatched: vi.fn().mockResolvedValue(undefined), markWebhookDispatchFailed: vi.fn().mockResolvedValue(undefined)
    };
    return { methods, instance: methods as unknown as Database };
  }

  it('records a matching outcome and marks the persisted webhook processed', async () => {
    const { methods, instance } = database();
    await processWebhookEvent(instance, 'event-1');
    expect(methods.listLiveAutomations).toHaveBeenCalledWith('ig-account');
    expect(methods.insertTriggerEvent).toHaveBeenCalledWith(expect.objectContaining({
      commentId: 'comment', automationId: 'automation', outcome: 'queued', matchedKeyword: 'guide'
    }));
    expect(methods.markWebhookProcessed).toHaveBeenCalledWith('event-1');
  });

  it('does not mark an event processed when trigger persistence fails', async () => {
    const { methods, instance } = database();
    methods.insertTriggerEvent.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(processWebhookEvent(instance, 'event-1')).rejects.toThrow('database unavailable');
    expect(methods.markWebhookProcessed).not.toHaveBeenCalled();
  });

  it('rejects missing persisted events so BullMQ can retry them', async () => {
    const { methods, instance } = database();
    methods.getWebhookPayload.mockResolvedValueOnce(undefined);
    await expect(processWebhookEvent(instance, 'missing')).rejects.toThrow('was not found');
    expect(methods.markWebhookProcessed).not.toHaveBeenCalled();
  });

  it('records failed dispatch and continues to later records even if error reporting throws', async () => {
    const { methods, instance } = database();
    const queue = { enqueueMatch: vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined), close: vi.fn() };
    await dispatchWebhookOutbox(instance, queue, () => { throw new Error('reporter failed'); });
    expect(methods.markWebhookDispatchFailed).toHaveBeenCalledWith('event-1', 'QUEUE_DISPATCH_FAILED');
    expect(methods.markWebhookDispatched).toHaveBeenCalledExactlyOnceWith('event-2');
    expect(queue.enqueueMatch).toHaveBeenCalledTimes(2);
  });
});
