/**
 * Telegram Bot for AI Character Prompts
 * Features:
 * - Character search and retrieval
 * - Premium/free tier support
 * - Daily prompt limits for free users
 * - Stripe payment integration
 */

import TelegramBot from 'node-telegram-bot-api';

// Environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const HUB_URL = process.env.HUB_URL || 'http://localhost:3000';
const STRIPE_PAYMENT_LINK = process.env.STRIPE_PAYMENT_LINK || 'https://buy.stripe.com/test';

if (!TELEGRAM_BOT_TOKEN) {
  console.error('TELEGRAM_BOT_TOKEN environment variable is required');
  process.exit(1);
}

// Create bot instance
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// In-memory user tracking (in production, use database)
const userUsage = new Map();
const SUBSCRIPTION_TIER = {
  FREE: 'free',
  PREMIUM: 'premium'
};

const MAX_FREE_PROMPTS_PER_DAY = 5;

// Helper: Check if user is premium
function isPremium(userId) {
  const userData = userUsage.get(userId);
  return userData?.tier === SUBSCRIPTION_TIER.PREMIUM;
}

// Helper: Check daily limit for free users
function canGetPrompt(userId) {
  if (isPremium(userId)) return true;

  const userData = userUsage.get(userId) || {
    tier: SUBSCRIPTION_TIER.FREE,
    promptsToday: 0,
    lastReset: new Date().toDateString()
  };

  // Reset counter if new day
  if (userData.lastReset !== new Date().toDateString()) {
    userData.promptsToday = 0;
    userData.lastReset = new Date().toDateString();
  }

  return userData.promptsToday < MAX_FREE_PROMPTS_PER_DAY;
}

// Helper: Increment prompt usage
function incrementUsage(userId) {
  if (isPremium(userId)) return;

  const userData = userUsage.get(userId) || {
    tier: SUBSCRIPTION_TIER.FREE,
    promptsToday: 0,
    lastReset: new Date().toDateString()
  };

  if (userData.lastReset !== new Date().toDateString()) {
    userData.promptsToday = 0;
    userData.lastReset = new Date().toDateString();
  }

  userData.promptsToday++;
  userUsage.set(userId, userData);
}

// Helper: Fetch character from API
async function fetchCharacter(name) {
  try {
    const response = await fetch(`${HUB_URL}/api/characters/search/${encodeURIComponent(name)}`);
    if (!response.ok) throw new Error('Character not found');
    const data = await response.json();
    return data.success ? data.data[0] : null;
  } catch (error) {
    console.error('Error fetching character:', error);
    return null;
  }
}

// Helper: Fetch all characters
async function fetchAllCharacters() {
  try {
    const response = await fetch(`${HUB_URL}/api/characters`);
    if (!response.ok) throw new Error('Failed to fetch characters');
    const data = await response.json();
    return data.success ? data.data : [];
  } catch (error) {
    console.error('Error fetching characters:', error);
    return [];
  }
}

// Helper: Fetch random character
async function fetchRandomCharacter() {
  try {
    const response = await fetch(`${HUB_URL}/api/characters/random`);
    if (!response.ok) throw new Error('Failed to fetch random character');
    const data = await response.json();
    return data.success ? data.data : null;
  } catch (error) {
    console.error('Error fetching random character:', error);
    return null;
  }
}

// Command: /start
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // Initialize user
  if (!userUsage.has(userId)) {
    userUsage.set(userId, {
      tier: SUBSCRIPTION_TIER.FREE,
      promptsToday: 0,
      lastReset: new Date().toDateString()
    });
  }

  const welcomeMessage = `
🎭 Welcome to AI Character Prompts!

Get creative AI character prompts for your stories, games, and creative projects.

📖 Available Commands:
/search <name> - Search for a character
/list - List all available characters
/random - Get a random character prompt
/status - Check your usage and subscription
/upgrade - Upgrade to premium for unlimited access
/help - Show this help message

✨ Free tier: 5 prompts per day
🔥 Premium: Unlimited access

Type /help to get started!
  `;

  await bot.sendMessage(chatId, welcomeMessage);
});

// Command: /help
bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;

  const helpMessage = `
📚 Help - AI Character Prompts

🔍 Search Commands:
/search <name> - Search for a specific character
  Example: /search Mary Magnumbytes

/list - Browse all available characters
/random - Get a random character prompt

📊 Account Commands:
/status - Check your daily usage and subscription tier
/upgrade - Upgrade to premium for unlimited access

💰 Premium Benefits:
✅ Unlimited character prompts
✅ Advanced search filters
✅ Priority support
✅ Early access to new characters

🔗 Payment: ${STRIPE_PAYMENT_LINK}

Need help? Contact support or visit our web app.
  `;

  await bot.sendMessage(chatId, helpMessage);
});

