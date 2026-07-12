const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// ─── GET /messages — DM Inbox Page ───────────────────────
router.get('/', requireAuth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const currentUserId = req.session.userId;

        // Load all accepted friends
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

        // Fetch last message snippet for each friend
        const lastMsgStmt = db.db.prepare(`
            SELECT id, content, sender_id, created_at FROM direct_messages
            WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
            ORDER BY created_at DESC LIMIT 1
        `);

        const chats = friends.map(f => {
            const lastMsg = lastMsgStmt.get(currentUserId, f.id, f.id, currentUserId);
            return {
                friend: f,
                lastMessage: lastMsg || null
            };
        });

        // Sort by last message date (most recent first)
        chats.sort((a, b) => {
            const timeA = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0;
            const timeB = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0;
            return timeB - timeA;
        });

        res.render('messages', {
            title: 'DMs — Frequency 2004',
            chats,
            activeFriendId: req.query.friendId || null
        });
    } catch (err) {
        console.error('Inbox loading error:', err);
        res.status(500).render('error', { title: 'Error', message: 'Failed to load inbox.' });
    }
});

// ─── GET /messages/chat/:friendId — Load full history ───
router.get('/chat/:friendId', requireAuth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const currentUserId = req.session.userId;
        const { friendId } = req.params;

        const friend = db.db.prepare('SELECT id, username, display_name, avatar_url FROM users WHERE id = ?').get(friendId);
        if (!friend) {
            return res.status(404).json({ error: 'User not found' });
        }

        const messages = db.db.prepare(`
            SELECT * FROM direct_messages
            WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
            ORDER BY created_at ASC
        `).all(currentUserId, friendId, friendId, currentUserId);

        res.json({ friend, messages });
    } catch (err) {
        console.error('Chat history fetch error:', err);
        res.status(500).json({ error: 'Failed to load chat history' });
    }
});

// ─── POST /messages/send — Send new message ─────────────
router.post('/send', requireAuth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const currentUserId = req.session.userId;
        const { recipientId, content } = req.body;

        if (!recipientId || !content || !content.trim()) {
            return res.status(400).json({ error: 'Invalid message data' });
        }

        const info = db.db.prepare(`
            INSERT INTO direct_messages (sender_id, recipient_id, content)
            VALUES (?, ?, ?)
        `).run(currentUserId, recipientId, content.trim());

        const newMessage = db.db.prepare('SELECT * FROM direct_messages WHERE id = ?').get(info.lastInsertRowid);
        res.json({ success: true, message: newMessage });
    } catch (err) {
        console.error('Message send error:', err);
        res.status(500).json({ error: 'Failed to send message' });
    }
});

// ─── GET /messages/poll/:friendId — AJAX Message Poller ─
router.get('/poll/:friendId', requireAuth, (req, res) => {
    try {
        const db = req.app.locals.db;
        const currentUserId = req.session.userId;
        const { friendId } = req.params;
        const { lastMessageId } = req.query;

        if (!lastMessageId) {
            return res.status(400).json({ error: 'Missing lastMessageId' });
        }

        const newMessages = db.db.prepare(`
            SELECT * FROM direct_messages
            WHERE ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?))
            AND id > ?
            ORDER BY created_at ASC
        `).all(currentUserId, friendId, friendId, currentUserId, lastMessageId);

        res.json({ messages: newMessages });
    } catch (err) {
        console.error('Polling error:', err);
        res.status(500).json({ error: 'Failed to poll new messages' });
    }
});

module.exports = router;
