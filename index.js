const {
    Client,
    GatewayIntentBits,
    Partials,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Events,
    PermissionFlagsBits
} = require('discord.js');

require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Configuration
const triggerWords = ["/b", "/welcome", "/👏"];
const emojiToReact = "👏";
const PORT = process.env.PORT || 3000;

// Health check endpoint for Render
const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.json({ 
        status: 'Bot is running', 
        uptime: process.uptime(),
        botStatus: client.isReady() ? 'Connected' : 'Connecting...'
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
});

// Start HTTP server for Render health checks
app.listen(PORT, () => {
    console.log(`🌐 Health check server running on port ${PORT}`);
});

client.once('ready', () => {
    console.log(`✅ Bot is online as ${client.user.tag}`);
    console.log(`📊 Connected to ${client.guilds.cache.size} guilds`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const content = message.content.trim().toLowerCase();

    if (triggerWords.includes(content)) {
        try {
            const member = await message.guild.members.fetch(message.author.id);
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return message.reply("❌ This command is for admins only.");
            }

            // Check if the original message already contains the emoji
            if (message.content.includes(emojiToReact)) {
                return;
            }

            const button = new ButtonBuilder()
                .setCustomId('addEmoji')
                .setLabel('Click to react 👏')
                .setStyle(ButtonStyle.Success);

            const row = new ActionRowBuilder().addComponents(button);

            await message.reply({
                content: "⚠️ Emoji 👏 not found in your message.",
                components: [row]
            });
        } catch (error) {
            console.error('Error handling message:', error);
            message.reply("❌ An error occurred while processing your command.").catch(console.error);
        }
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'addEmoji') {
        const originalMessage = interaction.message;

        try {
            await originalMessage.react(emojiToReact);
            await interaction.reply({ content: "✅ Emoji 👏 added!", ephemeral: true });
        } catch (error) {
            console.error('Error adding emoji reaction:', error);
            await interaction.reply({ content: "❌ Failed to add emoji.", ephemeral: true });
        }
    }
});

// Error handling
client.on('error', error => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully...');
    client.destroy();
    process.exit(0);
});

// Validate token before login
if (!process.env.TOKEN) {
    console.error('❌ Discord bot token is missing! Please set the TOKEN environment variable.');
    process.exit(1);
}

// Login to Discord
client.login(process.env.TOKEN).catch(error => {
    console.error('Failed to login to Discord:', error);
    
    if (error.code === 'TokenInvalid') {
        console.error('🔑 Your Discord bot token is invalid. Please check:');
        console.error('   1. Go to Discord Developer Portal');
        console.error('   2. Reset your bot token');
        console.error('   3. Update the TOKEN environment variable in Render');
    } else if (error.message.includes('disallowed intents')) {
        console.error('🚫 Your bot is missing required intents. Please:');
        console.error('   1. Go to Discord Developer Portal');
        console.error('   2. Enable "Message Content Intent" in Bot settings');
        console.error('   3. Save changes and redeploy');
    }
    
    process.exit(1);
});