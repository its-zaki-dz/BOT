const { Client, GatewayIntentBits, EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const fetch = require('node-fetch');

// تكوين البوت
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// متغيرات البيئة
const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!BOT_TOKEN || !CLIENT_ID) {
    console.error('Missing required environment variables: BOT_TOKEN or CLIENT_ID');
    process.exit(1);
}

// دالة للحصول على معلومات المستخدم من Lanyard
async function getLanyardData(userId) {
    try {
        const response = await fetch(`https://api.lanyard.rest/v1/users/${userId}`);
        if (!response.ok) return null;
        
        const data = await response.json();
        return data.success ? data.data : null;
    } catch (error) {
        console.error('Lanyard API Error:', error);
        return null;
    }
}

// دالة إنشاء embed للملف الشخصي
async function createProfileEmbed(user, guild = null) {
    const lanyardData = await getLanyardData(user.id);
    
    // تحديد الحالة
    const statusEmojis = {
        online: '🟢',
        idle: '🟡', 
        dnd: '🔴',
        offline: '⚫'
    };
    
    const statusTexts = {
        online: 'متصل',
        idle: 'خامل',
        dnd: 'مشغول', 
        offline: 'غير متصل'
    };
    
    const status = lanyardData?.discord_status || 'offline';
    const statusText = statusTexts[status] || 'غير معروف';
    const statusEmoji = statusEmojis[status] || '⚫';

    // إنشاء الـ embed
    const embed = new EmbedBuilder()
        .setColor(status === 'online' ? '#43B581' : status === 'idle' ? '#FAA61A' : status === 'dnd' ? '#F04747' : '#747F8D')
        .setTitle(`📋 ملف ${user.displayName || user.username} الشخصي`)
        .setDescription(`معلومات شاملة عن المستخدم وحالته الحية`)
        .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setTimestamp()
        .setFooter({ 
            text: 'Discord Profile Bot', 
            iconURL: client.user.displayAvatarURL() 
        });

    // إضافة معلومات الحالة
    embed.addFields({
        name: '📊 الحالة الحالية',
        value: `${statusEmoji} **${statusText}**\n${lanyardData ? '📡 *بيانات مباشرة*' : '💾 *بيانات مخزنة*'}`,
        inline: true
    });

    // إضافة معلومات الأنشطة
    let activitiesText = '';
    if (lanyardData && lanyardData.activities && lanyardData.activities.length > 0) {
        const activities = lanyardData.activities.slice(0, 3); // أول 3 أنشطة فقط
        activitiesText = activities.map(activity => {
            const icons = { 0: '🎮', 1: '📺', 2: '🎵', 3: '📺', 4: '💭', 5: '🏆' };
            const types = { 0: 'يلعب', 1: 'يبث', 2: 'يستمع', 3: 'يشاهد', 4: 'حالة', 5: 'يتنافس' };
            
            const icon = icons[activity.type] || '✨';
            const type = types[activity.type] || 'نشاط';
            const name = activity.name || 'غير معروف';
            
            return `${icon} **${type}:** ${name}`;
        }).join('\n');
        
        // إضافة معلومات Spotify إذا كانت متوفرة
        if (lanyardData.spotify) {
            const spotify = lanyardData.spotify;
            activitiesText += `\n🎵 **Spotify:** ${spotify.song}\n👨‍🎤 **بواسطة:** ${spotify.artist}`;
        }
    } else {
        activitiesText = '😴 لا توجد أنشطة حالية';
    }

    embed.addFields({
        name: '🎮 الأنشطة الحالية',
        value: activitiesText,
        inline: false
    });

    // إضافة معلومات الحساب
    const createdAt = user.createdAt;
    const accountAge = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    
    let accountInfo = `📅 **تاريخ الإنشاء:** ${createdAt.toLocaleDateString('ar-EG')}\n`;
    accountInfo += `⏰ **عمر الحساب:** ${accountAge} يوم\n`;
    accountInfo += `🆔 **معرف المستخدم:** \`${user.id}\``;
    
    // معلومات إضافية إذا كان المستخدم في نفس الخادم
    if (guild) {
        const member = await guild.members.fetch(user.id).catch(() => null);
        if (member) {
            const joinedAt = member.joinedAt;
            const memberAge = Math.floor((Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24));
            accountInfo += `\n🏠 **انضم للخادم:** ${joinedAt.toLocaleDateString('ar-EG')}`;
            accountInfo += `\n📊 **في الخادم منذ:** ${memberAge} يوم`;
            
            if (member.roles.cache.size > 1) {
                const roles = member.roles.cache
                    .filter(role => role.name !== '@everyone')
                    .first(3)
                    .map(role => role.toString())
                    .join(', ');
                accountInfo += `\n🎭 **الأدوار:** ${roles}`;
            }
        }
    }
    
    embed.addFields({
        name: '📈 معلومات الحساب',
        value: accountInfo,
        inline: false
    });

    // إضافة البانر إذا كان متوفراً
    if (user.bannerURL()) {
        embed.setImage(user.bannerURL({ dynamic: true, size: 1024 }));
    }

    return embed;
}

