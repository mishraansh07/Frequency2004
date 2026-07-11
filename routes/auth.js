const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { requireAuth } = require('../middleware/auth');

// ──────────────────────────────────────────────
// GET /login — Render login page
// ──────────────────────────────────────────────
router.get('/login', (req, res) => {
    res.render('login', { title: 'Login', error: null });
});

// ──────────────────────────────────────────────
// POST /login — Authenticate user credentials
// ──────────────────────────────────────────────
router.post('/login', (req, res) => {
    try {
        const db = req.app.locals.db;
        const { username, password } = req.body;

        // Look up user by username
        const user = db.db.prepare('SELECT * FROM users WHERE username = ?').get(username);

        if (!user) {
            return res.render('login', { title: 'Login', error: 'Invalid username or password.' });
        }

        // Compare submitted password with stored hash
        const valid = bcrypt.compareSync(password, user.password_hash);
        if (!valid) {
            return res.render('login', { title: 'Login', error: 'Invalid username or password.' });
        }

        // Set session and redirect to home
        req.session.userId = user.id;
        res.redirect('/home');
    } catch (err) {
        console.error('Login error:', err);
        res.render('login', { title: 'Login', error: 'Something went wrong. Please try again.' });
    }
});

// ──────────────────────────────────────────────
// GET /register — Render registration page
// ──────────────────────────────────────────────
router.get('/register', (req, res) => {
    res.render('register', { title: 'Register', error: null });
});

// ──────────────────────────────────────────────
// POST /register — Create a new user account
// ──────────────────────────────────────────────
router.post('/register', (req, res) => {
    try {
        const db = req.app.locals.db;
        const { username, email, password, display_name } = req.body;

        // Validate required fields
        if (!username || !email || !password || !display_name) {
            return res.render('register', {
                title: 'Register',
                error: 'All fields are required.'
            });
        }

        // Hash the password
        const password_hash = bcrypt.hashSync(password, 10);

        // Insert new user into database
        const result = db.db.prepare(`
            INSERT INTO users (username, email, password_hash, display_name)
            VALUES (?, ?, ?, ?)
        `).run(username, email, password_hash, display_name);

        // Set session and redirect to home
        req.session.userId = result.lastInsertRowid;
        res.redirect('/home');
    } catch (err) {
        console.error('Registration error:', err);

        // Handle unique constraint violations (duplicate username/email)
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
            let field = 'username or email';
            if (err.message.includes('users.username')) field = 'username';
            if (err.message.includes('users.email')) field = 'email';
            return res.render('register', {
                title: 'Register',
                error: `That ${field} is already taken.`
            });
        }

        res.render('register', {
            title: 'Register',
            error: 'Something went wrong. Please try again.'
        });
    }
});

// ──────────────────────────────────────────────
// GET /logout — Destroy session and redirect
// ──────────────────────────────────────────────
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error('Logout error:', err);
        res.redirect('/login');
    });
});

// ──────────────────────────────────────────────
// GET /home — Dashboard / home page (requires auth)
// ──────────────────────────────────────────────
router.get('/home', requireAuth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const currentUserId = req.session.userId;

        // Load current user info
        const currentUser = db.db.prepare('SELECT * FROM users WHERE id = ?').get(currentUserId);

        // Load friends (accepted friendships, joined with user details)
        const friends = db.db.prepare(`
            SELECT u.* FROM friendships f
            JOIN users u ON u.id = CASE
                WHEN f.requester_id = ? THEN f.addressee_id
                ELSE f.requester_id
            END
            WHERE f.status = 'accepted'
            AND (f.requester_id = ? OR f.addressee_id = ?)
        `).all(currentUserId, currentUserId, currentUserId);

        // Load recent scraps received by current user (last 10)
        const scraps = db.db.prepare(`
            SELECT s.*, u.username AS author_username, u.display_name AS author_display_name,
                   u.avatar_url AS author_avatar
            FROM scraps s
            JOIN users u ON u.id = s.author_id
            WHERE s.recipient_id = ?
            ORDER BY s.created_at DESC
            LIMIT 10
        `).all(currentUserId);

        // Load communities the user belongs to
        const communities = db.db.prepare(`
            SELECT c.* FROM community_members cm
            JOIN communities c ON c.id = cm.community_id
            WHERE cm.user_id = ?
        `).all(currentUserId);

        // Load 5 random other users as "cool people" suggestions
        const coolPeople = db.db.prepare(`
            SELECT id, username, display_name, avatar_url, headline
            FROM users
            WHERE id != ?
            ORDER BY RANDOM()
            LIMIT 5
        `).all(currentUserId);

        // Count pending friend requests received
        const pendingCount = db.db.prepare(`
            SELECT COUNT(*) as count FROM friendships
            WHERE addressee_id = ? AND status = 'pending'
        `).get(currentUserId).count;

        res.render('home', {
            title: 'Home',
            currentUser,
            friends,
            scraps,
            communities,
            coolPeople,
            pendingCount
        });
    } catch (err) {
        console.error('Home page error:', err);
        res.status(500).render('error', { title: 'Error', message: 'Failed to load home page.' });
    }
});

// ──────────────────────────────────────────────
// GET /search — Search users and communities
// ──────────────────────────────────────────────
router.get('/search', (req, res) => {
    try {
        const db = req.app.locals.db;
        const q = req.query.q || '';

        let users = [];
        let communities = [];

        if (q.trim()) {
            const searchTerm = `%${q}%`;

            // Search users by username or display_name
            users = db.db.prepare(`
                SELECT id, username, display_name, avatar_url, headline
                FROM users
                WHERE username LIKE ? OR display_name LIKE ?
                LIMIT 50
            `).all(searchTerm, searchTerm);

            // Search communities by name
            communities = db.db.prepare(`
                SELECT * FROM communities
                WHERE name LIKE ?
                LIMIT 50
            `).all(searchTerm);
        }

        res.render('search', {
            title: 'Search',
            q,
            users,
            communities
        });
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).render('error', { title: 'Error', message: 'Search failed.' });
    }
});

module.exports = router;
