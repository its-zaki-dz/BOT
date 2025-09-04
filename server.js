const express = require("express");
const fetch = require("node-fetch");
const app = express();

// Environment variables validation
const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const redirect_uri = process.env.REDIRECT_URI;

if (!client_id || !client_secret || !redirect_uri) {
  console.error("Missing required environment variables: CLIENT_ID, CLIENT_SECRET, or REDIRECT_URI");
  process.exit(1);
}

app.use(express.json());

app.get("/", (req, res) => {
  res.send(`
    <h1>Discord OAuth2 Bot</h1>
    <p>مرحباً بك في خدمة المصادقة عبر Discord.</p>
    <a href="/login" style="background: #5865F2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">تسجيل الدخول مع Discord</a>
  `);
});

app.get("/login", (req, res) => {
  const url = `https://discord.com/api/oauth2/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&scope=identify%20guilds`;
  res.redirect(url);
});

app.get("/callback", async (req, res) => {
  try {
    const code = req.query.code;
    const error = req.query.error;
    
    // التحقق من وجود خطأ في المصادقة
    if (error) {
      console.error("Discord OAuth error:", error);
      return res.send(`
        <h1>خطأ في المصادقة</h1>
        <p>تم رفض المصادقة من Discord: ${error}</p>
        <a href="/login" style="background: #5865F2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">إعادة المحاولة</a>
      `);
    }
    
    if (!code) {
      return res.send(`
        <h1>كود المصادقة مفقود</h1>
        <p>لم يتم العثور على كود المصادقة. يرجى البدء من صفحة تسجيل الدخول.</p>
        <a href="/login" style="background: #5865F2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">تسجيل الدخول مرة أخرى</a>
      `);
    }

    console.log("Received authorization code");

    // الحصول على التوكن
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { 
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      },
      body: new URLSearchParams({
        client_id,
        client_secret,
        grant_type: "authorization_code",
        code,
        redirect_uri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      return res.status(500).send("Failed to exchange authorization code for token.");
    }

    const tokenData = await tokenResponse.json();
    console.log("Token data received");

    if (!tokenData.access_token) {
      console.error("No access token received:", tokenData);
      return res.status(500).send("No access token received from Discord.");
    }

    // الحصول على بيانات المستخدم
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { 
        Authorization: `${tokenData.token_type} ${tokenData.access_token}`,
        "Accept": "application/json"
      },
    });

    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      console.error("User data fetch failed:", errorText);
      return res.status(500).send("Failed to fetch user data from Discord.");
    }

    const userData = await userResponse.json();
    console.log("User data received for:", userData.username);

    // الحصول على بيانات الخوادم للمستخدم
    let guildData = [];
    try {
      const guildsResponse = await fetch("https://discord.com/api/users/@me/guilds", {
        headers: { 
          Authorization: `${tokenData.token_type} ${tokenData.access_token}`,
          "Accept": "application/json"
        },
      });
      if (guildsResponse.ok) {
        guildData = await guildsResponse.json();
      }
    } catch (guildError) {
      console.warn("Could not fetch guild data");
    }

    // محاولة استخدام Lanyard API مع تحسينات
    let status = "online";
    let activities = [];
    let isLanyardActive = false;
    
    try {
      const lanyardResponse = await fetch(`https://api.lanyard.rest/v1/users/${userData.id}`);
      if (lanyardResponse.ok) {
        const lanyardData = await lanyardResponse.json();
        if (lanyardData.success && lanyardData.data) {
          isLanyardActive = true;
          status = lanyardData.data.discord_status || "online";
          activities = lanyardData.data.activities || [];
          
          // إضافة معلومات Spotify إذا كانت متوفرة
          if (lanyardData.data.spotify) {
            const spotify = lanyardData.data.spotify;
            activities.unshift({
              type: 2,
              name: "Spotify",
              details: spotify.song,
              state: `by ${spotify.artist}`,
              large_image: spotify.album_art_url
            });
          }
        }
      }
    } catch (lanyardError) {
      console.warn("Lanyard API unavailable, using default status");
    }

    // إنشاء رابط الصورة الشخصية
    const avatarUrl = userData.avatar 
      ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.${userData.avatar.startsWith('a_') ? 'gif' : 'png'}?size=256`
      : `https://cdn.discordapp.com/embed/avatars/${userData.discriminator % 5}.png`;

    // إنشاء رابط الـ Banner
    const banner = userData.banner 
      ? `https://cdn.discordapp.com/banners/${userData.id}/${userData.banner}.${userData.banner.startsWith('a_') ? 'gif' : 'png'}?size=1024` 
      : "";

    // معالجة الـ Badges (public_flags) بشكل موسع
    const flags = userData.public_flags || 0;
    const badges = [];
    
    // قائمة شاملة بجميع الـ Discord badges
    const badgeMapping = {
      1: { name: "Discord Staff", icon: "🛡️", color: "#5865F2" },
      2: { name: "Discord Partner", icon: "🤝", color: "#5865F2" },
      4: { name: "HypeSquad Events", icon: "🎉", color: "#9C84EF" },
      8: { name: "Bug Hunter Level 1", icon: "🐛", color: "#3E8E41" },
      16: { name: "HypeSquad Bravery", icon: "💪", color: "#9C84EF" },
      32: { name: "HypeSquad Brilliance", icon: "🧠", color: "#9C84EF" },
      64: { name: "HypeSquad Balance", icon: "⚖️", color: "#9C84EF" },
      128: { name: "Early Supporter", icon: "💎", color: "#9C84EF" },
      256: { name: "Team User", icon: "👥", color: "#5865F2" },
      512: { name: "System", icon: "🤖", color: "#5865F2" },
      1024: { name: "Bug Hunter Level 2", icon: "🐛", color: "#C9AA71" },
      4096: { name: "Verified Bot", icon: "✅", color: "#3E8E41" },
      8192: { name: "Verified Developer", icon: "🤖", color: "#3E8E41" },
      16384: { name: "Certified Moderator", icon: "⚡", color: "#5865F2" },
      65536: { name: "Bot HTTP Interactions", icon: "🔗", color: "#5865F2" },
      131072: { name: "Spammer", icon: "⚠️", color: "#ED4245" },
      4194304: { name: "Active Developer", icon: "🔨", color: "#3E8E41" },
      17592186044416: { name: "Nitro", icon: "💎", color: "#FF73FA" }
    };

    // إضافة badges بناءً على الـ flags
    for (const flag in badgeMapping) {
      if (flags & parseInt(flag)) {
        badges.push(badgeMapping[flag]);
      }
    }

    // فحص إضافي للـ Nitro (Premium Type)
    if (userData.premium_type === 1) {
      badges.push({ name: "Nitro Classic", icon: "💎", color: "#FF73FA" });
    } else if (userData.premium_type === 2) {
      badges.push({ name: "Nitro", icon: "💎", color: "#FF73FA" });
    } else if (userData.premium_type === 3) {
      badges.push({ name: "Nitro Basic", icon: "💎", color: "#FF73FA" });
    }

    // فحص عضوية الخوادم المميزة (Boosting)
    const boostedGuilds = guildData.filter(guild => guild.features && guild.features.includes('PARTNERED'));
    if (boostedGuilds.length > 0) {
      badges.push({ name: "Server Booster", icon: "🚀", color: "#F47FFF" });
    }

    // إنشاء HTML للـ badges مع ألوان مناسبة
    let badgesHTML = badges.length > 0 
      ? badges.map(badge => `<span style="display: inline-block; margin: 2px 5px; padding: 4px 10px; background: ${badge.color}; color: white; border-radius: 15px; font-size: 12px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">${badge.icon} ${badge.name}</span>`).join("")
      : "<span style='color: #666; font-style: italic;'>لا توجد شارات متاحة</span>";

    // إنشاء HTML للـ activities مع تحسينات
    let activitiesHTML = "";
    if (activities.length > 0) {
      activitiesHTML = activities.map(activity => {
        const activityName = activity.name || "Unknown Activity";
        const activityDetails = activity.details || "";
        const activityState = activity.state || "";
        
        switch (activity.type) {
          case 0: // Playing
            return `
              <div style="margin: 8px 0; padding: 12px; background: linear-gradient(135deg, #5865F2, #7289DA); color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                🎮 <strong>Playing:</strong> ${activityName}
                ${activityDetails ? `<br><small style="opacity: 0.9;">📋 ${activityDetails}</small>` : ""}
                ${activityState ? `<br><small style="opacity: 0.9;">📍 ${activityState}</small>` : ""}
              </div>`;
          case 1: // Streaming
            return `
              <div style="margin: 8px 0; padding: 12px; background: linear-gradient(135deg, #9146FF, #A855F7); color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                📺 <strong>Streaming:</strong> ${activityName}
                ${activityDetails ? `<br><small style="opacity: 0.9;">📋 ${activityDetails}</small>` : ""}
                ${activity.url ? `<br><a href="${activity.url}" target="_blank" style="color: #FFE4E1; text-decoration: underline;">Watch Stream</a>` : ""}
              </div>`;
          case 2: // Listening
            return `
              <div style="margin: 8px 0; padding: 12px; background: linear-gradient(135deg, #1DB954, #1ED760); color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                🎵 <strong>Listening to:</strong> ${activityName}
                ${activityDetails ? `<br><small style="opacity: 0.9;">🎧 ${activityDetails}</small>` : ""}
                ${activityState ? `<br><small style="opacity: 0.9;">👨‍🎤 ${activityState}</small>` : ""}
              </div>`;
          case 3: // Watching
            return `
              <div style="margin: 8px 0; padding: 12px; background: linear-gradient(135deg, #FF6B6B, #FF8E8E); color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                📺 <strong>Watching:</strong> ${activityName}
                ${activityDetails ? `<br><small style="opacity: 0.9;">📋 ${activityDetails}</small>` : ""}
                ${activityState ? `<br><small style="opacity: 0.9;">📍 ${activityState}</small>` : ""}
              </div>`;
          case 4: // Custom Status
            return `
              <div style="margin: 8px 0; padding: 12px; background: linear-gradient(135deg, #36393f, #484B51); color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                💭 <strong>Custom Status:</strong> ${activity.state || activity.name || "Custom status"}
                ${activity.emoji ? `<br><span style="font-size: 16px;">${activity.emoji.name || "😊"}</span>` : ""}
              </div>`;
          case 5: // Competing
            return `
              <div style="margin: 8px 0; padding: 12px; background: linear-gradient(135deg, #F47FFF, #FF6B9D); color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                🏆 <strong>Competing in:</strong> ${activityName}
                ${activityDetails ? `<br><small style="opacity: 0.9;">📋 ${activityDetails}</small>` : ""}
              </div>`;
          default:
            return `
              <div style="margin: 8px 0; padding: 12px; background: linear-gradient(135deg, #99AAB5, #7289DA); color: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                ✨ <strong>Activity:</strong> ${activityName}
                ${activityDetails ? `<br><small style="opacity: 0.9;">${activityDetails}</small>` : ""}
                ${activityState ? `<br><small style="opacity: 0.9;">${activityState}</small>` : ""}
              </div>`;
        }
      }).join("");
    } else {
      activitiesHTML = `
        <div style='color: #666; font-style: italic; padding: 15px; background: #f8f9fa; border-radius: 8px; text-align: center; border: 2px dashed #ddd;'>
          ${isLanyardActive ? "لا توجد أنشطة جارية حالياً" : "غير متاح - قم بالانضمام إلى خادم Lanyard للحصول على البيانات الحية"}
        </div>`;
    }

    // Status color mapping
    const statusColors = {
      online: "#43B581",
      idle: "#FAA61A", 
      dnd: "#F04747",
      offline: "#747F8D"
    };

    // تحديد نص الحالة
    const statusText = isLanyardActive ? `${status} (Live)` : `${status} (Detected)`;

    // إرسال الـ HTML response
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Discord Profile - ${userData.username}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          .profile-card {
            background: white;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            overflow: hidden;
            max-width: 450px;
            width: 100%;
          }
          .banner {
            height: 120px;
            background: linear-gradient(45deg, #5865F2, #7289DA);
            position: relative;
          }
          .banner img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .avatar-container {
            position: relative;
            text-align: center;
            margin-top: -60px;
          }
          .avatar {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            border: 5px solid white;
            background: white;
          }
          .status-indicator {
            position: absolute;
            bottom: 10px;
            right: calc(50% - 45px);
            width: 20px;
            height: 20px;
            border-radius: 50%;
            border: 3px solid white;
            animation: pulse 2s infinite;
          }
          @keyframes pulse {
            0% { box-shadow: 0 0 0 0 rgba(67, 181, 129, 0.7); }
            70% { box-shadow: 0 0 0 10px rgba(67, 181, 129, 0); }
            100% { box-shadow: 0 0 0 0 rgba(67, 181, 129, 0); }
          }
          .content {
            padding: 20px;
            text-align: center;
          }
          .username {
            font-size: 24px;
            font-weight: bold;
            color: #2C2F33;
            margin: 10px 0 5px 0;
          }
          .user-id {
            color: #666;
            font-size: 14px;
            margin-bottom: 20px;
          }
          .section {
            margin: 15px 0;
            text-align: left;
          }
          .section-title {
            font-weight: bold;
            color: #2C2F33;
            margin-bottom: 8px;
            font-size: 16px;
          }
          .discord-link {
            display: inline-block;
            background: #5865F2;
            color: white;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 25px;
            margin-top: 15px;
            transition: all 0.3s;
            font-weight: bold;
          }
          .discord-link:hover {
            background: #4752C4;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
          }
        </style>
      </head>
      <body>
        <div class="profile-card">
          <div class="banner">
            ${banner ? `<img src="${banner}" alt="User Banner">` : ""}
          </div>
          <div class="avatar-container">
            <img src="${avatarUrl}" alt="Avatar" class="avatar">
            <div class="status-indicator" style="background-color: ${statusColors[status]};"></div>
          </div>
          <div class="content">
            <div class="username">${userData.global_name || userData.username}</div>
            <div class="user-id">@${userData.username} • ID: ${userData.id}</div>
            
            <div class="section">
              <div class="section-title">الحالة (Status)</div>
              <div style="color: ${statusColors[status]}; font-weight: bold; text-transform: capitalize; display: flex; align-items: center; gap: 8px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background-color: ${statusColors[status]};"></div>
                ${statusText}
              </div>
            </div>

            <div class="section">
              <div class="section-title">الأنشطة (Activities)</div>
              ${activitiesHTML}
            </div>

            <div class="section">
              <div class="section-title">الشارات والإنجازات (Badges & Achievements)</div>
              <div>${badgesHTML}</div>
              ${userData.premium_type ? `
                <div style="margin-top: 15px; padding: 12px; background: linear-gradient(135deg, #FF73FA, #C77DFF); color: white; border-radius: 8px; font-weight: bold; text-align: center;">
                  💎 Nitro Subscriber (Premium Type ${userData.premium_type})
                </div>
              ` : ""}
              ${userData.avatar && userData.avatar.startsWith('a_') ? `
                <div style="margin-top: 10px; padding: 10px; background: linear-gradient(135deg, #FF6B9D, #F47FFF); color: white; border-radius: 8px; font-weight: bold; text-align: center;">
                  ✨ Animated Avatar
                </div>
              ` : ""}
            </div>

            <div class="section">
              <div class="section-title">معلومات الحساب</div>
              <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; font-size: 14px; line-height: 1.6;">
                <strong>تاريخ الإنشاء:</strong> ${new Date(((parseInt(userData.id) / 4194304) + 1420070400000)).toLocaleDateString('ar-EG')}<br>
                <strong>التحقق:</strong> ${userData.verified ? "✅ مُفعَّل" : "❌ غير مُفعَّل"}<br>
                <strong>المصادقة الثنائية:</strong> ${userData.mfa_enabled ? "🔒 مُفعَّلة" : "🔓 غير مُفعَّلة"}<br>
                <strong>اللغة:</strong> ${userData.locale || "en-US"}<br>
                <strong>عدد الخوادم:</strong> ${guildData.length} خادم<br>
                ${userData.banner ? "<strong>Banner:</strong> ✅ مُخصص<br>" : ""}
              </div>
            </div>

            <a href="https://discord.com/users/${userData.id}" target="_blank" class="discord-link">
              فتح الملف الشخصي في Discord
            </a>
          </div>
        </div>
      </body>
      </html>
    `);

  } catch (err) {
    console.error("Detailed error:", err);
    console.error("Error stack:", err.stack);
    res.status(500).send(`
      <div style="max-width: 500px; margin: 50px auto; padding: 20px; font-family: Arial, sans-serif;">
        <h1 style="color: #ED4245;">خطأ في الحصول على البيانات</h1>
        <p>حدث خطأ أثناء محاولة الحصول على بيانات Discord الخاصة بك.</p>
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; font-family: monospace; font-size: 12px; color: #666;">
          ${err.message || "Unknown error"}
        </div>
        <p>يرجى المحاولة مرة أخرى أو التواصل مع المطور.</p>
        <a href="/login" style="background: #5865F2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">العودة لتسجيل الدخول</a>
      </div>
    `);
  }
});
