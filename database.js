/**
 * ============================================================
 *  Frequency 2004 Social — Database Module
 * ============================================================
 *
 * Provides the SQLite database layer using better-sqlite3.
 *
 * Exports:
 *   • db          – the raw better-sqlite3 Database instance
 *   • initialize() – creates all 11 tables and seeds demo data
 *
 * Tables:
 *   users · friendships · top_friends · scraps · testimonials
 *   ratings · communities · community_members · community_posts
 *   community_replies · shoutbox_messages
 * ============================================================
 */

const path    = require('path');
const fs      = require('fs');
const Database = require('better-sqlite3');
const bcrypt  = require('bcryptjs');

// ─── Open (or create) the SQLite database ────────────────
const DB_PATH = process.env.DATABASE_URL || path.join(__dirname, 'retrosocial.db');

// Ensure parent directory exists (e.g. /data on Render)
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
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
 * Create all 11 tables if they don't already exist.
 * Wrapped in a transaction for atomicity.
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
      mood TEXT DEFAULT '😊 Happy',
      location TEXT DEFAULT '',
      gender TEXT DEFAULT '',
      age INTEGER,
      avatar_url TEXT DEFAULT '/images/avatars/default.png',
      profile_song TEXT DEFAULT '',
      custom_css TEXT DEFAULT '',
      profile_views INTEGER DEFAULT 0,
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
 * Populates the database with realistic demo data that
 * brings the retro social network to life.
 */
