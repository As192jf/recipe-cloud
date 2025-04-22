// Konfiguration über Environment Variables in Cloudflare
const BOT_TOKEN = YOUR_BOT_TOKEN; // In Cloudflare Workers als Secret setzen
const AUTHORIZED_USERS = YOUR_AUTHORIZED_USERS.split(",").map(Number); // z.B. "123456789,987654321"

// Handler für Telegram Updates
async function handleTelegramUpdate(update) {
  // Inline Query verarbeiten
  if (update.inline_query) {
    const query = update.inline_query;
    const user = query.from;
    const userId = user.id;
    const username = user.username || user.first_name;
    const queryText = query.query.trim();

    // Prüfe Autorisisierung
    if (!AUTHORIZED_USERS.includes(userId)) {
      console.log(`Unauthorized user: ${username} (${userId})`);
      return new Response('Unauthorized', { status: 401 });
    }

    // Prüfe ob URL
    if (!queryText.startsWith('http')) {
      console.log(`Invalid query from ${username}: ${queryText}`);
      return new Response('Invalid query', { status: 400 });
    }

    // Bring URL erstellen
    const encodedUrl = encodeURIComponent(queryText);
    const bringUrl = `https://api.getbring.com/rest/bringrecipes/deeplink?url=${encodedUrl}&source=telegram&baseQuantity=4&requestedQuantity=4`;

    // Inline Query Antwort vorbereiten
    const answerPayload = {
      inline_query_id: query.id,
      results: [{
        type: 'article',
        id: crypto.randomUUID(),
        title: 'Rezept übertragen',
        input_message_content: {
          message_text: `<a href="${bringUrl}">Rezept übertragen.</a>`,
          parse_mode: 'HTML'
        },
        description: 'Klickbarer Bring!-Link'
      }],
      cache_time: 0
    };

    // Antwort an Telegram senden
    return await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerInlineQuery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(answerPayload)
    });
  }

  // Start Command verarbeiten
  if (update.message && update.message.text === '/start') {
    const chatId = update.message.chat.id;
    const messagePayload = {
      chat_id: chatId,
      text: "Bot läuft und ist bereit für Inline-Anfragen!"
    };

    return await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload)
    });
  }

  return new Response('OK', { status: 200 });
}

// Hauptfunktion des Workers
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  // Ping Route
  if (request.url.endsWith('/ping')) {
    return new Response('pong', {
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  // Webhook Route
  if (request.method === 'POST') {
    try {
      const update = await request.json();
      return await handleTelegramUpdate(update);
    } catch (error) {
      console.error('Error processing update:', error);
      return new Response('Error', { status: 500 });
    }
  }

  return new Response('Method not allowed', { status: 405 });
}
