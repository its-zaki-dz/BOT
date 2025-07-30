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
    StringSelectMenuBuilder,
    EmbedBuilder
} = require('discord.js');

require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions // إضافة intent للـ reactions
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// Configuration
const triggerWords = ["/b", "/welcome", "/👏", "/vexo", "/tile", "/btn", "/titlemessage", "/btnmessage", "/emoji", "/link"];

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
    },
    "/btn": {
        message: "🔘 Button setup! Configure your reaction button:",
        setupButton: true
    },
    "/titlemessage": {
        message: "📝 Title Message setup! Set up your title and content:",
        setupTitle: true
    },
    "/btnmessage": {
        message: "💬 Button Message setup! Create button with message:",
        setupButtonMessage: true
    },
    "/emoji": {
        message: "😊 Emoji setup! Configure emoji reaction response:",
        setupEmoji: true
    },
    "/link": {
        message: "🔗 Link setup! Configure link sharing on reaction:",
        setupLink: true
    }
};

// Storage for reaction-based content (في التطبيق الحقيقي، استخدم قاعدة بيانات)
const reactionContent = new Map();

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
            .addOptions(commonEmojiOptions.slice(0, 25));
        
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

// Function to create setup components for new commands
async function createSetupComponents(commandType, userId) {
    const components = [];
    
    if (commandType === 'btn') {
        const setupButton = new ButtonBuilder()
            .setCustomId(`setup_btn_${userId}`)
            .setLabel('Setup Button Reaction')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⚙️');
        
        components.push(new ActionRowBuilder().addComponents(setupButton));
    }
    
    else if (commandType === 'titlemessage') {
        const setupButton = new ButtonBuilder()
            .setCustomId(`setup_title_${userId}`)
            .setLabel('Setup Title & Message')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('📝');
        
        components.push(new ActionRowBuilder().addComponents(setupButton));
    }
    
    else if (commandType === 'btnmessage') {
        const setupButton = new ButtonBuilder()
            .setCustomId(`setup_btnmsg_${userId}`)
            .setLabel('Setup Button Message')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('💬');
        
        components.push(new ActionRowBuilder().addComponents(setupButton));
    }
    
    else if (commandType === 'emoji') {
        const setupButton = new ButtonBuilder()
            .setCustomId(`setup_emoji_${userId}`)
            .setLabel('Setup Emoji Response')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('😊');
        
        components.push(new ActionRowBuilder().addComponents(setupButton));
    }
    
    else if (commandType === 'link') {
        const setupButton = new ButtonBuilder()
            .setCustomId(`setup_link_${userId}`)
            .setLabel('Setup Link Response')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔗');
        
        components.push(new ActionRowBuilder().addComponents(setupButton));
    }
    
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
                    components: components.slice(0, 5)
                });
                return;
            }
            
            // Handle new setup commands
            if (config.setupButton || config.setupTitle || config.setupButtonMessage || config.setupEmoji || config.setupLink) {
                const setupType = triggerWord.replace('/', '');
                const components = await createSetupComponents(setupType, message.author.id);
                
                await message.reply({
                    content: config.message,
                    components: components
                });
                return;
            }
            
            // Regular command handling for other commands
            if (config.emoji) {
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

// Handle reaction add events
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    
    try {
        // If reaction is partial, fetch the full reaction
        if (reaction.partial) {
            await reaction.fetch();
        }
        
        const messageId = reaction.message.id;
        const emojiKey = reaction.emoji.id || reaction.emoji.name;
        const contentKey = `${messageId}_${emojiKey}`;
        
        // Check if there's stored content for this reaction
        if (reactionContent.has(contentKey)) {
            const content = reactionContent.get(contentKey);
            
            // Send the stored content to user
            if (content.type === 'text') {
                await user.send(`📝 **Message:** ${content.text}`).catch(console.error);
            } else if (content.type === 'link') {
                await user.send(`🔗 **Link:** ${content.link}`).catch(console.error);
            } else if (content.type === 'embed') {
                const embed = new EmbedBuilder()
                    .setTitle(content.title)
                    .setDescription(content.description)
                    .setColor(0x0099FF);
                
                await user.send({ embeds: [embed] }).catch(console.error);
            }
        }
    } catch (error) {
        console.error('Error handling reaction add:', error);
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
        
        // Handle setup buttons
        else if (interaction.customId.startsWith('setup_')) {
            const setupType = interaction.customId.split('_')[1];
            const userId = interaction.customId.split('_')[2];
            
            if (interaction.user.id !== userId) {
                return interaction.reply({
                    content: '❌ You can only use your own setup buttons.',
                    ephemeral: true
                });
            }
            
            let instructions = '';
            
            if (setupType === 'btn') {
                instructions = '🔘 **Button Setup Instructions:**\n\n' +
                             '1. React to any message with an emoji\n' +
                             '2. Then type: `!setcontent [emoji] [text or link]`\n' +
                             '3. Example: `!setcontent ❤️ Welcome to our server!`\n' +
                             '4. Example: `!setcontent 🔗 https://example.com`\n\n' +
                             'Now when someone reacts with that emoji, they\'ll get your content!';
            }
            else if (setupType === 'title') {
                instructions = '📝 **Title Message Setup Instructions:**\n\n' +
                             '1. React to any message with an emoji\n' +
                             '2. Then type: `!settitle [emoji] | [title] | [description]`\n' +
                             '3. Example: `!settitle ⭐ | Important Info | Check our rules channel`\n\n' +
                             'Users will receive a nice embed message!';
            }
            else if (setupType === 'btnmsg') {
                instructions = '💬 **Button Message Setup Instructions:**\n\n' +
                             '1. React to any message with an emoji\n' +
                             '2. Then type: `!setbtnmsg [emoji] [message]`\n' +
                             '3. Example: `!setbtnmsg 🎉 Thanks for reacting!`\n\n' +
                             'Simple message responses for reactions!';
            }
            else if (setupType === 'emoji') {
                instructions = '😊 **Emoji Response Setup Instructions:**\n\n' +
                             '1. React to any message with an emoji\n' +
                             '2. Then type: `!setemoji [trigger_emoji] [response_text]`\n' +
                             '3. Example: `!setemoji 👋 Hello there! Welcome!`\n\n' +
                             'Perfect for welcome messages and responses!';
            }
            else if (setupType === 'link') {
                instructions = '🔗 **Link Setup Instructions:**\n\n' +
                             '1. React to any message with an emoji\n' +
                             '2. Then type: `!setlink [emoji] [link] [optional description]`\n' +
                             '3. Example: `!setlink 📚 https://docs.example.com Study Materials`\n\n' +
                             'Share important links when users react!';
            }
            
            await interaction.reply({
                content: instructions,
                ephemeral: true
            });
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

// Handle content setup commands
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const content = message.content.trim();
    
    // Simple command: !react [emoji] [text or link]
    if (content.startsWith('!react ')) {
        const member = await message.guild.members.fetch(message.author.id);
        if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply("❌ This command is for admins only.");
        }
        
        const parts = content.slice(7).split(' ');
        if (parts.length < 2) {
            return message.reply('❌ Usage: `!react [emoji] [text or link]`\nExample: `!react ❤️ Welcome to our server!`\nExample: `!react 🔗 https://discord.gg/yourserver`');
        }
        
        const emoji = parts[0];
        const text = parts.slice(1).join(' ');
        
        try {
            // Add reaction to the message
            await message.react(emoji);
            
            // Store the content for this reaction
            const emojiKey = emoji;
            const contentKey = `${message.id}_${emojiKey}`;
            
            // Determine if it's a link or text
            const isLink = text.startsWith('http://') || text.startsWith('https://');
            
            reactionContent.set(contentKey, {
                type: isLink ? 'link' : 'text',
                [isLink ? 'link' : 'text']: text
            });
            
            await message.reply(`✅ Reaction ${emoji} added! When someone reacts with ${emoji}, they will receive: "${text}"`);
            
        } catch (error) {
            console.error('Error setting up reaction:', error);
            await message.reply(`❌ Failed to add reaction ${emoji}. Make sure the emoji is valid.`);
        }
    }
    
    // Handle !setcontent command (backward compatibility)
    else if (content.startsWith('!setcontent ')) {
        const member = await message.guild.members.fetch(message.author.id);
        if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply("❌ This command is for admins only.");
        }
        
        const parts = content.slice(12).split(' ');
        if (parts.length < 2) {
            return message.reply('❌ Usage: `!setcontent [emoji] [text or link]`');
        }
        
        const emoji = parts[0];
        const text = parts.slice(1).join(' ');
        
        // Get recent messages to find the one with this emoji reaction
        const messages = await message.channel.messages.fetch({ limit: 10 });
        const targetMessage = messages.find(msg => 
            msg.reactions.cache.some(reaction => 
                reaction.emoji.name === emoji || reaction.emoji.toString() === emoji
            )
        );
        
        if (targetMessage) {
            const emojiKey = emoji;
            const contentKey = `${targetMessage.id}_${emojiKey}`;
            
            // Determine if it's a link or text
            const isLink = text.startsWith('http://') || text.startsWith('https://');
            
            reactionContent.set(contentKey, {
                type: isLink ? 'link' : 'text',
                [isLink ? 'link' : 'text']: text
            });
            
            await message.reply(`✅ Content set for ${emoji} reaction on the target message!`);
        } else {
            await message.reply('❌ No recent message found with that emoji reaction. Please react to a message first.');
        }
    }
    
    // Handle !settitle command
    else if (content.startsWith('!settitle ')) {
        const member = await message.guild.members.fetch(message.author.id);
        if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply("❌ This command is for admins only.");
        }
        
        const parts = content.slice(10).split(' | ');
        if (parts.length < 3) {
            return message.reply('❌ Usage: `!settitle [emoji] | [title] | [description]`');
        }
        
        const emoji = parts[0].trim();
        const title = parts[1].trim();
        const description = parts[2].trim();
        
        const messages = await message.channel.messages.fetch({ limit: 10 });
        const targetMessage = messages.find(msg => 
            msg.reactions.cache.some(reaction => 
                reaction.emoji.name === emoji || reaction.emoji.toString() === emoji
            )
        );
        
        if (targetMessage) {
            const contentKey = `${targetMessage.id}_${emoji}`;
            
            reactionContent.set(contentKey, {
                type: 'embed',
                title: title,
                description: description
            });
            
            await message.reply(`✅ Title message set for ${emoji} reaction!`);
        } else {
            await message.reply('❌ No recent message found with that emoji reaction.');
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
