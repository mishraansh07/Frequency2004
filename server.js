/**
 * ============================================================
 *  Frequency 2004 Social — Main Express Server
 * ============================================================
 *
 * A retro social network inspired by the golden age of
 * MySpace, Orkut, Friendster, and Hi5 (circa 2003-2007).
 *
 * Stack: Express · EJS · better-sqlite3 · express-session
 * ============================================================
 */

// ─── Environment ─────────────────────────────────────────
// Load .env variables (PORT, SESSION_SECRET, etc.)
// Using a try/catch so the server still works if dotenv
// isn't installed — the defaults below will kick in.
try {
  require('dotenv').config();
} catch (_) {
  console.log('[server] dotenv not installed — using defaults');
}

const path    = require('path');
const fs      = require('fs');
const express = require('express');
const morgan  = require('morgan');
const session = require('express-session');

// connect-sqlite3 needs the session module passed to it
const SQLiteStore = require('connect-sqlite3')(session);

// ─── Database ────────────────────────────────────────────
const database = require('./database');

// ─── App Initialisation ─────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3000;

// ─── View Engine (EJS) ──────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Logging ─────────────────────────────────────────────
// 'dev' format gives concise coloured output:
//   GET /home 200 12ms
app.use(morgan('dev'));

// ─── Body Parsers ────────────────────────────────────────
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ─── Static Files ────────────────────────────────────────
// Serve CSS, JS, images, etc. from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Specific favicon route
app.get('/favicon.ico', (req, res) => res.redirect('/favicon.png'));
app.get('/favicon.png', (req, res) => res.sendFile(path.join(__dirname, 'public', 'favicon.png')));

// ─── Session Configuration ──────────────────────────────
let sessionDbDir = __dirname;

if (process.env.DATABASE_URL) {
  try {
    const targetDir = path.dirname(process.env.DATABASE_URL);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    sessionDbDir = targetDir;
  } catch (err) {
    console.warn(`[server] Warn: Could not create session folder: ${err.message}. Falling back to local folder.`);
    sessionDbDir = __dirname;
  }
}

// Trust first proxy (Render, Heroku, etc.) so secure cookies work behind HTTPS
app.set('trust proxy', 1);

app.use(session({
  store: new SQLiteStore({
    db:  'sessions.db',         // SQLite file for session persistence
    dir: sessionDbDir,          // Store sessions.db in the resolved persistent directory
  }),
  secret:            process.env.SESSION_SECRET || 'retro-fallback-secret',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    maxAge:   1000 * 60 * 60 * 24 * 7, // 7 days
    httpOnly: true,
    secure:   false,  // Render proxy handles HTTPS; Express sees HTTP
    sameSite: 'lax',
  },
}));

// ─── Database Bootstrap ─────────────────────────────────
// Initialize tables + seed data, then expose the raw
// better-sqlite3 handle to all routes via app.locals.
try {
  database.initialize();
  console.log('[server] Database initialised successfully ✔');
} catch (err) {
  console.error('[server] FATAL — could not initialise database:', err.message);
  process.exit(1);
}

// Attach the raw better-sqlite3 instance so route handlers
// can access it as `req.app.locals.db`
app.locals.db = database;

