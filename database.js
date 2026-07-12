/**
 * ============================================================
 *  Frequency 2004 Social — Database Module
 * ============================================================
 *
 * Provides the SQLite database layer using better-sqlite3.
 *
 * Exports:
 *   • db          – the raw better-sqlite3 Database instance
 *   • initialize() – creates all 13 tables and seeds developer environment data
 *
 * Tables:
 *   users · friendships · top_friends · scraps · testimonials
 *   ratings · communities · community_members · community_posts
 *   community_replies · shoutbox_messages · direct_messages · slambook_responses
 * ============================================================
 */

const path    = require('path');
const fs      = require('fs');
const Database = require('better-sqlite3');
const bcrypt  = require('bcryptjs');

// ─── Open (or create) the SQLite database ────────────────
let DB_PATH = process.env.DATABASE_URL || path.join(__dirname, 'retrosocial.db');

// Ensure parent directory exists (e.g. /data on Render)
try {
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
} catch (err) {
  console.warn(`[database] Warn: Could not create directory for database: ${err.message}. Falling back to local database.`);
  DB_PATH = path.join(__dirname, 'retrosocial.db');
}

const db = new Database(DB_PATH);

// Turn on WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
// Enforce foreign keys
db.pragma('foreign_keys = ON');

// ══════════════════════════════════════════════════════════
//  TABLE DEFINITIONS
// ══════════════════════════════════════════════════════════

/**
 * Create all 13 tables if they don't already exist.
 */
function createTables() {
  const createSQL = `
    -- ─────────────────────── USERS ───────────────────────
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      headline TEXT DEFAULT '~*~ Welcome to my profile ~*~',
      bio TEXT DEFAULT '',
      who_id_like_to_meet TEXT DEFAULT '',
      interests_general TEXT DEFAULT '',
      interests_music TEXT DEFAULT '',
      interests_movies TEXT DEFAULT '',
      interests_tv TEXT DEFAULT '',
      interests_books TEXT DEFAULT '',
      interests_heroes TEXT DEFAULT '',
      mood TEXT DEFAULT 'Happy',
      location TEXT DEFAULT '',
      gender TEXT DEFAULT '',
      age INTEGER,
      avatar_url TEXT DEFAULT '/images/avatars/default.png',
      profile_song TEXT DEFAULT '',
      custom_css TEXT DEFAULT '',
      profile_views INTEGER DEFAULT 0,
      profile_id INTEGER UNIQUE,
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ─────────────────── FRIENDSHIPS ─────────────────────
    CREATE TABLE IF NOT EXISTS friendships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id INTEGER NOT NULL REFERENCES users(id),
      addressee_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(requester_id, addressee_id)
    );

    -- ─────────────────── TOP FRIENDS ─────────────────────
    CREATE TABLE IF NOT EXISTS top_friends (
      user_id INTEGER NOT NULL REFERENCES users(id),
      friend_id INTEGER NOT NULL REFERENCES users(id),
      position INTEGER NOT NULL CHECK(position BETWEEN 1 AND 8),
      PRIMARY KEY(user_id, position)
    );

    -- ──────────────────── SCRAPS ─────────────────────────
    CREATE TABLE IF NOT EXISTS scraps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL REFERENCES users(id),
      recipient_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ────────────────── TESTIMONIALS ─────────────────────
    CREATE TABLE IF NOT EXISTS testimonials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL REFERENCES users(id),
      recipient_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      approved INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ──────────────────── RATINGS ────────────────────────
    CREATE TABLE IF NOT EXISTS ratings (
      rater_id INTEGER NOT NULL REFERENCES users(id),
      rated_id INTEGER NOT NULL REFERENCES users(id),
      trustworthy INTEGER DEFAULT 0 CHECK(trustworthy BETWEEN 0 AND 3),
      cool INTEGER DEFAULT 0 CHECK(cool BETWEEN 0 AND 3),
      sexy INTEGER DEFAULT 0 CHECK(sexy BETWEEN 0 AND 3),
      is_fan INTEGER DEFAULT 0,
      is_crush INTEGER DEFAULT 0,
      PRIMARY KEY(rater_id, rated_id)
    );

    -- ─────────────────── COMMUNITIES ─────────────────────
    CREATE TABLE IF NOT EXISTS communities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      owner_id INTEGER NOT NULL REFERENCES users(id),
      avatar_url TEXT DEFAULT '/images/avatars/community_default.png',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ────────────── COMMUNITY MEMBERS ────────────────────
    CREATE TABLE IF NOT EXISTS community_members (
      community_id INTEGER NOT NULL REFERENCES communities(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      role TEXT DEFAULT 'member' CHECK(role IN ('owner','moderator','member')),
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(community_id, user_id)
    );

    -- ─────────────── COMMUNITY POSTS ─────────────────────
    CREATE TABLE IF NOT EXISTS community_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      community_id INTEGER NOT NULL REFERENCES communities(id),
      author_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ────────────── COMMUNITY REPLIES ────────────────────
    CREATE TABLE IF NOT EXISTS community_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES community_posts(id),
      author_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ────────────── SHOUTBOX MESSAGES ────────────────────
    CREATE TABLE IF NOT EXISTS shoutbox_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- ────────────── DIRECT MESSAGES ──────────────────────
    CREATE TABLE IF NOT EXISTS direct_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL REFERENCES users(id),
      recipient_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_read INTEGER DEFAULT 0
    );

    -- ────────────── SLAMBOOK RESPONSES ───────────────────
    CREATE TABLE IF NOT EXISTS slambook_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      author_id INTEGER NOT NULL REFERENCES users(id),
      crush TEXT DEFAULT '',
      first_impression TEXT DEFAULT '',
      best_memory TEXT DEFAULT '',
      describe_me TEXT DEFAULT '',
      advice TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, author_id)
    );
  `;

  db.exec(createSQL);
}

