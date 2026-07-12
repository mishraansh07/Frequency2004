const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// ──────────────────────────────────────────────
// GET / — Friends list, pending requests, and Top 8
// ──────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const currentUserId = req.session.userId;

        // Load all accepted friends (both directions)
        const friends = db.db.prepare(`
            SELECT u.id, u.username, u.display_name, u.avatar_url, u.headline
            FROM friendships f
            JOIN users u ON u.id = CASE
                WHEN f.requester_id = ? THEN f.addressee_id
                ELSE f.requester_id
            END
            WHERE f.status = 'accepted'
            AND (f.requester_id = ? OR f.addressee_id = ?)
        `).all(currentUserId, currentUserId, currentUserId);

        // Load pending friend requests received by current user
        const pendingRequests = db.db.prepare(`
            SELECT u.id, u.username, u.display_name, u.avatar_url, u.headline, f.created_at as request_date
            FROM friendships f
            JOIN users u ON u.id = f.requester_id
            WHERE f.addressee_id = ? AND f.status = 'pending'
            ORDER BY f.created_at DESC
        `).all(currentUserId);

        // Load current Top 8 friends (ordered by position)
        const top8 = db.db.prepare(`
            SELECT u.id, u.username, u.display_name, u.avatar_url, tf.position
            FROM top_friends tf
            JOIN users u ON u.id = tf.friend_id
            WHERE tf.user_id = ?
            ORDER BY tf.position ASC
        `).all(currentUserId);

        res.render('friends', {
            title: 'My Friends',
            friends,
            pendingRequests,
            top8
        });
    } catch (err) {
        console.error('Friends list error:', err);
        res.status(500).render('error', { title: 'Error', message: 'Failed to load friends.' });
    }
});

// ──────────────────────────────────────────────
// POST /request/:userId — Send a friend request
// ──────────────────────────────────────────────
router.post('/request/:userId', requireAuth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const currentUserId = req.session.userId;
        const targetUserId = parseInt(req.params.userId);

        // Prevent self-friending
        if (currentUserId === targetUserId) {
            return res.redirect('back');
        }

        // Check if a friendship already exists in either direction
        const existing = db.db.prepare(`
            SELECT * FROM friendships
            WHERE (requester_id = ? AND addressee_id = ?)
               OR (requester_id = ? AND addressee_id = ?)
        `).get(currentUserId, targetUserId, targetUserId, currentUserId);

        if (existing) {
            return res.redirect('back');
        }

        // Insert the pending friend request
        db.db.prepare(`
            INSERT INTO friendships (requester_id, addressee_id, status)
            VALUES (?, ?, 'pending')
        `).run(currentUserId, targetUserId);

        res.redirect('back');
    } catch (err) {
        console.error('Friend request error:', err);
        res.redirect('back');
    }
});

// ──────────────────────────────────────────────
// POST /cancel/:userId — Cancel/Withdraw a friend request
// ──────────────────────────────────────────────
router.post('/cancel/:userId', requireAuth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const currentUserId = req.session.userId;
        const targetUserId = parseInt(req.params.userId);

        // Delete the pending request in the direction currentUserId -> targetUserId
        db.db.prepare(`
            DELETE FROM friendships
            WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'
        `).run(currentUserId, targetUserId);

        res.redirect('back');
    } catch (err) {
        console.error('Cancel friend request error:', err);
        res.redirect('back');
    }
});

// ──────────────────────────────────────────────
// POST /accept/:userId — Accept a friend request
// ──────────────────────────────────────────────
router.post('/accept/:userId', requireAuth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const currentUserId = req.session.userId;
        const requesterId = parseInt(req.params.userId);

        // Update the pending request to accepted
        db.db.prepare(`
            UPDATE friendships
            SET status = 'accepted'
            WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'
        `).run(requesterId, currentUserId);

        res.redirect('back');
    } catch (err) {
        console.error('Accept friend error:', err);
        res.redirect('back');
    }
});

// ──────────────────────────────────────────────
// POST /reject/:userId — Reject a friend request
// ──────────────────────────────────────────────
router.post('/reject/:userId', requireAuth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const currentUserId = req.session.userId;
        const requesterId = parseInt(req.params.userId);

        // Delete the pending request
        db.db.prepare(`
            DELETE FROM friendships
            WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'
        `).run(requesterId, currentUserId);

        res.redirect('back');
    } catch (err) {
        console.error('Reject friend error:', err);
        res.redirect('back');
    }
});

// ──────────────────────────────────────────────
// POST /remove/:userId — Remove a friend entirely
// Deletes friendship in both directions and removes
// from Top 8 if they were in it
// ──────────────────────────────────────────────
router.post('/remove/:userId', requireAuth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const currentUserId = req.session.userId;
        const friendId = parseInt(req.params.userId);

        // Delete friendship in both directions
        db.db.prepare(`
            DELETE FROM friendships
            WHERE (requester_id = ? AND addressee_id = ?)
               OR (requester_id = ? AND addressee_id = ?)
        `).run(currentUserId, friendId, friendId, currentUserId);

        // Also remove from Top 8 (both ways, to be safe)
        db.db.prepare(`
            DELETE FROM top_friends
            WHERE (user_id = ? AND friend_id = ?)
               OR (user_id = ? AND friend_id = ?)
        `).run(currentUserId, friendId, friendId, currentUserId);

        res.redirect('back');
    } catch (err) {
        console.error('Remove friend error:', err);
        res.redirect('back');
    }
});

// ──────────────────────────────────────────────
// POST /top8 — Set the user's Top 8 friends
// Expects friend_1 through friend_8 as user IDs in
// the request body. Empty values are skipped.
// ──────────────────────────────────────────────
router.post('/top8', requireAuth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const currentUserId = req.session.userId;

        // Clear existing Top 8 for this user
        db.db.prepare('DELETE FROM top_friends WHERE user_id = ?').run(currentUserId);

        // Insert new Top 8 positions from form data
        const insertStmt = db.db.prepare(`
            INSERT INTO top_friends (user_id, friend_id, position)
            VALUES (?, ?, ?)
        `);

        for (let i = 1; i <= 8; i++) {
            const friendId = req.body[`friend_${i}`];
            if (friendId && friendId.trim()) {
                insertStmt.run(currentUserId, parseInt(friendId), i);
            }
        }

        res.redirect('back');
    } catch (err) {
        console.error('Top 8 update error:', err);
        res.redirect('back');
    }
});

module.exports = router;
