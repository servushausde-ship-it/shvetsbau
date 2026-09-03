const https = require('https');
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '.env');

function loadEnv(filePath = ENV_PATH) {
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

function updateEnvChatId(chatId) {
  let content = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf-8') : '';
  const line = `TELEGRAM_CHAT_ID=${chatId}`;
  if (/^TELEGRAM_CHAT_ID\s*=\s*/m.test(content)) {
    content = content.replace(/^TELEGRAM_CHAT_ID\s*=.*$/m, line);
  } else {
    content += `\n${line}\n`;
  }
  fs.writeFileSync(ENV_PATH, content);
  process.env.TELEGRAM_CHAT_ID = String(chatId);
  console.log(`\nUpdated .env with TELEGRAM_CHAT_ID=${chatId}`);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN not set in .env');
  process.exit(1);
}

function apiCall(method, params = {}) {
  return new Promise((resolve, reject) => {
    const q = new URLSearchParams(params).toString();
    const url = `https://api.telegram.org/bot${token}/${method}${q ? '?' + q : ''}`;
    https
      .get(url, (res) => {
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
    console.error('Telegram API error:', me.description);
    process.exit(1);
  }
  console.log(`Bot OK: @${me.result.username}\n`);

  const updates = await apiCall('getUpdates', {
    limit: 100,
    allowed_updates: JSON.stringify([
      'message',
      'my_chat_member',
      'chat_member',
      'channel_post',
    ]),
  });

  if (!updates.ok) {
    console.error('Telegram API error:', updates.description);
    process.exit(1);
  }

  if (!updates.result || updates.result.length === 0) {
    console.log(
      'No updates found. Add the bot to the desired group, send /start, then run this script again.'
    );
    return;
  }

  const chats = new Map();
  for (const u of updates.result) {
    const chat =
      u.message?.chat ||
      u.my_chat_member?.chat ||
      u.chat_member?.chat ||
      u.channel_post?.chat;
    const from = u.message?.from || u.my_chat_member?.from;
    if (chat && !chats.has(chat.id)) {
      chats.set(chat.id, { ...chat, from_username: from?.username });
    }
  }

  if (chats.size === 0) {
    console.log(
      'No chats found in updates. Add the bot to the desired group, send /start, then run this script again.'
    );
    return;
  }

  console.log('Found chats:');
  for (const [id, chat] of chats) {
    const label = chat.title || chat.username || 'Private chat';
    console.log(`- ${label} (id: ${id}, type: ${chat.type})`);
  }

  const groups = Array.from(chats.entries()).filter(([_, chat]) =>
    ['group', 'supergroup'].includes(chat.type)
  );

  if (groups.length === 1) {
    const [id, chat] = groups[0];
    console.log(`\nSingle group found: ${chat.title || chat.username} (id: ${id})`);
    updateEnvChatId(id);
    console.log('You can now run: node server.js');
  } else if (groups.length > 1) {
    console.log(
      '\nMultiple groups found. Choose the desired id and set TELEGRAM_CHAT_ID in .env, then run: node server.js'
    );
  } else if (chats.size === 1) {
    const [id, chat] = chats.entries().next().value;
    console.log(
      `\nOnly a private chat found: ${chat.title || chat.username} (id: ${id}). If this is the correct destination, set TELEGRAM_CHAT_ID=${id} in .env`
    );
  } else {
    console.log(
      '\nNo group found. Add the bot to a group, send /start, then run this script again.'
    );
  }
})();
