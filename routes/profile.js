const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// ──────────────────────────────────────────────
// BFS: Find degrees of separation between two users
// Traverses the friendships graph up to 6 degrees deep
// ──────────────────────────────────────────────
function findDegrees(db, fromId, toId) {
    if (fromId === toId) return 0;
    const visited = new Set([fromId]);
    let queue = [fromId];
    let degree = 0;
    while (queue.length > 0 && degree < 6) {
        degree++;
        const nextQueue = [];
        for (const userId of queue) {
            const friends = db.prepare(`
                SELECT CASE WHEN requester_id = ? THEN addressee_id ELSE requester_id END as friend_id
                FROM friendships WHERE status = 'accepted'
                AND (requester_id = ? OR addressee_id = ?)
            `).all(userId, userId, userId);
            for (const f of friends) {
                if (f.friend_id === toId) return degree;
                if (!visited.has(f.friend_id)) {
                    visited.add(f.friend_id);
                    nextQueue.push(f.friend_id);
                }
            }
        }
        queue = nextQueue;
    }
    return null;
}

// ──────────────────────────────────────────────
// GET /:username — View a user's profile
// ──────────────────────────────────────────────
router.get('/:username', (req, res) => {
    try {
        const db = req.app.locals.db;
        const { username } = req.params;
        const currentUserId = req.session.userId;

        // Load the profile user by username
        const profileUser = db.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!profileUser) {
            return res.status(404).render('error', { title: '404', message: 'User not found.' });
        }

        const isOwner = currentUserId === profileUser.id;

        // Increment profile views if viewer is not the owner
        if (!isOwner && currentUserId) {
            db.db.prepare('UPDATE users SET profile_views = profile_views + 1 WHERE id = ?').run(profileUser.id);
            profileUser.profile_views += 1;
        }

        // Load Top 8 friends (ordered by position)
        const top8 = db.db.prepare(`
            SELECT u.id, u.username, u.display_name, u.avatar_url
            FROM top_friends tf
            JOIN users u ON u.id = tf.friend_id
            WHERE tf.user_id = ?
            ORDER BY tf.position ASC
        `).all(profileUser.id);

        // Load recent scraps on this user's wall (last 10)
        const scraps = db.db.prepare(`
            SELECT s.*, u.username AS author_username, u.display_name AS author_display_name,
                   u.avatar_url AS author_avatar
            FROM scraps s
            JOIN users u ON u.id = s.author_id
            WHERE s.recipient_id = ?
            ORDER BY s.created_at DESC
            LIMIT 10
        `).all(profileUser.id);

        // Load approved testimonials with author info
        const testimonials = db.db.prepare(`
            SELECT t.*, u.username AS author_username, u.display_name AS author_display_name,
                   u.avatar_url AS author_avatar
            FROM testimonials t
            JOIN users u ON u.id = t.author_id
            WHERE t.recipient_id = ? AND t.approved = 1
            ORDER BY t.created_at DESC
        `).all(profileUser.id);

        // Calculate average ratings
        const avgRatings = db.db.prepare(`
            SELECT
                AVG(trustworthy) as avg_trustworthy,
                AVG(cool) as avg_cool,
                AVG(sexy) as avg_sexy
            FROM ratings
            WHERE rated_id = ?
        `).get(profileUser.id);

        // Count total fans
        const fanCountObj = db.db.prepare(`
            SELECT COUNT(*) as count FROM ratings
            WHERE rated_id = ? AND is_fan = 1
        `).get(profileUser.id);
        const fanCount = fanCountObj ? fanCountObj.count : 0;

        // Check friendship status between current user and profile user
        let isFriend = false;
        let friendRequestSent = false;
        let friendRequestReceived = false;
        let degrees = null;
        let myRating = null;
        let mutualCrush = false;

        if (currentUserId && !isOwner) {
            // Check if they are already friends (accepted)
            const friendship = db.db.prepare(`
                SELECT * FROM friendships
                WHERE status = 'accepted'
                AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
            `).get(currentUserId, profileUser.id, profileUser.id, currentUserId);
            isFriend = !!friendship;

            // Check if current user sent a pending request
            const sentRequest = db.db.prepare(`
                SELECT * FROM friendships
                WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'
            `).get(currentUserId, profileUser.id);
            friendRequestSent = !!sentRequest;

            // Check if profile user sent current user a pending request
            const receivedRequest = db.db.prepare(`
                SELECT * FROM friendships
                WHERE requester_id = ? AND addressee_id = ? AND status = 'pending'
            `).get(profileUser.id, currentUserId);
            friendRequestReceived = !!receivedRequest;

            // Compute degrees of separation via BFS (max 6)
            degrees = findDegrees(db.db, currentUserId, profileUser.id);

            // Load current user's existing rating of this person
            myRating = db.db.prepare(`
                SELECT * FROM ratings WHERE rater_id = ? AND rated_id = ?
            `).get(currentUserId, profileUser.id);

            // Check for mutual crush (both users have is_crush=1 for each other)
            const myCrush = db.db.prepare(`
                SELECT is_crush FROM ratings WHERE rater_id = ? AND rated_id = ? AND is_crush = 1
            `).get(currentUserId, profileUser.id);
            const theirCrush = db.db.prepare(`
                SELECT is_crush FROM ratings WHERE rater_id = ? AND rated_id = ? AND is_crush = 1
            `).get(profileUser.id, currentUserId);
            mutualCrush = !!(myCrush && theirCrush);
        }

        res.render('profile', {
            title: `${profileUser.display_name}'s Profile`,
            profileUser,
            isOwner,
            top8,
            scraps,
            testimonials,
            avgRatings: avgRatings || { avg_trustworthy: null, avg_cool: null, avg_sexy: null },
            fanCount,
            isFriend,
            friendRequestSent,
            friendRequestReceived,
            degrees,
            myRating,
            mutualCrush
        });
    } catch (err) {
        console.error('Profile view error:', err);
        res.status(500).render('error', { title: 'Error', message: 'Failed to load profile.' });
    }
});

