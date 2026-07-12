/**
 * ============================================================
 *  Frequency 2004 Social — Database Module
 * ============================================================
 */

const path     = require('path');
const fs       = require('fs');
const Database = require('better-sqlite3');
const bcrypt   = require('bcryptjs');

// ─── Open (or create) the SQLite database ────────────────
let DB_PATH = process.env.DATABASE_URL || path.join(__dirname, 'retrosocial.db');

try {
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
} catch (err) {
  console.warn(`[database] Warn: ${err.message}. Falling back to local database.`);
  DB_PATH = path.join(__dirname, 'retrosocial.db');
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ══════════════════════════════════════════════════════════
//  TABLE DEFINITIONS
// ══════════════════════════════════════════════════════════
function createTables() {
  db.exec(`
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

    CREATE TABLE IF NOT EXISTS friendships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_id INTEGER NOT NULL REFERENCES users(id),
      addressee_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(requester_id, addressee_id)
    );

    CREATE TABLE IF NOT EXISTS top_friends (
      user_id INTEGER NOT NULL REFERENCES users(id),
      friend_id INTEGER NOT NULL REFERENCES users(id),
      position INTEGER NOT NULL CHECK(position BETWEEN 1 AND 8),
      PRIMARY KEY(user_id, position)
    );

    CREATE TABLE IF NOT EXISTS scraps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL REFERENCES users(id),
      recipient_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS testimonials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author_id INTEGER NOT NULL REFERENCES users(id),
      recipient_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      approved INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

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

    CREATE TABLE IF NOT EXISTS communities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      owner_id INTEGER NOT NULL REFERENCES users(id),
      avatar_url TEXT DEFAULT '/images/avatars/community_default.png',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS community_members (
      community_id INTEGER NOT NULL REFERENCES communities(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      role TEXT DEFAULT 'member' CHECK(role IN ('owner','moderator','member')),
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(community_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS community_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      community_id INTEGER NOT NULL REFERENCES communities(id),
      author_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS community_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL REFERENCES community_posts(id),
      author_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS shoutbox_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS direct_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL REFERENCES users(id),
      recipient_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_read INTEGER DEFAULT 0
    );

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
  `);
}

// ══════════════════════════════════════════════════════════
//  SEED DATA
// ══════════════════════════════════════════════════════════
function seedData() {
  console.log('[database] Seeding developer + demo data...');
  const hash = bcrypt.hashSync('password123', 10);

  // ─── Users ────────────────────────────────────────────
  const insUser = db.prepare(`
    INSERT INTO users
      (username,email,password_hash,display_name,headline,bio,mood,location,
       gender,age,custom_css,interests_music,interests_movies,interests_general,
       interests_heroes,profile_views,avatar_url,profile_id)
    VALUES
      (@username,@email,@hash,@display_name,@headline,@bio,@mood,@location,
       @gender,@age,@custom_css,@interests_music,@interests_movies,@interests_general,
       @interests_heroes,@profile_views,@avatar_url,@profile_id)
  `);

  // id=1: Ansh Mishra (Developer)
  insUser.run({
    username:'anshmishra', email:'anshmishra@example.com', hash,
    display_name:'Ansh Mishra',
    headline:'Creator of Frequency 2004 — Building the retro web',
    bio:'Hey! I am Ansh Mishra, the developer behind Frequency 2004. I built this whole platform from scratch with Node.js, SQLite, EJS, and a whole lot of nostalgia. Feel free to add me as a friend or drop a scrap!',
    mood:'Shipping code...',
    location:'Delhi, India', gender:'Male', age:20,
    custom_css:'',
    interests_music:'Euphoria, Strings, Lucky Ali, Classic Bollywood, Daft Punk',
    interests_movies:'Dil Chahta Hai, Pirates of Silicon Valley, The Social Network',
    interests_general:'Web Dev, Retro Design, Music, Open Source, Cybercafes',
    interests_heroes:'Linus Torvalds, Steve Jobs, Dennis Ritchie',
    profile_views:1337, avatar_url:'/images/avatars/pixel_boy_blue_1783831781477.png', profile_id:1001
  });

  // id=2: naitik12 (Developer)
  insUser.run({
    username:'naitik12', email:'naitik12@example.com', hash,
    display_name:'Naitik',
    headline:'Verified Developer of Frequency 2004',
    bio:'Hey! I am Naitik, a developer on Frequency 2004. Glad to be building this retro corner of the web!',
    mood:'Coding...',
    location:'Delhi, India', gender:'Male', age:20,
    custom_css:'',
    interests_music:'Lucky Ali, Strings, KK, Classic Bollywood',
    interests_movies:'Dil Chahta Hai, Kal Ho Naa Ho',
    interests_general:'Web Development, Retro Design, Cybercafes',
    interests_heroes:'Steve Jobs, Linus Torvalds',
    profile_views:99, avatar_url:'/images/avatars/pixel_computer_1783822705542.png', profile_id:1002
  });

  // id=3: Exe_sparsh (Developer)
  insUser.run({
    username:'Exe_sparsh', email:'exe_sparsh@example.com', hash,
    display_name:'Sparsh',
    headline:'Verified Developer of Frequency 2004',
    bio:'Hey! I am Sparsh, a developer on Frequency 2004. Welcome to my retro profile!',
    mood:'Coding...',
    location:'Delhi, India', gender:'Male', age:20,
    custom_css:'',
    interests_music:'Linkin Park, Euphoria, Strings',
    interests_movies:'The Matrix, Pirates of Silicon Valley',
    interests_general:'Programming, Retro Design, Computer hardware',
    interests_heroes:'Linus Torvalds, Dennis Ritchie',
    profile_views:99, avatar_url:'/images/avatars/crt_monitor_1783831864729.png', profile_id:1003
  });

  // id=4: CoOl_DuDe99
  insUser.run({
    username:'CoOl_DuDe99', email:'cooldude99@yahoo.com', hash,
    display_name:'~*CoOl DuDe*~', headline:'~*~LiViNg ThE dReAm~*~',
    bio:'Hey everyone! I am the coolest dude on the internet. I love Bollywood music, cricket, and chatting on Yahoo Messenger. My fav song is Kal Ho Naa Ho.',
    mood:'Vibing to Bollywood', location:'Mumbai', gender:'Male', age:19,
    custom_css:'body{background:#1a1a2e!important}.profile-content{color:#00ff88!important}',
    interests_music:'Bollywood, Linkin Park, Eminem, Lucky Ali, Strings',
    interests_movies:'Kal Ho Naa Ho, DDLJ, Lagaan, Dil Chahta Hai',
    interests_general:'Cricket, Yahoo Messenger, MP3 collecting, Cybercafes',
    interests_heroes:'Sachin Tendulkar, Shah Rukh Khan',
    profile_views:342, avatar_url:'/images/avatars/pixel_boy_1783822667200.png', profile_id:1004
  });

  // id=5: PixelPrincess
  insUser.run({
    username:'PixelPrincess', email:'pixelprincess@hotmail.com', hash,
    display_name:'Pixel Princess', headline:'Princess of Pixels',
    bio:'hiii!! im pixel princess and i LOVE making websites on geocities!! my favorite color is pink and i have 3 cats!! pls sign my guestbook!!',
    mood:'Dreaming', location:'Delhi', gender:'Female', age:17,
    custom_css:'body{background:#ffe6f0!important}.profile-content{color:#cc0066!important}a{color:#ff69b4!important}',
    interests_music:'Backstreet Boys, Britney Spears, Avril Lavigne, Hilary Duff',
    interests_movies:'Mean Girls, A Walk to Remember, Harry Potter',
    interests_general:'HTML/CSS design, Geocities, cats, glitter graphics',
    interests_heroes:'My mom, Hello Kitty',
    profile_views:521, avatar_url:'/images/avatars/pixel_girl_pink_1783831809448.png', profile_id:1005
  });

  // id=6: MP3_Hunter
  insUser.run({
    username:'MP3_Hunter', email:'mp3hunter@rediffmail.com', hash,
    display_name:'MP3 Hunter', headline:'Sharing is Caring | 56kbps Warrior',
    bio:'I have the BIGGEST mp3 collection in my neighborhood. 2000+ songs on my PC. Ask me for any song and I will burn it on a CD for you.',
    mood:'Downloading...', location:'Bangalore', gender:'Male', age:20,
    custom_css:'',
    interests_music:'Eminem, Linkin Park, Atif Aslam, Jal, Strings, Euphoria',
    interests_movies:'The Matrix, Fight Club, Gladiator',
    interests_general:'MP3 downloading, CD burning, gaming, file sharing',
    interests_heroes:'Eminem, Chester Bennington',
    profile_views:298, avatar_url:'/images/avatars/avatar_boombox_1783823552230.png', profile_id:1006
  });

  // id=7: DialUpKing
  insUser.run({
    username:'DialUpKing', email:'dialupking@vsnl.net', hash,
    display_name:'The Dial-Up King', headline:'Connection Lost... Reconnecting...',
    bio:'WHY does my mom ALWAYS pick up the phone when im online?? Dial-up life is pain. I spend 2 hours downloading one song. BSNL broadband please come to my area!!',
    mood:'56k struggles', location:'Pune', gender:'Male', age:18,
    custom_css:'body{background:#0d0d0d!important}.profile-content{color:#00ff00!important}',
    interests_music:'Linkin Park, Papa Roach, Green Day, Slipknot',
    interests_movies:'Hackers, Terminator 2, Alien',
    interests_general:'Computers, modem tweaking, IRC, BSNL helpline complaining',
    interests_heroes:'Kevin Mitnick, Neo',
    profile_views:187, avatar_url:'/images/avatars/floppy_disk_1783831878023.png', profile_id:1007
  });

  // id=8: SunnyBoy2003
  insUser.run({
    username:'SunnyBoy2003', email:'sunnyboy@yahoo.co.in', hash,
    display_name:'Sunny', headline:'Every day is a sunny day',
    bio:'Namaste dosto! I am Sunny from Jaipur. I love going to the cybercafe after school. My hobbies are cricket, carrom, and watching Shaktimaan reruns.',
    mood:'Chilling at cybercafe', location:'Jaipur', gender:'Male', age:16,
    custom_css:'',
    interests_music:'Udit Narayan, Alka Yagnik, Sonu Nigam, Kumar Sanu',
    interests_movies:'Sholay, Koi Mil Gaya, Kaho Naa Pyaar Hai',
    interests_general:'Cricket, Yahoo chatrooms, cycling, tiffin stealing',
    interests_heroes:'Sachin Tendulkar, Shaktimaan',
    profile_views:145, avatar_url:'/images/avatars/avatar_puppy_1783823536377.png', profile_id:1008
  });

  // id=9: xX_AnGeL_Xx
  insUser.run({
    username:'xX_AnGeL_Xx', email:'angel_eyes@yahoo.com', hash,
    display_name:'AnGeL', headline:'Love My Friends',
    bio:'LoVe My FrIeNdS!! SchOoL iS tHe BeSt TiMe Of OuR LiVeS!! I miss 10th class so much. If you are reading this, you are special to me.',
    mood:'Missing school days', location:'Kolkata', gender:'Female', age:18,
    custom_css:'body{background:#2d1b4e!important}.profile-content{color:#e6ccff!important}',
    interests_music:'Lucky Ali, Alisha Chinai, Falguni Pathak, Westlife',
    interests_movies:'Dil To Pagal Hai, Kuch Kuch Hota Hai, K3G',
    interests_general:'Passing chits, scrapbook writing, friendship bands',
    interests_heroes:'Shah Rukh Khan, my besties',
    profile_views:412, avatar_url:'/images/avatars/pixel_girl_1783822679066.png', profile_id:1009
  });

  // id=10: WinampFan
  insUser.run({
    username:'WinampFan', email:'winamp_llama@gmail.com', hash,
    display_name:'Winamp4Life', headline:'It really whips the llamas ass!',
    bio:'Winamp > everything else. I have 500+ Winamp skins. My current skin looks like a spaceship. If you use Windows Media Player we cant be friends lol',
    mood:'It really whips the llamas ass', location:'Hyderabad', gender:'Male', age:21,
    custom_css:'',
    interests_music:'Pink Floyd, Led Zeppelin, Iron Maiden, Metallica',
    interests_movies:'High Fidelity, Almost Famous, School of Rock',
    interests_general:'Winamp skinning, audio formats, concert bootleg trading',
    interests_heroes:'Justin Frankel (Winamp creator), Jimmy Page',
    profile_views:254, avatar_url:'/images/avatars/winamp_mascot_1783831890370.png', profile_id:1010
  });

  // id=11: Nokia3310
  insUser.run({
    username:'Nokia3310', email:'indestructible_nokia@hotmail.com', hash,
    display_name:'Snake Master', headline:'Snake High Score: 9999',
    bio:'My Nokia 3310 is indestructible. I dropped it from 3rd floor and it survived. Currently learning to type with T9.',
    mood:'On my Nokia', location:'Chennai', gender:'Male', age:17,
    custom_css:'',
    interests_music:'A.R. Rahman, Harris Jayaraj, Yuvan Shankar Raja',
    interests_movies:'Sivaji, Vikram, Anniyan',
    interests_general:'Snake II, composer mode ringtones, T9 fast typing',
    interests_heroes:'Rajinikanth, Nokia engineers',
    profile_views:310, avatar_url:'/images/avatars/nokia_3310_1783831838880.png', profile_id:1011
  });

  // id=12: BollywoodQueen
  insUser.run({
    username:'BollywoodQueen', email:'filmi_queen@yahoo.com', hash,
    display_name:'Bollywood Queen', headline:'Bollywood is Life, Bollywood is Love',
    bio:'I know the lyrics to EVERY Bollywood song from 1995-2005. Test me! My favorite actors are SRK and Hrithik. I watch every Friday release at Gaiety Galaxy.',
    mood:'Dancing to Kajra Re', location:'Mumbai', gender:'Female', age:19,
    custom_css:'',
    interests_music:'A.R. Rahman, Pritam, Himesh Reshammiya, Sunidhi Chauhan',
    interests_movies:'Dilwale Dulhania Le Jayenge, Kabhi Khushi Kabhie Gham, Devdas',
    interests_general:'Cinema, movie poster collecting, gossip magazines, antakshari',
    interests_heroes:'Shah Rukh Khan, Kajol, Aishwarya Rai',
    profile_views:654, avatar_url:'/images/avatars/avatar_alien_1783823525098.png', profile_id:1012
  });

  // id=13: TechGeek2004
  insUser.run({
    username:'TechGeek2004', email:'lets_cpp@gmail.com', hash,
    display_name:'Tech Geek', headline:'01001000 01100101 01101100 01101100 01101111',
    bio:'I built my own PC from parts I bought at Nehru Place. 256MB RAM, 40GB HDD, GeForce MX 440. Running Windows XP SP2. Will make the next Google someday!',
    mood:'Coding in BASIC', location:'Delhi', gender:'Male', age:20,
    custom_css:'body{background:#001a00!important}.profile-content{color:#00ff41!important;font-family:"Courier New",monospace!important}',
    interests_music:'Kraftwerk, Daft Punk, Jean-Michel Jarre',
    interests_movies:'WarGames, Tron, Pirates of Silicon Valley',
    interests_general:'PC building, Linux, C++, over-clocking, CRT monitors',
    interests_heroes:'Linus Torvalds, Bill Gates (sorry), Yashavant Kanetkar',
    profile_views:489, avatar_url:'/images/avatars/retro_gameboy_1783831852295.png', profile_id:1013
  });

  // id=14: Vaishnavi (Developer)
  insUser.run({
    username:'vaishnavi', email:'vaishnavi@example.com', hash,
    display_name:'Vaishnavi',
    headline:'Verified Developer of Frequency 2004 ✿',
    bio:'Hey! I am Vaishnavi, a core developer of Frequency 2004. I love designing retro interfaces, styling vintage CSS layouts, and building the future of our retro social network. Feel free to leave a scrap or test my code!',
    mood:'Styling CSS panels...',
    location:'Delhi, India', gender:'Female', age:20,
    custom_css:'body{background:#fff0f5!important}.profile-content{color:#c71585!important}a{color:#ff1493!important}',
    interests_music:'Lucky Ali, Wada Raha, Dil Dooba, Strings, KK',
    interests_movies:'Dil Chahta Hai, Kal Ho Naa Ho, Jab We Met',
    interests_general:'Web Development, UI/UX Design, CSS layouts, Pixel Art',
    interests_heroes:'Ada Lovelace, Grace Hopper',
    profile_views:120, avatar_url:'/images/avatars/pixel_girl_pink_1783831809448.png', profile_id:1014
  });

  console.log('[database]   14 users created (4 developer + 10 demo)');

  // ─── Friendships ─────────────────────────────────────
  const insFriend = db.prepare(`INSERT INTO friendships(requester_id,addressee_id,status) VALUES(?,?,'accepted')`);
  db.transaction(() => {
    [[1,2],[1,3],[1,4],[1,11],[1,14],
     [2,3],[2,4],[2,6],[2,10],[2,14],
     [3,4],[3,7],[3,10],[3,14],
     [4,5],[4,8],[4,11],
     [5,6],[5,9],
     [6,7],[6,10],
     [7,8],[8,9],[9,10],[10,11],
     [11,14]
    ].forEach(([a,b]) => insFriend.run(a,b));
  })();
  console.log('[database]   Friendships created');

  // ─── Communities ─────────────────────────────────────
  const insCom = db.prepare(`INSERT INTO communities(name,description,category,owner_id,avatar_url) VALUES(?,?,?,?,?)`);
  const insMem = db.prepare(`INSERT INTO community_members(community_id,user_id,role) VALUES(?,?,?)`);

  db.transaction(() => {
    insCom.run('Bollywood Music Lovers','For those who live and breathe Bollywood music! Share your fav songs, discuss latest albums, and relive the golden era.','Music',1,'/images/avatars/comm_pixel1.png');
    insCom.run('School Days Nostalgia','Remember the good old school days? Tiffin sharing, PT periods, annual day, and bunking classes. Share your memories!','Nostalgia',7,'/images/avatars/comm_pixel2.png');
    insCom.run('Dial-Up Survivors Club','If you have ever been disconnected because someone picked up the phone, this community is for you.','Technology',5,'/images/avatars/comm_pixel3.png');
    insCom.run('Nokia 3310 Appreciation Society','The phone that refused to die. Share your Snake scores and ringtones!','Fun & Games',9,'/images/avatars/comm_pixel4.png');
    insCom.run('Retro Games Forever','Mario, Contra, Dave, Road Rash, NFS II SE... if these names give you goosebumps, join us!','Fun & Games',11,'/images/avatars/comm_pixel5.png');
    insCom.run('Frequency 2004 FM Listeners','Official community for Frequency 2004 FM radio listeners. Request songs and share the love for radio!','Music',1,'/images/avatars/comm_pixel1.png');

    // Music Zones (Communities with category = 'MusicZone')
    insCom.run('O Sanam Zone','Official zone for O Sanam by Lucky Ali. Listen to the track and chat with fellow fans!','MusicZone',7,'/images/avatars/comm_music_1783822902926.png');
    insCom.run('Dil Chahta Hai Zone','Official zone for the ultimate friendship anthem Dil Chahta Hai!','MusicZone',3,'/images/avatars/comm_music_1783822902926.png');
    insCom.run('Wada Raha Zone','Official zone for Wada Raha Pyaar Se from Khakee. Discuss the beautiful lyrics!','MusicZone',9,'/images/avatars/comm_music_1783822902926.png');
    insCom.run('Kaho Naa Pyaar Hai Zone','Official zone for Kaho Naa Pyaar Hai. Discuss the iconic steps!','MusicZone',1,'/images/avatars/comm_music_1783822902926.png');

    // c1 Bollywood
    [[1,1,'owner'],[1,4,'member'],[1,5,'member'],[1,8,'member'],[1,12,'moderator'],[1,9,'member']].forEach(r=>insMem.run(...r));
    // c2 School
    [[2,9,'owner'],[2,1,'member'],[2,4,'member'],[2,8,'member'],[2,11,'member'],[2,12,'member']].forEach(r=>insMem.run(...r));
    // c3 Dial-Up
    [[3,7,'owner'],[3,1,'member'],[3,6,'member'],[3,8,'member'],[3,10,'member'],[3,13,'member']].forEach(r=>insMem.run(...r));
    // c4 Nokia
    [[4,11,'owner'],[4,7,'member'],[4,8,'member'],[4,9,'member'],[4,12,'member']].forEach(r=>insMem.run(...r));
    // c5 Games
    [[5,13,'owner'],[5,1,'member'],[5,6,'member'],[5,7,'member'],[5,8,'member'],[5,10,'moderator']].forEach(r=>insMem.run(...r));
    // c6 FM
    [[6,1,'owner'],[6,4,'member'],[6,5,'member'],[6,9,'member'],[6,12,'member'],[6,8,'member'],[6,10,'member']].forEach(r=>insMem.run(...r));

    // c7 O Sanam Zone (id=7)
    [[7,7,'owner'],[7,1,'member'],[7,2,'member'],[7,3,'member'],[7,14,'member']].forEach(r=>insMem.run(...r));
    // c8 Dil Chahta Hai Zone (id=8)
    [[8,3,'owner'],[8,1,'member'],[8,2,'member'],[8,4,'member'],[8,13,'member'],[8,14,'member']].forEach(r=>insMem.run(...r));
    // c9 Wada Raha Zone (id=9)
    [[9,9,'owner'],[9,1,'member'],[9,2,'member'],[9,11,'member'],[9,14,'member']].forEach(r=>insMem.run(...r));
    // c10 Kaho Naa Pyaar Hai Zone (id=10)
    [[10,1,'owner'],[10,2,'member'],[10,4,'member'],[10,14,'member']].forEach(r=>insMem.run(...r));
  })();
  console.log('[database]   10 communities (6 standard + 4 MusicZones) + memberships created');

  // ─── Community Posts + Replies ───────────────────────
  // Capture lastInsertRowid after each post to reference it in replies
  const insPost  = db.prepare(`INSERT INTO community_posts(community_id,author_id,title,content) VALUES(?,?,?,?)`);
  const insReply = db.prepare(`INSERT INTO community_replies(post_id,author_id,content) VALUES(?,?,?)`);
  const ap = (c,u,t,b) => insPost.run(c,u,t,b).lastInsertRowid;
  const ar = (p,u,b)   => insReply.run(p,u,b);

  // Community 1: Bollywood
  const b1 = ap(1,1,'Welcome to Bollywood Music Lovers!','I created this community for sharing our love of Bollywood. Drop your top 5 songs of 2003 below!');
  const b2 = ap(1,4,'Best Bollywood song of 2003??','Kal Ho Naa Ho title track is the BEST this year. What do you think?');
  const b3 = ap(1,12,'Shankar-Ehsaan-Loy appreciation','Dil Chahta Hai, Kal Ho Naa Ho, Bunty Aur Babli... every album is a banger!!');
  ar(b1,12,'The FM stations keep playing their songs all day and I never get tired of it!');
  ar(b1, 4,'Kal Ho Naa Ho forever!! SRK is unbeatable.');
  ar(b2,12,'Kajra Re is also stuck in my head 24/7 lol.');
  ar(b2, 6,'I have a 320kbps version of the full album if anyone wants it. DM me on Yahoo!');

  // Community 2: School Days
  const s1 = ap(2,9,'Things only 90s kids remember','SLAM BOOKS!! Remember filling them for all your friends?? I still have mine from 8th class!');
  const s2 = ap(2,8,'PT period was the best period!!','No books, no homework, just playing in the ground!');
  ar(s1, 5,'OMG SLAM BOOKS YES!! My favorite color answer was always PINK.');
  ar(s1, 8,'Remember those friendship bands?? We used to make them in art class on Friendship Day.');
  ar(s2, 4,'Dude the best was tiffin sharing. My mom made the best parathas and everyone wanted to trade.');

  // Community 3: Dial-Up
  const d1 = ap(3,7,'BSNL broadband launch date confirmed??','I heard BSNL is launching broadband next month!! 256 kbps for Rs. 500/month!! NO MORE DIAL-UP!!');
  const d2 = ap(3,13,'Tips to speed up dial-up','Close all background programs. Disable images in browser. Download files at night.');
  ar(d1, 7,'FINALLY!! No more download resume issues at 3 AM!!');
  ar(d2, 9,'DISABLE IMAGES?? But how will I see the cool profile pictures on Orkut??');
  ar(d2, 11,'Pro tip: download between 2-5 AM. Fastest speeds because everyone is sleeping.');

  // Community 4: Nokia
  const n1 = ap(4,11,'Post your Snake high scores!!','My current high score is 9999 (maxed it out). I play during every boring class. What is yours??');
  const n2 = ap(4,8,'Best self-composed ringtone?','I spent 3 hours composing Kal Ho Naa Ho on my Nokia. It sounds 80% like the original!');
  ar(n1, 8,'My score is 7832. How do you get 9999?? Are you playing during EVERY class??');
  ar(n1, 11,'I got 8500 once but my friend called and I lost focus. Phone calls ruin everything.');

  // Community 5: Games
  const g1 = ap(5,13,'NFS II SE or Road Rash - which is better??','ULTIMATE debate. NFS II SE has better graphics. Road Rash has the thrill of hitting people with clubs lol.');
  const g2 = ap(5, 10,'Dave is the most underrated game ever','Everyone talks about Mario and Contra but NO ONE talks about Dangerous Dave!!');
  const g3 = ap(5, 1,'Contra: Up Up Down Down Left Right Left Right B A','If you know this code, you are a real gamer. 30 lives! We used to play 2-player at my friends house every Sunday.');
  ar(g1, 4,'ROAD RASH any day!! The feeling of kicking someone off their bike at 200 km/h is unmatched.');
  ar(g1, 8,'NFS II SE! That Monolithic Studios track with the McLaren F1 is the GOAT racing experience.');
  ar(g3,13,'The Konami Code!! Essential knowledge. Without 30 lives that game is impossible.');
  ar(g3, 10,'I once completed Contra without the code. Took 3 weeks of practice. My proudest achievement.');

  // Community 6: FM Radio
  const f1 = ap(6,1,'Song request thread!','Post your song requests here! Most requested so far: Kal Ho Naa Ho. Keep them coming!');
  const f2 = ap(6,12,'The midnight show is the best!','Does anyone else stay up late to listen?? Slow romantic songs + no ads = perfection.');
  ar(f1,12,'Please play Tere Bina by A.R. Rahman!! I love that song so much.');
  ar(f1, 9,'Can you play some sad songs at night?? Tujhe Bhula Diya and Aadat pls!!');
  ar(f1, 5,'Play some Backstreet Boys too!! Not everything has to be Bollywood.');
  console.log('[database]   Community posts + replies created');

  // ─── Scraps ──────────────────────────────────────────
  const insScrap = db.prepare(`INSERT INTO scraps(author_id,recipient_id,content) VALUES(?,?,?)`);
  db.transaction(() => {
    insScrap.run(4, 1,'bro this site is AMAZING!! you built this whole thing?? add me on Yahoo Messenger lets chat!!');
    insScrap.run(5, 1,'heyyy!! your profile looks so cool!! can you teach me how to code too?? pls pls pls!!');
    insScrap.run(13,1,'nice work on Frequency 2004! The retro XP theme is a nice touch. Did you use EJS for the templates?');
    insScrap.run(12,1,'I am your biggest fan!! This website is so cool. Please add a Bollywood songs section!!');
    insScrap.run(4, 5,'hey pixel princess!! love ur new profile style!! the pink theme is SO pretty!');
    insScrap.run(5, 4,'aww thank you!! I spent 3 hours on the custom CSS hehe. How did you find this site??');
    insScrap.run(6, 4,'PixelPrincess can you burn me a CD of your fav songs?? I can pay 20 rupees!!');
    insScrap.run(7, 6,'bro I have been disconnected 5 times today. MOM KEEPS PICKING UP THE PHONE!!!!');
    insScrap.run(11,12,'bollywood queen do an antakshari with me!! I bet I know more SRK songs than you!!');
    insScrap.run(12,11,'CHALLENGE ACCEPTED!! Meet me at the cybercafe at 5pm!!');
    insScrap.run(10,13,'bro your pc build sounds epic. How did you get the GeForce MX 440 so cheap from Nehru Place??');
    insScrap.run(13,10,'haha the shopkeeper gave me wholesale price. Go early morning — that is the trick!');
  })();
  console.log('[database]   Scraps created');

  // ─── Testimonials on Ansh Mishra profile ─────────────
  const insTest = db.prepare(`INSERT INTO testimonials(author_id,recipient_id,content,approved) VALUES(?,?,?,1)`);
  db.transaction(() => {
    insTest.run(13,1,'Ansh built this entire platform from scratch. Node.js backend, SQLite database, custom retro CSS, the works. Absolute legend. This is the coolest indie project I have seen!! Future Google founder right here.');
    insTest.run(4, 1,'Dude bro this site is SICK!! It reminds me of Orkut but 10x cooler. I have been on it every day since I joined. Add me as friend if you have not already!!');
    insTest.run(12,1,'Ansh created a website that feels like 2004 but works perfectly today. The nostalgia hit me like a train. Thank you for building this!! It brought back so many school memories.');
  })();
  console.log('[database]   Testimonials created');

  // ─── Shoutbox ────────────────────────────────────────
  const insShout = db.prepare(`INSERT INTO shoutbox_messages(user_id,content) VALUES(?,?)`);
  db.transaction(() => {
    insShout.run(4, 'A/S/L? lol old school but had to do it');
    insShout.run(7, 'lol dial-up disconnected again :( this is the 5th time today. MOM!!');
    insShout.run(6, 'anyone recording songs from the radio?? I need the new Atif Aslam song!!');
    insShout.run(7, 'brb, someone picked up the phone line again. My downloading speed just died.');
    insShout.run(10, 'Winamp really whips the llamas ass!! Best media player ever made fight me.');
    insShout.run(9, 'omg this song reminds me of school days!! 10th class memories hitting different.');
    insShout.run(11, 'send me the ringtone pls!! what are the keystrokes for Kal Ho Naa Ho?');
    insShout.run(8, 'yahoo messenger anyone?? my ID is sunny_boy_jpr');
    insShout.run(5, 'hiiii everyone!! just updated my profile!! come see my new pink theme!!');
    insShout.run(12,'Kajra Re Kajra Re... cant stop singing this song!!');
    insShout.run(13,'just compiled my first C++ program without errors!! cout << "hello world"');
    insShout.run(4, 'who wants to play counter strike at cybercafe this weekend??');
    insShout.run(11, 'new snake high score: 9247!! come at me!!');
    insShout.run(9, 'friendship day coming soon!! making friendship bands for everyone!!');
    insShout.run(1, 'Welcome to Frequency 2004 everyone!! Hope you enjoy the site. Drop me a scrap!');
  })();
  console.log('[database]   Shoutbox messages created');

  // ─── Ratings ─────────────────────────────────────────
  const insRating = db.prepare(`INSERT INTO ratings(rater_id,rated_id,trustworthy,cool,sexy,is_fan,is_crush) VALUES(?,?,?,?,?,?,?)`);
  db.transaction(() => {
    insRating.run(4, 1, 3,3,1,1,0);  // CoOl_DuDe99 -> Ansh
    insRating.run(13,1, 3,3,1,1,0);  // TechGeek -> Ansh
    insRating.run(12,1, 3,2,1,1,0);  // BollywoodQueen -> Ansh
    insRating.run(5, 4, 3,3,2,1,0);  // PixelPrincess -> CoOl_DuDe99
    insRating.run(4, 5, 3,3,3,1,1);  // CoOl_DuDe99 -> PixelPrincess (crush!)
    insRating.run(8, 9, 3,3,2,0,1);  // SunnyBoy -> Angel (crush!)
    insRating.run(9, 8, 3,2,2,0,1);  // Angel -> SunnyBoy (mutual!)
    insRating.run(12,4, 3,2,1,1,0);  // BollywoodQueen -> CoOl_DuDe99
    insRating.run(6,13, 3,3,1,1,0);  // MP3_Hunter -> TechGeek
  })();
  console.log('[database]   Ratings created');

  console.log('[database] All seed data inserted successfully!');
}

// ══════════════════════════════════════════════════════════
//  INITIALIZE
// ══════════════════════════════════════════════════════════
function initialize() {
  try {
    // Check if 'vaishnavi' user exists. If tables exist but she is missing,
    // we drop tables and re-seed to include her and the MusicZones.
    let needReSeed = false;
    try {
      const uCount = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name='users'").get();
      if (uCount.count > 0) {
        const vExists = db.prepare("SELECT id FROM users WHERE username = 'vaishnavi'").get();
        if (!vExists) {
          needReSeed = true;
        }
      }
    } catch(e) {
      // Tables don't exist yet, standard initialize will handle creation & seeding
    }

    if (needReSeed) {
      console.log("[database] Dev database version outdated. Dropping tables to re-seed Dev Vaishnavi + MusicZones...");
      const tables = [
        'users', 'friendships', 'top_friends', 'scraps', 'testimonials', 
        'ratings', 'communities', 'community_members', 'community_posts', 
        'community_replies', 'shoutbox_messages', 'direct_messages', 'slambook_entries'
      ];
      for (const table of tables) {
        db.prepare(`DROP TABLE IF EXISTS ${table}`).run();
      }
    }

    createTables();
    console.log('[database] All 13 tables ready');

    // Migration: add profile_id column if missing
    try {
      db.prepare('SELECT profile_id FROM users LIMIT 1').get();
    } catch(e) {
      try {
        db.exec('ALTER TABLE users ADD COLUMN profile_id INTEGER');
        const users = db.prepare('SELECT id FROM users').all();
        let pid = 1000;
        const upd = db.prepare('UPDATE users SET profile_id=? WHERE id=?');
        db.transaction(() => { for (const u of users) upd.run(++pid, u.id); })();
        db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_profile_id ON users(profile_id)');
        console.log('[database] Migration: profile_id column added');
      } catch(me) {
        console.error('[database] Migration failed:', me.message);
      }
    }

    const { count } = db.prepare('SELECT COUNT(*) AS count FROM users').get();
    if (count === 0) {
      seedData();
    } else {
      console.log(`[database] ${count} users found — skipping seed`);
    }
  } catch(err) {
    console.error('[database] FATAL:', err.message);
    throw err;
  }
}

module.exports = { db, initialize };
