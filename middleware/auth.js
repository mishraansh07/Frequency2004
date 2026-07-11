/**
 * ============================================================
 *  Yeh Un Dino Ki Baat Hai Social - Authentication Middleware
 * ============================================================
 *
 * Two middleware functions for protecting routes and loading
 * the current user from the database into the request cycle.
 *
 *  • requireAuth  – gate-keeper; redirects unauthenticated
 *                   visitors to the login page.
 *  • loadUser     – best-effort loader; silently attaches
 *                   the full user row to req.user and
 *                   res.locals.currentUser when a session
 *                   exists, so EJS templates can always
 *                   reference `currentUser`.
 */

// ──────────────────────────────────────────────────────────
//  requireAuth
//  Checks for an active session (req.session.userId).
//  If missing, the user is bounced to the login page.
// ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  // No active session → redirect to login
  return res.redirect('/login');
}

// ──────────────────────────────────────────────────────────
//  loadUser
//  If the session contains a userId, look up the full user
//  row from SQLite and attach it in two places:
//    • req.user              – for route handlers
//    • res.locals.currentUser – for EJS templates
//
//  If anything goes wrong (missing DB, bad ID, etc.) we
//  degrade gracefully — the request continues without a
//  user object and templates see currentUser as undefined.
// ──────────────────────────────────────────────────────────
function loadUser(req, res, next) {
  // Default: no user loaded
  req.user = null;
  res.locals.currentUser = null;

  // Nothing to load if the session has no userId
  if (!req.session || !req.session.userId) {
    return next();
  }

  try {
    // Grab the database handle from app.locals (set in server.js)
    const db = req.app.locals.db;

    if (!db) {
      console.warn('[loadUser] Database not available on app.locals.db');
      return next();
    }

    // Fetch the user row — better-sqlite3 is synchronous, so
    // no async/await gymnastics needed here.
    const user = db.db.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).get(req.session.userId);

    if (user) {
      req.user = user;
      res.locals.currentUser = user;
    } else {
      // userId in session doesn't match any row — stale session.
      // Clear it so the visitor isn't stuck in a ghost state.
      console.warn(
        `[loadUser] No user found for session userId=${req.session.userId}. Clearing session.`
      );
      delete req.session.userId;
    }
  } catch (err) {
    // Log but don't crash — let the request continue unauthenticated
    console.error('[loadUser] Error loading user from database:', err.message);
  }

  return next();
}

// ──────────────────────────────────────────────────────────
//  Exports
// ──────────────────────────────────────────────────────────
module.exports = {
  requireAuth,
  loadUser,
};
