# Frequency 2004 — Retro Social Network 🕹️

Frequency 2004 is a premium, high-fidelity retro social network web application designed to recreate the golden era of the early 2000s web. The design draws heavy inspiration from **MySpace (2003-2008)**, **Orkut (2004-2010)**, and the classic **Windows XP / Internet Explorer 6** system interface.

Built using Node.js, Express, better-sqlite3, and custom CSS styling, it incorporates authentic Web 1.0 details, music playlist playback, and modern real-time capabilities.

---

## 🌟 Key Features

*   **Verified Developer Badges**: Automatic verified badging for developers (`anshmishra`, `naitik12`, `Exe_sparsh`).
*   **Custom Retro Pixel Avatars**: A selection of 16 custom retro avatars, with support for direct user image uploads.
*   **XP Window Interface & Theme**: Windows XP metallic gray borders, gradient blue title bars, CRT scanline overlay filters, and custom cursor sparkle trails.
*   **Classic Orkut Rating Bars**: Trustworthy, Cool, and Sexy ratings including mutually discovered "Crush" notifications.
*   **iPod Music Player**: Functional vintage iPod click-wheel audio player loaded with Bollywood classics. Autoplays profile-specific ambient audio on user click.
*   **Live Broadcast Shoutbox**: WebSockets-driven real-time global shoutbox chat with automatic HTTP polling fallback.
*   **Community Groups & Discussion Boards**: Custom groups with member management, thread discussions, replies, and custom community logo upload capabilities.
*   **MySpace Custom CSS Overrides**: Custom CSS profile styling overrides saved dynamically per profile.

---

## 🛠️ Stack & Technologies

*   **Backend**: Node.js, Express.js
*   **Database**: SQLite (`better-sqlite3`), with `connect-sqlite3` session store
*   **Frontend Engine**: EJS (Embedded JavaScript) Templates
*   **Styling**: Vanilla CSS (XP-style modular design tokens)
*   **Real-time engine**: WebSockets (`ws` package)
*   **Upload Handling**: `multer` multipart engine

---

## ⚙️ Installation & Local Setup

### 1. Clone the repository
```bash
git clone https://github.com/mishraansh07/Frequency2004.git
cd Frequency2004
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your web browser. The application will automatically initialize and seed the local database.

---

## 🌐 Environment Configurations

For persistent hosting setups (such as Render or Heroku) where disk storage is ephemeral, configure the following environment variable to link an external database:

*   `DATABASE_URL`: Connection string to an external PostgreSQL or SQLite database. If omitted, the application falls back to seeding a local `retrosocial.db` file.
