const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { requireAuth } = require('../middleware/auth');

// Multer storage for community avatars
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../public/images/avatars'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname) || '.png';
        cb(null, 'community_upload_' + uniqueSuffix + ext);
    }
});
const upload = multer({ storage });

// Programmatic directory check for audio uploads
const audioDir = path.join(__dirname, '../public/audio');
if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
}

// Multer storage for community audio uploads
const audioStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, audioDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname) || '.mp3';
        cb(null, 'community_audio_' + uniqueSuffix + ext);
    }
});
const uploadAudio = multer({ 
    storage: audioStorage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /mp3|mpeg|wav|ogg|m4a|mp4/;
        const mimeType = allowedTypes.test(file.mimetype);
        const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        if (mimeType && extName) {
            return cb(null, true);
        }
        cb(new Error('Only audio files are allowed!'));
    }
});

// ──────────────────────────────────────────────
// GET / — List all communities with member counts
// Supports optional category filtering via ?category=
// ──────────────────────────────────────────────
router.get('/', (req, res) => {
    try {
        const db = req.app.locals.db;
        const category = req.query.category || null;

        let communities;
        if (category) {
            // Filter by category
            communities = db.db.prepare(`
                SELECT c.*, COUNT(cm.user_id) as member_count
                FROM communities c
                LEFT JOIN community_members cm ON cm.community_id = c.id
                WHERE c.category = ?
                GROUP BY c.id
                ORDER BY member_count DESC
            `).all(category);
        } else {
            // All communities
            communities = db.db.prepare(`
                SELECT c.*, COUNT(cm.user_id) as member_count
                FROM communities c
                LEFT JOIN community_members cm ON cm.community_id = c.id
                GROUP BY c.id
                ORDER BY member_count DESC
            `).all();
        }

        // Get distinct categories for the filter dropdown
        const categories = db.db.prepare(`
            SELECT DISTINCT category FROM communities WHERE category IS NOT NULL AND category != ''
            ORDER BY category
        `).all();

        res.render('communities', {
            title: 'Communities',
            communities,
            categories,
            selectedCategory: category
        });
    } catch (err) {
        console.error('Communities list error:', err);
        res.status(500).render('error', { title: 'Error', message: 'Failed to load communities.' });
    }
});

// ──────────────────────────────────────────────
// GET /create — Community creation form
// ──────────────────────────────────────────────
router.get('/create', requireAuth, (req, res) => {
    try {
        res.render('community-create', { title: 'Create Community', error: null });
    } catch (err) {
        console.error('Create community page error:', err);
        res.status(500).render('error', { title: 'Error', message: 'Failed to load create page.' });
    }
});

// ──────────────────────────────────────────────
// POST /create — Create a new community
// The creator is automatically added as owner
// ──────────────────────────────────────────────
router.post('/create', requireAuth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const currentUserId = req.session.userId;
        const { name, description, category } = req.body;

        if (!name || !name.trim()) {
            return res.render('community-create', {
                title: 'Create Community',
                error: 'Community name is required.'
            });
        }

        // Insert the community
        const result = db.db.prepare(`
            INSERT INTO communities (name, description, category, owner_id)
            VALUES (?, ?, ?, ?)
        `).run(name.trim(), description || '', category || '', currentUserId);

        const communityId = result.lastInsertRowid;

        // Add the creator as the first member with 'owner' role
        db.db.prepare(`
            INSERT INTO community_members (community_id, user_id, role)
            VALUES (?, ?, 'owner')
        `).run(communityId, currentUserId);

        res.redirect(`/communities/${communityId}`);
    } catch (err) {
        console.error('Create community error:', err);
        res.render('community-create', {
            title: 'Create Community',
            error: 'Failed to create community. Name may already be taken.'
        });
    }
});

// ──────────────────────────────────────────────
// GET /:id — View a specific community
// Shows posts, members, and join/leave option
// ──────────────────────────────────────────────
router.get('/:id', (req, res) => {
    try {
        const db = req.app.locals.db;
        const communityId = parseInt(req.params.id);
        const currentUserId = req.session.userId;

        // Load community details
        const community = db.db.prepare('SELECT * FROM communities WHERE id = ?').get(communityId);
        if (!community) {
            return res.status(404).render('error', { title: '404', message: 'Community not found.' });
        }

        // Load community posts with author info (newest first)
        const posts = db.db.prepare(`
            SELECT cp.*, u.username AS author_username, u.display_name AS author_display_name,
                   u.avatar_url AS author_avatar
            FROM community_posts cp
            JOIN users u ON u.id = cp.author_id
            WHERE cp.community_id = ?
            ORDER BY cp.created_at DESC
        `).all(communityId);

        // Load community members with user info
        const members = db.db.prepare(`
            SELECT u.id, u.username, u.display_name, u.avatar_url, cm.role
            FROM community_members cm
            JOIN users u ON u.id = cm.user_id
            WHERE cm.community_id = ?
            ORDER BY cm.role DESC, u.username ASC
        `).all(communityId);

        // Check if current user is a member
        let isMember = false;
        if (currentUserId) {
            const membership = db.db.prepare(`
                SELECT * FROM community_members
                WHERE community_id = ? AND user_id = ?
            `).get(communityId, currentUserId);
            isMember = !!membership;
        }

        res.render('community', {
            title: community.name,
            community,
            posts,
            members,
            isMember,
            memberCount: members.length
        });
    } catch (err) {
        console.error('Community view error:', err);
        res.status(500).render('error', { title: 'Error', message: 'Failed to load community.' });
    }
});

