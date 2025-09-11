const express = require("express");
const fetch = require("node-fetch");
const { Client, GatewayIntentBits, Partials, Events } = require("discord.js");

// ====== Environment Variables ======
const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const ROLE_ID = process.env.ROLE_ID;
const TAG_TRIGGER = process.env.TAG_TRIGGER || "#tag";
const NICK_PREFIX = process.env.NICK_PREFIX || "C9・";
const PORT = process.env.PORT;
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

if (!TOKEN || !CHANNEL_ID || !ROLE_ID) {
  console.error("❌ Missing environment variables: DISCORD_TOKEN, CHANNEL_ID, ROLE_ID are required!");
  process.exit(1);
}

// ====== Express Web Server ======
const app = express();
app.get("/", (req, res) => res.send("Bot is running!"));
app.listen(PORT, () => console.log(`Web server running on port ${PORT}`));

// Self-ping كل 5 دقائق
setInterval(() => {
  fetch(URL).then(() => console.log("Self-ping sent")).catch(() => {});
}, 5 * 60 * 1000);

// ====== Discord Bot ======
const lockedMembers = new Set();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.GuildMember]
});

client.once(Events.ClientReady, () => {
  console.log(`✅ Ready as ${client.user.tag}`);
});

// Listen for trigger
client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;
  if (message.channel.id !== CHANNEL_ID) return;
  if (!message.content.includes(TAG_TRIGGER)) return;

  const member = message.member;
  if (!member) return;

  if (member.roles.cache.has(ROLE_ID)) {
    return message.reply("✅ You already have the role.");
  }

  try {
    await member.roles.add(ROLE_ID, "Assigned by tag trigger");

    const currentNick = member.nickname || member.user.username;
    if (!currentNick.startsWith(NICK_PREFIX)) {
      try {
        await member.setNickname(`${NICK_PREFIX}${currentNick}`, "Prefix added by bot");
      } catch (e) {
        console.error("Failed to set nickname:", e.message);
      }
    }

    lockedMembers.add(member.id);
    await message.reply("✅ Role assigned and nickname updated.");
  } catch (err) {
    console.error("Error assigning role:", err);
    message.reply("⚠️ Failed to assign role — check bot permissions and role hierarchy.");
  }
});

// Enforce role & nickname
client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
  if (!lockedMembers.has(newMember.id)) return;

  const hadRole = oldMember.roles.cache.has(ROLE_ID);
  const hasRole = newMember.roles.cache.has(ROLE_ID);

  if (hadRole && !hasRole) {
    try {
      await newMember.roles.add(ROLE_ID, "Re-adding locked role");
      const sysChan = newMember.guild.systemChannel;
      if (sysChan) sysChan.send(`${newMember.toString()}: role was removed and re-added.`);
    } catch (e) {
      console.error("Failed to re-add role:", e.message);
    }
  }

  const newNick = newMember.nickname || newMember.user.username;
  if (!newNick.startsWith(NICK_PREFIX)) {
    try {
      await newMember.setNickname(`${NICK_PREFIX}${newNick}`, "Re-applying locked nickname prefix");
    } catch (e) {
      console.error("Failed to reset nickname:", e.message);
    }
  }
});

client.login(TOKEN);
