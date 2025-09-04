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
    <p>Welcome to Discord OAuth2 authentication service.</p>
    <a href="/login" style="background: #5865F2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Login with Discord</a>
  `);
});

app.get("/login", (req, res) => {
  const url = `https://discord.com/api/oauth2/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&scope=identify`;
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
        <p>تأكد من:</p>
        <ul>
          <li>البدء من صفحة /login</li>
          <li>عدم رفض المصادقة في Discord</li>
          <li>صحة إعدادات التطبيق في Discord Developer Portal</li>
        </ul>
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

    // التحقق من وجود البيانات الأساسية
    if (!userData.id || !userData.username) {
      console.error("Invalid user data received:", userData);
      return res.status(500).send("Invalid user data received from Discord.");
    }

    // استخدام Lanyard API للحصول على الحالة (مع معالجة الأخطاء)
    let status = "offline";
    let activities = [];
    try {
      const lanyardResponse = await fetch(`https://api.lanyard.rest/v1/users/${userData.id}`);
      if (lanyardResponse.ok) {
        const lanyardData = await lanyardResponse.json();
        if (lanyardData.success) {
          status = lanyardData.data.discord_status || "offline";
          activities = lanyardData.data.activities || [];
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

    // معالجة الـ Badges (public_flags)
    const flags = userData.public_flags || 0;
    const badges = [];
    
    const badgeMapping = {
      1: { name: "Discord Staff", icon: "🛡️" },
      2: { name: "Discord Partner", icon: "🤝" },
      4: { name: "HypeSquad Events", icon: "🎉" },
      8: { name: "Bug Hunter Level 1", icon: "🐛" },
      64: { name: "HypeSquad Bravery", icon: "💪" },
      128: { name: "HypeSquad Brilliance", icon: "🧠" },
      256: { name: "HypeSquad Balance", icon: "⚖️" },
      512: { name: "Early Supporter", icon: "💎" },
      16384: { name: "Bug Hunter Level 2", icon: "🐛" },
      131072: { name: "Verified Bot Developer", icon: "🤖" }
    };

    for (const flag in badgeMapping) {
      if (flags & parseInt(flag)) {
        badges.push(badgeMapping[flag]);
      }
    }

    // إنشاء HTML للـ badges
    let badgesHTML = badges.length > 0 
      ? badges.map(badge => `<span style="display: inline-block; margin: 2px 5px; padding: 2px 8px; background: #5865F2; color: white; border-radius: 12px; font-size: 12px;">${badge.icon} ${badge.name}</span>`).join("")
      : "<span style='color: #666;'>No badges</span>";

    // إنشاء HTML للـ activities
    let activitiesHTML = "";
    if (activities.length > 0) {
      activitiesHTML = activities.map(activity => {
        if (activity.type === 0) { // Playing
          return `<div style="margin: 5px 0; padding: 8px; background: #f0f0f0; border-radius: 5px;">🎮 Playing ${activity.name}</div>`;
        } else if (activity.type === 1) { // Streaming
          return `<div style="margin: 5px 0; padding: 8px; background: #9146FF; color: white; border-radius: 5px;">📺 Streaming ${activity.name}</div>`;
        } else if (activity.type === 2) { // Listening
          return `<div style="margin: 5px 0; padding: 8px; background: #1DB954; color: white; border-radius: 5px;">🎵 Listening to ${activity.name}</div>`;
        } else if (activity.type === 3) { // Watching
          return `<div style="margin: 5px 0; padding: 8px; background: #FF6B6B; color: white; border-radius: 5px;">📺 Watching ${activity.name}</div>`;
        } else if (activity.type === 4) { // Custom
          return `<div style="margin: 5px 0; padding: 8px; background: #36393f; color: white; border-radius: 5px;">💭 ${activity.state || activity.name}</div>`;
        }
        return "";
      }).join("");
    } else {
      activitiesHTML = "<div style='color: #666; font-style: italic;'>No current activities</div>";
    }

    // Status color mapping
    const statusColors = {
      online: "#43B581",
      idle: "#FAA61A", 
      dnd: "#F04747",
      offline: "#747F8D"
    };

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
            max-width: 400px;
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
          }
          .discord-link {
            display: inline-block;
            background: #5865F2;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 25px;
            margin-top: 15px;
            transition: background 0.3s;
          }
          .discord-link:hover {
            background: #4752C4;
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
              <div class="section-title">Status</div>
              <div style="color: ${statusColors[status]}; font-weight: bold; text-transform: capitalize;">${status}</div>
            </div>

            <div class="section">
              <div class="section-title">Activities</div>
              ${activitiesHTML}
            </div>

            <div class="section">
              <div class="section-title">Badges</div>
              <div>${badgesHTML}</div>
            </div>

            <a href="https://discord.com/users/${userData.id}" target="_blank" class="discord-link">
              Open Discord Profile
            </a>
          </div>
        </div>
      </body>
      </html>
    `);

  } catch (err) {
    console.error("Detailed error:", err);
    res.status(500).send(`
      <h1>خطأ في الحصول على البيانات</h1>
      <p>حدث خطأ أثناء محاولة الحصول على بيانات Discord الخاصة بك.</p>
      <p>يرجى المحاولة مرة أخرى أو التواصل مع المطور.</p>
      <a href="/login">العودة لتسجيل الدخول</a>
    `);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).send("Internal server error occurred.");
});

// Route not found handler
app.use((req, res) => {
  res.status(404).send("Page not found.");
});

// استخدم PORT من Render أو 3000 كافتراضي
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
