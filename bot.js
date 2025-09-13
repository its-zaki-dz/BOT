// Enhanced Discord Bot with Web Interface, Anti-Stop System, and #T Channel Creation
const express = require("express");
const fetch = require("node-fetch");
const fs = require("fs").promises;
const path = require("path");
const { Client, GatewayIntentBits, Partials, Events, ActivityType, EmbedBuilder, ChannelType, PermissionFlagsBits } = require("discord.js");

// Environment Variables
const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const ROLE_ID = process.env.ROLE_ID;
const TAG_TRIGGER = process.env.TAG_TRIGGER || "#tag";
const T_TRIGGER = process.env.T_TRIGGER || "#T"; // New trigger for channel creation
const NICK_PREFIX = process.env.NICK_PREFIX || "C9";
const PORT = process.env.PORT || 3000;
const SELF_URL = process.env.SELF_URL;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const ADMIN_USER_ID = process.env.ADMIN_USER_ID;
const WEB_PASSWORD = process.env.WEB_PASSWORD || "admin123";

// Data Storage
const DATA_FILE = "bot_data.json";
let lockedMembers = new Set();
let createdChannels = new Map(); // Track created channels
let botStats = {
  startTime: Date.now(),
  rolesAssigned: 0,
  nicknamesUpdated: 0,
  lockEnforcements: 0,
  channelsCreated: 0,
  rolesCreated: 0,
  uptime: 0,
  lastPing: Date.now(),
  errors: 0,
  webRequests: 0,
  keepAliveRequests: 0
};

// Load/Save Functions
async function loadData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(data);
    lockedMembers = new Set(parsed.lockedMembers || []);
    createdChannels = new Map(parsed.createdChannels || []);
    botStats = { ...botStats, ...parsed.stats };
    console.log(`Loaded ${lockedMembers.size} locked members and ${createdChannels.size} created channels from storage`);
  } catch (error) {
    console.log("No existing data file found, starting fresh");
  }
}

async function saveData() {
  try {
    const data = {
      lockedMembers: Array.from(lockedMembers),
      createdChannels: Array.from(createdChannels),
      stats: botStats,
      lastSave: new Date().toISOString()
    };
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Failed to save data:", error.message);
  }
}

// Channel and Role Creation Functions
async function createChannelAndRole(guild, member, triggerMessage) {
  try {
    const timestamp = Date.now();
    const channelName = `${member.user.username}-${timestamp}`;
    const roleName = `${member.user.username}-role-${timestamp}`;
    
    // Create a new role
    const newRole = await guild.roles.create({
      name: roleName,
      color: 'Random',
      hoist: true,
      mentionable: true,
      reason: `Created by ${member.user.tag} using ${T_TRIGGER} trigger`
    });
    
    botStats.rolesCreated++;
    
    // Create a new text channel
    const newChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      topic: `Private channel for ${member.user.tag} - Created on ${new Date().toLocaleString()}`,
      reason: `Created by ${member.user.tag} using ${T_TRIGGER} trigger`,
      permissionOverwrites: [
        {
          id: guild.roles.everyone.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        },
        {
          id: newRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory
          ]
        }
      ]
    });
    
    botStats.channelsCreated++;
    
    // Assign the new role to the member
    await member.roles.add(newRole.id, `Auto-assigned role created by ${T_TRIGGER} trigger`);
    botStats.rolesAssigned++;
    
    // Store channel and role info
    createdChannels.set(newChannel.id, {
      channelId: newChannel.id,
      channelName: newChannel.name,
      roleId: newRole.id,
      roleName: newRole.name,
      creatorId: member.id,
      creatorTag: member.user.tag,
      createdAt: timestamp,
      guildId: guild.id
    });
    
    // Create success embed
    const successEmbed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('🎉 Channel and Role Created!')
      .setDescription(`Successfully created your private setup!`)
      .addFields(
        { name: '📝 Channel', value: `<#${newChannel.id}>`, inline: true },
        { name: '🏷️ Role', value: `<@&${newRole.id}>`, inline: true },
        { name: '👤 Creator', value: `${member.user.tag}`, inline: true }
      )
      .setFooter({ text: `Use ${T_TRIGGER} to create more channels` })
      .setTimestamp();
    
    // Send confirmation in the original channel
    await triggerMessage.reply({ embeds: [successEmbed] });
    
    // Send welcome message in the new channel
    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x7289da)
      .setTitle('Welcome to your private channel!')
      .setDescription(`Hello ${member.user.tag}! This is your private channel.`)
      .addFields(
        { name: '🔒 Privacy', value: 'Only you and users with your role can see this channel', inline: false },
        { name: '⚙️ Permissions', value: 'You have full access to manage this channel', inline: false },
        { name: '🎯 Role', value: `You've been assigned the <@&${newRole.id}> role`, inline: false }
      )
      .setFooter({ text: 'Enjoy your private space!' })
      .setTimestamp();
    
    await newChannel.send({ content: `Welcome <@${member.id}>!`, embeds: [welcomeEmbed] });
    
    // Save data after successful creation
    await saveData();
    
    console.log(`Created channel "${channelName}" and role "${roleName}" for ${member.user.tag}`);
    
    return { channel: newChannel, role: newRole, success: true };
    
  } catch (error) {
    console.error('Error creating channel and role:', error);
    botStats.errors++;
    
    const errorEmbed = new EmbedBuilder()
      .setColor(0xff0000)
      .setTitle('❌ Creation Failed')
      .setDescription('Failed to create channel and role. Please check bot permissions.')
      .addFields(
        { name: 'Error', value: error.message || 'Unknown error', inline: false }
      )
      .setTimestamp();
    
    await triggerMessage.reply({ embeds: [errorEmbed] });
    
    return { success: false, error: error.message };
  }
}

