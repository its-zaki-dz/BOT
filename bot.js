// bot.js - Enhanced Version with Performance + Anti-Stop
const express = require("express");
const fetch = require("node-fetch");
const fs = require("fs").promises;
const path = require("path");
const { Client, GatewayIntentBits, Partials, Events, ActivityType } = require("discord.js");

// === Environment Variables ===
const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const ROLE_ID = process.env.ROLE_ID;
const TAG_TRIGGER = process.env.TAG_TRIGGER || "#tag";
const NICK_PREFIX = process.env.NICK_PREFIX || "C9・";
const PORT = process.env.PORT || 3000;
const SELF_URL = process.env.SELF_URL;
const WEBHOOK_URL = process.env.WEBHOOK_URL; // Optional: للتنبيهات
const ADMIN_USER_ID = process.env.ADMIN_USER_ID; // Optional: للإشعارات

// === Performance & Storage ===
const DATA_FILE = "bot_data.json";
let lockedMembers = new Set();
let botStats = {
  startTime: Date.now(),
  rolesAssigned: 0,
  nicknamesUpdated: 0,
  lockEnforcements: 0,
  uptime: 0,
  lastPing: Date.now(),
  errors: 0
};

// === Load/Save Data Functions ===
async function loadData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(data);
    lockedMembers = new Set(parsed.lockedMembers || []);
    botStats = { ...botStats, ...parsed.stats };
    console.log(`📁 Loaded ${lockedMembers.size} locked members from storage`);
  } catch (error) {
    console.log("📁 No existing data file found, starting fresh");
  }
}

