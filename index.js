const {
    Client,
    GatewayIntentBits,
    Partials,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    Events,
    PermissionFlagsBits,
    SelectMenuBuilder,
    ComponentType,
    StringSelectMenuBuilder
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
const triggerWords = ["/b", "/welcome", "/👏", "/vexo", "/tile"];

// Command configurations
const commandConfigs = {
    "/b": {
        message: "🎨 Choose an emoji or sticker to react with:",
        showSuggestions: true
    },
    "/welcome": {
        message: "🎉 Welcome message! React with emoji below:",
        buttonLabel: "Add Welcome Reaction 🎊",
        emoji: "🎊"
    },
    "/👏": {
        message: "👏 Clap command activated!",
        buttonLabel: "Add Clap 👏",
        emoji: "👏"
    },
    "/vexo": {
        message: "🚀 VEXO TEAM activated! Ready to react:",
        buttonLabel: "VEXO React ⚡",
        emoji: "⚡"
    },
    "/tile": {
        message: "🎯 Tile command ready! Add your reaction:",
        buttonLabel: "Tile Reaction 🔥",
        emoji: "🔥"
    }
};

// Common emojis for suggestions
const commonEmojis = [
    '👏', '🎉', '❤️', '😂', '😍', '🔥', '👍', '⚡',
    '🚀', '💯', '✨', '🎊', '👑', '🌟', '💎', '🎯'
];

// Function to get server emojis and stickers
async function getServerEmojisAndStickers(guild) {
    const emojis = [];
    const stickers = [];
    
    try {
        // Get server emojis
        const guildEmojis = await guild.emojis.fetch();
        guildEmojis.forEach(emoji => {
            if (emoji.available) {
                emojis.push({
                    name: emoji.name,
                    id: emoji.id,
                    animated: emoji.animated,
                    display: `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>`,
                    value: `emoji_${emoji.id}`
                });
            }
        });
        
        // Get server stickers
        const guildStickers = await guild.stickers.fetch();
        guildStickers.forEach(sticker => {
            if (sticker.available) {
                stickers.push({
                    name: sticker.name,
                    id: sticker.id,
                    display: `Sticker: ${sticker.name}`,
                    value: `sticker_${sticker.id}`
                });
            }
        });
        
    } catch (error) {
        console.error('Error fetching server emojis/stickers:', error);
    }
    
    return { emojis, stickers };
}

// Function to create suggestion components
async function createSuggestionComponents(guild) {
    const { emojis, stickers } = await getServerEmojisAndStickers(guild);
    const components = [];
    
    // Common emojis dropdown
    const commonEmojiOptions = commonEmojis.map((emoji, index) => ({
        label: `${emoji} Common Emoji`,
        value: `common_${index}`,
        emoji: emoji
    }));
    
    if (commonEmojiOptions.length > 0) {
        const commonSelect = new StringSelectMenuBuilder()
            .setCustomId('emoji_common')
            .setPlaceholder('Choose a common emoji')
            .addOptions(commonEmojiOptions.slice(0, 25)); // Discord limit is 25
        
        components.push(new ActionRowBuilder().addComponents(commonSelect));
    }
    
    // Server emojis dropdown
    if (emojis.length > 0) {
        const serverEmojiOptions = emojis.slice(0, 25).map(emoji => ({
            label: emoji.name,
            value: emoji.value,
            description: `Server emoji: ${emoji.name}`
        }));
        
        const serverSelect = new StringSelectMenuBuilder()
            .setCustomId('emoji_server')
            .setPlaceholder('Choose a server emoji')
            .addOptions(serverEmojiOptions);
        
        components.push(new ActionRowBuilder().addComponents(serverSelect));
    }
    
    // Server stickers dropdown
    if (stickers.length > 0) {
        const stickerOptions = stickers.slice(0, 25).map(sticker => ({
            label: sticker.name,
            value: sticker.value,
            description: 'Server sticker'
        }));
        
        const stickerSelect = new StringSelectMenuBuilder()
            .setCustomId('sticker_server')
            .setPlaceholder('Choose a server sticker')
            .addOptions(stickerOptions);
        
        components.push(new ActionRowBuilder().addComponents(stickerSelect));
    }
    
    // Custom emoji input button
    const customButton = new ButtonBuilder()
        .setCustomId('emoji_custom')
        .setLabel('Use Custom Emoji')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✏️');
    
    components.push(new ActionRowBuilder().addComponents(customButton));
    
    return components;
}
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
    const triggerWord = triggerWords.find(word => content === word);

    if (triggerWord) {
        try {
            const member = await message.guild.members.fetch(message.author.id);
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return message.reply("❌ This command is for admins only.");
            }

            const config = commandConfigs[triggerWord];
            
            // Special handling for /b command with suggestions
            if (triggerWord === "/b" && config.showSuggestions) {
                const components = await createSuggestionComponents(message.guild);
                
                await message.reply({
                    content: config.message,
                    components: components.slice(0, 5) // Discord limit is 5 action rows
                });
                return;
            }
            
            // Regular command handling for other commands
            if (config.emoji) {
                // Check if the original message already contains the target emoji
                if (message.content.includes(config.emoji)) {
                    return;
                }

                const button = new ButtonBuilder()
                    .setCustomId(`addEmoji_${config.emoji}`)
                    .setLabel(config.buttonLabel)
                    .setStyle(ButtonStyle.Success);

                const row = new ActionRowBuilder().addComponents(button);

                await message.reply({
                    content: config.message,
                    components: [row]
                });
            }
        } catch (error) {
            console.error('Error handling message:', error);
            message.reply("❌ An error occurred while processing your command.").catch(console.error);
        }
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        // Handle emoji reaction buttons
        if (interaction.customId.startsWith('addEmoji_')) {
            const emoji = interaction.customId.replace('addEmoji_', '');
            const originalMessage = interaction.message;

            try {
                await originalMessage.react(emoji);
                await interaction.reply({ 
                    content: `✅ Emoji ${emoji} added successfully!`, 
                    ephemeral: true 
                });
            } catch (error) {
                console.error('Error adding emoji reaction:', error);
                await interaction.reply({ 
                    content: `❌ Failed to add emoji ${emoji}.`, 
                    ephemeral: true 
                });
            }
        }
        
        // Handle custom emoji input
        else if (interaction.customId === 'emoji_custom') {
            await interaction.reply({
                content: '✏️ **How to use custom emojis:**\n\n' +
                         '**For server emojis:** Type the emoji name like `:emojiname:`\n' +
                         '**For Unicode emojis:** Just type the emoji directly like 🎉\n' +
                         '**For other server emojis:** Copy and paste the emoji\n\n' +
                         'Then I\'ll add it as a reaction to the original message!',
                ephemeral: true
            });
        }
    }
    
    else if (interaction.isStringSelectMenu()) {
        const originalMessage = interaction.message;
        
        try {
            // Handle common emoji selection
            if (interaction.customId === 'emoji_common') {
                const selectedIndex = parseInt(interaction.values[0].replace('common_', ''));
                const emoji = commonEmojis[selectedIndex];
                
                await originalMessage.react(emoji);
                await interaction.reply({
                    content: `✅ Added ${emoji} reaction!`,
                    ephemeral: true
                });
            }
            
            // Handle server emoji selection
            else if (interaction.customId === 'emoji_server') {
                const emojiId = interaction.values[0].replace('emoji_', '');
                const emoji = interaction.guild.emojis.cache.get(emojiId);
                
                if (emoji) {
                    await originalMessage.react(emoji);
                    await interaction.reply({
                        content: `✅ Added <:${emoji.name}:${emoji.id}> reaction!`,
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: '❌ Emoji not found!',
                        ephemeral: true
                    });
                }
            }
            
            // Handle server sticker selection
            else if (interaction.customId === 'sticker_server') {
                const stickerId = interaction.values[0].replace('sticker_', '');
                const sticker = interaction.guild.stickers.cache.get(stickerId);
                
                if (sticker) {
                    // Send sticker as a reply
                    await interaction.reply({
                        content: `✅ Added sticker: **${sticker.name}**`,
                        stickers: [sticker],
                        ephemeral: false
                    });
                } else {
                    await interaction.reply({
                        content: '❌ Sticker not found!',
                        ephemeral: true
                    });
                }
            }
            
        } catch (error) {
            console.error('Error handling selection:', error);
            await interaction.reply({
                content: '❌ Failed to add reaction/sticker.',
                ephemeral: true
            });
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