// ──────────────────────────────────────────────
// POST /:id/join — Join a community
// ──────────────────────────────────────────────
router.post('/:id/join', requireAuth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const communityId = parseInt(req.params.id);
        const currentUserId = req.session.userId;

        // Check if already a member
        const existing = db.db.prepare(`
            SELECT * FROM community_members
            WHERE community_id = ? AND user_id = ?
        `).get(communityId, currentUserId);

        if (!existing) {
            db.db.prepare(`
                INSERT INTO community_members (community_id, user_id, role)
                VALUES (?, ?, 'member')
            `).run(communityId, currentUserId);
        }

        res.redirect('back');
    } catch (err) {
        console.error('Join community error:', err);
        res.redirect('back');
    }
});

// ──────────────────────────────────────────────
// POST /:id/leave — Leave a community
// ──────────────────────────────────────────────
router.post('/:id/leave', requireAuth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const communityId = parseInt(req.params.id);
        const currentUserId = req.session.userId;

        db.db.prepare(`
            DELETE FROM community_members
            WHERE community_id = ? AND user_id = ?
        `).run(communityId, currentUserId);

        res.redirect('back');
    } catch (err) {
        console.error('Leave community error:', err);
        res.redirect('back');
    }
});

// ──────────────────────────────────────────────
// POST /:id/post — Create a post in a community
// User must be a member to post
// ──────────────────────────────────────────────
router.post('/:id/post', requireAuth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const communityId = parseInt(req.params.id);
        const currentUserId = req.session.userId;

        // Verify membership
        const membership = db.db.prepare(`
            SELECT * FROM community_members
            WHERE community_id = ? AND user_id = ?
        `).get(communityId, currentUserId);

        if (!membership) {
            return res.status(403).render('error', {
                title: 'Forbidden',
                message: 'You must be a member to post in this community.'
            });
        }

        const { title, content } = req.body;
        if (!content || !content.trim()) {
            return res.redirect('back');
        }

        db.db.prepare(`
            INSERT INTO community_posts (community_id, author_id, title, content)
            VALUES (?, ?, ?, ?)
        `).run(communityId, currentUserId, title || '', content.trim());

        res.redirect('back');
    } catch (err) {
        console.error('Community post error:', err);
        res.redirect('back');
    }
});

// ──────────────────────────────────────────────
// GET /:id/post/:postId — View a single post with replies
// ──────────────────────────────────────────────
router.get('/:id/post/:postId', (req, res) => {
    try {
        const db = req.app.locals.db;
        const communityId = parseInt(req.params.id);
        const postId = parseInt(req.params.postId);
        const currentUserId = req.session.userId;

        // Load the community
        const community = db.db.prepare('SELECT * FROM communities WHERE id = ?').get(communityId);
        if (!community) {
            return res.status(404).render('error', { title: '404', message: 'Community not found.' });
        }

        // Load the post with author info
        const post = db.db.prepare(`
            SELECT cp.*, u.username AS author_username, u.display_name AS author_display_name,
                   u.avatar_url AS author_avatar
            FROM community_posts cp
            JOIN users u ON u.id = cp.author_id
            WHERE cp.id = ? AND cp.community_id = ?
        `).get(postId, communityId);

        if (!post) {
            return res.status(404).render('error', { title: '404', message: 'Post not found.' });
        }

        // Load all replies with author info
        const replies = db.db.prepare(`
            SELECT cr.*, u.username AS author_username, u.display_name AS author_display_name,
                   u.avatar_url AS author_avatar
            FROM community_replies cr
            JOIN users u ON u.id = cr.author_id
            WHERE cr.post_id = ?
            ORDER BY cr.created_at ASC
        `).all(postId);

        // Check if current user is a member (for reply permissions)
        let isMember = false;
        if (currentUserId) {
            const membership = db.db.prepare(`
                SELECT * FROM community_members
                WHERE community_id = ? AND user_id = ?
            `).get(communityId, currentUserId);
            isMember = !!membership;
        }

        res.render('community-post', {
            title: post.title || 'Post',
            community,
            post,
            replies,
            isMember
        });
    } catch (err) {
        console.error('Community post view error:', err);
        res.status(500).render('error', { title: 'Error', message: 'Failed to load post.' });
    }
});

