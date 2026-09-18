/**
 * WhatsApp Bot for AI Character Prompts
 * Features:
 * - Character search and retrieval
 * - /batch command for bulk character requests
 * - /products command for product listings
 * - /workflow command for workflow guidance
 * - Premium/free tier support
 * - Daily prompt limits for free users
 * - Stripe payment integration
 */

import { Client, LocalAuth } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';

// Environment variables
const HUB_URL = process.env.HUB_URL || 'http://localhost:3000';
const STRIPE_PAYMENT_LINK = process.env.STRIPE_PAYMENT_LINK || 'https://buy.stripe.com/test';

// Create WhatsApp client
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }
});

// Display QR code in terminal
client.on('qr', (qr) => {
  console.log('QR Code received. Scan it with WhatsApp:');
  qrcode.generate(qr, { small: true });
});

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

// Client ready
client.on('ready', () => {
  console.log('WhatsApp bot is ready!');
});

// Handle messages
client.on('message', async (message) => {
  const chatId = message.from;
  const userId = message.from;
  const body = message.body.trim().toLowerCase();

  // Initialize user
  if (!userUsage.has(userId)) {
    userUsage.set(userId, {
      tier: SUBSCRIPTION_TIER.FREE,
      promptsToday: 0,
      lastReset: new Date().toDateString()
    });
  }

  // Command: /start
  if (body === '/start' || body === 'start') {
    const welcomeMessage = `
🎭 Welcome to AI Character Prompts!

Get creative AI character prompts for your stories, games, and creative projects.

📖 Available Commands:
/search <name> - Search for a character
/random - Get a random character
/batch <count> - Get multiple character prompts
/products - View available products
/workflow - Get workflow guidance
/status - Check your usage and subscription
/upgrade - Upgrade to premium
/help - Show this help message

✨ Free tier: 5 prompts per day
🔥 Premium: Unlimited access

Type /help to get started!
    `;
    await message.reply(welcomeMessage);
    return;
  }

  // Command: /help
  if (body === '/help' || body === 'help') {
    const helpMessage = `
📚 Help - AI Character Prompts

🔍 Search Commands:
/search <name> - Search for a specific character
  Example: /search Mary Magnumbytes
/random - Get a random character
/batch <count> - Get multiple random characters (1-10)
  Example: /batch 5

📦 Product Commands:
/products - View available products and pricing
/workflow - Get workflow guidance for using prompts

📊 Account Commands:
/status - Check your daily usage and subscription tier
/upgrade - Upgrade to premium for unlimited access

💰 Premium Benefits:
✅ Unlimited character prompts
✅ Batch requests (up to 10 at once)
✅ Advanced search filters
✅ Priority support
✅ Early access to new characters

🔗 Payment: ${STRIPE_PAYMENT_LINK}

Need help? Contact support or visit our web app.
    `;
    await message.reply(helpMessage);
    return;
  }

  // Command: /search
  if (body.startsWith('/search ') || body.startsWith('search ')) {
    const searchTerm = body.replace(/^\/?search\s+/, '').trim();

    if (!searchTerm) {
      await message.reply('Please provide a character name.\nExample: /search Mary Magnumbytes');
      return;
    }

    // Check usage limit
    if (!canGetPrompt(userId)) {
      await message.reply(`⚠️ Daily limit reached!\n\nFree tier: ${MAX_FREE_PROMPTS_PER_DAY} prompts per day\n\nUpgrade to premium for unlimited access:\n${STRIPE_PAYMENT_LINK}`);
      return;
    }

    await message.reply('🔍 Searching...');

    const character = await fetchCharacter(searchTerm);

    if (!character) {
      await message.reply(`❌ Character "${searchTerm}" not found.\n\nUse /list to see all available characters.`);
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
    await message.reply(characterMessage);
    return;
  }

  // Command: /random
  if (body === '/random' || body === 'random') {
    // Check usage limit
    if (!canGetPrompt(userId)) {
      await message.reply(`⚠️ Daily limit reached!\n\nFree tier: ${MAX_FREE_PROMPTS_PER_DAY} prompts per day\n\nUpgrade to premium for unlimited access:\n${STRIPE_PAYMENT_LINK}`);
      return;
    }

    await message.reply('🎲 Finding a random character...');

    const randomCharacter = await fetchRandomCharacter();

    if (!randomCharacter) {
      await message.reply('No characters available yet.');
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
    await message.reply(characterMessage);
    return;
  }

  // Command: /batch
  if (body.startsWith('/batch ') || body.startsWith('batch ')) {
    const countStr = body.replace(/^\/?batch\s+/, '').trim();
    const count = parseInt(countStr, 10);

    if (isNaN(count) || count < 1 || count > 10) {
      await message.reply('Please provide a valid number between 1 and 10.\nExample: /batch 5');
      return;
    }

    // Premium only for batch
    if (!isPremium(userId)) {
      await message.reply(`⚠️ Batch requests are a premium feature!\n\nFree tier: Single character search only\n\nUpgrade to premium:\n${STRIPE_PAYMENT_LINK}`);
      return;
    }

    await message.reply(`📦 Fetching ${count} random characters...`);

    const characters = await fetchAllCharacters();

    if (characters.length === 0) {
      await message.reply('No characters available yet.');
      return;
    }

    // Shuffle and pick random characters
    const shuffled = [...characters].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);

    let batchMessage = `📦 Batch of ${count} Characters:\n\n`;

    selected.forEach((char, idx) => {
      batchMessage += `${idx + 1}. ${char.name}\n`;
      batchMessage += `   ${char.rarity ? `⭐ ${char.rarity}` : ''}\n`;
      batchMessage += `   ${char.description?.substring(0, 100) || 'No description'}...\n\n`;
    });

    await message.reply(batchMessage);
    return;
  }

  // Command: /products
  if (body === '/products' || body === 'products') {
    const productsMessage = `
📦 Available Products

1. Single Character Prompt - $2.99
   Perfect for testing out our prompts

2. 10 Character Pack - $19.99
   Great for small projects

3. All 45 Characters - $49.99
   Complete character database

4. Premium Subscription - $9.99/month
   Unlimited access to all features:
   ✅ Unlimited character prompts
   ✅ Batch requests (up to 10 at once)
   ✅ Advanced search filters
   ✅ Priority support
   ✅ Early access to new characters

5. Starter Kit - $29.99
   Complete package including:
   ✅ All character prompts
   ✅ Marketing templates
   ✅ Workflow guides
   ✅ Launch checklist

🔗 Purchase: ${STRIPE_PAYMENT_LINK}

Type /upgrade to subscribe to premium.
    `;
    await message.reply(productsMessage);
    return;
  }

  // Command: /workflow
  if (body === '/workflow' || body === 'workflow') {
    const workflowMessage = `
📋 Workflow Guidance

Getting Started with AI Character Prompts:

1️⃣ CHARACTER SELECTION
   - Use /search to find specific characters
   - Use /batch (premium) to get multiple options
   - Review descriptions and archetypes

2️⃣ PROMPT INTEGRATION
   - Copy the hook prompt for your AI tool
   - Use the backstory for context
   - Apply attributes to shape responses

3️⃣ CUSTOMIZATION
   - Modify prompts to fit your needs
   - Combine multiple characters
   - Adjust tone and style

4️⃣ CONTENT CREATION
   - Generate stories, dialogues, or scenarios
   - Use character attributes consistently
   - Maintain archetype integrity

5️⃣ ITERATION
   - Refine prompts based on output
   - Track what works best
   - Build your prompt library

💡 Tips:
- Start with legendary characters for rich backstories
- Use archetypes to guide character behavior
- Combine hook prompts with backstory for depth

Need more help? Visit our web app or contact support.
    `;
    await message.reply(workflowMessage);
    return;
  }

  // Command: /status
  if (body === '/status' || body === 'status') {
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

${userData.tier === SUBSCRIPTION_TIER.FREE ? '\n🔗 Upgrade for unlimited access:\n' + STRIPE_PAYMENT_LINK : '\n✅ Enjoy unlimited access!'}
    `;
    await message.reply(statusMessage);
    return;
  }

  // Command: /upgrade
  if (body === '/upgrade' || body === 'upgrade') {
    const upgradeMessage = `
🔥 Upgrade to Premium

Benefits:
✅ Unlimited character prompts
✅ Batch requests (up to 10 at once)
✅ Advanced search filters
✅ Priority support
✅ Early access to new characters

💰 Price: $9.99/month

🔗 Upgrade: ${STRIPE_PAYMENT_LINK}
    `;
    await message.reply(upgradeMessage);
    return;
  }
});

// Handle errors
client.on('error', (error) => {
  console.error('WhatsApp bot error:', error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Stopping WhatsApp bot...');
  client.destroy();
  process.exit(0);
});

// Start client
console.log('Starting WhatsApp bot...');
client.initialize();
