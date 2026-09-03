const https = require('https');
const fs = require('fs');
const path = require('path');

function loadEnv(filePath = path.join(__dirname, '.env')) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  content.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) {
      let value = m[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[m[1]] = value;
    }
  });
}
loadEnv();

const token = process.env.TELEGRAM_BOT_TOKEN;
const url = process.argv[2] || 'https://shvetsbau.vercel.app/api/telegram';

if (!token) {
  console.error('TELEGRAM_BOT_TOKEN not set in .env');
  process.exit(1);
}

function apiCall(method, params = {}) {
  return new Promise((resolve, reject) => {
    const q = new URLSearchParams(params).toString();
    const apiUrl = `https://api.telegram.org/bot${token}/${method}${q ? '?' + q : ''}`;
    https
      .get(apiUrl, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
}

(async () => {
  const me = await apiCall('getMe');
  if (!me.ok) {
    console.error('Token error:', me.description);
    process.exit(1);
  }
  console.log(`Bot: @${me.result.username}`);
  console.log(`Setting webhook to: ${url}`);

  const result = await apiCall('setWebhook', { url });
  if (result.ok) {
    console.log('Webhook set successfully.');
  } else {
    console.error('Failed to set webhook:', result.description);
    process.exit(1);
  }
})();
