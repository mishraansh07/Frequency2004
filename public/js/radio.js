/**
 * ============================================================
 *  Frequency 2004 Social — iPod Player & Shoutbox JS
 * ============================================================
 *  Combines early 2000s iPod click wheel logic, menu navigation,
 *  and live chat shoutbox polling.
 * ============================================================
 */

let stations = [
    { name: 'Kaho Naa Pyaar Hai', genre: 'Udit Narayan & Alka Yagnik', url: 'https://archive.org/download/kaho-naa-pyaar-hai_202005/Kaho Naa Pyaar Hai.mp3' },
    { name: 'O Sanam', genre: 'Lucky Ali (Classic Pop)', url: 'https://archive.org/download/MainTumhaaraHiRahoon320/Lucky Ali - Sunoh (1996)/01 - Lucky Ali - O Sanam .mp3' },
    { name: 'Ek Pal Ka Jeena', genre: 'Lucky Ali (Kaho Naa Pyaar Hai)', url: 'https://archive.org/download/MainTumhaaraHiRahoon320/LUCKY ALI AKS/EK PAL KA JEENA.mp3' },
    { name: 'Na Tum Jano Na Hum', genre: 'Lucky Ali (Kaho Naa Pyaar Hai)', url: 'https://archive.org/download/MainTumhaaraHiRahoon320/LUCKY ALI AKS/NA TUM JANO NA HUM.mp3' },
    { name: 'Dil Chahta Hai', genre: 'Shankar Mahadevan', url: 'https://archive.org/download/dil-chahta-hai-2001-movie-songs-hindiganadownload.com/Dil Chahta Hai/1. Dil Chahta Hai - hindiganadownload.com.mp3' },
    { name: 'Jaane Kyon Log Pyaar', genre: 'Udit Narayan & Alka Yagnik', url: 'https://archive.org/download/dil-chahta-hai-2001-movie-songs-hindiganadownload.com/Dil Chahta Hai/2. Jaane Kyon - hindiganadownload.com.mp3' },
    { name: 'Woh Ladki Hai Kahan', genre: 'Shaan & Kavita Krishnamurthy', url: 'https://archive.org/download/dil-chahta-hai-2001-movie-songs-hindiganadownload.com/Dil Chahta Hai/3. Woh Ladki Hai Kahan - hindiganadownload.com.mp3' },
    { name: 'Tanhayee (Sad)', genre: 'Sonu Nigam (Dil Chahta Hai)', url: 'https://archive.org/download/dil-chahta-hai-2001-movie-songs-hindiganadownload.com/Dil Chahta Hai/7. Tanhayee - hindiganadownload.com.mp3' },
    { name: 'Wada Raha (Khakee)', genre: 'Arnab Chakraborty & Shreya Ghoshal', url: 'https://archive.org/download/khakee-2004-movie-songs-hindiganadownload.com/Khakee/01 - Wada Raha.mp3' },
    { name: 'Dil Dooba (Khakee)', genre: 'Sonu Nigam & Shreya Ghoshal', url: 'https://archive.org/download/khakee-2004-movie-songs-hindiganadownload.com/Khakee/04 - Dil Dooba.mp3' },
    { name: 'Aisa Jadoo (Khakee)', genre: 'Sunidhi Chauhan', url: 'https://archive.org/download/khakee-2004-movie-songs-hindiganadownload.com/Khakee/02 - Aisa Jadoo.mp3' },
    { name: 'Yun Hi Tumse Pyar', genre: 'Sonu Nigam & Shreya Ghoshal', url: 'https://archive.org/download/khakee-2004-movie-songs-hindiganadownload.com/Khakee/03 - Youn Hi Hum Tumse Pyar Karte Rahein.mp3' },
    { name: 'Sunoh (Lucky Ali)', genre: 'Lucky Ali (Classic Pop)', url: 'https://archive.org/download/MainTumhaaraHiRahoon320/Lucky Ali - Sunoh (1996)/02 - Lucky Ali - Sunoh.mp3' },
    { name: 'Kabhi Aisa Lagta Hai', genre: 'Lucky Ali (Classic Pop)', url: 'https://archive.org/download/MainTumhaaraHiRahoon320/Lucky ALi - Kabhi Aisa Lagta Hai/kalh1(www.songs.pk).mp3' },
    { name: 'Teri Yaadein Aati Hain', genre: 'Lucky Ali (Classic Pop)', url: 'https://archive.org/download/MainTumhaaraHiRahoon320/Lucky ALi - Kabhi Aisa Lagta Hai/kalh2(www.songs.pk).mp3' }
];

