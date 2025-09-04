const express = require("express");
const fetch = require("node-fetch");
const app = express();

console.log("Starting Discord OAuth2 Server...");

// Environment variables validation
const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const redirect_uri = process.env.REDIRECT_URI;

console.log("Environment variables check:");
console.log("CLIENT_ID:", client_id ? "✅ Set" : "❌ Missing");
console.log("CLIENT_SECRET:", client_secret ? "✅ Set" : "❌ Missing");
console.log("REDIRECT_URI:", redirect_uri ? "✅ Set" : "❌ Missing");

if (!client_id || !client_secret || !redirect_uri) {
  console.error("❌ Missing required environment variables");
  process.exit(1);
}

app.use(express.json());

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Discord OAuth2 Bot</title>
        <style>
            body { font-family: Arial, sans-serif; text-align: center; background: #2C2F33; color: white; padding: 50px; }
            .container { max-width: 500px; margin: 0 auto; }
            .btn { background: #5865F2; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; }
            .btn:hover { background: #4752C4; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>🤖 Discord OAuth2 Bot</h1>
            <p>مرحباً بك في خدمة المصادقة عبر Discord</p>
            <a href="/login" class="btn">تسجيل الدخول مع Discord</a>
        </div>
    </body>
    </html>
  `);
});

app.get("/login", (req, res) => {
  console.log("Login request received");
  const url = `https://discord.com/api/oauth2/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&scope=identify%20guilds`;
  console.log("Redirecting to:", url);
  res.redirect(url);
});

app.get("/callback", async (req, res) => {
  console.log("Callback received");
  
  try {
    const code = req.query.code;
    const error = req.query.error;
    
    if (error) {
      console.error("Discord OAuth error:", error);
      return res.send(`
        <h1>خطأ في المصادقة</h1>
        <p>تم رفض المصادقة من Discord: ${error}</p>
        <a href="/login">إعادة المحاولة</a>
      `);
    }
    
    if (!code) {
      console.error("No authorization code received");
      return res.send(`
        <h1>كود المصادقة مفقود</h1>
        <p>لم يتم العثور على كود المصادقة.</p>
        <a href="/login">تسجيل الدخول مرة أخرى</a>
      `);
    }

    console.log("✅ Authorization code received");

    // تبادل الكود للحصول على التوكن
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
      throw new Error("Failed to exchange code for token");
    }

    const tokenData = await tokenResponse.json();
    console.log("✅ Token data received");

    if (!tokenData.access_token) {
      console.error("No access token in response:", tokenData);
      throw new Error("No access token received");
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
      throw new Error("Failed to fetch user data");
    }

    const userData = await userResponse.json();
    console.log("✅ User data received for:", userData.username);

    // الحصول على بيانات الخوادم (اختياري)
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
        console.log(`✅ Found ${guildData.length} guilds`);
      }
    } catch (guildError) {
      console.warn("Could not fetch guild data:", guildError.message);
    }

    // محاولة الحصول على بيانات Lanyard
    let status = "online";
    let activities = [];
    let lanyardWorking = false;
    
    try {
      const lanyardResponse = await fetch(`https://api.lanyard.rest/v1/users/${userData.id}`, {
        timeout: 5000
      });
      
      if (lanyardResponse.ok) {
        const lanyardData = await lanyardResponse.json();
        if (lanyardData.success && lanyardData.data) {
          lanyardWorking = true;
          status = lanyardData.data.discord_status || "online";
          activities = lanyardData.data.activities || [];
          console.log(`✅ Lanyard data received - Status: ${status}, Activities: ${activities.length}`);
          
          // إضافة Spotify
          if (lanyardData.data.spotify) {
            const spotify = lanyardData.data.spotify;
            activities.unshift({
              type: 2,
              name: "Spotify",
              details: spotify.song,
              state: `by ${spotify.artist}`
            });
          }
        }
      }
    } catch (lanyardError) {
      console.warn("Lanyard API error:", lanyardError.message);
    }

    // إعداد الصورة الشخصية
    const avatarUrl = userData.avatar 
      ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png?size=256`
      : `https://cdn.discordapp.com/embed/avatars/${(userData.discriminator || 0) % 5}.png`;

    // إعداد البانر
    const bannerUrl = userData.banner 
      ? `https://cdn.discordapp.com/banners/${userData.id}/${userData.banner}.png?size=1024` 
      : null;

    // معالجة الشارات
    const flags = userData.public_flags || 0;
    const badges = [];
    
    const badgeMap = {
      1: { name: "Discord Staff", icon: "🛡️", color: "#5865F2" },
      2: { name: "Discord Partner", icon: "🤝", color: "#5865F2" },
      4: { name: "HypeSquad Events", icon: "🎉", color: "#9C84EF" },
      8: { name: "Bug Hunter Level 1", icon: "🐛", color: "#3E8E41" },
      64: { name: "HypeSquad Bravery", icon: "💪", color: "#9C84EF" },
      128: { name: "HypeSquad Brilliance", icon: "🧠", color: "#9C84EF" },
      256: { name: "HypeSquad Balance", icon: "⚖️", color: "#9C84EF" },
      512: { name: "Early Supporter", icon: "💎", color: "#9C84EF" },
      16384: { name: "Bug Hunter Level 2", icon: "🐛", color: "#C9AA71" },
      131072: { name: "Verified Developer", icon: "🤖", color: "#3E8E41" },
      4194304: { name: "Active Developer", icon: "🔨", color: "#3E8E41" }
    };

    // إضافة الشارات المناسبة
    for (const flagValue in badgeMap) {
      if (flags & parseInt(flagValue)) {
        badges.push(badgeMap[flagValue]);
      }
    }

    // فحص Nitro
    if (userData.premium_type) {
      const nitroTypes = {
        1: "Nitro Classic",
        2: "Nitro",
        3: "Nitro Basic"
      };
      badges.push({ 
        name: nitroTypes[userData.premium_type] || "Nitro", 
        icon: "💎", 
        color: "#FF73FA" 
      });
    }

    // تحديد ألوان الحالة
    const statusColors = {
      online: "#43B581",
      idle: "#FAA61A", 
      dnd: "#F04747",
      offline: "#747F8D"
    };

    // إنشاء HTML للشارات
    const badgesHTML = badges.length > 0 
      ? badges.map(badge => `<span style="display: inline-block; margin: 3px; padding: 5px 10px; background: ${badge.color}; color: white; border-radius: 12px; font-size: 11px; font-weight: bold;">${badge.icon} ${badge.name}</span>`).join("")
      : "<span style='color: #999; font-style: italic;'>لا توجد شارات</span>";

    // إنشاء HTML للأنشطة
    let activitiesHTML = "";
    if (activities.length > 0) {
      activitiesHTML = activities.map(activity => {
        const name = activity.name || "Unknown";
        const details = activity.details || "";
        const state = activity.state || "";
        
        const typeStyles = {
          0: { bg: "#5865F2", icon: "🎮", label: "Playing" },
          1: { bg: "#9146FF", icon: "📺", label: "Streaming" },
          2: { bg: "#1DB954", icon: "🎵", label: "Listening to" },
          3: { bg: "#FF6B6B", icon: "📺", label: "Watching" },
          4: { bg: "#36393f", icon: "💭", label: "Custom Status" },
          5: { bg: "#F47FFF", icon: "🏆", label: "Competing in" }
        };
        
        const style = typeStyles[activity.type] || typeStyles[0];
        
        return `
          <div style="margin: 8px 0; padding: 10px; background: ${style.bg}; color: white; border-radius: 6px;">
            ${style.icon} <strong>${style.label}:</strong> ${name}
            ${details ? `<br><small style="opacity: 0.8;">${details}</small>` : ""}
            ${state ? `<br><small style="opacity: 0.8;">${state}</small>` : ""}
          </div>`;
      }).join("");
    } else {
      activitiesHTML = `<div style='color: #999; font-style: italic; padding: 15px; background: #f5f5f5; border-radius: 6px; text-align: center;'>${lanyardWorking ? "لا توجد أنشطة حالياً" : "غير متاح - تحتاج Lanyard للبيانات المباشرة"}</div>`;
    }

    // حساب عمر الحساب
    const createdAt = new Date(((parseInt(userData.id) / 4194304) + 1420070400000));
    const accountAge = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    // إرسال الاستجابة
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Discord Profile - ${userData.username}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: 'Segoe UI', system-ui, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .profile-card {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
            max-width: 500px;
            width: 100%;
          }
          .banner {
            height: 140px;
            background: linear-gradient(45deg, #5865F2, #7289DA);
            position: relative;
          }
          .banner img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .avatar-section {
            position: relative;
            text-align: center;
            margin-top: -70px;
            padding-bottom: 20px;
          }
          .avatar {
            width: 140px;
            height: 140px;
            border-radius: 50%;
            border: 6px solid white;
            background: white;
            box-shadow: 0 8px 16px rgba(0,0,0,0.1);
          }
          .status-dot {
            position: absolute;
            bottom: 25px;
            right: calc(50% - 55px);
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 4px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
          .content {
            padding: 0 30px 30px 30px;
          }
          .username {
            font-size: 28px;
            font-weight: 700;
            color: #2C2F33;
            margin: 15px 0 5px 0;
            text-align: center;
          }
          .user-tag {
            color: #666;
            font-size: 16px;
            text-align: center;
            margin-bottom: 25px;
          }
          .info-section {
            margin: 20px 0;
          }
          .section-title {
            font-weight: 600;
            color: #2C2F33;
            margin-bottom: 10px;
            font-size: 18px;
            border-bottom: 2px solid #5865F2;
            padding-bottom: 5px;
          }
          .status-display {
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 600;
            font-size: 16px;
            text-transform: capitalize;
          }
          .status-indicator {
            width: 16px;
            height: 16px;
            border-radius: 50%;
          }
          .discord-btn {
            display: block;
            background: linear-gradient(45deg, #5865F2, #7289DA);
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 50px;
            margin: 25px auto 0 auto;
            text-align: center;
            font-weight: 600;
            width: fit-content;
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .discord-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 16px rgba(88, 101, 242, 0.3);
          }
        </style>
      </head>
      <body>
        <div class="profile-card">
          <div class="banner">
            ${bannerUrl ? `<img src="${bannerUrl}" alt="Banner">` : ""}
          </div>
          
          <div class="avatar-section">
            <img src="${avatarUrl}" alt="Avatar" class="avatar">
            <div class="status-dot" style="background-color: ${statusColors[status]};"></div>
          </div>
          
          <div class="content">
            <div class="username">${userData.global_name || userData.username}</div>
            <div class="user-tag">@${userData.username} • ${userData.id}</div>
            
            <div class="info-section">
              <div class="section-title">الحالة</div>
              <div class="status-display" style="color: ${statusColors[status]};">
                <div class="status-indicator" style="background-color: ${statusColors[status]};"></div>
                ${status} ${lanyardWorking ? "(مباشر)" : "(افتراضي)"}
              </div>
            </div>

            <div class="info-section">
              <div class="section-title">الأنشطة</div>
              ${activitiesHTML}
            </div>

            <div class="info-section">
              <div class="section-title">الشارات</div>
              <div style="line-height: 2;">${badgesHTML}</div>
            </div>

            <div class="info-section">
              <div class="section-title">معلومات الحساب</div>
              <div style="background: #f8f9fa; padding: 15px; border-radius: 10px; font-size: 14px; line-height: 1.8;">
                <strong>تاريخ الإنشاء:</strong> ${createdAt.toLocaleDateString('ar-EG')}<br>
                <strong>عمر الحساب:</strong> ${accountAge} يوم<br>
                <strong>التحقق:</strong> ${userData.verified ? "✅ مُفعَّل" : "❌ غير مُفعَّل"}<br>
                <strong>المصادقة الثنائية:</strong> ${userData.mfa_enabled ? "🔒 مُفعَّلة" : "🔓 غير مُفعَّلة"}<br>
                <strong>الخوادم:</strong> ${guildData.length} خادم<br>
                <strong>النوع:</strong> ${userData.premium_type ? "Premium User" : "Regular User"}
              </div>
            </div>

            <a href="https://discord.com/users/${userData.id}" target="_blank" class="discord-btn">
              عرض في Discord
            </a>
          </div>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error("❌ Callback error:", error);
    console.error("Error stack:", error.stack);
    
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>خطأ</title>
        <style>
          body { font-family: Arial, sans-serif; background: #f5f5f5; padding: 50px; text-align: center; }
          .error-container { max-width: 500px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          .error-title { color: #ED4245; margin-bottom: 15px; }
          .btn { background: #5865F2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px; display: inline-block; }
        </style>
      </head>
      <body>
        <div class="error-container">
          <h1 class="error-title">خطأ في الخدمة</h1>
          <p>حدث خطأ أثناء معالجة طلبك.</p>
          <p style="font-size: 12px; color: #666; margin: 15px 0;">${error.message}</p>
          <a href="/login" class="btn">إعادة المحاولة</a>
        </div>
      </body>
      </html>
    `);
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).send(`
    <h1>404 - الصفحة غير موجودة</h1>
    <p>الصفحة المطلوبة غير موجودة.</p>
    <a href="/">العودة للصفحة الرئيسية</a>
  `);
});

// Error handler
app.use((error, req, res, next) => {
  console.error("❌ Unhandled error:", error);
  res.status(500).json({ error: "Internal server error" });
});

// إعداد المنفذ
const PORT = process.env.PORT || 3000;

// معالجة إيقاف الخدمة
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received - shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received - shutting down gracefully');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// بدء الخادم
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Discord OAuth2 Server started successfully`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: /health`);
  console.log(`✅ Ready to accept connections`);
});