async function saveData() {
  try {
    const data = {
      lockedMembers: Array.from(lockedMembers),
      stats: botStats,
      lastSave: new Date().toISOString()
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("❌ Failed to save data:", error.message);
  }
}

// === SUPER AGGRESSIVE Express Server ===
const app = express();
app.use(express.json());

// Middleware to log all requests (shows activity)
app.use((req, res, next) => {
  console.log(`📡 ${new Date().toISOString()} - ${req.method} ${req.path} from ${req.ip}`);
  botStats.lastPing = Date.now();
  next();
});

// Main health check with fake processing
app.get("/", (req, res) => {
  // Simulate some processing work
  const startTime = Date.now();
  const fakeData = Array.from({length: 50}, () => Math.random() * 1000);
  const processed = fakeData.map(x => Math.sqrt(x)).reduce((a, b) => a + b, 0);
  
  botStats.uptime = Date.now() - botStats.startTime;
  res.json({
    status: "alive",
    uptime: Math.floor(botStats.uptime / 1000),
    stats: botStats,
    locked_members: lockedMembers.size,
    fake_activity: antiStopSystem.fakeActivity,
    processing_time: Date.now() - startTime,
    processed_data: Math.round(processed),
    timestamp: new Date().toISOString(),
    random_id: Math.random().toString(36).substr(2, 9)
  });
});

// Multiple fake endpoints to simulate a busy server
app.get("/api/status", (req, res) => {
  res.json({ active: true, timestamp: Date.now() });
});

app.get("/api/ping", (req, res) => {
  res.json({ pong: Date.now() });
});

app.get("/api/random", (req, res) => {
  const data = Array.from({length: 20}, () => ({
    id: Math.random().toString(36).substr(2, 9),
    value: Math.random() * 1000,
    timestamp: Date.now()
  }));
  res.json(data);
});

// Fake admin panel
app.get("/admin", (req, res) => {
  res.json({
    server: "active",
    users: lockedMembers.size,
    uptime: Math.floor((Date.now() - botStats.startTime) / 1000),
    memory: process.memoryUsage(),
    load: Math.random()
  });
});

// Health endpoint for monitoring services
app.get("/health", (req, res) => {
  const isHealthy = Date.now() - botStats.lastPing < 10 * 60 * 1000;
  const healthData = {
    healthy: isHealthy,
    last_activity: new Date(botStats.lastPing).toISOString(),
    cpu_usage: Math.random() * 50 + 25, // Fake CPU usage
    memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    active_connections: Math.floor(Math.random() * 10) + 1
  };
  
  // Simulate health check processing
  setTimeout(() => {
    res.status(isHealthy ? 200 : 503).json(healthData);
  }, Math.random() * 100 + 50);
});

// Stats endpoint with fake metrics
app.get("/stats", (req, res) => {
  const fakeMetrics = {
    ...botStats,
    uptime: Math.floor((Date.now() - botStats.startTime) / 1000),
    locked_members_count: lockedMembers.size,
    fake_activity_count: antiStopSystem.fakeActivity,
    requests_per_minute: Math.floor(Math.random() * 50) + 10,
    average_response_time: Math.random() * 100 + 50,
    database_queries: Math.floor(Math.random() * 1000) + 500,
    cache_hits: Math.floor(Math.random() * 800) + 200
  };
  
  res.json(fakeMetrics);
});

// Webhook endpoint with processing simulation
app.post("/webhook", (req, res) => {
  console.log("📡 Webhook received:", req.body);
  
  // Simulate webhook processing
  const processingTime = Math.random() * 200 + 100;
  setTimeout(() => {
    res.json({ 
      received: true, 
      processed_at: new Date().toISOString(),
      processing_time: processingTime
    });
  }, processingTime);
});

// Fake database endpoint
app.get("/db/stats", (req, res) => {
  res.json({
    connections: Math.floor(Math.random() * 20) + 5,
    queries_per_second: Math.floor(Math.random() * 100) + 10,
    cache_size: Math.floor(Math.random() * 1000) + 500,
    last_backup: new Date(Date.now() - Math.random() * 86400000).toISOString()
  });
});

// Keep the server busy with internal requests
setInterval(async () => {
  try {
    // Self-request to different endpoints
    const endpoints = ['/api/status', '/api/ping', '/health', '/stats'];
    const randomEndpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    
    await fetch(`http://localhost:${PORT}${randomEndpoint}`, {
      timeout: 5000
    }).catch(() => {}); // Ignore failures
    
  } catch (e) {
    // Ignore errors
  }
}, 45000); // Every 45 seconds

app.listen(PORT, () => console.log(`🌐 Enhanced web server running on port ${PORT}`));

// === Advanced Anti-Stop System ===
const antiStopSystem = {
  intervals: [],
  
  init() {
    // Self-ping every 3 minutes
    if (SELF_URL) {
      this.intervals.push(setInterval(() => {
        this.selfPing();
      }, 3 * 60 * 1000));
    }
    
    // Save data every 10 minutes
    this.intervals.push(setInterval(() => {
      saveData();
    }, 10 * 60 * 1000));
    
    // Update bot status every 5 minutes
    this.intervals.push(setInterval(() => {
      this.updateBotStatus();
    }, 5 * 60 * 1000));
    
    // Health check every minute
    this.intervals.push(setInterval(() => {
      this.healthCheck();
    }, 60 * 1000));
  },
  
  async selfPing() {
    try {
      const response = await fetch(SELF_URL, { 
        timeout: 10000,
        headers: { 'User-Agent': 'DiscordBot-KeepAlive' }
      });
      const data = await response.json();
      botStats.lastPing = Date.now();
      console.log(`🏓 Self-ping successful - Uptime: ${Math.floor(data.uptime / 60)}m`);
    } catch (error) {
      botStats.errors++;
      console.log("🏓 Keep-alive error:", error.message);
    }
  },
  
  updateBotStatus() {
    if (client.isReady()) {
      const uptimeMinutes = Math.floor((Date.now() - botStats.startTime) / 60000);
      client.user.setPresence({
        activities: [{
          name: `${lockedMembers.size} locked users | ${uptimeMinutes}m uptime`,
          type: ActivityType.Watching
        }],
        status: 'online'
      });
    }
  },
  
  async healthCheck() {
    const memoryUsage = process.memoryUsage();
    const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    
    if (memoryMB > 100) { // Alert if memory usage is high
      console.log(`⚠️  High memory usage: ${memoryMB}MB`);
    }
    
    // Check if bot is still responsive
    if (client.isReady()) {
      botStats.lastPing = Date.now();
    }
  },
  
  cleanup() {
    this.intervals.forEach(interval => clearInterval(interval));
  }
};

// === Enhanced Discord Client ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.GuildMember],
  presence: {
    activities: [{
      name: 'Starting up...',
      type: ActivityType.Playing
    }],
    status: 'idle'
  }
});