let activeRoom = null;
let isPartyHost = false;
let wsConnection = null;

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

    // Parse URL Room parameters
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
        activeRoom = roomParam;
        isPartyHost = (activeRoom === currentUserName);
        
        // Show party active panel UI
        const noState = document.getElementById('no-party-state');
        const activeState = document.getElementById('party-active-state');
        if (noState) noState.style.display = 'none';
        if (activeState) activeState.style.display = 'block';
        
        const roomIdEl = document.getElementById('party-room-id');
        if (roomIdEl) roomIdEl.textContent = activeRoom;
        
        const roleBadge = document.getElementById('party-role-badge');
        if (roleBadge) {
            roleBadge.textContent = isPartyHost ? 'Host' : 'Guest';
            roleBadge.style.background = isPartyHost ? '#0a246a' : '#27ae60';
        }
        
        if (isPartyHost) {
            const hostSec = document.getElementById('host-invite-section');
            if (hostSec) hostSec.style.display = 'block';
        } else {
            const guestSec = document.getElementById('guest-status-section');
            if (guestSec) guestSec.style.display = 'block';
        }
        
        // Update Shoutbox title info
        const toolbarTitle = document.querySelector('.shoutbox-toolbar span');
        if (toolbarTitle) {
            toolbarTitle.textContent = `Listening Party Chatroom: ${activeRoom}`;
            toolbarTitle.style.color = 'var(--orkut-pink)';
            toolbarTitle.style.fontWeight = 'bold';
        }
        
        // Clear message log to separate from global shoutbox
        const msgContainer = document.getElementById('shoutbox-messages');
        if (msgContainer) msgContainer.innerHTML = '';
    }

    // Initialize iPod Menu directly with static songs
    renderIpodMenu();

    // Initialize Shoutbox with WebSockets and fallback to polling
    if (!activeRoom) {
        pollShoutbox();
    }
    initShoutboxWebSocket();

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
    if (activeRoom && !isPartyHost) {
        showPartyAlert("Host controls only!");
        return;
    }
    if (ipodState.view !== 'menu') return;
    if (ipodState.menuIndex > 0) {
        ipodState.menuIndex--;
        renderIpodMenu();
    }
}

function ipodNext() {
    if (activeRoom && !isPartyHost) {
        showPartyAlert("Host controls only!");
        return;
    }
    if (ipodState.view !== 'menu') return;
    if (ipodState.menuIndex < stations.length - 1) {
        ipodState.menuIndex++;
        renderIpodMenu();
    }
}

// Menu button goes back to menu view
function ipodMenu() {
    if (ipodState.view === 'nowplaying') {
        ipodState.view = 'menu';
        renderIpodMenu();
    }
}

function ipodSelect() {
    if (activeRoom && !isPartyHost) {
        showPartyAlert("Host controls only!");
        return;
    }
    if (ipodState.view === 'menu') {
        const selectedStation = stations[ipodState.menuIndex];
        playIpodStation(selectedStation);
        broadcastSync({ action: 'change', songIndex: ipodState.menuIndex });
    }
}