// Attach song list to app.locals so it is globally available in templates
app.locals.stations = [
    { name: 'Kaho Naa Pyaar Hai', genre: 'Udit Narayan & Alka Yagnik', url: 'https://archive.org/download/kaho-naa-pyaar-hai_202005/Kaho%20Naa%20Pyaar%20Hai.mp3' },
    { name: 'O Sanam', genre: 'Lucky Ali (Classic Pop)', url: 'https://archive.org/download/MainTumhaaraHiRahoon320/Lucky%20Ali%20-%20Sunoh%20(1996)/01%20-%20Lucky%20Ali%20-%20O%20Sanam%20.mp3' },
    { name: 'Ek Pal Ka Jeena', genre: 'Lucky Ali (Kaho Naa Pyaar Hai)', url: 'https://archive.org/download/MainTumhaaraHiRahoon320/LUCKY%20ALI%20AKS/EK%20PAL%20KA%20JEENA.mp3' },
    { name: 'Na Tum Jano Na Hum', genre: 'Lucky Ali (Kaho Naa Pyaar Hai)', url: 'https://archive.org/download/MainTumhaaraHiRahoon320/LUCKY%20ALI%20AKS/NA%20TUM%20JANO%20NA%20HUM.mp3' },
    { name: 'Dil Chahta Hai', genre: 'Shankar Mahadevan', url: 'https://archive.org/download/dil-chahta-hai-2001-movie-songs-hindiganadownload.com/Dil%20Chahta%20Hai/1.%20Dil%20Chahta%20Hai%20-%20hindiganadownload.com.mp3' },
    { name: 'Jaane Kyon Log Pyaar', genre: 'Udit Narayan & Alka Yagnik', url: 'https://archive.org/download/dil-chahta-hai-2001-movie-songs-hindiganadownload.com/Dil%20Chahta%20Hai/2.%20Jaane%20Kyon%20-%20hindiganadownload.com.mp3' },
    { name: 'Woh Ladki Hai Kahan', genre: 'Shaan & Kavita Krishnamurthy', url: 'https://archive.org/download/dil-chahta-hai-2001-movie-songs-hindiganadownload.com/Dil%20Chahta%20Hai/3.%20Woh%20Ladki%20Hai%20Kahan%20-%20hindiganadownload.com.mp3' },
    { name: 'Tanhayee (Sad)', genre: 'Sonu Nigam (Dil Chahta Hai)', url: 'https://archive.org/download/dil-chahta-hai-2001-movie-songs-hindiganadownload.com/Dil%20Chahta%20Hai/7.%20Tanhayee%20-%20hindiganadownload.com.mp3' },
    { name: 'Wada Raha (Khakee)', genre: 'Arnab Chakraborty & Shreya Ghoshal', url: 'https://archive.org/download/khakee-2004-movie-songs-hindiganadownload.com/Khakee/01%20-%20Wada%20Raha.mp3' },
    { name: 'Dil Dooba (Khakee)', genre: 'Sonu Nigam & Shreya Ghoshal', url: 'https://archive.org/download/khakee-2004-movie-songs-hindiganadownload.com/Khakee/04%20-%20Dil%20Dooba.mp3' },
    { name: 'Aisa Jadoo (Khakee)', genre: 'Sunidhi Chauhan', url: 'https://archive.org/download/khakee-2004-movie-songs-hindiganadownload.com/Khakee/02%20-%20Aisa%20Jadoo.mp3' },
    { name: 'Yun Hi Tumse Pyar', genre: 'Sonu Nigam & Shreya Ghoshal', url: 'https://archive.org/download/khakee-2004-movie-songs-hindiganadownload.com/Khakee/03%20-%20Youn%20Hi%20Hum%20Tumse%20Pyar%20Karte%20Rahein.mp3' },
    { name: 'Sunoh (Lucky Ali)', genre: 'Lucky Ali (Classic Pop)', url: 'https://archive.org/download/MainTumhaaraHiRahoon320/Lucky%20Ali%20-%20Sunoh%20(1996)/02%20-%20Lucky%20Ali%20-%20Sunoh.mp3' },
    { name: 'Kabhi Aisa Lagta Hai', genre: 'Lucky Ali (Classic Pop)', url: 'https://archive.org/download/MainTumhaaraHiRahoon320/Lucky%20ALi%20-%20Kabhi%20Aisa%20Lagta%20Hai/kalh1(www.songs.pk).mp3' },
    { name: 'Teri Yaadein Aati Hain', genre: 'Lucky Ali (Classic Pop)', url: 'https://archive.org/download/MainTumhaaraHiRahoon320/Lucky%20ALi%20-%20Kabhi%20Aisa%20Lagta%20Hai/kalh2(www.songs.pk).mp3' }
];

// ─── Auth Middleware ────────────────────────────────────
const { requireAuth, loadUser } = require('./middleware/auth');

// Run loadUser on EVERY request so EJS templates always
// have access to `currentUser` (null when logged out).
app.use(loadUser);

// Make formatDate helper available to all EJS templates
app.use((req, res, next) => {
  res.locals.formatDate = (dateStr, type = 'datetime') => {
    if (!dateStr) return '';
    if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+') && !dateStr.includes('-')) {
      dateStr = dateStr.replace(' ', 'T') + 'Z';
    }
    const d = new Date(dateStr);
    if (type === 'date') {
      return d.toLocaleDateString();
    } else if (type === 'time') {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleString();
  };
  next();
});

// ─── Route Imports ──────────────────────────────────────
const authRoutes        = require('./routes/auth');
const profileRoutes     = require('./routes/profile');
const friendsRoutes     = require('./routes/friends');
const communitiesRoutes = require('./routes/communities');
const musiczonesRoutes  = require('./routes/musiczones');
const scrapbookRoutes   = require('./routes/scrapbook');
const shoutboxRoutes    = require('./routes/shoutbox');
const messagesRoutes    = require('./routes/messages');

// ─── Route Mounting ─────────────────────────────────────

