/**
 * ============================================================
 *  Frequency 2004 Social — iPod Player & Shoutbox JS
 * ============================================================
 *  Combines early 2000s iPod click wheel logic, menu navigation,
 *  and live chat shoutbox polling.
 * ============================================================
 */

// Static playlist with ultra-reliable fallback MP3s to guarantee playback
let stations = [
    { name: 'Kaho Naa Pyaar Hai', genre: 'Udit Narayan', url: 'https://archive.org/download/kaho-naa-pyaar-hai_202005/Kaho%20Naa%20Pyaar%20Hai.mp3' },
    { name: 'Koi Mil Gaya', genre: 'Udit Narayan & Alka Yagnik', url: 'https://archive.org/download/Koi-Mil-Gaya-2003-Movie-Hindiganadownload.com/Koi%20Mil%20Gaya.mp3' },
    { name: 'Ek Pal Ka Jeena', genre: 'Lucky Ali', url: 'https://archive.org/download/MainTumhaaraHiRahoon320/02%20Ek%20Pal%20Ka%20Jeena.mp3' },
    { name: 'Kal Ho Naa Ho (Theme)', genre: 'Sonu Nigam', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
    { name: 'It\'s The Time To Disco (Beat)', genre: 'Shaan & KK', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
    { name: 'Mahi Ve (Theme)', genre: 'Sadhana Sargam', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' }
];

const ipodState = {
    view: 'menu', // 'menu' or 'nowplaying'
    menuIndex: 0,
    isPlaying: false,
    currentStation: null,
    progressInterval: null
};

let audioElement;
let audioCtx;

document.addEventListener('DOMContentLoaded', () => {
    // Reference HTML5 audio tag
    audioElement = document.getElementById('radio-audio');
    if (audioElement) {
        audioElement.volume = 0.75;
    }

    // Initialize iPod Menu directly with static songs
    renderIpodMenu();

    // Initialize Shoutbox
    pollShoutbox();
    setInterval(pollShoutbox, 5000); // Poll every 5s

    // Input handlers for shoutbox
    const input = document.getElementById('shoutbox-input');
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendShoutboxMessage();
        });
    }
});

/* ─── iPod Menu & Navigation ────────────────────────────── */

function renderIpodMenu() {
    const menuContainer = document.getElementById('ipod-menu');
    if (!menuContainer) return;
    
    document.getElementById('ipod-status-title').textContent = 'iPod';
    document.getElementById('ipod-now-playing').style.display = 'none';
    menuContainer.style.display = 'flex';
    
    menuContainer.innerHTML = '';
    
    stations.forEach((station, index) => {
        const item = document.createElement('div');
        item.className = 'ipod-menu-item' + (index === ipodState.menuIndex ? ' active' : '');
        
        // Allow clicking the screen directly (since it's a web app)
        item.onclick = () => {
            ipodState.menuIndex = index;
            renderIpodMenu();
            ipodSelect();
        };

        const nameSpan = document.createElement('span');
        nameSpan.textContent = station.name;
        
        const arrowSpan = document.createElement('span');
        arrowSpan.textContent = '>';
        
        item.appendChild(nameSpan);
        item.appendChild(arrowSpan);
        menuContainer.appendChild(item);
        
        if (index === ipodState.menuIndex) {
            item.scrollIntoView({ block: 'nearest' });
        }
    });
}

function ipodPrev() {
    if (ipodState.view !== 'menu') return;
    if (ipodState.menuIndex > 0) {
        ipodState.menuIndex--;
        renderIpodMenu();
    }
}

function ipodNext() {
    if (ipodState.view !== 'menu') return;
    if (ipodState.menuIndex < stations.length - 1) {
        ipodState.menuIndex++;
        renderIpodMenu();
    }
}

function ipodMenu() {
    // Menu button goes back to menu view
    if (ipodState.view === 'nowplaying') {
        ipodState.view = 'menu';
        renderIpodMenu();
    }
}

function ipodSelect() {
    if (ipodState.view === 'menu') {
        const selectedStation = stations[ipodState.menuIndex];
        playIpodStation(selectedStation);
    }
}

function ipodPlayPause() {
    if (ipodState.isPlaying) {
        pauseIpod();
    } else {
        if (!ipodState.currentStation) {
            ipodState.currentStation = stations[ipodState.menuIndex];
        }
        playIpodStation(ipodState.currentStation);
    }
}

/* ─── iPod Audio Playback ────────────────────────────── */

