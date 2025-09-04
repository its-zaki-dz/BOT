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
  const code = req.query.code;

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

  const userResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `${tokenData.token_type} ${tokenData.access_token}` },
  });

  const userData = await userResponse.json();

  res.send(`
    <h1>Discord Profile</h1>
    <img src="https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png" width="120" style="border-radius: 50%;">
    <h2>${userData.username}#${userData.discriminator}</h2>
    <p>ID: ${userData.id}</p>
  `);
});

app.listen(3000, () => console.log("Server running on port 3000"));