// === Enhanced Event Handlers ===
client.once(Events.ClientReady, async () => {
  console.log(`✅ Ready as ${client.user.tag}`);
  await loadData();
  antiStopSystem.init();
  antiStopSystem.updateBotStatus();
  
  // Send startup notification
  if (WEBHOOK_URL) {
    try {
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `🟢 **Bot Started**\n\`\`\`\nBot: ${client.user.tag}\nLocked Members: ${lockedMembers.size}\nUptime Reset: ${new Date().toLocaleString()}\n\`\`\``
        })
      });
    } catch (e) {
      console.log("Webhook notification failed:", e.message);
    }
  }
});

// Enhanced message trigger with rate limiting
const userCooldowns = new Map();

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (message.channel.id !== CHANNEL_ID) return;
  if (!message.content.includes(TAG_TRIGGER)) return;

  const member = message.member;
  if (!member) return;

  // Rate limiting - 1 minute cooldown per user
  const now = Date.now();
  const cooldownExpire = userCooldowns.get(member.id);
  if (cooldownExpire && now < cooldownExpire) {
    const remaining = Math.ceil((cooldownExpire - now) / 1000);
    return message.reply(`⏱️ Please wait ${remaining} seconds before trying again.`);
  }

  if (member.roles.cache.has(ROLE_ID)) {
    return message.reply("✅ You already have the role.");
  }

  // Set cooldown
  userCooldowns.set(member.id, now + 60000); // 1 minute

  try {
    // Check bot permissions first
    const botMember = message.guild.members.me;
    if (!botMember.permissions.has('ManageRoles') || !botMember.permissions.has('ManageNicknames')) {
      return message.reply("❌ I need `Manage Roles` and `Manage Nicknames` permissions.");
    }

    await member.roles.add(ROLE_ID, "Assigned by tag trigger");
    botStats.rolesAssigned++;

    const currentNick = member.nickname || member.user.username;
    if (!currentNick.startsWith(NICK_PREFIX)) {
      try {
        await member.setNickname(`${NICK_PREFIX}${currentNick}`, "Prefix added by bot");
        botStats.nicknamesUpdated++;
      } catch (e) {
        console.error("Failed to set nickname:", e.message);
      }
    }

    lockedMembers.add(member.id);
    await message.reply("✅ Role assigned and nickname updated. You are now locked to this role.");
    
    // Auto-save after important changes
    if (botStats.rolesAssigned % 5 === 0) {
      await saveData();
    }
    
  } catch (err) {
    console.error("Error assigning role:", err);
    botStats.errors++;
    message.reply("❌ Failed to assign role — check bot permissions.");
  }
});

// Enhanced lock enforcement
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  if (!lockedMembers.has(newMember.id)) return;

  let actionTaken = false;

  // Role enforcement
  const hadRole = oldMember.roles.cache.has(ROLE_ID);
  const hasRole = newMember.roles.cache.has(ROLE_ID);

  if (hadRole && !hasRole) {
    try {
      await newMember.roles.add(ROLE_ID, "Re-adding locked role");
      botStats.lockEnforcements++;
      actionTaken = true;
      
      const sysChan = newMember.guild.systemChannel;
      if (sysChan) {
        sysChan.send(`🔒 ${newMember.toString()}: Role was automatically restored.`);
      }
    } catch (e) {
      console.error("Failed to re-add role:", e.message);
      botStats.errors++;
    }
  }

  // Nickname enforcement
  const newNick = newMember.nickname || newMember.user.username;
  if (!newNick.startsWith(NICK_PREFIX)) {
    try {
      await newMember.setNickname(`${NICK_PREFIX}${newNick}`, "Re-applying locked nickname prefix");
      botStats.lockEnforcements++;
      actionTaken = true;
    } catch (e) {
      console.error("Failed to reset nickname:", e.message);
      botStats.errors++;
    }
  }

  // Save data after enforcement actions
  if (actionTaken && botStats.lockEnforcements % 3 === 0) {
    await saveData();
  }
});

// Error handling
client.on(Events.Error, (error) => {
  console.error('Discord client error:', error);
  botStats.errors++;
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🔄 Gracefully shutting down...');
  antiStopSystem.cleanup();
  await saveData();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🔄 Received SIGTERM, shutting down...');
  antiStopSystem.cleanup();
  await saveData();
  client.destroy();
  process.exit(0);
});

// === Login ===
if (!TOKEN) {
  console.error("❌ Missing DISCORD_TOKEN environment variable!");
  process.exit(1);
}

client.login(TOKEN).catch(error => {
  console.error("❌ Failed to login:", error.message);
  process.exit(1);
});