function playIpodStation(station) {
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    const isNewStation = (ipodState.currentStation !== station);
    ipodState.currentStation = station;
    ipodState.isPlaying = true;
    ipodState.view = 'nowplaying';
    
    // Update UI
    document.getElementById('ipod-menu').style.display = 'none';
    document.getElementById('ipod-now-playing').style.display = 'flex';
    document.getElementById('ipod-status-title').textContent = 'Now Playing';
    
    document.getElementById('ipod-np-title').textContent = station.name;
    document.getElementById('ipod-np-artist').textContent = station.genre;
    
    startIpodProgress();

    // UI updates for buffering and errors
    audioElement.onplaying = () => {
        document.getElementById('ipod-np-title').textContent = station.name;
    };
    audioElement.onwaiting = () => {
        document.getElementById('ipod-np-title').textContent = 'Buffering...';
    };
    audioElement.onerror = () => {
        document.getElementById('ipod-np-title').textContent = 'Stream Error';
        document.getElementById('ipod-np-artist').textContent = 'Please try another station';
        stopIpodProgress();
    };
    audioElement.onended = () => {
        // Auto-play next song in the playlist like a real iPod
        if (ipodState.menuIndex < stations.length - 1) {
            ipodState.menuIndex++;
            renderIpodMenu();
            playIpodStation(stations[ipodState.menuIndex]);
        } else {
            pauseIpod();
            document.getElementById('ipod-np-title').textContent = 'End of Playlist';
        }
    };

    if (audioElement && isNewStation) {
        audioElement.src = station.url;
        audioElement.play().catch(err => {
            console.error('Playback error:', err);
            document.getElementById('ipod-np-title').textContent = 'Playback Failed';
            stopIpodProgress();
        });
    } else if (audioElement) {
        audioElement.play().catch(err => {
            console.error('Playback error:', err);
            document.getElementById('ipod-np-title').textContent = 'Playback Failed';
            stopIpodProgress();
        });
    }
}

function pauseIpod() {
    ipodState.isPlaying = false;
    stopIpodProgress();
    
    if (audioElement) {
        audioElement.pause();
    }
}

function formatTime(secs) {
    if (isNaN(secs) || !isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function startIpodProgress() {
    const fill = document.getElementById('ipod-np-fill');
    const elapsedEl = document.getElementById('ipod-np-elapsed');
    const durationEl = document.getElementById('ipod-np-duration');
    if (ipodState.progressInterval) clearInterval(ipodState.progressInterval);
    
    ipodState.progressInterval = setInterval(() => {
        if (!audioElement) return;
        const cur = audioElement.currentTime;
        const dur = audioElement.duration;
        if (dur) {
            const percent = (cur / dur) * 100;
            if (fill) fill.style.width = percent + '%';
            if (elapsedEl) elapsedEl.textContent = formatTime(cur);
            if (durationEl) durationEl.textContent = formatTime(dur);
        } else {
            if (fill) fill.style.width = '0%';
            if (elapsedEl) elapsedEl.textContent = '0:00';
            if (durationEl) durationEl.textContent = '0:00';
        }
    }, 250);
}

function stopIpodProgress() {
    if (ipodState.progressInterval) {
        clearInterval(ipodState.progressInterval);
        ipodState.progressInterval = null;
    }
}

/* ─── Shoutbox Live Integration ──────────────────────── */
function pollShoutbox() {
    fetch('/shoutbox/api/messages')
        .then(res => res.json())
        .then(data => {
            if (Array.isArray(data)) {
                // Reverse to show oldest first in chat scrolling layout
                renderShoutbox(data.slice().reverse());
            }
        })
        .catch(err => console.error('[Shoutbox API error]:', err));
}

function renderShoutbox(messages) {
    const container = document.getElementById('shoutbox-messages');
    if (!container) return;
    container.innerHTML = '';
    messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = 'shoutbox__msg';
        
        const dateObj = new Date(msg.created_at);
        const timeStr = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
        
        div.innerHTML = `
            <span class="shoutbox__msg-time">[${timeStr}]</span>
            <span class="shoutbox__msg-author">&lt;${msg.display_name}&gt;</span>
            <span class="shoutbox__msg-content">${escapeHTML(msg.content)}</span>
        `;
        container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
}

function sendShoutboxMessage() {
    const input = document.getElementById('shoutbox-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    
    fetch('/shoutbox', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: text })
    })
    .then(() => {
        input.value = '';
        pollShoutbox();
    })
    .catch(err => {
        console.error('[Send Message failed]:', err);
        window.location.href = '/login';
    });
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