// كوماند /profile
const profileCommand = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('عرض ملف المستخدم الشخصي على Discord')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('المستخدم المراد عرض ملفه (اتركه فارغاً لعرض ملفك)')
                .setRequired(false)
        ),
    
    async execute(interaction) {
        await interaction.deferReply();
        
        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const guild = interaction.guild;
            
            const profileEmbed = await createProfileEmbed(targetUser, guild);
            
            // إضافة أزرار تفاعلية
            const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
            
            const buttons = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setStyle(ButtonStyle.Link)
                        .setLabel('فتح في Discord')
                        .setURL(`https://discord.com/users/${targetUser.id}`)
                        .setEmoji('🔗'),
                    new ButtonBuilder()
                        .setCustomId('refresh_profile')
                        .setLabel('تحديث')
                        .setStyle(ButtonStyle.Secondary)
                        .setEmoji('🔄'),
                    new ButtonBuilder()
                        .setStyle(ButtonStyle.Link)
                        .setLabel('OAuth2 Service')
                        .setURL('https://bot-c43g.onrender.com/login')
                        .setEmoji('🤖')
                );

            await interaction.editReply({ 
                embeds: [profileEmbed], 
                components: [buttons] 
            });
            
        } catch (error) {
            console.error('Profile command error:', error);
            await interaction.editReply({
                content: '❌ حدث خطأ أثناء جلب بيانات الملف الشخصي.',
                ephemeral: true
            });
        }
    }
};

// كوماند /status للحصول على الحالة فقط
const statusCommand = {
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('عرض حالة المستخدم الحالية')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('المستخدم المراد فحص حالته')
                .setRequired(false)
        ),
    
    async execute(interaction) {
        await interaction.deferReply();
        
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const lanyardData = await getLanyardData(targetUser.id);
        
        if (!lanyardData) {
            return await interaction.editReply({
                content: `❌ لا يمكن الحصول على بيانات الحالة لـ ${targetUser.displayName}. تأكد من أن المستخدم مسجل في Lanyard API.`,
                ephemeral: true
            });
        }

        const statusEmojis = {
            online: '🟢 متصل',
            idle: '🟡 خامل', 
            dnd: '🔴 مشغول',
            offline: '⚫ غير متصل'
        };

        const currentStatus = lanyardData.discord_status;
        const statusText = statusEmojis[currentStatus] || '❓ غير معروف';

        const embed = new EmbedBuilder()
            .setColor(currentStatus === 'online' ? '#43B581' : '#747F8D')
            .setTitle(`📊 حالة ${targetUser.displayName}`)
            .setDescription(`**الحالة الحالية:** ${statusText}`)
            .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
            .setTimestamp();

        // إضافة معلومات الأنشطة إذا كانت متوفرة
        if (lanyardData.activities && lanyardData.activities.length > 0) {
            const activity = lanyardData.activities[0];
            const activityTypes = {
                0: { icon: '🎮', text: 'يلعب' },
                1: { icon: '📺', text: 'يبث' },
                2: { icon: '🎵', text: 'يستمع' },
                4: { icon: '💭', text: 'حالة مخصصة' }
            };
            
            const actType = activityTypes[activity.type] || { icon: '✨', text: 'نشاط' };
            embed.addFields({
                name: '🎯 النشاط الحالي',
                value: `${actType.icon} **${actType.text}:** ${activity.name || 'غير معروف'}`,
                inline: false
            });
        }

        await interaction.editReply({ embeds: [embed] });
    }
};

