//node --env-file=../.env ./RegisterClient.js

// Script pour enregistrer N8N
import 'dotenv/config';
import { createHmac } from 'crypto';

const ACCESS_KEY = process.env.OAUTH_REGISTRATION_ACCESS_KEY;
const SECRET_KEY = process.env.OAUTH_REGISTRATION_SECRET_KEY;
const timestamp = Date.now();

// L'URL de callback de N8N (à adapter selon votre instance)
const body = {
  client_name: 'N8N Automation',
  redirect_uris: ['https://n8n.skynet.ovh/rest/oauth2-credential/callback']
};

const bodyString = JSON.stringify(body);
const message = `${ACCESS_KEY}${timestamp}${bodyString}`;
const signature = createHmac('sha256', SECRET_KEY)
  .update(message)
  .digest('hex');

const response = await fetch('http://localhost:3000/oauth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Access-Key': ACCESS_KEY,
    'X-Timestamp': timestamp.toString(),
    'X-Signature': signature,
  },
  body: bodyString,
});

const result = await response.json();
console.log('Client ID:', result.client_id);
console.log('Client Secret:', result.client_secret);