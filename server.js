require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const axios = require('axios');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(session({ secret: 'discord-dashboard', resave: false, saveUninitialized: false }));

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

let settingsDB = {}; // تخزين مؤقت للإعدادات

// 1️⃣ Login مع Discord
app.get('/login', (req, res) => {
  const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
  res.redirect(url);
});

// 2️⃣ Callback بعد تسجيل الدخول
app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send("No code provided");

  const params = new URLSearchParams();
  params.append("client_id", CLIENT_ID);
  params.append("client_secret", CLIENT_SECRET);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", REDIRECT_URI);
  params.append("scope", "identify guilds");

  try {
    const tokenRes = await axios.post('https://discord.com/api/oauth2/token', params, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }});
    const token = tokenRes.data.access_token;

    const userRes = await axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${token}` }});
    const guildsRes = await axios.get('https://discord.com/api/users/@me/guilds', { headers: { Authorization: `Bearer ${token}` }});

    req.session.user = userRes.data;
    req.session.guilds = guildsRes.data;

    res.redirect('/'); // توجه للـ frontend
  } catch (e) {
    console.error(e);
    res.send("Error logging in");
  }
});

// 3️⃣ API بيانات المستخدم
app.get('/api/user', (req, res) => {
  if (!req.session.user) return res.status(401).send({ error: "Not logged in" });
  res.send({
    username: req.session.user.username,
    avatar: `https://cdn.discordapp.com/avatars/${req.session.user.id}/${req.session.user.avatar}.png`
  });
});

// 4️⃣ API السيرفرات
app.get('/api/guilds', (req, res) => {
  if (!req.session.guilds) return res.status(401).send({ error: "Not logged in" });
  res.send(req.session.guilds);
});

// 5️⃣ حفظ إعدادات السيرفر
app.post('/api/save', (req, res) => {
  const data = req.body;
  settingsDB[data.guild_id] = data;

  fs.writeFileSync('settings.json', JSON.stringify(settingsDB, null, 2));
  res.send({ success: true });
});

app.listen(process.env.PORT || 3000, () => console.log('Backend running'));