// Command: /search
bot.onText(/\/search(?:\s+(.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const searchTerm = match[1]?.trim();

  if (!searchTerm) {
    await bot.sendMessage(chatId, 'Please provide a character name.\nExample: /search Mary Magnumbytes');
    return;
  }

  // Check usage limit
  if (!canGetPrompt(userId)) {
    await bot.sendMessage(chatId, `⚠️ Daily limit reached!\n\nFree tier: ${MAX_FREE_PROMPTS_PER_DAY} prompts per day\n\nUpgrade to premium for unlimited access:`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔥 Upgrade to Premium', url: STRIPE_PAYMENT_LINK }]
        ]
      }
    });
    return;
  }

  await bot.sendMessage(chatId, '🔍 Searching...');

  const character = await fetchCharacter(searchTerm);

  if (!character) {
    await bot.sendMessage(chatId, `❌ Character "${searchTerm}" not found.\n\nUse /list to see all available characters.`);
    return;
  }

  incrementUsage(userId);

  const characterMessage = `
🎭 ${character.name}
${character.rarity ? `⭐ ${character.rarity}` : ''}

📝 Description:
${character.description || 'No description available'}

🎯 Archetype: ${character.archetype || 'N/A'}
🔧 Tool Category: ${character.keyToolCategory || 'N/A'}

💬 Hook Prompt:
${character.prompts?.hook || 'N/A'}

📖 Backstory:
${character.backstory?.substring(0, 200) || 'N/A'}${character.backstory?.length > 200 ? '...' : ''}
  `;

  await bot.sendMessage(chatId, characterMessage);
});

// Command: /list
bot.onText(/\/list/, async (msg) => {
  const chatId = msg.chat.id;

  await bot.sendMessage(chatId, '📜 Fetching character list...');

  const characters = await fetchAllCharacters();

  if (characters.length === 0) {
    await bot.sendMessage(chatId, 'No characters available yet.');
    return;
  }

  // Send in chunks if too many
  const chunkSize = 20;
  for (let i = 0; i < characters.length; i += chunkSize) {
    const chunk = characters.slice(i, i + chunkSize);
    const listMessage = chunk.map((c, idx) => `${i + idx + 1}. ${c.name}`).join('\n');
    await bot.sendMessage(chatId, `📜 Characters (${i + 1}-${Math.min(i + chunkSize, characters.length)}):\n\n${listMessage}`);
  }
});

// Command: /random
bot.onText(/\/random/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // Check usage limit
  if (!canGetPrompt(userId)) {
    await bot.sendMessage(chatId, `⚠️ Daily limit reached!\n\nFree tier: ${MAX_FREE_PROMPTS_PER_DAY} prompts per day\n\nUpgrade to premium for unlimited access:`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔥 Upgrade to Premium', url: STRIPE_PAYMENT_LINK }]
        ]
      }
    });
    return;
  }

  await bot.sendMessage(chatId, '🎲 Finding a random character...');

  const randomCharacter = await fetchRandomCharacter();

  if (!randomCharacter) {
    await bot.sendMessage(chatId, 'No characters available yet.');
    return;
  }

  incrementUsage(userId);

  const characterMessage = `
🎲 Random Character: ${randomCharacter.name}
${randomCharacter.rarity ? `⭐ ${randomCharacter.rarity}` : ''}

📝 Description:
${randomCharacter.description || 'No description available'}

🎯 Archetype: ${randomCharacter.archetype || 'N/A'}
🔧 Tool Category: ${randomCharacter.keyToolCategory || 'N/A'}

💬 Hook Prompt:
${randomCharacter.prompts?.hook || 'N/A'}
  `;

  await bot.sendMessage(chatId, characterMessage);
});

// Command: /status
bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const userData = userUsage.get(userId) || {
    tier: SUBSCRIPTION_TIER.FREE,
    promptsToday: 0,
    lastReset: new Date().toDateString()
  };

  // Reset counter if new day
  if (userData.lastReset !== new Date().toDateString()) {
    userData.promptsToday = 0;
    userData.lastReset = new Date().toDateString();
    userUsage.set(userId, userData);
  }

  const remainingPrompts = MAX_FREE_PROMPTS_PER_DAY - userData.promptsToday;

  const statusMessage = `
📊 Your Account Status

🎯 Tier: ${userData.tier === SUBSCRIPTION_TIER.PREMIUM ? '🔥 Premium' : '✨ Free'}

📈 Usage Today:
${userData.tier === SUBSCRIPTION_TIER.FREE ? `  ${userData.promptsToday} / ${MAX_FREE_PROMPTS_PER_DAY} prompts used` : '  Unlimited'}

${userData.tier === SUBSCRIPTION_TIER.FREE ? `  ${remainingPrompts} prompts remaining` : ''}

${userData.tier === SUBSCRIPTION_TIER.FREE ? '\n🔗 Upgrade for unlimited access:' : '\n✅ Enjoy unlimited access!'}
  `;

  if (userData.tier === SUBSCRIPTION_TIER.FREE) {
    await bot.sendMessage(chatId, statusMessage, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔥 Upgrade to Premium', url: STRIPE_PAYMENT_LINK }]
        ]
      }
    });
  } else {
    await bot.sendMessage(chatId, statusMessage);
  }
});

// Command: /upgrade
bot.onText(/\/upgrade/, async (msg) => {
  const chatId = msg.chat.id;

  const upgradeMessage = `
🔥 Upgrade to Premium

Benefits:
✅ Unlimited character prompts
✅ Advanced search filters
✅ Priority support
✅ Early access to new characters

💰 Price: $9.99/month

Click below to upgrade:
  `;

  await bot.sendMessage(chatId, upgradeMessage, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💳 Upgrade Now', url: STRIPE_PAYMENT_LINK }]
      ]
    }
  });
});

// Handle errors
bot.on('polling_error', (error) => {
  console.error('Telegram bot polling error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Stopping Telegram bot...');
  bot.stopPolling();
  process.exit(0);
});

console.log('Telegram bot started...');