function ipodPlayPause() {
    if (activeRoom && !isPartyHost) {
        showPartyAlert("Host controls only!");
        return;
    }
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
        if (isPartyHost) {
            broadcastSync({
                action: 'play',
                songIndex: ipodState.menuIndex,
                currentTime: audioElement.currentTime
            });
        }
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
        audioElement.play().then(() => {
            if (isPartyHost) {
                broadcastSync({
                    action: 'play',
                    songIndex: ipodState.menuIndex,
                    currentTime: 0
                });
            }
        }).catch(err => {
            console.error('Playback error:', err);
            document.getElementById('ipod-np-title').textContent = 'Playback Failed';
            stopIpodProgress();
        });
    } else if (audioElement) {
        audioElement.play().then(() => {
            if (isPartyHost) {
                broadcastSync({
                    action: 'play',
                    songIndex: ipodState.menuIndex,
                    currentTime: audioElement.currentTime
                });
            }
        }).catch(err => {
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
    if (isPartyHost) {
        broadcastSync({
            action: 'pause',
            songIndex: ipodState.menuIndex
        });
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
/* ─── Shoutbox & Room Listening Party Live Integration ──────── */
function initShoutboxWebSocket() {
    try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('[ws] Connected to real-time chat socket channel');
            wsConnection = ws;
            if (activeRoom) {
                ws.send(JSON.stringify({
                    type: 'join',
                    room: activeRoom,
                    username: currentUserName,
                    displayName: currentUserDisplayName
                }));
            }
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                
                // 1. System notices
                if (message.type === 'user_joined') {
                    appendSystemMessage(`${message.displayName} joined the listening party room 🎧`);
                } else if (message.type === 'user_left') {
                    appendSystemMessage(`${message.displayName} left the party.`);
                }
                
                // 2. Synchronized audio controls (Only Guest handles this)
                else if (message.type === 'sync' && activeRoom && !isPartyHost) {
                    handleSyncMessage(message);
                }
                
                // 3. Chat Room messages
                else if (message.type === 'room_chat' && activeRoom) {
                    appendRoomChatMessage(message);
                } else if (message.type === 'shoutbox' && !activeRoom) {
                    // Global shoutbox message
                    appendShoutboxMessage(message.message || message.data);
                }
            } catch (e) {
                console.error('[ws] Failed to parse socket message:', e);
            }
        };

        ws.onerror = (err) => {
            console.warn('[ws] Connection error. Polling fallback active.', err);
        };

        ws.onclose = () => {
            console.warn('[ws] Socket disconnected.');
            wsConnection = null;
            if (!activeRoom) {
                // Fallback: poll every 6 seconds if WS is disconnected in global mode
                setInterval(pollShoutbox, 6000);
            }
        };
    } catch (err) {
        console.warn('[ws] WS setup failed. Falling back to HTTP polling.', err);
        if (!activeRoom) {
            setInterval(pollShoutbox, 6000);
        }
    }
}

function handleSyncMessage(msg) {
    console.log('[sync] Received sync from host:', msg);
    if (msg.action === 'change') {
        ipodState.menuIndex = msg.songIndex;
        playIpodStationSilent(msg.songIndex);
    } else if (msg.action === 'play') {
        if (!ipodState.isPlaying || ipodState.menuIndex !== msg.songIndex) {
            playIpodStationSilent(msg.songIndex);
        }
        if (audioElement && Math.abs(audioElement.currentTime - msg.currentTime) > 2) {
            audioElement.currentTime = msg.currentTime;
        }
    } else if (msg.action === 'pause') {
        pauseIpodSilent();
    }
}

function broadcastSync(payload) {
    if (isPartyHost && wsConnection && wsConnection.readyState === WebSocket.OPEN) {
        wsConnection.send(JSON.stringify({
            type: 'sync',
            room: activeRoom,
            ...payload
        }));
    }
}

// Silent audio control helper functions for guest players
function playIpodStationSilent(songIndex) {
    const station = stations[songIndex];
    if (!station) return;
    ipodState.menuIndex = songIndex;
    ipodState.currentStation = station;
    ipodState.isPlaying = true;
    ipodState.view = 'nowplaying';
    
    // Update Screen UI
    document.getElementById('ipod-menu').style.display = 'none';
    document.getElementById('ipod-now-playing').style.display = 'flex';
    document.getElementById('ipod-status-title').textContent = 'Listening Together';
    
    document.getElementById('ipod-np-title').textContent = station.name;
    document.getElementById('ipod-np-artist').textContent = station.genre;
    
    startIpodProgress();

    if (audioElement) {
        if (audioElement.src !== station.url) {
            audioElement.src = station.url;
        }
        audioElement.play().catch(err => console.log('Auto-play blocked by user gesture restrictions', err));
    }
}

function pauseIpodSilent() {
    ipodState.isPlaying = false;
    stopIpodProgress();
    if (audioElement) {
        audioElement.pause();
    }
    document.getElementById('ipod-status-title').textContent = 'Paused (Sync)';
}

function startParty() {
    if (!currentUserName) {
        alert("Please log in to start a listening party!");
        window.location.href = "/login";
        return;
    }
    window.location.href = `/radio?room=${encodeURIComponent(currentUserName)}`;
}

function leaveParty() {
    window.location.href = '/radio';
}

function sendInvite() {
    const select = document.getElementById('invite-friend-select');
    if (!select) return;
    const friendId = select.value;
    if (!friendId) {
        alert("Please select a friend to invite!");
        return;
    }

    fetch('/radio/invite', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            friendId: friendId,
            room: activeRoom
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            const status = document.getElementById('invite-status');
            if (status) {
                status.style.display = 'block';
                setTimeout(() => status.style.display = 'none', 3000);
            }
        } else {
            alert("Failed to send invite: " + (data.error || "unknown error"));
        }
    })
    .catch(err => console.error("Error sending invite:", err));
}