// ──────────────────────────────────────────────
// POST /:id/post/:postId/reply — Reply to a community post
// User must be a member to reply
// ──────────────────────────────────────────────
router.post('/:id/post/:postId/reply', requireAuth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const communityId = parseInt(req.params.id);
        const postId = parseInt(req.params.postId);
        const currentUserId = req.session.userId;

        // Verify membership
        const membership = db.db.prepare(`
            SELECT * FROM community_members
            WHERE community_id = ? AND user_id = ?
        `).get(communityId, currentUserId);

        if (!membership) {
            return res.status(403).render('error', {
                title: 'Forbidden',
                message: 'You must be a member to reply in this community.'
            });
        }

        const { content } = req.body;
        if (!content || !content.trim()) {
            return res.redirect('back');
        }

        db.db.prepare(`
            INSERT INTO community_replies (post_id, author_id, content)
            VALUES (?, ?, ?)
        `).run(postId, currentUserId, content.trim());

        res.redirect('back');
    } catch (err) {
        console.error('Community reply error:', err);
        res.redirect('back');
    }
});

router.post('/:id/avatar', requireAuth, upload.single('custom_community_avatar'), (req, res) => {
    try {
        const db = req.app.locals.db;
        const communityId = parseInt(req.params.id);
        const currentUserId = req.session.userId;

        // Check if user is owner of the community
        const community = db.db.prepare('SELECT * FROM communities WHERE id = ?').get(communityId);
        if (!community) {
            return res.status(404).render('error', { title: '404', message: 'Community not found.' });
        }

        if (community.owner_id !== currentUserId) {
            return res.status(403).render('error', { title: 'Forbidden', message: 'Only the community owner can change the avatar.' });
        }

        // If custom file uploaded, use it. Otherwise fallback to preset selected in radio buttons.
        let resolvedAvatarUrl = req.body.avatar_url || community.avatar_url;
        if (req.file) {
            resolvedAvatarUrl = `/images/avatars/${req.file.filename}`;
        }

        if (resolvedAvatarUrl) {
            db.db.prepare('UPDATE communities SET avatar_url = ? WHERE id = ?').run(resolvedAvatarUrl, communityId);
        }

        res.redirect('back');
    } catch (err) {
        console.error('Update community avatar error:', err);
        res.redirect('back');
    }
});

// ──────────────────────────────────────────────
// POST /:id/edit — Edit community details
// Only owner can update community details
// ──────────────────────────────────────────────
router.post('/:id/edit', requireAuth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const communityId = parseInt(req.params.id);
        const currentUserId = req.session.userId;

        // Check if user is owner of the community
        const community = db.db.prepare('SELECT * FROM communities WHERE id = ?').get(communityId);
        if (!community) {
            return res.status(404).render('error', { title: '404', message: 'Community not found.' });
        }

        if (community.owner_id !== currentUserId) {
            return res.status(403).render('error', { title: 'Forbidden', message: 'Only the community owner can edit details.' });
        }

        const { name, category, description } = req.body;
        if (!name || !name.trim()) {
            return res.redirect('back');
        }

        db.db.prepare(`
            UPDATE communities
            SET name = ?, category = ?, description = ?
            WHERE id = ?
        `).run(name.trim(), category || 'General', description || '', communityId);

        res.redirect(`/communities/${communityId}`);
    } catch (err) {
        console.error('Edit community error:', err);
        res.redirect('back');
    }
});

// POST /communities/:id/upload-song — Handle song file upload for MusicZone
router.post('/:id/upload-song', requireAuth, uploadAudio.single('song_file'), (req, res) => {
    try {
        const db = req.app.locals.db;
        const communityId = parseInt(req.params.id);
        const currentUserId = req.session.userId;

        // Verify community exists and current user is owner
        const community = db.db.prepare('SELECT * FROM communities WHERE id = ?').get(communityId);
        if (!community) {
            return res.status(404).render('error', { title: 'Not Found', message: 'Community not found' });
        }
        if (community.owner_id !== currentUserId) {
            return res.status(403).render('error', { title: 'Forbidden', message: 'Only the zone owner can upload songs.' });
        }

        if (!req.file) {
            return res.redirect('back');
        }

        const songUrl = '/audio/' + req.file.filename;

        // Update database
        db.db.prepare('UPDATE communities SET song_url = ? WHERE id = ?').run(songUrl, communityId);

        res.redirect(`/communities/${communityId}`);
    } catch (err) {
        console.error('Audio upload error:', err);
        res.status(500).render('error', { title: 'Error', message: 'Failed to upload audio file.' });
    }
});

module.exports = router;