// ──────────────────────────────────────────────
// GET /:username/edit — Edit profile form (owner only)
// ──────────────────────────────────────────────
router.get('/:username/edit', requireAuth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const { username } = req.params;

        const user = db.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!user) {
            return res.status(404).render('error', { title: '404', message: 'User not found.' });
        }

        // Only the profile owner can edit
        if (user.id !== req.session.userId) {
            return res.status(403).render('error', { title: 'Forbidden', message: 'You can only edit your own profile.' });
        }

        res.render('edit-profile', { title: 'Edit Profile', user });
    } catch (err) {
        console.error('Edit profile page error:', err);
        res.status(500).render('error', { title: 'Error', message: 'Failed to load edit page.' });
    }
});

// ──────────────────────────────────────────────
// POST /:username/edit — Save profile changes (owner only)
// ──────────────────────────────────────────────
router.post('/:username/edit', requireAuth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const { username } = req.params;

        const user = db.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!user) {
            return res.status(404).render('error', { title: '404', message: 'User not found.' });
        }

        // Only the profile owner can edit
        if (user.id !== req.session.userId) {
            return res.status(403).render('error', { title: 'Forbidden', message: 'You can only edit your own profile.' });
        }

        // Extract all editable fields from the request body
        const {
            display_name, headline, bio, who_id_like_to_meet,
            mood, location, gender, age,
            interests_general, interests_music, interests_movies,
            interests_tv, interests_books, interests_heroes,
            custom_css, profile_song, avatar_url
        } = req.body;

        // Update the user record with all profile fields
        db.db.prepare(`
            UPDATE users SET
                display_name = ?,
                headline = ?,
                bio = ?,
                who_id_like_to_meet = ?,
                mood = ?,
                location = ?,
                gender = ?,
                age = ?,
                interests_general = ?,
                interests_music = ?,
                interests_movies = ?,
                interests_tv = ?,
                interests_books = ?,
                interests_heroes = ?,
                custom_css = ?,
                profile_song = ?,
                avatar_url = ?
            WHERE id = ?
        `).run(
            display_name || '', headline || '', bio || '', who_id_like_to_meet || '',
            mood || '', location || '', gender || '', age || null,
            interests_general || '', interests_music || '', interests_movies || '',
            interests_tv || '', interests_books || '', interests_heroes || '',
            custom_css || '', profile_song || '', avatar_url || '/images/avatars/default.png',
            user.id
        );

        res.redirect(`/profile/${username}`);
    } catch (err) {
        console.error('Edit profile error:', err);
        res.status(500).render('error', { title: 'Error', message: 'Failed to update profile.' });
    }
});

// ──────────────────────────────────────────────
// POST /:username/testimonial — Submit a testimonial
// Testimonials require approval before they are shown
// ──────────────────────────────────────────────
router.post('/:username/testimonial', requireAuth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const { username } = req.params;
        const currentUserId = req.session.userId;

        const profileUser = db.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!profileUser) {
            return res.status(404).render('error', { title: '404', message: 'User not found.' });
        }

        const { content } = req.body;
        if (!content || !content.trim()) {
            return res.redirect(`/profile/${username}`);
        }

        // Insert testimonial with approved=0 (pending approval)
        db.db.prepare(`
            INSERT INTO testimonials (author_id, recipient_id, content, approved)
            VALUES (?, ?, ?, 0)
        `).run(currentUserId, profileUser.id, content.trim());

        res.redirect(`/profile/${username}`);
    } catch (err) {
        console.error('Testimonial error:', err);
        res.redirect(`/profile/${req.params.username}`);
    }
});

// ──────────────────────────────────────────────
// POST /:username/rate — Rate a user
// Uses INSERT OR REPLACE to update existing ratings
// ──────────────────────────────────────────────
router.post('/:username/rate', requireAuth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const { username } = req.params;
        const currentUserId = req.session.userId;

        const profileUser = db.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!profileUser) {
            return res.status(404).render('error', { title: '404', message: 'User not found.' });
        }

        const { trustworthy, cool, sexy, is_fan, is_crush } = req.body;

        // INSERT OR REPLACE allows updating an existing rating
        db.db.prepare(`
            INSERT OR REPLACE INTO ratings (rater_id, rated_id, trustworthy, cool, sexy, is_fan, is_crush)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            currentUserId,
            profileUser.id,
            parseInt(trustworthy) || 0,
            parseInt(cool) || 0,
            parseInt(sexy) || 0,
            is_fan ? 1 : 0,
            is_crush ? 1 : 0
        );

        res.redirect(`/profile/${username}`);
    } catch (err) {
        console.error('Rating error:', err);
        res.redirect(`/profile/${req.params.username}`);
    }
});

module.exports = router;
