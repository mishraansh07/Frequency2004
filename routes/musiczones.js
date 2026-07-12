const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// GET / - List all music zones
router.get('/', (req, res) => {
    try {
        const db = req.app.locals.db;
        const zones = db.db.prepare(`
            SELECT c.*, COUNT(cm.user_id) as member_count
            FROM communities c
            LEFT JOIN community_members cm ON cm.community_id = c.id
            WHERE c.category = 'MusicZone'
            GROUP BY c.id
            ORDER BY member_count DESC
        `).all();

        res.render('musiczones', {
            title: 'Music Zones',
            zones
        });
    } catch (err) {
        console.error('Error loading music zones:', err);
        res.status(500).render('error', { title: 'Error', message: 'Failed to load music zones.' });
    }
});

module.exports = router;
