import { describe, expect, it } from 'vitest';
import { extractCommentEvents, parseInstagramWebhook } from '../src/instagram/webhook.js';

describe('Instagram webhook comment parsing', () => {
  it('extracts an Instagram Login comment_id payload', () => {
    const payload = parseInstagramWebhook({
      object: 'instagram',
      entry: [{
        id: 'ig-account',
        time: 1730000000,
        changes: [{
          field: 'comments',
          value: {
            comment_id: 'comment-1',
            text: 'guide please',
            from: { id: 'igsid-1', username: 'dev' },
            media: { id: 'media-1', media_product_type: 'FEED' },
            parent_id: 'parent-1'
          }
        }]
      }]
    });

    expect(extractCommentEvents(payload)).toEqual([{
      accountId: 'ig-account',
      commentId: 'comment-1',
      commentText: 'guide please',
      igsid: 'igsid-1',
      username: 'dev',
      mediaId: 'media-1',
      parentCommentId: 'parent-1'
    }]);
  });

  it('keeps value.id payloads working', () => {
    const payload = parseInstagramWebhook({
      object: 'instagram',
      entry: [{
        id: 'ig-account',
        changes: [{
          field: 'comments',
          value: { id: 'legacy-comment', text: 'hello' }
        }]
      }]
    });

    expect(extractCommentEvents(payload)).toHaveLength(1);
    expect(extractCommentEvents(payload)[0]?.commentId).toBe('legacy-comment');
  });

  it('skips comment changes without an id', () => {
    const payload = parseInstagramWebhook({
      object: 'instagram',
      entry: [{
        id: 'ig-account',
        changes: [{
          field: 'comments',
          value: { text: 'no id' }
        }]
      }]
    });

    expect(extractCommentEvents(payload)).toEqual([]);
  });
});
