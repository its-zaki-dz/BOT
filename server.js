const express = require("express");
const fetch = require("node-fetch");
const app = express();

const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const redirect_uri = process.env.REDIRECT_URI;

app.get("/login", (req, res) => {
  const url = `https://discord.com/api/oauth2/authorize?client_id=${client_id}&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&scope=identify`;
  res.redirect(url);
});

app.get("/callback", async (req, res) => {
  try {
    const code = req.query.code;

    // الحصول على التوكن
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id,
        client_secret,
        grant_type: "authorization_code",
        code,
        redirect_uri,
      }),
    });

    const tokenData = await tokenResponse.json();

    // الحصول على بيانات المستخدم
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `${tokenData.token_type} ${tokenData.access_token}` },
    });

    const userData = await userResponse.json();

    // استخدام Lanyard API للحصول على الحالة و الـ Banner
    const lanyardResponse = await fetch(`https://api.lanyard.rest/v1/users/${userData.id}`);
    const lanyardData = await lanyardResponse.json();
    const status = lanyardData.data.discord_status || "offline";

    const banner = userData.banner 
      ? `https://cdn.discordapp.com/banners/${userData.id}/${userData.banner}.png?size=1024` 
      : "";

    // Badges (public_flags)
    const flags = userData.public_flags || 0;
    const badgeIcons = {
      1: "https://cdn.discordapp.com/badges/staff.png",
      2: "https://cdn.discordapp.com/badges/partner.png",
      64: "https://cdn.discordapp.com/badges/bughunter.png"
    };
    let badgesHTML = "";
    for (const flag in badgeIcons) {
      if (flags & flag) {
        badgesHTML += `<img src="${badgeIcons[flag]}" width="30" style="margin:0 2px;">`;
      }
    }

    res.send(`
      <h1>Discord Profile</h1>
      ${banner ? `<img src="${banner}" width="500" style="border-radius:10px;"><br>` : ""}
      <img src="https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png" width="120" style="border-radius:50%;"><br>
      <h2>${userData.username}#${userData.discriminator}</h2>
      <p>Status: ${status}</p>
      <p>Badges: ${badgesHTML}</p>
      <a href="https://discord.com/users/${userData.id}" target="_blank">Open Discord Profile</a>
    `);
  } catch (err) {
    console.error(err);
    res.send("Error fetching Discord profile.");
  }
});

// استخدم PORT من Render أو 3000 كافتراضي
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
