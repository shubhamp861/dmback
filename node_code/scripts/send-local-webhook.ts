import 'dotenv/config';
import { createHmac } from 'node:crypto';

const port = process.env.PORT ?? '3000';
const appSecret = process.env.META_APP_SECRET;
if (!appSecret) {
  throw new Error('META_APP_SECRET must be set before sending the local webhook');
}

const payload = {
  object: 'instagram',
  entry: [{
    id: 'local-ig-account',
    time: Math.floor(Date.now() / 1000),
    changes: [{
      field: 'comments',
      value: {
        id: `local-comment-${Date.now()}`,
        text: 'guide please',
        from: { id: 'local-user-1', username: 'local_user' },
        media: { id: 'local-media-1' }
      }
    }]
  }]
};

const body = JSON.stringify(payload);
const signature = createHmac('sha256', appSecret).update(body).digest('hex');
const response = await fetch(`http://localhost:${port}/v1/webhooks/instagram`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-hub-signature-256': `sha256=${signature}`
  },
  body
});

const responseBody = await response.text();
console.log(`${response.status} ${responseBody}`);
if (!response.ok) process.exitCode = 1;