function showPartyAlert(text) {
    const npTitle = document.getElementById('ipod-np-title');
    if (npTitle) {
        const originalText = npTitle.textContent;
        npTitle.textContent = text;
        setTimeout(() => {
            if (npTitle.textContent === text) {
                npTitle.textContent = originalText;
            }
        }, 2000);
    }
}

function appendShoutboxMessage(msg) {
    const container = document.getElementById('shoutbox-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'shoutbox__msg';

    const dateObj = new Date(msg.created_at || new Date());
    const timeStr = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

    div.innerHTML = `
        <span class="shoutbox__msg-time">[${timeStr}]</span>
        <span class="shoutbox__msg-author">&lt;${msg.display_name}&gt;</span>
        <span class="shoutbox__msg-content">${escapeHTML(msg.content)}</span>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function appendRoomChatMessage(msg) {
    const container = document.getElementById('shoutbox-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'shoutbox__msg';
    div.innerHTML = `
        <span class="shoutbox__msg-time">[${msg.timestamp}]</span>
        <span class="shoutbox__msg-author" style="color:#bf3a6c; font-weight:bold;">&lt;${msg.displayName}&gt;</span>
        <span class="shoutbox__msg-content">${escapeHTML(msg.content)}</span>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function appendSystemMessage(text) {
    const container = document.getElementById('shoutbox-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'shoutbox__msg';
    div.style.color = '#7f8c8d';
    div.style.fontStyle = 'italic';
    div.style.padding = '3px 8px';
    div.innerHTML = `📢 ${escapeHTML(text)}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function pollShoutbox() {
    fetch('/shoutbox/api/messages')
        .then(res => res.json())
        .then(data => {
            if (Array.isArray(data)) {
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
    
    if (activeRoom && wsConnection && wsConnection.readyState === WebSocket.OPEN) {
        wsConnection.send(JSON.stringify({
            type: 'chat',
            room: activeRoom,
            username: currentUserName,
            displayName: currentUserDisplayName,
            avatarUrl: currentUserAvatar,
            content: text
        }));
        input.value = '';
    } else {
        fetch('/shoutbox', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ content: text })
        })
        .then(() => {
            input.value = '';
        })
        .catch(err => {
            console.error('[Send Message failed]:', err);
            window.location.href = '/login';
        });
    }
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
