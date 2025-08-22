const express = require('express');
const bodyParser = require('body-parser');
const { Client, GatewayIntentBits } = require('discord.js');
const cors = require('cors');
const WebSocket = require('ws');
const fetch = require('node-fetch');
const fs = require('fs');

const app = express();
const port = 3000;
const wsPort = 3001;
const discordToken = 'YOUR_DISCORD_BOT_TOKEN'; 


const logStream = fs.createWriteStream('server.log', { flags: 'a' });
console.log = function (...args) {
  logStream.write(`[${new Date().toISOString()}] ${args.join(' ')}\n`);
  process.stdout.write(`[${new Date().toISOString()}] ${args.join(' ')}\n`);
};
console.error = console.log;
console.warn = console.log;

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' })); 


const wss = new WebSocket.Server({ port: wsPort });


let clients = [];


let lastMessageIds = {};


function broadcastMessage(message) {
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}


wss.on('connection', (ws) => {
  console.log('Новый клиент подключен');
  clients.push(ws);

  ws.on('close', () => {
    clients = clients.filter(client => client !== ws);
    console.log('Клиент отключен');
  });

  ws.on('error', (err) => {
    console.error('WebSocket ошибка:', err);
  });
});


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

client.once('ready', () => {
  console.log(`Discord бот запущен как ${client.user.tag}`);
});

client.on('error', (err) => {
  console.error('Discord бот ошибка:', err);
});

client.on('warn', (warn) => {
  console.warn('Discord бот предупреждение:', warn);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return; 

  if (message.content.startsWith('!')) {
    const cmd = message.content.slice(1).trim();
    const messageData = {
      userId: message.author.id,
      username: message.author.username,
      message: cmd,
      channelId: message.channel.id,
      messageId: message.id
    };
    console.log(`Получена команда от ${message.author.username} в канале ${message.channel.id}: ${cmd}`);
    broadcastMessage(messageData); 
  }
});


async function fetchWithRetry(url, options, retries = 5, backoff = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { ...options, timeout: 15000 }); 
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      console.error(`Попытка ${i + 1} не удалась: ${err.message}`);
      if (i < retries - 1 && err.code !== 'UND_ERR_CONNECT_TIMEOUT') {
        console.warn(`Повтор через ${backoff} мс...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        backoff *= 2; 
      } else {
        throw err;
      }
    }
  }
}


function isValidBase64(str) {
  try {
    
    const base64Str = str.replace(/^data:image\/[a-z]+;base64,/, '');
    Buffer.from(base64Str, 'base64').toString('base64');
    return true;
  } catch (err) {
    return false;
  }
}


app.get('/channels/:guildId', async (req, res) => {
  const guildId = req.params.guildId;
  try {
    const guild = await client.guilds.fetch(guildId);
    const channels = guild.channels.cache
      .filter(channel => channel.type === 0) 
      .map(channel => ({
        id: channel.id,
        name: channel.name
      }));
    res.json({ channels });
  } catch (err) {
    console.error('Ошибка получения каналов:', err);
    res.status(500).json({ error: 'Failed to fetch channels', details: err.message });
  }
});


app.post('/send-message', async (req, res) => {
  const { channelId, message } = req.body;
  if (!channelId || !message) {
    return res.status(400).json({ error: 'channelId and message required' });
  }

  try {
    const channel = await client.channels.fetch(channelId);
    if (channel.type !== 0) {
      return res.status(400).json({ error: 'Invalid channel type' });
    }
    const sentMessage = await channel.send(message);
    lastMessageIds[channelId] = sentMessage.id; 
    res.json({ message: 'Message sent successfully', messageId: sentMessage.id });
  } catch (err) {
    console.error('Ошибка отправки сообщения:', err);
    res.status(500).json({ error: 'Failed to send message', details: err.message });
  }
});


app.patch('/edit-message', async (req, res) => {
  const { channelId, messageId, newContent } = req.body;
  if (!channelId || !messageId || !newContent) {
    return res.status(400).json({ error: 'channelId, messageId, and newContent required' });
  }

  try {
    const channel = await client.channels.fetch(channelId);
    if (channel.type !== 0) {
      return res.status(400).json({ error: 'Invalid channel type' });
    }
    const message = await channel.messages.fetch(messageId);
    if (message.author.id !== client.user.id) {
      return res.status(403).json({ error: 'Can only edit bot messages' });
    }
    await message.edit(newContent);
    res.json({ message: 'Message edited successfully' });
  } catch (err) {
    console.error('Ошибка редактирования сообщения:', err);
    res.status(500).json({ error: 'Failed to edit message', details: err.message });
  }
});


app.post('/send-image', async (req, res) => {
  const { channelId, base64Image } = req.body;
  if (!channelId || !base64Image) {
    return res.status(400).json({ error: 'channelId and base64Image required' });
  }

  try {
    
    const base64Str = base64Image.replace(/^data:image\/[a-z]+;base64,/, '');
    if (!isValidBase64(base64Str)) {
      return res.status(400).json({ error: 'Invalid base64 string' });
    }
    const buffer = Buffer.from(base64Str, 'base64');
    
    if (buffer.length > 8 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image size exceeds 8 MB limit' });
    }
    const channel = await client.channels.fetch(channelId);
    if (channel.type !== 0) {
      return res.status(400).json({ error: 'Invalid channel type' });
    }
    const sentMessage = await channel.send({
      files: [{ attachment: buffer, name: 'image.png' }]
    });
    lastMessageIds[channelId] = sentMessage.id; 
    res.json({ message: 'Image sent successfully', messageId: sentMessage.id });
  } catch (err) {
    console.error('Ошибка отправки изображения:', err);
    res.status(500).json({ error: 'Failed to send image', details: err.message });
  }
});

// Запуск HTTP-сервера
app.listen(port, () => {
  console.log(`HTTP-сервер запущен на http://localhost:${port}`);
  console.log(`WebSocket-сервер запущен на ws://localhost:${wsPort}`);
});

// Запуск Discord бота
client.login(discordToken).catch(err => {
  console.error('Ошибка входа бота:', err);
});

// Инструкции по запуску:


// 3. Заменить 'YOUR_DISCORD_BOT_TOKEN' на реальный токен бота (https://discord.com/developers/applications)
// 4. Включи Message Content Intent в настройках бота
// 5. node server.js
// Бот слушает сообщения "!текст" в текстовых каналах сервера.
// Construct 2 получает сообщения через WebSocket (ws://localhost:3001).
// Отправка сообщений: HTTP POST /send-message
// Редактирование сообщений: HTTP PATCH /edit-message
// Отправка изображений: HTTP POST /send-image
// Список каналов: HTTP GET /channels/<guildId>
// Логи сохраняются в server.log