// ══════════════════════════════════════════════════════════
//  SEED DATA
// ══════════════════════════════════════════════════════════

/**
 * Populates the database with developer environment data.
 */
function seedData() {
  console.log('[database] Seeding developer environment data...');

  const hash = bcrypt.hashSync('password123', 10);

  // ─── 1. Developer User (Ansh Mishra) ───────────────────
  const insertUser = db.prepare(`
    INSERT INTO users
      (username, email, password_hash, display_name, headline, bio,
       mood, location, gender, age, custom_css, interests_music,
       interests_movies, interests_general, interests_heroes, profile_views, avatar_url, profile_id)
    VALUES
      (@username, @email, @hash, @display_name, @headline, @bio,
       @mood, @location, @gender, @age, @custom_css, @interests_music,
       @interests_movies, @interests_general, @interests_heroes, @profile_views, @avatar_url, @profile_id)
  `);

  const devUser = {
    username: 'anshmishra',
    email: 'anshmishra@example.com',
    hash,
    display_name: 'Ansh Mishra',
    headline: 'Creator of Frequency 2004',
    bio: 'Hi, I am Ansh Mishra, the creator and developer of Frequency 2004. Welcome to my profile! Feel free to add me as a friend, sign my slam book, or send me a scrap!',
    mood: 'Coding...',
    location: 'Delhi, India',
    gender: 'Male',
    age: 20,
    custom_css: '/* Developer stylesheet */\nbody { background: #f4f6f9; }',
    interests_music: 'Classic Bollywood, Euphoria, Strings, Lucky Ali',
    interests_movies: 'Dil Chahta Hai, Kal Ho Naa Ho, Swades',
    interests_general: 'Coding, Retro Design, Music, Cybercafes',
    interests_heroes: 'Steve Jobs, Linus Torvalds',
    profile_views: 1337,
    avatar_url: '/images/avatars/pixel1.png',
    profile_id: 1001
  };

  insertUser.run(devUser);
  console.log('[database]   ✔ Developer profile (Ansh Mishra) created');

  // ─── 2. Communities ────────────────────────────────────
  const insertCommunity = db.prepare(`
    INSERT INTO communities (name, description, category, owner_id, avatar_url)
    VALUES (?, ?, ?, ?, ?)
  `);

  const communities = [
    ['Bollywood Music Lovers', 'For those who live and breathe Bollywood music! Share your fav songs, discuss latest albums, and relive the golden era.', 'Music', 1, '/images/avatars/comm_pixel1.png'],
    ['School Days Nostalgia', 'Remember the good old school days? Tiffin sharing, PT periods, annual day, and bunking classes. Share your memories!', 'Nostalgia', 1, '/images/avatars/comm_pixel2.png'],
    ['Dial-Up Survivors Club', 'If you have ever been disconnected because someone picked up the phone, this community is for you.', 'Technology', 1, '/images/avatars/comm_pixel3.png'],
    ['Nokia 3310 Appreciation Society', 'The phone that refused to die. Share your Snake scores and ringtones!', 'Fun & Games', 1, '/images/avatars/comm_pixel4.png'],
    ['Retro Games Forever', 'Mario, Contra, Dave, Road Rash, NFS II SE... if these names give you goosebumps, join us!', 'Fun & Games', 1, '/images/avatars/comm_pixel5.png'],
    ['Frequency 2004 FM Listeners', 'Official community for Frequency 2004 FM radio listeners. Request songs, discuss shows, and share the love for radio!', 'Music', 1, '/images/avatars/comm_pixel1.png'],
  ];

  const insertMember = db.prepare(`
    INSERT INTO community_members (community_id, user_id, role)
    VALUES (?, ?, 'owner')
  `);

  const insertPost = db.prepare(`
    INSERT INTO community_posts (community_id, author_id, title, content)
    VALUES (?, 1, ?, ?)
  `);

  db.transaction(() => {
    let cid = 1;
    for (const [name, desc, cat, owner, avatar] of communities) {
      insertCommunity.run(name, desc, cat, owner, avatar);
      insertMember.run(cid, 1);
      
      // Add a default welcome post in each group
      insertPost.run(cid, `Welcome to ${name}!`, `Welcome to the ${name} community! Feel free to start a thread, introduce yourself, or reply to existing discussions.`);
      cid++;
    }
  })();
  console.log('[database]   ✔ 6 communities created and default welcome posts added');
  console.log('[database] ✅ Developer environment database ready!');
}

