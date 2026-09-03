const querystring = require('querystring');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildMessage(fields) {
  const lines = [
    '<b>Neue Projektanfrage</b>',
    '',
    `Name: ${escapeHtml(fields.Name || '-')}`,
    `Telefon: ${escapeHtml(fields.Telefon || '-')}`,
    `E-Mail: ${escapeHtml(fields['E-Mail'] || '-')}`,
    `PLZ / Ort: ${escapeHtml(fields['PLZ Ort'] || '-')}`,
    `Leistung: ${escapeHtml(fields['Was planen Sie'] || '-')}`,
    `Projektstart: ${escapeHtml(fields.Projektstart || '-')}`,
    `Nachricht: ${escapeHtml(fields.Nachricht || '-')}`,
  ];
  return lines.join('\n');
}

function sendJson(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    sendJson(res, 500, { ok: false, error: 'Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID' });
    return;
  }

  let body = '';
  req.on('data', (chunk) => (body += chunk));
  await new Promise((resolve, reject) => {
    req.on('end', resolve);
    req.on('error', reject);
  });

  const fields = querystring.parse(body);
  const text = buildMessage(fields);

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    const tgData = await tgRes.json();
    if (!tgData.ok) throw new Error(tgData.description || 'Telegram error');
    sendJson(res, 200, { ok: true });
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { ok: false, error: err.message });
  }
};