// Auth routes: /login, /register, /logout, /home
app.use('/', authRoutes);

// Profile routes (also handles /search)
app.use('/profile', profileRoutes);
app.use('/search',  profileRoutes);

// Social features
app.use('/friends',     friendsRoutes);
app.use('/communities', communitiesRoutes);
app.use('/community',   communitiesRoutes);
app.use('/musiczones',  musiczonesRoutes);
app.use('/scrapbook',   scrapbookRoutes);
app.use('/shoutbox',    shoutboxRoutes);
app.use('/messages',    messagesRoutes);

// ─── Radio Page ─────────────────────────────────────────
app.get('/radio', (req, res) => {
  try {
    const db = app.locals.db;
    const currentUserId = req.session.userId;
    let friends = [];
    if (currentUserId) {
      friends = db.db.prepare(`
        SELECT u.id, u.username, u.display_name, u.avatar_url
        FROM friendships f
        JOIN users u ON u.id = CASE
            WHEN f.requester_id = ? THEN f.addressee_id
            ELSE f.requester_id
        END
        WHERE f.status = 'accepted'
        AND (f.requester_id = ? OR f.addressee_id = ?)
        ORDER BY u.display_name ASC
      `).all(currentUserId, currentUserId, currentUserId);
    }
    res.render('radio', { title: 'FM Radio & Shoutbox', friends });
  } catch (err) {
    console.error('Radio loading error:', err);
    res.sendFile(path.join(__dirname, 'index.html'));
  }
});

app.post('/radio/invite', (req, res) => {
  try {
    const db = app.locals.db;
    const currentUserId = req.session.userId;
    const { friendId, room } = req.body;
    if (!currentUserId || !friendId || !room) {
      return res.status(400).json({ error: 'Invalid parameters' });
    }

    const inviteLink = `/radio?room=${encodeURIComponent(room)}`;
    const content = `Hey! Come join my Music Listening Party and chat with me! Click here: ${inviteLink}`;

    db.db.prepare(`
        INSERT INTO direct_messages (sender_id, recipient_id, content)
        VALUES (?, ?, ?)
    `).run(currentUserId, parseInt(friendId), content);

    res.json({ success: true });
  } catch (err) {
    console.error('Listening party invite error:', err);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// ─── Root Route ─────────────────────────────────────────
// Redirect based on auth status
app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/home');
  }
  return res.redirect('/login');
});

// ─── 404 Handler ────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('404', {
    title: '404 — Page Not Found',
    message: 'Oops! That page doesn\'t exist on this retro network. 😿',
  });
});

// ─── Start Server ───────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════════════╗
  ║   Frequency 2004 Social is LIVE! 🚀     ║
  ║   http://localhost:${PORT}                         ║
  ║   Press Ctrl+C to stop                           ║
  ╚══════════════════════════════════════════════════╝
  `);
});

// ─── WebSocket Server for Shoutbox Broadcast ────────────
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('[ws] Client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'join') {
        ws.room = data.room;
        ws.username = data.username;
        ws.displayName = data.displayName;
        console.log(`[ws] User ${ws.username} joined room ${ws.room}`);

        // Broadcast join notice
        broadcastToRoom(ws.room, {
          type: 'user_joined',
          username: ws.username,
          displayName: ws.displayName
        }, ws);
      } else if (data.type === 'chat') {
        broadcastToRoom(ws.room, {
          type: 'room_chat',
          username: ws.username,
          displayName: ws.displayName,
          avatarUrl: data.avatarUrl || '/images/avatars/default.png',
          content: data.content,
          timestamp: new Date().toLocaleTimeString()
        });
      } else if (data.type === 'sync') {
        // Broadcast play state/song change to the room
        broadcastToRoom(ws.room, {
          type: 'sync',
          action: data.action,
          songIndex: data.songIndex,
          currentTime: data.currentTime
        }, ws);
      }
    } catch (err) {
      console.error('[ws] Message handling error:', err);
    }
  });

  ws.on('close', () => {
    console.log('[ws] Client disconnected');
    if (ws.room && ws.username) {
      broadcastToRoom(ws.room, {
        type: 'user_left',
        username: ws.username,
        displayName: ws.displayName
      });
    }
  });
});

function broadcastToRoom(room, payload, excludeWs = null) {
  wss.clients.forEach(client => {
    if (client.room === room && client.readyState === WebSocket.OPEN && client !== excludeWs) {
      client.send(JSON.stringify(payload));
    }
  });
}

// Attach WebSocket Server reference to app locals so routes can broadcast
app.locals.wss = wss;

module.exports = app;