// ══════════════════════════════════════════════════════════
//  INITIALIZE
// ══════════════════════════════════════════════════════════

/**
 * Master initialization routine.
 * 1. Creates all tables (idempotent via IF NOT EXISTS).
 * 2. Seeds developer data if the users table is empty.
 */
function initialize() {
  try {
    // Check if the database has the old seeding (e.g. CoOl_DuDe99 exists)
    let needsReset = false;
    try {
      const oldCheck = db.prepare("SELECT id FROM users WHERE username = 'CoOl_DuDe99'").get();
      if (oldCheck) {
        needsReset = true;
      }
    } catch (e) {
      // Table or column might not exist yet, that's fine
    }

    if (needsReset) {
      console.log('[database] Resetting database to clean developer mode...');
      db.pragma('foreign_keys = OFF');
      const tables = [
        'users', 'friendships', 'top_friends', 'scraps', 'testimonials', 
        'ratings', 'communities', 'community_members', 'community_posts', 
        'community_replies', 'shoutbox_messages', 'direct_messages', 'slambook_responses'
      ];
      for (const t of tables) {
        db.exec(`DROP TABLE IF EXISTS ${t}`);
      }
      db.pragma('foreign_keys = ON');
    }

    createTables();
    console.log('[database] All 13 tables ready ✔');

    // Run migration checks (add profile_id if missing)
    try {
      db.prepare('SELECT profile_id FROM users LIMIT 1').get();
    } catch (e) {
      console.log('[database] Migration: Adding profile_id column to users table...');
      try {
        db.exec('ALTER TABLE users ADD COLUMN profile_id INTEGER');
        
        // Seed profile_id for existing users
        const users = db.prepare('SELECT id FROM users').all();
        let initialId = 1000;
        const updateStmt = db.prepare('UPDATE users SET profile_id = ? WHERE id = ?');
        const runUpdate = db.transaction(() => {
          for (const u of users) {
            initialId++;
            updateStmt.run(initialId, u.id);
          }
        });
        runUpdate();

        // Add a unique index to profile_id to enforce uniqueness
        db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_profile_id ON users(profile_id)');
        console.log('[database] Migration: Successfully seeded profile_id for existing users!');
      } catch (migrationErr) {
        console.error('[database] Migration failed:', migrationErr.message);
      }
    }

    // Only seed if the database is empty
    const row = db.prepare('SELECT COUNT(*) AS count FROM users').get();
    if (row.count === 0) {
      seedData();
    } else {
      console.log(`[database] Database already has ${row.count} users — skipping seed.`);
    }
  } catch (err) {
    console.error('[database] FATAL — initialization failed:', err.message);
    throw err;
  }
}

// ──────────────────────────────────────────────────────────
//  Exports
// ──────────────────────────────────────────────────────────
module.exports = {
  db,           // raw better-sqlite3 Database instance
  initialize,   // call once at startup
};
