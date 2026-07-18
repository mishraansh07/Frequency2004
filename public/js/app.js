/**
 * ============================================================
 *  Frequency 2004 Social — Frontend JavaScript
 * ============================================================
 *  Retro effects, taskbar clock, sparkles, and interactivity
 * ============================================================
 */

// ─── Immediate Theme Restoration to prevent FOUC ──────────
(function() {
  const savedYear = localStorage.getItem('frequency-year') || '2004';
  document.documentElement.className = 'theme-' + savedYear;
})();

document.addEventListener('DOMContentLoaded', () => {
  // ─── Web Year Time Machine ──────────────────────────
  const eraSlider = document.getElementById('era-tuner-slider');
  const eraDisplay = document.getElementById('era-tuner-display');
  const eras = ['1999', '2004', '2007', '2009'];

  if (eraSlider && eraDisplay) {
    const savedYear = localStorage.getItem('frequency-year') || '2004';
    const initialIndex = eras.indexOf(savedYear);
    eraSlider.value = initialIndex !== -1 ? initialIndex : 1;
    eraDisplay.textContent = savedYear;

    eraSlider.addEventListener('input', (e) => {
      const idx = e.target.value;
      const targetYear = eras[idx];
      
      if (localStorage.getItem('frequency-year') === targetYear) return;

      // Trigger TV glitch static transition
      const glitchOverlay = document.getElementById('tv-glitch-overlay');
      if (glitchOverlay) {
        glitchOverlay.className = 'tv-glitch-active';
        if (typeof playGlitchSound === 'function') {
          playGlitchSound();
        }

        setTimeout(() => {
          // Peak of transition: swap styles
          document.documentElement.className = 'theme-' + targetYear;
          eraDisplay.textContent = targetYear;
          localStorage.setItem('frequency-year', targetYear);
        }, 200);

        setTimeout(() => {
          // End transition
          glitchOverlay.className = 'tv-glitch-hidden';
        }, 450);
      } else {
        // Fallback
        document.documentElement.className = 'theme-' + targetYear;
        eraDisplay.textContent = targetYear;
        localStorage.setItem('frequency-year', targetYear);
      }
    });
  }

  // ─── Taskbar Clock ──────────────────────────────────
  const clockEl = document.getElementById('taskbar-clock');
  if (clockEl) {
    function updateClock() {
      const now = new Date();
      const h = now.getHours();
      const m = String(now.getMinutes()).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hr = h % 12 || 12;
      clockEl.textContent = `${hr}:${m} ${ampm}`;
    }
    updateClock();
    setInterval(updateClock, 30000);
  }

  // ─── Marquee Text ───────────────────────────────────
  const marquees = document.querySelectorAll('.retro-marquee__inner');
  // CSS handles the animation, but we can add hover-pause
  marquees.forEach(m => {
    m.addEventListener('mouseenter', () => { m.style.animationPlayState = 'paused'; });
    m.addEventListener('mouseleave', () => { m.style.animationPlayState = 'running'; });
  });

  // ─── Sparkle Cursor Trail ───────────────────────────
  let sparkleEnabled = true;
  let sparkleThrottle = 0;
  document.addEventListener('mousemove', (e) => {
    if (!sparkleEnabled) return;
    const now = Date.now();
    if (now - sparkleThrottle < 80) return;
    sparkleThrottle = now;
    createSparkle(e.pageX, e.pageY);
  });

  function createSparkle(x, y) {
    const spark = document.createElement('div');
    spark.textContent = '✦';
    spark.style.cssText = `
      position: absolute; left: ${x}px; top: ${y}px;
      pointer-events: none; z-index: 9999;
      font-size: ${8 + Math.random() * 10}px;
      color: hsl(${Math.random() * 360}, 100%, 70%);
      animation: sparkle-fade 0.6s ease-out forwards;
    `;
    document.body.appendChild(spark);
    setTimeout(() => spark.remove(), 600);
  }

  // Add sparkle animation
  if (!document.getElementById('sparkle-style')) {
    const style = document.createElement('style');
    style.id = 'sparkle-style';
    style.textContent = `
      @keyframes sparkle-fade {
        0% { opacity: 1; transform: scale(1) translateY(0); }
        100% { opacity: 0; transform: scale(0.3) translateY(-20px) rotate(180deg); }
      }
    `;
    document.head.appendChild(style);
  }

  // ─── XP Window Close Buttons ────────────────────────
  document.querySelectorAll('.xp-titlebar__btn--close').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const closeTo = btn.getAttribute('data-close-to');
      if (closeTo) {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = closeTo;
        return;
      }

      const win = btn.closest('.xp-window');
      if (win) {
        win.style.transition = 'opacity 0.3s, transform 0.3s';
        win.style.opacity = '0';
        win.style.transform = 'scale(0.9)';
        setTimeout(() => win.style.display = 'none', 300);
      }
    });
  });

  // ─── Shoutbox Auto-scroll ───────────────────────────
  const shoutbox = document.querySelector('.shoutbox');
  if (shoutbox) {
    shoutbox.scrollTop = shoutbox.scrollHeight;
  }

  // ─── Confirm Delete Actions ─────────────────────────
  document.querySelectorAll('[data-confirm]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (!confirm(el.dataset.confirm)) {
        e.preventDefault();
      }
    });
  });

  // ─── Form Validation Visual Feedback ─────────────────
  document.querySelectorAll('.xp-input, .xp-textarea').forEach(input => {
    input.addEventListener('invalid', () => {
      input.style.borderColor = '#CC0000';
      input.style.background = '#FFF0F0';
    });
    input.addEventListener('input', () => {
      input.style.borderColor = '';
      input.style.background = '';
    });
  });

  // ─── Tooltip for truncated text ─────────────────────
  document.querySelectorAll('[data-tooltip]').forEach(el => {
    el.title = el.dataset.tooltip;
  });

  console.log('✨ Frequency 2004 Social — loaded! ✨');
  console.log('🕹️ Best viewed at 1024x768 in Internet Explorer 6.0');
});