// معالج الأحداث للأزرار
client.on('interactionCreate', async interaction => {
    if (interaction.isCommand()) {
        const command = interaction.commandName;
        
        if (command === 'profile') {
            await profileCommand.execute(interaction);
        } else if (command === 'status') {
            await statusCommand.execute(interaction);
        }
    } else if (interaction.isButton()) {
        if (interaction.customId === 'refresh_profile') {
            await interaction.deferUpdate();
            
            const embed = interaction.message.embeds[0];
            const userId = embed.footer?.text?.match(/\d+/)?.[0];
            
            if (userId) {
                const user = await client.users.fetch(userId).catch(() => null);
                if (user) {
                    const newEmbed = await createProfileEmbed(user, interaction.guild);
                    await interaction.editReply({ embeds: [newEmbed] });
                }
            }
        }
    }
});

// تسجيل الكوماندات عند تشغيل البوت
client.once('ready', async () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
    console.log(`🤖 Bot ID: ${client.user.id}`);
    console.log(`📊 Servers: ${client.guilds.cache.size}`);
    
    // تسجيل الكوماندات العامة
    try {
        const { REST, Routes } = require('discord.js');
        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
        
        const commands = [
            profileCommand.data.toJSON(),
            statusCommand.data.toJSON()
        ];
        
        console.log('🔄 Started refreshing application commands...');
        
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        
        console.log('✅ Successfully reloaded application commands');
        
        // إضافة كوماندات إضافية للخادم المحدد (اختياري)
        const testGuildId = process.env.TEST_GUILD_ID;
        if (testGuildId) {
            await rest.put(
                Routes.applicationGuildCommands(CLIENT_ID, testGuildId),
                { body: commands }
            );
            console.log('✅ Guild commands registered');
        }
        
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
});

// كوماند نصي بديل
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    
    const prefix = '!';
    if (!message.content.startsWith(prefix)) return;
    
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    
    if (command === 'profile' || command === 'بروفايل') {
        const targetUser = message.mentions.users.first() || message.author;
        
        try {
            const embed = await createProfileEmbed(targetUser, message.guild);
            await message.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Profile command error:', error);
            await message.reply('❌ حدث خطأ أثناء جلب بيانات الملف الشخصي.');
        }
    }
    
    if (command === 'status' || command === 'حالة') {
        const targetUser = message.mentions.users.first() || message.author;
        const lanyardData = await getLanyardData(targetUser.id);
        
        if (!lanyardData) {
            return await message.reply(`❌ لا يمكن الحصول على حالة ${targetUser.displayName}.`);
        }
        
        const statusEmojis = {
            online: '🟢 متصل',
            idle: '🟡 خامل',
            dnd: '🔴 مشغول',
            offline: '⚫ غير متصل'
        };
        
        const statusText = statusEmojis[lanyardData.discord_status] || '❓ غير معروف';
        await message.reply(`**${targetUser.displayName}** الحالة: ${statusText}`);
    }
    
    if (command === 'help' || command === 'مساعدة') {
        const helpEmbed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('📚 أوامر البوت')
            .setDescription('قائمة بجميع الأوامر المتاحة')
            .addFields(
                {
                    name: '🔹 أوامر Slash Commands',
                    value: '`/profile [user]` - عرض ملف المستخدم الشامل\n`/status [user]` - فحص حالة المستخدم',
                    inline: false
                },
                {
                    name: '🔹 أوامر نصية',
                    value: '`!profile [@user]` - عرض الملف الشخصي\n`!status [@user]` - فحص الحالة\n`!help` - عرض هذه المساعدة',
                    inline: false
                },
                {
                    name: '🔗 خدمات إضافية',
                    value: '[OAuth2 Service](https://bot-c43g.onrender.com) - خدمة المصادقة المتقدمة',
                    inline: false
                }
            )
            .setFooter({ text: 'Discord Profile Bot by Zaki' });
            
        await message.reply({ embeds: [helpEmbed] });
    }
});

// معالجة الأخطاء
client.on('error', error => {
    console.error('❌ Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('❌ Uncaught exception:', error);
    process.exit(1);
});

// تسجيل الدخول
client.login(BOT_TOKEN);
