import { z } from 'zod';

const commentChangeSchema = z.object({
  field: z.literal('comments'),
  value: z.object({
    id: z.string(),
    text: z.string().optional(),
    from: z.object({ id: z.string(), username: z.string().optional() }).optional(),
    media: z.object({ id: z.string() }).optional(),
    parent_id: z.string().optional()
  }).passthrough()
});

const webhookEntrySchema = z.object({
  id: z.string(),
  time: z.number().optional(),
  changes: z.array(z.unknown()).default([])
}).passthrough();

export const instagramWebhookSchema = z.object({
  object: z.string(),
  entry: z.array(webhookEntrySchema)
}).passthrough();

export type InstagramWebhookPayload = z.infer<typeof instagramWebhookSchema>;

export interface CommentEvent {
  accountId: string;
  commentId: string;
  commentText: string;
  igsid?: string;
  username?: string;
  mediaId?: string;
  parentCommentId?: string;
}

export function parseInstagramWebhook(payload: unknown): InstagramWebhookPayload {
  return instagramWebhookSchema.parse(payload);
}

export function extractCommentEvents(payload: InstagramWebhookPayload): CommentEvent[] {
  const events: CommentEvent[] = [];
  for (const entry of payload.entry) {
    for (const rawChange of entry.changes) {
      const result = commentChangeSchema.safeParse(rawChange);
      if (!result.success) continue;
      const value = result.data.value;
      events.push({
        accountId: entry.id,
        commentId: value.id,
        commentText: value.text ?? '',
        ...(value.from?.id ? { igsid: value.from.id } : {}),
        ...(value.from?.username ? { username: value.from.username } : {}),
        ...(value.media?.id ? { mediaId: value.media.id } : {}),
        ...(value.parent_id ? { parentCommentId: value.parent_id } : {})
      });
    }
  }
  return events;
}