function seedData() {
  console.log('[database] Seeding demo data …');

  // All demo users share the same password for easy testing
  const hash = bcrypt.hashSync('password123', 10);

  // ─── 1. Users ──────────────────────────────────────────
  const insertUser = db.prepare(`
    INSERT INTO users
      (username, email, password_hash, display_name, headline, bio,
       mood, location, gender, age, custom_css, interests_music,
       interests_movies, interests_general, interests_heroes, profile_views, avatar_url)
    VALUES
      (@username, @email, @hash, @display_name, @headline, @bio,
       @mood, @location, @gender, @age, @custom_css, @interests_music,
       @interests_movies, @interests_general, @interests_heroes, @profile_views, COALESCE(@avatar_url, '/images/avatars/default.png'))
  `);

  const users = [
    {
      username: 'CoOl_DuDe99',
      email: 'cooldude99@yahoo.com',
      hash,
      display_name: '~*CoOl DuDe*~',
      mood: '🎵 Vibing to Bollywood',
      headline: '~*~LiViNg ThE dReAm~*~',
      bio: 'Hey everyone! I am the coolest dude on the internet. I love Bollywood music, cricket, and chatting on Yahoo Messenger. My fav song is Kal Ho Naa Ho. Add me on Yahoo: cooldude99@yahoo.com',
      location: 'Mumbai',
      gender: 'Male',
      age: 19,
      custom_css: 'body{background:#1a1a2e!important} .profile-content{color:#00ff88!important}',
      interests_music: 'Bollywood, Linkin Park, Eminem, Lucky Ali, Strings',
      interests_movies: 'Kal Ho Naa Ho, DDLJ, Lagaan, Dil Chahta Hai',
      interests_general: 'Cricket, Yahoo Messenger, MP3 collecting, Cybercafes',
      interests_heroes: 'Sachin Tendulkar, Shah Rukh Khan',
      profile_views: 342,
      avatar_url: '/images/avatars/pixel1.png',
    },
    {
      username: 'PixelPrincess',
      email: 'pixelprincess@hotmail.com',
      hash,
      display_name: '✿ Pixel Princess ✿',
      mood: '💖 Dreaming',
      headline: '*.·:·.✧ Princess of Pixels ✧.·:·.*',
      bio: 'hiii!! im pixel princess and i LOVE making websites on geocities!! my favorite color is pink and i have 3 cats 🐱🐱🐱 pls sign my guestbook!!',
      location: 'Delhi',
      gender: 'Female',
      age: 17,
      custom_css: 'body{background:#ffe6f0!important} .profile-content{color:#cc0066!important} a{color:#ff69b4!important}',
      interests_music: 'Britney Spears, Backstreet Boys, Avril Lavigne, Alisha Chinai',
      interests_movies: 'Mean Girls, Kuch Kuch Hota Hai, Legally Blonde',
      interests_general: 'Geocities, Web design, Cats, Glitter graphics, Dollz',
      interests_heroes: 'Sailor Moon, my big sister',
      profile_views: 891,
      avatar_url: '/images/avatars/pixel2.png',
    },
    {
      username: 'MP3_Hunter',
      email: 'mp3hunter@rediffmail.com',
      hash,
      display_name: 'MP3 Hunter 🎧',
      mood: '🎧 Downloading...',
      headline: 'Sharing is Caring | 56kbps Warrior',
      bio: 'I have the BIGGEST mp3 collection in my neighborhood. 2000+ songs on my PC. Ask me for any song and I will burn it on a CD for you. Currently downloading the new Eminem album...',
      location: 'Bangalore',
      gender: 'Male',
      age: 20,
      custom_css: '',
      interests_music: 'EVERYTHING! I have it all! Bollywood, Hollywood, Rock, Pop, Indi-pop',
      interests_movies: 'The Matrix, Fight Club, Rang De Basanti',
      interests_general: 'MP3 collecting, CD burning, Napster, Kazaa, WinMX',
      interests_heroes: 'Shawn Fanning (Napster founder)',
      profile_views: 567,
      avatar_url: '/images/avatars/pixel1.png',
    },
    {
      username: 'DialUpKing',
      email: 'dialupking@sify.com',
      hash,
      display_name: 'The Dial-Up King 📞',
      mood: '😤 56k struggles',
      headline: 'Connection Lost... Reconnecting...',
      bio: 'WHY does my mom ALWAYS pick up the phone when im online?? 😡😡 Dial-up life is pain. I spend 2 hours downloading one song. BSNL broadband please come to my area!!',
      location: 'Pune',
      gender: 'Male',
      age: 18,
      custom_css: 'body{background:#0d0d0d!important} .profile-content{color:#00ff00!important} .profile-header{background:#003300!important}',
      interests_music: 'Whatever finishes downloading first lol',
      interests_movies: 'Any movie I can watch at 240p without buffering',
      interests_general: 'Complaining about dial-up, Waiting for broadband, IRC, mIRC scripts',
      interests_heroes: 'Anyone who invented broadband',
      profile_views: 213,
      avatar_url: '/images/avatars/pixel4.png',
    },
    {
      username: 'SunnyBoy2003',
      email: 'sunnyboy@indiatimes.com',
      hash,
      display_name: 'Sunny ☀️',
      mood: '😎 Chilling at cybercafe',
      headline: '☀️ Every day is a sunny day ☀️',
      bio: 'Namaste dosto! I am Sunny from Jaipur. I love going to the cybercafe after school to chat with my friends. My hobbies are cricket, carrom, and watching Shaktimaan reruns.',
      location: 'Jaipur',
      gender: 'Male',
      age: 16,
      custom_css: '',
      interests_music: 'Himesh Reshammiya, Sonu Nigam, KK',
      interests_movies: 'Shaktimaan, Koi Mil Gaya, Dhoom',
      interests_general: 'Cricket, Carrom, Cybercafe, WWF/WWE, Beyblade',
      interests_heroes: 'Shaktimaan, Sachin Tendulkar, John Cena',
      profile_views: 156,
      avatar_url: '/images/avatars/pixel1.png',
    },
    {
      username: 'xX_AnGeL_Xx',
      email: 'angel_forever@yahoo.co.in',
      hash,
      display_name: '~*AnGeL*~',
      mood: '🥺 Missing school days',
      headline: '..::xXx ☆ AnGeL ☆ xXx::..	',
      bio: '♥♥♥ LoVe My FrIeNdS ♥♥♥ SchOoL iS tHe BeSt TiMe Of OuR LiVeS!! I miss 10th class so much 😭 If you are reading this, you are special to me ♥',
      location: 'Kolkata',
      gender: 'Female',
      age: 18,
      custom_css: 'body{background:#2d1b4e!important} .profile-content{color:#e6ccff!important} a{color:#ff99ff!important}',
      interests_music: 'Atif Aslam, Shreya Ghoshal, Evanescence, Green Day',
      interests_movies: 'Kabhi Khushi Kabhie Gham, Titanic, A Walk to Remember',
      interests_general: 'Slam books, Friendship bands, Autograph books, Poetry',
      interests_heroes: 'My best friends ♥♥♥',
      profile_views: 723,
      avatar_url: '/images/avatars/pixel2.png',
    },
    {
      username: 'WinampFan',
      email: 'winamp4life@gmail.com',
      hash,
      display_name: 'Winamp4Life 🦙',
      mood: '🦙 It really whips the llamas ass',
      headline: '♫ Winamp, it really whips the llamas ass! ♫',
      bio: 'Winamp > everything else. I have 500+ Winamp skins. My current skin looks like a spaceship. Also I make custom visualizations. If you use Windows Media Player we cant be friends lol',
      location: 'Hyderabad',
      gender: 'Male',
      age: 21,
      custom_css: '',
      interests_music: 'Everything that plays on Winamp (which is everything)',
      interests_movies: 'Tron, The Matrix, Hackers',
      interests_general: 'Winamp skins, Audio visualizations, Foobar2000 (sometimes), MPCs',
      interests_heroes: 'Justin Frankel (Winamp creator)',
      profile_views: 445,
      avatar_url: '/images/avatars/pixel4.png',
    },
    {
      username: 'Nokia3310',
      email: 'snakemaster@nokia.fan',
      hash,
      display_name: 'Snake Master 🐍',
      mood: '📱 On my Nokia',
      headline: '🐍 Snake High Score: 9999 🐍',
      bio: 'My Nokia 3310 is indestructible. I dropped it from 3rd floor and it survived. I have the best ringtone collection - all composed by me! Currently learning to type with T9.',
      location: 'Chennai',
      gender: 'Male',
      age: 17,
      custom_css: '',
      interests_music: 'Nokia ringtones (self-composed), A.R. Rahman',
      interests_movies: 'Anything I can watch on my 1-inch screen (nothing lol)',
      interests_general: 'Snake game, Ringtone composing, SMS lingo, T9 typing championships',
      interests_heroes: 'The Nokia engineers who made the 3310',
      profile_views: 310,
      avatar_url: '/images/avatars/pixel4.png',
    },
    {
      username: 'BollywoodQueen',
      email: 'bollywoodqueen@gmail.com',
      hash,
      display_name: 'Bollywood Queen 💃',
      mood: '💃 Dancing to Kajra Re',
      headline: '💃 Bollywood is Life, Bollywood is Love 💃',
      bio: 'I know the lyrics to EVERY Bollywood song from 1995-2005. Test me! My favorite actors are SRK and Hrithik. I watch every Friday release at Gaiety Galaxy. Jai Ho! 🎬',
      location: 'Mumbai',
      gender: 'Female',
      age: 19,
      custom_css: '',
      interests_music: 'Bollywood OSTs, A.R. Rahman, Shankar-Ehsaan-Loy, Jatin-Lalit',
      interests_movies: 'EVERY Bollywood movie ever made (almost)',
      interests_general: 'Movie reviews, Filmi gossip, Dance, Antakshari',
      interests_heroes: 'Shah Rukh Khan, Hrithik Roshan, Madhuri Dixit',
      profile_views: 654,
      avatar_url: '/images/avatars/pixel2.png',
    },
    {
      username: 'TechGeek2004',
      email: 'techgeek@geekmail.com',
      hash,
      display_name: 'Tech Geek 💻',
      mood: '🖥️ Coding in BASIC',
      headline: '01001000 01100101 01101100 01101100 01101111',
      bio: 'I built my own PC from parts I bought at Nehru Place. 256MB RAM, 40GB HDD, GeForce MX 440. Running Windows XP SP2. Learning C++ from Let Us C by Yashavant Kanetkar. Will make the next Google someday!',
      location: 'Delhi',
      gender: 'Male',
      age: 20,
      custom_css: 'body{background:#001a00!important} .profile-content{color:#00ff41!important;font-family:"Courier New",monospace!important} .profile-header{background:#002200!important}',
      interests_music: 'Chiptunes, Video game OSTs, Linkin Park',
      interests_movies: 'The Matrix, Hackers, War Games, Tron',
      interests_general: 'C++, HTML, Assembly, Building PCs, Overclocking, Linux',
      interests_heroes: 'Linus Torvalds, Bill Gates (sorry), Yashavant Kanetkar',
      profile_views: 489,
      avatar_url: '/images/avatars/pixel4.png',
    },
  ];

  const insertUsersTransaction = db.transaction(() => {
    for (const u of users) {
      insertUser.run(u);
    }
  });
  insertUsersTransaction();
  console.log('[database]   ✔ 10 users created');

  // ─── 2. Friendships ───────────────────────────────────
  const insertFriendship = db.prepare(`
    INSERT INTO friendships (requester_id, addressee_id, status)
    VALUES (?, ?, 'accepted')
  `);

  const friendships = [
    [1, 2], [1, 3], [1, 5], [1, 7], [1, 9],
    [2, 3], [2, 4], [2, 6], [2, 9],
    [3, 4], [3, 7], [3, 10],
    [4, 5], [4, 8], [4, 10],
    [5, 6], [5, 9],
    [6, 7], [6, 8],
    [7, 10],
    [8, 9], [8, 10],
    [9, 10],
  ];

  const insertFriendshipsTransaction = db.transaction(() => {
    for (const [a, b] of friendships) {
      insertFriendship.run(a, b);
    }
  });
  insertFriendshipsTransaction();
  console.log(`[database]   ✔ ${friendships.length} friendships created`);

  // ─── 3. Top 8 Friends ─────────────────────────────────
  const insertTopFriend = db.prepare(`
    INSERT INTO top_friends (user_id, friend_id, position)
    VALUES (?, ?, ?)
  `);

  const topFriends = [
    // CoOl_DuDe99's Top 8
    [1, 2, 1], [1, 3, 2], [1, 5, 3], [1, 7, 4],
    [1, 9, 5],
    // PixelPrincess's Top 8
    [2, 1, 1], [2, 6, 2], [2, 3, 3], [2, 9, 4],
    [2, 4, 5],
    // MP3_Hunter's Top 8
    [3, 1, 1], [3, 7, 2], [3, 10, 3], [3, 4, 4],
    [3, 2, 5],
  ];

  const insertTopFriendsTransaction = db.transaction(() => {
    for (const [uid, fid, pos] of topFriends) {
      insertTopFriend.run(uid, fid, pos);
    }
  });
  insertTopFriendsTransaction();
  console.log('[database]   ✔ Top 8 friends set for users 1, 2, 3');

  // ─── 4. Communities ────────────────────────────────────
  const insertCommunity = db.prepare(`
    INSERT INTO communities (name, description, category, owner_id, avatar_url)
    VALUES (?, ?, ?, ?, COALESCE(?, '/images/avatars/community_default.png'))
  `);

  const communities = [
    ['Bollywood Music Lovers 🎵', 'For those who live and breathe Bollywood music! Share your fav songs, discuss latest albums, and relive the golden era of 90s-2000s Bollywood.', 'Music', 1, '/images/avatars/comm_pixel1.png'],
    ['School Days Nostalgia 🏫', 'Remember the good old school days? Tiffin sharing, PT periods, annual day, and bunking classes. Share your memories here!', 'Nostalgia', 6, '/images/avatars/comm_pixel2.png'],
    ['Dial-Up Survivors Club 📞', 'If you have ever been disconnected because someone picked up the phone, this community is for you. We understand your pain.', 'Technology', 4, '/images/avatars/comm_pixel3.png'],
    ['Nokia 3310 Appreciation Society 📱', 'The phone that refused to die. Share your Snake scores, compose ringtones, and celebrate the greatest phone ever made.', 'Fun & Games', 8, '/images/avatars/comm_pixel4.png'],
    ['Retro Games Forever 🎮', 'Mario, Contra, Dave, Road Rash, NFS II SE... if these names give you goosebumps, join us!', 'Fun & Games', 10, '/images/avatars/comm_pixel5.png'],
    ['Frequency 2004 FM Listeners 📻', 'Official community for Frequency 2004 FM radio listeners. Request songs, discuss shows, and share the love for radio!', 'Music', 1, '/images/avatars/comm_pixel1.png'],
  ];

  const insertCommunitiesTransaction = db.transaction(() => {
    for (const [name, desc, cat, owner, avatar] of communities) {
      insertCommunity.run(name, desc, cat, owner, avatar);
    }
  });
  insertCommunitiesTransaction();
  console.log('[database]   ✔ 6 communities created');

  // ─── 5. Community Members ─────────────────────────────
  const insertMember = db.prepare(`
    INSERT INTO community_members (community_id, user_id, role)
    VALUES (?, ?, ?)
  `);

  const communityMembers = [
    // Bollywood Music Lovers (community 1, owner: 1)
    [1, 1, 'owner'], [1, 2, 'member'], [1, 3, 'member'],
    [1, 5, 'member'], [1, 9, 'moderator'], [1, 6, 'member'],
    [1, 7, 'member'],
    // School Days Nostalgia (community 2, owner: 6)
    [2, 6, 'owner'], [2, 1, 'member'], [2, 2, 'member'],
    [2, 5, 'member'], [2, 8, 'member'], [2, 9, 'member'],
    // Dial-Up Survivors Club (community 3, owner: 4)
    [3, 4, 'owner'], [3, 1, 'member'], [3, 3, 'member'],
    [3, 5, 'member'], [3, 7, 'member'], [3, 10, 'member'],
    [3, 8, 'member'],
    // Nokia 3310 Appreciation Society (community 4, owner: 8)
    [4, 8, 'owner'], [4, 4, 'member'], [4, 5, 'member'],
    [4, 6, 'member'], [4, 9, 'member'], [4, 10, 'member'],
    // Retro Games Forever (community 5, owner: 10)
    [5, 10, 'owner'], [5, 1, 'member'], [5, 3, 'member'],
    [5, 4, 'member'], [5, 5, 'member'], [5, 7, 'moderator'],
    [5, 8, 'member'],
    // Frequency 2004 FM Listeners (community 6, owner: 1)
    [6, 1, 'owner'], [6, 2, 'member'], [6, 3, 'member'],
    [6, 6, 'member'], [6, 9, 'member'], [6, 5, 'member'],
    [6, 7, 'member'], [6, 10, 'member'],
  ];

  const insertMembersTransaction = db.transaction(() => {
    for (const [cid, uid, role] of communityMembers) {
      insertMember.run(cid, uid, role);
    }
  });
  insertMembersTransaction();
  console.log('[database]   ✔ Community memberships set');

  // ─── 6. Community Posts ────────────────────────────────
  const insertPost = db.prepare(`
    INSERT INTO community_posts (community_id, author_id, title, content)
    VALUES (?, ?, ?, ?)
  `);

  const communityPosts = [
    // Bollywood Music Lovers
    [1, 1, 'Best Bollywood song of 2003??',
      'I think Kal Ho Naa Ho title track is the BEST song this year. The lyrics are so beautiful and Sonu Nigam\'s voice is 💯. What do you guys think?? Drop your favorites below!!'],
    [1, 9, 'Shankar-Ehsaan-Loy appreciation post 🎵',
      'Can we just talk about how AMAZING Shankar-Ehsaan-Loy are?? Dil Chahta Hai, Kal Ho Naa Ho, Bunty Aur Babli... every single album is a banger!! They are the future of Bollywood music fr fr'],
    [1, 3, 'Where to download Bollywood MP3s??',
      'Hey everyone! I need good sites to download Bollywood mp3s. My collection is getting old. I have most of the 90s songs but need 2002-2003 stuff. DM me if you have CDs to share! 💿'],

    // School Days Nostalgia
    [2, 6, 'Things only 90s kids will remember 🥺',
      'SLAM BOOKS!! Remember filling slam books for all your friends?? What\'s your favorite color, favorite teacher, what will you remember about me... I still have mine from 8th class 😭😭'],
    [2, 5, 'PT period was the best period!!',
      'No books, no homework, just playing in the ground!! We used to play kho-kho and langdi in PT period. Our PT teacher was so cool, he let us play cricket too sometimes 🏏'],

    // Dial-Up Survivors Club
    [3, 4, 'BSNL broadband launch date confirmed??',
      'I heard BSNL is launching broadband in our area next month!!! 256 kbps for just Rs. 500/month!! NO MORE DIAL-UP!! 🎉🎉🎉 Can anyone confirm?? I am SO done with 56k'],
    [3, 10, 'Tips to speed up dial-up connection',
      'Guys I found some tricks to make dial-up faster:\n1. Close all background programs\n2. Disable images in browser (Tools > Internet Options)\n3. Use Google instead of Yahoo (loads faster)\n4. Download files at night when traffic is low\n\nLet me know if any of these work for you!'],
    [3, 3, 'Best download manager for dial-up?',
      'I keep losing my downloads because of disconnections. Which download manager do you guys use? I tried DAP (Download Accelerator Plus) but FlashGet seems faster. Also heard about IDM...'],

    // Nokia 3310 Appreciation Society
    [4, 8, 'Post your Snake high scores here!! 🐍',
      'My current high score is 9999 (yes, I maxed it out 😎). I play during every boring class. What\'s your highest score?? No lying!!'],
    [4, 5, 'Best self-composed ringtone?',
      'I spent 3 hours composing the Kal Ho Naa Ho tune on my Nokia. It sounds 80% like the original!! Will share the keystrokes if anyone wants it.'],

    // Retro Games Forever
    [5, 10, 'NFS II SE or Road Rash - which is better??',
      'This is the ULTIMATE debate. I personally think NFS II SE is better because of the graphics and car selection. But Road Rash has that thrill of hitting people with clubs lol 😂 What do you think??'],
    [5, 7, 'Dave is the most underrated game ever',
      'Everyone talks about Mario and Contra but NO ONE talks about Dangerous Dave!! It came pre-installed on every PC at every cybercafe. The shotgun levels were SO hard. Who has completed all levels??'],
    [5, 1, 'Contra: Up Up Down Down Left Right Left Right B A',
      'If you know this code, you are a real gamer 💪 30 lives in Contra!! We used to play 2-player at my friend\'s house every Sunday. Those were the days... 🎮'],

    // Frequency 2004 FM Listeners
    [6, 1, 'Song request thread!! 📻',
      'Post your song requests here and I\'ll try to play them on the radio! Currently our most requested song is "Kal Ho Naa Ho" (surprise surprise lol)'],
    [6, 9, 'The midnight show is the best!! 💫',
      'Does anyone else stay up late to listen to the midnight show?? The song selection is SO good at night. Slow romantic songs + no ads = perfection ✨'],
  ];

  const insertPostsTransaction = db.transaction(() => {
    for (const [cid, aid, title, content] of communityPosts) {
      insertPost.run(cid, aid, title, content);
    }
  });
  insertPostsTransaction();
  console.log(`[database]   ✔ ${communityPosts.length} community posts created`);

  // ─── 7. Community Replies ──────────────────────────────
  const insertReply = db.prepare(`
    INSERT INTO community_replies (post_id, author_id, content)
    VALUES (?, ?, ?)
  `);

  const communityReplies = [
    // Replies to "Best Bollywood song of 2003??" (post 1)
    [1, 9, 'Kal Ho Naa Ho is amazing but I think "Idhar Chala Main Udhar Chala" is more fun!! SRK is the best ❤️'],
    [1, 3, 'I have the full album in 320kbps if anyone wants it. DM me your email and I\'ll send the link 💿'],
    [1, 2, 'omg yes!! KHN makes me cry every time 😭😭 also love "Pretty Woman" from the same movie!!'],

    // Replies to "Shankar-Ehsaan-Loy appreciation post" (post 2)
    [2, 1, 'SO TRUE!! Dil Chahta Hai soundtrack changed my life. Every single song is a masterpiece 🎵'],
    [2, 7, 'Their songs are perfect for Winamp visualizations btw. The beats sync so well with MilkDrop 🦙'],

    // Replies to "Where to download Bollywood MP3s??" (post 3)
    [3, 4, 'bro wait for broadband first lol. On dial-up one song takes 45 min to download 😭'],
    [3, 7, 'Check your DM bro. I have a CD with 200+ latest songs. Will burn a copy for you 🔥'],

    // Replies to "Things only 90s kids will remember" (post 4)
    [4, 2, 'OMG SLAM BOOKS YES!! I still have mine too!! My favorite color answer was always PINK 💖💖'],
    [4, 5, 'Remember those friendship bands?? We used to make them in art class and give to everyone on Friendship Day 🤗'],
    [4, 1, 'Dude the best thing was tiffin sharing. My mom made the best parathas and everyone wanted to trade 😂'],

    // Replies to "BSNL broadband launch date confirmed??" (post 6)
    [6, 3, 'FINALLY!! I\'ve been waiting for this for YEARS. No more download resume issues at 3 AM!! 🎉'],
    [6, 5, 'My area still doesn\'t have BSNL line 😭 I\'ll have to keep going to cybercafe'],
    [6, 1, 'Bro 256 kbps is like... 32 KB/s. That\'s still slow but 10x faster than dial-up so I\'ll take it!! 🚀'],

    // Replies to "Tips to speed up dial-up" (post 7)
    [7, 4, 'DISABLE IMAGES?? But then how will I see the cool profile pictures on Orkut?? 😤'],
    [7, 8, 'Pro tip: download files between 2-5 AM. Fastest speeds guaranteed because everyone is sleeping 😴'],

    // Replies to "Post your Snake high scores" (post 9)
    [9, 5, 'My score is 7832. How do you even get 9999?? Are you playing during EVERY class?? 😂'],
    [9, 4, 'I got 8500 once but then my friend called and I lost focus 😤 Phone calls ruin everything'],

    // Replies to "NFS II SE or Road Rash" (post 11)
    [11, 1, 'ROAD RASH any day!! The feeling of kicking someone off their bike at 200 km/h is unmatched 🏍️😂'],
    [11, 5, 'NFS II SE! That Monolithic Studios track with the McLaren F1 is the GOAT racing experience 🏎️'],
    [11, 8, 'Both are great but have you tried NFS Most Wanted? Just came out and it\'s INSANE!! (if your PC can run it lol)'],

    // Replies to "Contra cheat code" (post 13)
    [13, 10, 'The Konami Code!! This is ESSENTIAL knowledge for survival. Without 30 lives that game is impossible 💀'],
    [13, 7, 'I once completed Contra without the code. Took me 3 weeks of practice. My proudest gaming achievement 🏆'],

    // Replies to "Song request thread" (post 14)
    [14, 9, 'Please play "Tere Bina" by A.R. Rahman!! I love that song so much 🎵❤️'],
    [14, 6, 'Can you play some sad songs at night?? "Tujhe Bhula Diya" and "Aadat" pls!! 😢💔'],
    [14, 2, 'Play some Backstreet Boys too!! Not everything has to be Bollywood 😤💖'],
  ];

  const insertRepliesTransaction = db.transaction(() => {
    for (const [pid, aid, content] of communityReplies) {
      insertReply.run(pid, aid, content);
    }
  });
  insertRepliesTransaction();
  console.log(`[database]   ✔ ${communityReplies.length} community replies created`);

  // ─── 8. Scraps (Orkut-style scrapbook messages) ───────
  const insertScrap = db.prepare(`
    INSERT INTO scraps (author_id, recipient_id, content)
    VALUES (?, ?, ?)
  `);

  const scraps = [
    [2, 1, 'heyyy!! long time no see on yahoo messenger!! where have u been?? 😊 ur profile looks SO cool btw!!'],
    [1, 2, 'hey pixel princess!! was busy with exams 📚 just got back online. love ur new glitter graphics!! ✨✨'],
    [5, 1, 'happy friendship day bhai!! 🤗🤗 u r my bestest friend 4ever!! thanks for helping me with computer homework'],
    [3, 1, 'dude did u see the new Hrithik movie?? SO GOOD!! Also I burned that CD for you, pick it up from cybercafe 💿'],
    [1, 3, 'thanks for burning that CD for me!! all songs are working perfectly 💿🎵 ur the best MP3 hunter!!'],
    [6, 2, 'omg ur profile is SO pretty!! how did u make those sparkly graphics?? teach me pls!! 💖💖✨'],
    [2, 6, 'aww thanku angel!! 💕 I use a website called glitter-graphics.com!! I\'ll show u next time at cybercafe ok?? 🌟'],
    [9, 1, 'CoOl DuDe!! Did u listen to the new Shankar-Ehsaan-Loy album?? Every song is a HIT!! 🎵💃'],
    [4, 3, 'bro can u burn me a CD too?? my dial-up cant download anything 😭😭 will pay u 20 rupees'],
    [3, 4, 'haha sure bro!! come to cybercafe tomorrow. I have the latest collection ready 💿 no charge for friends!! 🤝'],
    [7, 1, 'yo check out this new Winamp skin I made!! It looks like a spaceship cockpit!! 🚀🦙 sending u the file on Yahoo'],
    [8, 5, 'bro I just beat ur Snake score!! 8347!! challenge accepted and COMPLETED 🐍💪😎'],
    [5, 8, 'WHAT!! no way!! I\'m coming for that record during history class tomorrow!! 📱🐍 game ON!!'],
    [10, 3, 'hey can u get me the latest Linkin Park album?? Meteora is SO good!! I\'ll give u a blank CD 🎸'],
    [9, 6, 'angel!! miss u yaar 🥺 remember when we used to pass chits in class?? those were the best days!! ♥'],
    [6, 9, 'aww bollywood queen!! 😭😭 yes I miss those days SO much!! let\'s meet at the cybercafe this weekend ok?? ♥♥'],
    [1, 7, 'bro that winamp skin is SICK!! 🔥 how do u make these?? I want to learn!! teach me senpai 🙏'],
    [10, 4, 'dial-up king!! I fixed ur PC last week right?? did the internet speed improve after I changed the modem settings?? 💻'],
    [4, 10, 'YES bro!! it went from 28k to 48k!! still slow but much better than before 😂 thanks tech geek!! 🙏'],
    [2, 9, 'bollywood queen!! let\'s do antakshari online sometime!! I know ALL the songs from DDLJ and K3G 🎤💖'],
  ];

  const insertScrapsTransaction = db.transaction(() => {
    for (const [aid, rid, content] of scraps) {
      insertScrap.run(aid, rid, content);
    }
  });
  insertScrapsTransaction();
  console.log(`[database]   ✔ ${scraps.length} scraps created`);

  // ─── 9. Testimonials ──────────────────────────────────
  const insertTestimonial = db.prepare(`
    INSERT INTO testimonials (author_id, recipient_id, content, approved)
    VALUES (?, ?, ?, 1)
  `);

  const testimonials = [
    [2, 1, 'CoOl_DuDe is the nicest person I know online!! Always helps everyone with their computer problems and shares the best mp3s!! If u need a friend, he\'s the one!! 5 stars!! ⭐⭐⭐⭐⭐'],
    [3, 1, 'Best dude on the internet fr fr!! We\'ve been friends since we met at the cybercafe in 2002. He introduced me to Orkut and now look at us!! 🤜🤛 Stay cool bro!!'],
    [1, 2, 'Pixel Princess has the PRETTIEST profile on the entire internet!! She helped me learn HTML and make my profile cool. The best web designer I know!! 💖✨ Hire her for your Geocities page!!'],
    [6, 2, 'My bestie pixel princess!! She taught me how to use the internet and now I\'m addicted lol 😂💕 The sweetest person with the cutest cats!! ♥♥♥'],
    [1, 3, 'MP3 Hunter is a LEGEND!! He has EVERY song you can think of. He burned me 5 CDs last month and didn\'t even charge!! The most generous person online!! 💿🎵🏆'],
    [7, 3, 'This guy has better music taste than any radio station!! If you need mp3s, he\'s your guy. The real MVP of the internet!! 🎧👑'],
    [3, 4, 'The Dial-Up King has suffered more than any of us and yet he still comes online every day!! True warrior of the 56k era!! We salute you!! 😤🫡📞'],
    [5, 6, 'Angel is the sweetest person in our friend group!! Always writes the nicest scraps and never forgets anyone\'s birthday!! We love you angel!! ♥♥♥🥺'],
    [1, 9, 'Bollywood Queen knows MORE about Bollywood than the entire film industry combined!! She won 5 antakshari competitions in a row!! The ultimate filmi encyclopedia!! 💃🎬👑'],
    [4, 10, 'Tech Geek fixed my computer 3 times and never asked for anything in return!! He built his own PC from scratch at age 16!! Future Bill Gates right here!! 💻🔧⭐'],
  ];

  const insertTestimonialsTransaction = db.transaction(() => {
    for (const [aid, rid, content] of testimonials) {
      insertTestimonial.run(aid, rid, content);
    }
  });
  insertTestimonialsTransaction();
  console.log(`[database]   ✔ ${testimonials.length} testimonials created`);

  // ─── 10. Ratings ───────────────────────────────────────
  const insertRating = db.prepare(`
    INSERT INTO ratings (rater_id, rated_id, trustworthy, cool, sexy, is_fan, is_crush)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const ratings = [
    //            rater, rated, trust, cool, sexy, fan, crush
    [2, 1, 3, 3, 2, 1, 0],  // PixelPrincess rates CoOl_DuDe
    [3, 1, 3, 3, 1, 1, 0],  // MP3_Hunter rates CoOl_DuDe
    [5, 1, 3, 2, 1, 1, 0],  // SunnyBoy rates CoOl_DuDe
    [1, 2, 3, 3, 3, 1, 1],  // CoOl_DuDe rates PixelPrincess (crush!)
    [6, 2, 3, 3, 2, 1, 0],  // Angel rates PixelPrincess
    [1, 3, 3, 2, 1, 1, 0],  // CoOl_DuDe rates MP3_Hunter
    [4, 3, 2, 2, 1, 0, 0],  // DialUpKing rates MP3_Hunter
    [7, 3, 3, 3, 1, 1, 0],  // WinampFan rates MP3_Hunter
    [3, 4, 2, 1, 1, 0, 0],  // MP3_Hunter rates DialUpKing
    [10, 4, 3, 2, 1, 0, 0], // TechGeek rates DialUpKing
    [1, 5, 3, 2, 1, 0, 0],  // CoOl_DuDe rates SunnyBoy
    [8, 5, 2, 2, 1, 0, 0],  // Nokia3310 rates SunnyBoy
    [2, 6, 3, 3, 2, 1, 0],  // PixelPrincess rates Angel
    [9, 6, 3, 2, 2, 1, 0],  // BollywoodQueen rates Angel
    [5, 6, 3, 3, 2, 0, 1],  // SunnyBoy rates Angel (crush!)
    [6, 5, 3, 2, 2, 0, 1],  // Angel rates SunnyBoy (mutual crush!! 💕)
    [1, 7, 2, 3, 1, 1, 0],  // CoOl_DuDe rates WinampFan
    [3, 7, 3, 3, 1, 1, 0],  // MP3_Hunter rates WinampFan
    [4, 8, 2, 2, 1, 1, 0],  // DialUpKing rates Nokia3310
    [5, 8, 3, 3, 1, 1, 0],  // SunnyBoy rates Nokia3310
    [1, 9, 3, 3, 3, 1, 0],  // CoOl_DuDe rates BollywoodQueen
    [9, 1, 3, 3, 2, 1, 1],  // BollywoodQueen rates CoOl_DuDe (crush!)
    [2, 9, 3, 3, 2, 1, 0],  // PixelPrincess rates BollywoodQueen
    [3, 10, 3, 3, 1, 0, 0], // MP3_Hunter rates TechGeek
    [4, 10, 3, 2, 1, 1, 0], // DialUpKing rates TechGeek
    [7, 10, 3, 3, 1, 1, 0], // WinampFan rates TechGeek
  ];

  const insertRatingsTransaction = db.transaction(() => {
    for (const r of ratings) {
      insertRating.run(...r);
    }
  });
  insertRatingsTransaction();
  console.log(`[database]   ✔ ${ratings.length} ratings created`);

  // ─── 11. Shoutbox Messages ────────────────────────────
  const insertShout = db.prepare(`
    INSERT INTO shoutbox_messages (user_id, content)
    VALUES (?, ?)
  `);

  const shoutboxMessages = [
    [1, 'A/S/L? 😎'],
    [4, 'lol dial-up disconnected again :(( this is the 5th time today'],
    [3, 'anyone recording songs from the radio?? I need the new Atif Aslam song!!'],
    [4, 'brb, someone is using the phone line 😤📞'],
    [3, 'downloading mp3 at 6 KB/s 😭😭😭 send help'],
    [7, 'Winamp really whips the llamas ass!! 🦙🦙🦙'],
    [6, 'omg this song reminds me of school days ❤️😢 10th class memories'],
    [8, 'send me the ringtone pls!! what r the keystrokes??'],
    [5, 'yahoo messenger anyone?? my ID is sunny_boy_jpr 🌞'],
    [2, '*.·:·.✧ hiiii everyone!! new glitter graphics on my profile!! come see!! ✧.·:·.*'],
    [9, 'Kajra Re Kajra Re... 💃🎵 cant stop singing this song!!'],
    [10, 'just compiled my first C++ program without errors!! 🎉💻 cout << "hello world"'],
    [1, 'who wants to play counter strike at cybercafe this weekend?? 🎮'],
    [4, 'BSNL broadband when??? 😭😭 i cant take dial-up anymore'],
    [8, 'new snake high score: 9247!! come at me bros 🐍💪'],
    [6, '♥♥♥ friendship day coming soon!! making bands for everyone ♥♥♥'],
    [3, 'just finished burning 10 CDs for my friends. my CD writer is overheating lol 💿🔥'],
    [9, 'SRK is the BEST actor in the world and I will fight anyone who disagrees!! 👊❤️'],
    [7, 'downloading a new Winamp skin... 45 min remaining on dial-up 😤'],
    [2, 'does anyone know how to add falling snow effect to my Geocities page?? ❄️ pls help!!'],
    [5, 'cybercafe uncle says my time is up but I have 2 more scraps to write!! 😫'],
    [10, 'who else is learning HTML from W3Schools?? 💻 just learned how to make a <marquee> tag!!'],
    [1, 'goodnight everyone!! dont forget to set ur away message on Yahoo Messenger!! 🌙💤'],
    [4, 'MOM PICKED UP THE PHONE AGAIN!! I WAS DOWNLOADING A FILE FOR 2 HOURS!! 😡😡😡😡'],
  ];

  const insertShoutboxTransaction = db.transaction(() => {
    for (const [uid, content] of shoutboxMessages) {
      insertShout.run(uid, content);
    }
  });
  insertShoutboxTransaction();
  console.log(`[database]   ✔ ${shoutboxMessages.length} shoutbox messages created`);

  // ─── 7. Direct Messages ──────────────────────────────────
  const insertDirectMsg = db.prepare(`
    INSERT INTO direct_messages (sender_id, recipient_id, content)
    VALUES (?, ?, ?)
  `);

  const directMessages = [
    [1, 2, 'Hey PixelPrincess! Add me to your MSN Messenger, my email is cooldude99@yahoo.com.'],
    [2, 1, 'Hiii CoOl_DuDe99! Sure, I just added you. Did you see my custom CSS on my profile?'],
    [1, 2, 'Yeah it looks awesome! How did you do the glitter background?'],
    [2, 1, 'Its a secret Geocities code! 🤫💖 I can send it to you later.']
  ];

  const insertDirectMsgTransaction = db.transaction(() => {
    for (const [sender, recipient, content] of directMessages) {
      insertDirectMsg.run(sender, recipient, content);
    }
  });
  insertDirectMsgTransaction();
  console.log(`[database]   ✔ ${directMessages.length} direct messages seeded`);

  // ─── 8. Slam Book Responses ──────────────────────────────
  const insertSlam = db.prepare(`
    INSERT INTO slambook_responses (user_id, author_id, crush, first_impression, best_memory, describe_me, advice)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const slamEntries = [
    [1, 2, 'Someone in my class 🤭', 'Super helpful, gave me Yahoo messenger tips!', 'When you shared the Kal Ho Naa Ho MP3 link!', 'Music lover 🎧', 'Keep downloading cool songs!'],
    [2, 1, 'Secret!', 'Very cool programmer girl with a cute pink profile!', 'Helping you format your custom CSS!', 'Creative 🎨', 'Do not let your dialup connection drop!']
  ];

  const insertSlamTransaction = db.transaction(() => {
    for (const [uid, authId, crush, firstImp, bestMem, descMe, adv] of slamEntries) {
      insertSlam.run(uid, authId, crush, firstImp, bestMem, descMe, adv);
    }
  });
  insertSlamTransaction();
  console.log(`[database]   ✔ ${slamEntries.length} slam book responses seeded`);

  console.log('[database] ✅ All seed data inserted successfully!');
}

// ══════════════════════════════════════════════════════════
//  INITIALIZE
// ══════════════════════════════════════════════════════════

/**
 * Master initialization routine.
 * 1. Creates all tables (idempotent via IF NOT EXISTS).
 * 2. Seeds demo data if the users table is empty.
 */
function initialize() {
  try {
    createTables();
    console.log('[database] All 11 tables ready ✔');

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
