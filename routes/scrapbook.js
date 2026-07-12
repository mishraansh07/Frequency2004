const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// Number of scraps to show per page
const SCRAPS_PER_PAGE = 20;

// ──────────────────────────────────────────────
// GET /:username — View a user's scrapbook (paginated)
// ──────────────────────────────────────────────
router.get('/:username', (req, res) => {
    try {
        const db = req.app.locals.db;
        const { username } = req.params;
        const page = Math.max(1, parseInt(req.query.page) || 1);

        // Load the profile user
        const profileUser = db.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!profileUser) {
            return res.status(404).render('error', { title: '404', message: 'User not found.' });
        }

        // Count total scraps for pagination
        const totalScraps = db.db.prepare(`
            SELECT COUNT(*) as count FROM scraps WHERE recipient_id = ?
        `).get(profileUser.id).count;

        const totalPages = Math.max(1, Math.ceil(totalScraps / SCRAPS_PER_PAGE));
        const offset = (page - 1) * SCRAPS_PER_PAGE;

        // Load scraps for this page with author info
        const scraps = db.db.prepare(`
            SELECT s.*, u.username AS author_username, u.display_name AS author_display_name,
                   u.avatar_url AS author_avatar
            FROM scraps s
            JOIN users u ON u.id = s.author_id
            WHERE s.recipient_id = ?
            ORDER BY s.created_at DESC
            LIMIT ? OFFSET ?
        `).all(profileUser.id, SCRAPS_PER_PAGE, offset);

        res.render('scrapbook', {
            title: `${profileUser.display_name}'s Scrapbook`,
            profileUser,
            scraps,
            page,
            totalPages
        });
    } catch (err) {
        console.error('Scrapbook view error:', err);
        res.status(500).render('error', { title: 'Error', message: 'Failed to load scrapbook.' });
    }
});

// ──────────────────────────────────────────────
// POST /:username — Leave a scrap on someone's wall
// ──────────────────────────────────────────────
router.post('/:username', requireAuth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const { username } = req.params;
        const currentUserId = req.session.userId;

        // Find the recipient user
        const profileUser = db.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!profileUser) {
            return res.status(404).render('error', { title: '404', message: 'User not found.' });
        }

        const { content } = req.body;
        if (!content || !content.trim()) {
            return res.redirect(`/scrapbook/${username}`);
        }

        // Insert the scrap
        db.db.prepare(`
            INSERT INTO scraps (author_id, recipient_id, content)
            VALUES (?, ?, ?)
        `).run(currentUserId, profileUser.id, content.trim());

        res.redirect(`/scrapbook/${username}`);
    } catch (err) {
        console.error('Post scrap error:', err);
        res.redirect('back');
    }
});

// ──────────────────────────────────────────────
// POST /delete/:id — Delete a scrap (author only)
// Only the scrap author can delete it
// ──────────────────────────────────────────────
router.post('/delete/:id', requireAuth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const scrapId = parseInt(req.params.id);
        const currentUserId = req.session.userId;

        // Delete if current user is either the scrap author or the scrapbook owner (recipient)
        db.db.prepare(`
            DELETE FROM scraps
            WHERE id = ? AND (author_id = ? OR recipient_id = ?)
        `).run(scrapId, currentUserId, currentUserId);

        // Redirect back to the referring page
        const referer = req.get('referer') || '/home';
        res.redirect(referer);
    } catch (err) {
        console.error('Delete scrap error:', err);
        const referer = req.get('referer') || '/home';
        res.redirect(referer);
    }
});

module.exports = router;
