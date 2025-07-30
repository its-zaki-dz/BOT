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

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});


const triggerWords = ["/b", "/welcome", "/👏"];
const emojiToReact = "👏";

client.once('ready', () => {
    console.log(`✅ Bot is online as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const content = message.content.trim().toLowerCase();

    if (triggerWords.includes(content)) {
        const member = await message.guild.members.fetch(message.author.id);
        if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply("❌ This command is for admins only.");
        }

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
            console.error(error);
            await interaction.reply({ content: "❌ Failed to add emoji.", ephemeral: true });
        }
    }
});

require('dotenv').config();
client.login(process.env.TOKEN);