// Express Server Setup (keeping existing code)
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  botStats.lastPing = Date.now();
  botStats.webRequests++;
  next();
});

// Enhanced Web Interface HTML
const getWebInterface = () => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Discord Bot Management</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #2c2f33; color: #ffffff; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: #7289da; padding: 20px; border-radius: 10px; margin-bottom: 20px; text-align: center; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .stat-card { background: #36393f; padding: 20px; border-radius: 10px; border-left: 4px solid #7289da; }
        .stat-number { font-size: 2em; font-weight: bold; color: #7289da; }
        .stat-label { color: #b9bbbe; margin-top: 5px; }
        .controls { background: #36393f; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
        .btn { background: #7289da; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin: 5px; }
        .btn:hover { background: #5b6eae; }
        .btn.danger { background: #f04747; }
        .btn.danger:hover { background: #d73838; }
        .btn.success { background: #43b581; }
        .btn.success:hover { background: #369870; }
        .logs { background: #36393f; padding: 20px; border-radius: 10px; height: 300px; overflow-y: auto; }
        .log-entry { padding: 5px; border-bottom: 1px solid #2c2f33; font-family: monospace; font-size: 12px; }
        .input-group { margin: 10px 0; }
        .input-group label { display: block; margin-bottom: 5px; color: #b9bbbe; }
        .input-group input { width: 100%; padding: 8px; background: #2c2f33; border: 1px solid #7289da; border-radius: 5px; color: white; }
        .locked-users { background: #36393f; padding: 20px; border-radius: 10px; margin-top: 20px; }
        .created-channels { background: #36393f; padding: 20px; border-radius: 10px; margin-top: 20px; }
        .user-list, .channel-list { max-height: 200px; overflow-y: auto; }
        .user-item, .channel-item { padding: 8px; background: #2c2f33; margin: 5px 0; border-radius: 5px; display: flex; justify-content: space-between; align-items: center; }
        .channel-info { font-size: 12px; color: #b9bbbe; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Discord Bot Management Panel</h1>
            <p>Enhanced Role Management System with Channel Creation</p>
        </div>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number" id="uptime">0</div>
                <div class="stat-label">Uptime (minutes)</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="locked-count">0</div>
                <div class="stat-label">Locked Members</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="roles-assigned">0</div>
                <div class="stat-label">Roles Assigned</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="channels-created">0</div>
                <div class="stat-label">Channels Created</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="roles-created">0</div>
                <div class="stat-label">Roles Created</div>
            </div>
            <div class="stat-card">
                <div class="stat-number" id="enforcements">0</div>
                <div class="stat-label">Lock Enforcements</div>
            </div>
        </div>

        <div class="controls">
            <h3>Bot Controls</h3>
            <button class="btn" onclick="refreshStats()">Refresh Stats</button>
            <button class="btn" onclick="saveData()">Save Data</button>
            <button class="btn success" onclick="getChannelList()">List Created Channels</button>
            <button class="btn" onclick="clearLogs()">Clear Logs</button>
            <button class="btn danger" onclick="unlockAll()">Unlock All Users</button>
            
            <div class="input-group">
                <label>Unlock Specific User (User ID):</label>
                <input type="text" id="unlock-user-id" placeholder="Enter Discord User ID">
                <button class="btn" onclick="unlockUser()">Unlock User</button>
            </div>

            <div class="input-group">
                <label>Delete Channel (Channel ID):</label>
                <input type="text" id="delete-channel-id" placeholder="Enter Channel ID">
                <button class="btn danger" onclick="deleteChannel()">Delete Channel</button>
            </div>
        </div>

        <div class="locked-users">
            <h3>Locked Users</h3>
            <div class="user-list" id="locked-users-list">
                Loading...
            </div>
        </div>

        <div class="created-channels">
            <h3>Created Channels</h3>
            <div class="channel-list" id="created-channels-list">
                Loading...
            </div>
        </div>

        <div class="logs">
            <h3>System Logs</h3>
            <div id="log-container">
                <div class="log-entry">Bot management interface loaded</div>
            </div>
        </div>
    </div>

    <script>
        let logs = [];
        
        function addLog(message) {
            const timestamp = new Date().toLocaleTimeString();
            logs.unshift(\`[\${timestamp}] \${message}\`);
            if (logs.length > 100) logs.pop();
            updateLogs();
        }

        function updateLogs() {
            const container = document.getElementById('log-container');
            container.innerHTML = logs.map(log => \`<div class="log-entry">\${log}</div>\`).join('');
        }

        async function refreshStats() {
            try {
                const response = await fetch('/api/stats');
                const data = await response.json();
                
                document.getElementById('uptime').textContent = Math.floor(data.uptime / 60);
                document.getElementById('locked-count').textContent = data.locked_members_count;
                document.getElementById('roles-assigned').textContent = data.rolesAssigned;
                document.getElementById('channels-created').textContent = data.channelsCreated || 0;
                document.getElementById('roles-created').textContent = data.rolesCreated || 0;
                document.getElementById('enforcements').textContent = data.lockEnforcements;
                
                addLog('Stats refreshed successfully');
                updateLockedUsers(data.locked_members_list || []);
                updateCreatedChannels(data.created_channels_list || []);
            } catch (error) {
                addLog('Failed to refresh stats: ' + error.message);
            }
        }

        function updateLockedUsers(users) {
            const container = document.getElementById('locked-users-list');
            if (users.length === 0) {
                container.innerHTML = '<div class="user-item">No locked users</div>';
                return;
            }
            
            container.innerHTML = users.map(userId => 
                \`<div class="user-item">
                    <span>\${userId}</span>
                    <button class="btn" onclick="unlockSpecificUser('\${userId}')">Unlock</button>
                </div>\`
            ).join('');
        }

        function updateCreatedChannels(channels) {
            const container = document.getElementById('created-channels-list');
            if (channels.length === 0) {
                container.innerHTML = '<div class="channel-item">No created channels</div>';
                return;
            }
            
            container.innerHTML = channels.map(channel => 
                \`<div class="channel-item">
                    <div>
                        <div><strong>\${channel.channelName}</strong></div>
                        <div class="channel-info">Created by: \${channel.creatorTag} | Role: \${channel.roleName}</div>
                    </div>
                    <button class="btn danger" onclick="deleteSpecificChannel('\${channel.channelId}')">Delete</button>
                </div>\`
            ).join('');
        }

        async function deleteChannel() {
            const channelId = document.getElementById('delete-channel-id').value.trim();
            if (!channelId) {
                addLog('Please enter a valid channel ID');
                return;
            }
            deleteSpecificChannel(channelId);
        }

        async function deleteSpecificChannel(channelId) {
            if (!confirm('Are you sure you want to delete this channel and its associated role?')) return;
            
            try {
                const response = await fetch('/api/delete-channel', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ channelId })
                });
                
                const result = await response.json();
                addLog(result.message);
                document.getElementById('delete-channel-id').value = '';
                refreshStats();
            } catch (error) {
                addLog('Delete channel error: ' + error.message);
            }
        }

        async function saveData() {
            try {
                const response = await fetch('/api/save', { method: 'POST' });
                if (response.ok) {
                    addLog('Data saved successfully');
                } else {
                    addLog('Failed to save data');
                }
            } catch (error) {
                addLog('Save error: ' + error.message);
            }
        }

        async function unlockUser() {
            const userId = document.getElementById('unlock-user-id').value.trim();
            if (!userId) {
                addLog('Please enter a valid user ID');
                return;
            }

            try {
                const response = await fetch('/api/unlock', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId })
                });
                
                const result = await response.json();
                addLog(result.message);
                document.getElementById('unlock-user-id').value = '';
                refreshStats();
            } catch (error) {
                addLog('Unlock error: ' + error.message);
            }
        }

        async function unlockSpecificUser(userId) {
            document.getElementById('unlock-user-id').value = userId;
            unlockUser();
        }

        async function unlockAll() {
            if (!confirm('Are you sure you want to unlock ALL users?')) return;
            
            try {
                const response = await fetch('/api/unlock-all', { method: 'POST' });
                const result = await response.json();
                addLog(result.message);
                refreshStats();
            } catch (error) {
                addLog('Unlock all error: ' + error.message);
            }
        }

        function clearLogs() {
            logs = [];
            updateLogs();
            addLog('Logs cleared');
        }

        // Auto-refresh every 30 seconds
        setInterval(refreshStats, 30000);
        
        // Initial load
        refreshStats();
    </script>
</body>
</html>
`;

// Web Routes (keeping existing ones and adding new ones)
app.get('/', (req, res) => {
  res.send(getWebInterface());
});

// Enhanced API Routes
app.get('/api/stats', (req, res) => {
  botStats.uptime = Date.now() - botStats.startTime;
  res.json({
    ...botStats,
    locked_members_count: lockedMembers.size,
    locked_members_list: Array.from(lockedMembers),
    created_channels_list: Array.from(createdChannels.values()),
    bot_status: client.isReady() ? 'online' : 'offline',
    memory_usage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    timestamp: new Date().toISOString()
  });
});

app.post('/api/save', async (req, res) => {
  try {
    await saveData();
    res.json({ success: true, message: 'Data saved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/unlock', async (req, res) => {
  const { userId } = req.body;
  
  if (!userId) {
    return res.status(400).json({ success: false, message: 'User ID required' });
  }

  if (lockedMembers.has(userId)) {
    lockedMembers.delete(userId);
    await saveData();
    res.json({ success: true, message: `User ${userId} unlocked successfully` });
  } else {
    res.json({ success: false, message: 'User not found in locked list' });
  }
});

app.post('/api/unlock-all', async (req, res) => {
  const count = lockedMembers.size;
  lockedMembers.clear();
  await saveData();
  res.json({ success: true, message: `Unlocked ${count} users` });
});

// New API route for deleting channels
app.post('/api/delete-channel', async (req, res) => {
  const { channelId } = req.body;
  
  if (!channelId) {
    return res.status(400).json({ success: false, message: 'Channel ID required' });
  }

  try {
    const channelData = createdChannels.get(channelId);
    if (!channelData) {
      return res.json({ success: false, message: 'Channel not found in created channels list' });
    }

    const guild = client.guilds.cache.get(channelData.guildId);
    if (!guild) {
      return res.status(404).json({ success: false, message: 'Guild not found' });
    }

    // Delete the channel
    const channel = guild.channels.cache.get(channelId);
    if (channel) {
      await channel.delete('Deleted via web interface');
    }

    // Delete the associated role
    const role = guild.roles.cache.get(channelData.roleId);
    if (role) {
      await role.delete('Deleted via web interface');
    }

    // Remove from tracking
    createdChannels.delete(channelId);
    await saveData();

    res.json({ 
      success: true, 
      message: `Deleted channel "${channelData.channelName}" and role "${channelData.roleName}"` 
    });
  } catch (error) {
    console.error('Error deleting channel:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Keep existing keep-alive endpoints and anti-stop system...
app.get('/ping', (req, res) => {
  botStats.keepAliveRequests++;
  res.json({ 
    pong: Date.now(), 
    uptime: Date.now() - botStats.startTime,
    status: 'alive'
  });
});

app.get('/health', (req, res) => {
  const health = {
    status: client.isReady() ? 'healthy' : 'unhealthy',
    uptime: Date.now() - botStats.startTime,
    memory: process.memoryUsage(),
    locked_users: lockedMembers.size,
    created_channels: createdChannels.size,
    timestamp: Date.now()
  };
  
  res.status(client.isReady() ? 200 : 503).json(health);
});

// Multiple fake endpoints for activity simulation
const fakeEndpoints = ['/api/data', '/api/users', '/api/metrics', '/api/system'];
fakeEndpoints.forEach(endpoint => {
  app.get(endpoint, (req, res) => {
    res.json({ 
      data: Array.from({length: 10}, () => Math.random()),
      timestamp: Date.now(),
      endpoint
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Web server running on port ${PORT}`);
});

// Anti-Stop System (keeping existing implementation)
const antiStopSystem = {
  intervals: [],
  
  init() {
    if (SELF_URL) {
      this.intervals.push(setInterval(() => {
        this.performKeepAlive();
      }, 120000));
    }
    
    this.intervals.push(setInterval(() => {
      saveData();
    }, 300000));
    
    this.intervals.push(setInterval(() => {
      this.updateBotStatus();
    }, 180000));
    
    this.intervals.push(setInterval(() => {
      this.simulateActivity();
    }, 60000));
  },
  
  async performKeepAlive() {
    if (!SELF_URL) return;
    
    const endpoints = ['/ping', '/health', '/api/stats'];
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${SELF_URL}${endpoint}`, {
          timeout: 8000,
          headers: {
            'User-Agent': 'DiscordBot-KeepAlive',
            'Accept': 'application/json'
          }
        });
        
        if (response.ok) {
          console.log(`Keep-alive ping to ${endpoint} successful`);
          botStats.lastPing = Date.now();
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.log(`Keep-alive failed for ${endpoint}: ${error.message}`);
        botStats.errors++;
      }
    }
  },
  
  async simulateActivity() {
    const activities = [
      () => Array.from({length: 100}, () => Math.random()).sort(),
      () => JSON.stringify({fake: 'data', numbers: Array.from({length: 50}, () => Math.random())}),
      () => Buffer.from('fake-data-processing').toString('base64'),
      () => new Date().toISOString().split('').reverse().join('')
    ];
    
    const randomActivity = activities[Math.floor(Math.random() * activities.length)];
    randomActivity();
  },
  
  updateBotStatus() {
    if (client.isReady()) {
      const uptimeHours = Math.floor((Date.now() - botStats.startTime) / 3600000);
      client.user.setPresence({
        activities: [{
          name: `${lockedMembers.size} locked | ${createdChannels.size} channels | ${uptimeHours}h`,
          type: ActivityType.Watching
        }],
        status: 'online'
      });
    }
  },
  
  cleanup() {
    this.intervals.forEach(interval => clearInterval(interval));
  }
};

// Discord Client Setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.GuildMember]
});

// Discord Event Handlers
client.once(Events.ClientReady, async () => {
  console.log(`Bot ready as ${client.user.tag}`);
  await loadData();
  antiStopSystem.init();
  antiStopSystem.updateBotStatus();
  
  if (WEBHOOK_URL) {
    try {
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `**Bot Started**\nBot: ${client.user.tag}\nLocked Members: ${lockedMembers.size}\nCreated Channels: ${createdChannels.size}\nTime: ${new Date().toLocaleString()}`
        })
      });
    } catch (e) {
      console.log("Webhook notification failed:", e.message);
    }
  }
});

// Enhanced message handling with #T trigger
const userCooldowns = new Map();

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;
  
  const member = message.member;
  if (!member) return;

  // Handle #T trigger for channel creation
  if (message.content.includes(T_TRIGGER)) {
    // Rate limiting
    const now = Date.now();
    const cooldownKey = `${member.id}_T`;
    const cooldownExpire = userCooldowns.get(cooldownKey);
    if (cooldownExpire && now < cooldownExpire) {
      const remaining = Math.ceil((cooldownExpire - now) / 1000);
      return message.reply(`Please wait ${remaining} seconds before creating another channel.`);
    }

    userCooldowns.set(cooldownKey, now + 300000); // 5 minute cooldown for channel creation

    await createChannelAndRole(message.guild, member, message);
    return;
  }

  // Handle existing #tag trigger
  if (message.channel.id !== CHANNEL_ID || !message.content.includes(TAG_TRIGGER)) return;

  // Rate limiting for role assignment
  const now = Date.now();
  const cooldownExpire = userCooldowns.get(member.id);
  if (cooldownExpire && now < cooldownExpire) {
    const remaining = Math.ceil((cooldownExpire - now) / 1000);
    return message.reply(`Please wait ${remaining} seconds before trying again.`);
  }

  if (member.roles.cache.has(ROLE_ID)) {
    return message.reply("You already have the role.");
  }

  userCooldowns.set(member.id, now + 60000);

  try {
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
    
    const embed = new EmbedBuilder()
      .setColor(0x7289da)
      .setTitle('Role Assigned')
      .setDescription('Role assigned and nickname updated. You are now locked to this role.')
      .setTimestamp();
    
    await message.reply({ embeds: [embed] });
    
    if (botStats.rolesAssigned % 5 === 0) {
      await saveData();
    }
    
  } catch (err) {
    console.error("Error assigning role:", err);
    botStats.errors++;
    message.reply("Failed to assign role - check bot permissions.");
  }
});

// Lock enforcement
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

  if (actionTaken && botStats.lockEnforcements % 3 === 0) {
    await saveData();
  }
});

// Channel deletion handler - clean up tracking when channels are deleted
client.on(Events.ChannelDelete, async (channel) => {
  if (createdChannels.has(channel.id)) {
    const channelData = createdChannels.get(channel.id);
    
    // Try to also delete the associated role if it still exists
    try {
      const guild = channel.guild;
      const role = guild.roles.cache.get(channelData.roleId);
      if (role) {
        await role.delete('Associated channel was deleted');
      }
    } catch (error) {
      console.error('Failed to delete associated role:', error.message);
    }
    
    // Remove from tracking
    createdChannels.delete(channel.id);
    await saveData();
    
    console.log(`Cleaned up tracking for deleted channel: ${channelData.channelName}`);
  }
});

// Role deletion handler - clean up tracking when roles are deleted
client.on(Events.GuildRoleDelete, async (role) => {
  // Find and remove any channels associated with this role
  for (const [channelId, channelData] of createdChannels.entries()) {
    if (channelData.roleId === role.id) {
      // Try to delete the associated channel if it still exists
      try {
        const channel = role.guild.channels.cache.get(channelId);
        if (channel) {
          await channel.delete('Associated role was deleted');
        }
      } catch (error) {
        console.error('Failed to delete associated channel:', error.message);
      }
      
      // Remove from tracking
      createdChannels.delete(channelId);
      console.log(`Cleaned up tracking for channel associated with deleted role: ${channelData.roleName}`);
    }
  }
  
  await saveData();
});

// Enhanced admin commands
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guild) return;
  if (ADMIN_USER_ID && message.author.id !== ADMIN_USER_ID) return;
  if (!message.content.startsWith('!admin')) return;

  const args = message.content.slice(7).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  switch (command) {
    case 'stats':
      const embed = new EmbedBuilder()
        .setColor(0x7289da)
        .setTitle('📊 Bot Statistics')
        .addFields(
          { name: 'Uptime', value: `${Math.floor((Date.now() - botStats.startTime) / 60000)} minutes`, inline: true },
          { name: 'Locked Members', value: lockedMembers.size.toString(), inline: true },
          { name: 'Roles Assigned', value: botStats.rolesAssigned.toString(), inline: true },
          { name: 'Channels Created', value: botStats.channelsCreated.toString(), inline: true },
          { name: 'Roles Created', value: botStats.rolesCreated.toString(), inline: true },
          { name: 'Lock Enforcements', value: botStats.lockEnforcements.toString(), inline: true },
          { name: 'Errors', value: botStats.errors.toString(), inline: true },
          { name: 'Memory Usage', value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`, inline: true }
        )
        .setTimestamp();
      
      await message.reply({ embeds: [embed] });
      break;

    case 'cleanup':
      let cleaned = 0;
      const channelsToRemove = [];
      
      for (const [channelId, channelData] of createdChannels.entries()) {
        const channel = message.guild.channels.cache.get(channelId);
        const role = message.guild.roles.cache.get(channelData.roleId);
        
        if (!channel && !role) {
          channelsToRemove.push(channelId);
          cleaned++;
        }
      }
      
      channelsToRemove.forEach(id => createdChannels.delete(id));
      await saveData();
      
      await message.reply(`🧹 Cleaned up ${cleaned} orphaned channel records.`);
      break;

    case 'help':
      const helpEmbed = new EmbedBuilder()
        .setColor(0x7289da)
        .setTitle('🤖 Admin Commands')
        .setDescription('Available admin commands:')
        .addFields(
          { name: '!admin stats', value: 'Show bot statistics', inline: false },
          { name: '!admin cleanup', value: 'Clean up orphaned channel records', inline: false },
          { name: '!admin help', value: 'Show this help message', inline: false }
        )
        .setFooter({ text: 'Admin commands are only available to the configured admin user' });
      
      await message.reply({ embeds: [helpEmbed] });
      break;

    default:
      await message.reply('❌ Unknown admin command. Use `!admin help` for available commands.');
  }
});

// Error handling
client.on(Events.Error, (error) => {
  console.error('Discord client error:', error);
  botStats.errors++;
});

// Enhanced error handling for uncaught exceptions
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  botStats.errors++;
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  botStats.errors++;
});

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`Received ${signal}, gracefully shutting down...`);
  
  try {
    antiStopSystem.cleanup();
    await saveData();
    
    if (WEBHOOK_URL) {
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `**Bot Shutdown**\nBot: ${client.user?.tag || 'Unknown'}\nReason: ${signal}\nUptime: ${Math.floor((Date.now() - botStats.startTime) / 60000)} minutes\nTime: ${new Date().toLocaleString()}`
        })
      });
    }
    
    client.destroy();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Login with enhanced error handling
if (!TOKEN) {
  console.error("❌ Missing DISCORD_TOKEN environment variable");
  console.error("Please set the DISCORD_TOKEN environment variable with your bot's token");
  process.exit(1);
}

console.log("🚀 Starting Discord bot...");
console.log(`📝 Tag trigger: ${TAG_TRIGGER}`);
console.log(`🏗️ Channel creation trigger: ${T_TRIGGER}`);
console.log(`🌐 Web interface will be available on port ${PORT}`);

client.login(TOKEN).catch(error => {
  console.error("❌ Failed to login to Discord:", error.message);
  
  if (error.message.includes('TOKEN_INVALID')) {
    console.error("🔑 The provided Discord token is invalid. Please check your DISCORD_TOKEN environment variable.");
  } else if (error.message.includes('DISALLOWED_INTENTS')) {
    console.error("🔒 The bot is missing required intents. Please enable the required intents in the Discord Developer Portal.");
  }
  
  process.exit(1);
});