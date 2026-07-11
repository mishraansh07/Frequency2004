const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// ──────────────────────────────────────────────
// GET / — Load shoutbox messages and render radio page
// Displays the last 50 shoutbox messages
// ──────────────────────────────────────────────
router.get('/', (req, res) => {
    try {
        const db = req.app.locals.db;

        // Load last 50 shoutbox messages with user info
        const messages = db.db.prepare(`
            SELECT sm.id, sm.content, sm.created_at,
                   u.username, u.display_name
            FROM shoutbox_messages sm
            JOIN users u ON u.id = sm.user_id
            ORDER BY sm.created_at DESC
            LIMIT 50
        `).all();

        res.render('radio', {
            title: 'Radio & Shoutbox',
            messages
        });
    } catch (err) {
        console.error('Shoutbox page error:', err);
        res.status(500).render('error', { title: 'Error', message: 'Failed to load shoutbox.' });
    }
});

// ──────────────────────────────────────────────
// POST / — Post a new shoutbox message
// ──────────────────────────────────────────────
router.post('/', requireAuth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const currentUserId = req.session.userId;
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.redirect('/shoutbox');
        }

        // Insert the shoutbox message
        db.db.prepare(`
            INSERT INTO shoutbox_messages (user_id, content)
            VALUES (?, ?)
        `).run(currentUserId, content.trim());

        res.redirect('/shoutbox');
    } catch (err) {
        console.error('Shoutbox post error:', err);
        res.redirect('/shoutbox');
    }
});

// ──────────────────────────────────────────────
// GET /api/messages — JSON API for AJAX polling
// Returns the last 50 messages as JSON for live updates
// ──────────────────────────────────────────────
router.get('/api/messages', (req, res) => {
    try {
        const db = req.app.locals.db;

        const messages = db.db.prepare(`
            SELECT sm.id, sm.content, sm.created_at,
                   u.username, u.display_name
            FROM shoutbox_messages sm
            JOIN users u ON u.id = sm.user_id
            ORDER BY sm.created_at DESC
            LIMIT 50
        `).all();

        res.json(messages);
    } catch (err) {
        console.error('Shoutbox API error:', err);
        res.status(500).json({ error: 'Failed to load messages.' });
    }
});

module.exports = router;
