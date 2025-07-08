document.addEventListener('DOMContentLoaded', () => {

    const authContainer = document.getElementById('auth-container');
    const gameAppContainer = document.getElementById('game-app-container');
    const authForm = document.getElementById('auth-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const authTitle = document.getElementById('auth-title');
    const submitButton = document.getElementById('submit-button');
    const toggleAuth = document.getElementById('toggle-auth');
    const authMessage = document.getElementById('auth-message');
    const logoutButton = document.getElementById('logout-button');

    const kakaoRegisterContainer = document.getElementById('kakao-register-container');
    const kakaoRegisterForm = document.getElementById('kakao-register-form');
    const kakaoRegUsername = document.getElementById('kakao-reg-username');
    const kakaoRegPassword = document.getElementById('kakao-reg-password');
    const kakaoRegMessage = document.getElementById('kakao-reg-message');
    const kakaoLinkContainer = document.getElementById('kakao-link-container');
    const kakaoLinkForm = document.getElementById('kakao-link-form');
    const kakaoLinkUsername = document.getElementById('kakao-link-username');
    const kakaoLinkMessage = document.getElementById('kakao-link-message');

    let isLogin = true;
    let linkTokenForKakao = null; 

    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const action = urlParams.get('action');
    const tempToken = urlParams.get('token');

    if (error) {
        authMessage.textContent = decodeURIComponent(error);
        window.history.replaceState({}, document.title, "/"); 
    }
    
    if (action === 'kakao_finalize' && tempToken) {
        authContainer.style.display = 'none';
        const decoded = decodeJwtPayload(tempToken);
        
        sessionStorage.setItem('kakao_temp_token', tempToken);
        
        linkTokenForKakao = localStorage.getItem('link_token_for_kakao');

        if (linkTokenForKakao) {
            kakaoLinkContainer.style.display = 'flex';
        } else {
            kakaoRegisterContainer.style.display = 'flex';
        }
        window.history.replaceState({}, document.title, "/");
    }

    function toggleAuthView(showLogin = true) {
        isLogin = showLogin;
        
        const authForm = document.getElementById('auth-form');
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');

        authTitle.textContent = isLogin ? '로그인' : '회원가입';

        if (isLogin) {
            authForm.style.display = 'block';
            toggleAuth.innerHTML = '계정이 없으신가요? <span id="toggle-link">회원가입</span>';
        } else {
            authForm.style.display = 'none';
            toggleAuth.innerHTML = `<button type="button" id="kakao-register-button" style="width:100%; padding: 15px; border:none; border-radius:6px; background-color:#FEE500; color:#000; font-size:1.2em; font-weight:700; cursor:pointer;">카카오로 시작하기</button><p style="margin-top:15px;">이미 계정이 있으신가요? <span id="toggle-link">로그인</span></p>`;
            
            document.getElementById('kakao-register-button').addEventListener('click', () => {
                localStorage.removeItem('link_token_for_kakao');
                window.location.href = '/api/kakao/login';
            });
        }
        
        document.getElementById('toggle-link').addEventListener('click', () => {
            authMessage.textContent = ''; 
            toggleAuthView(!isLogin);
        });
    }

    toggleAuthView(true);

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = usernameInput.value;
        const password = passwordInput.value;
        
        try {
            const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
            const data = await response.json();
            
            if (!response.ok) {
                authMessage.textContent = data.message;
                return;
            }

            if (data.needsKakaoLink) {
                authMessage.textContent = '기존 계정은 카카오 연동이 필요합니다. 카카오로 로그인해주세요.';
                localStorage.setItem('link_token_for_kakao', data.linkToken);
                setTimeout(() => {
                    window.location.href = '/api/kakao/login';
                }, 1500);
            } else if (data.token) {
                localStorage.setItem('jwt_token', data.token);
                startApp(data.token);
            }
        } catch (error) {
            authMessage.textContent = '서버와 통신할 수 없습니다.';
        }
    });

    kakaoRegisterForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const kakaoTempToken = sessionStorage.getItem('kakao_temp_token');
        if (!kakaoTempToken) {
            kakaoRegMessage.textContent = '인증 정보가 만료되었습니다. 처음부터 다시 시도해주세요.';
            return;
        }
        const response = await fetch('/api/finalize-registration', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tempToken: kakaoTempToken,
                username: kakaoRegUsername.value,
                password: kakaoRegPassword.value
            })
        });
        const data = await response.json();
        if (!response.ok) {
            kakaoRegMessage.textContent = data.message;
        } else {
            alert(data.message);
            sessionStorage.removeItem('kakao_temp_token');
            location.reload(); 
        }
    });
    
    kakaoLinkForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const linkToken = localStorage.getItem('link_token_for_kakao');
        const kakaoTempToken = sessionStorage.getItem('kakao_temp_token');
        if (!linkToken || !kakaoTempToken) {
            kakaoLinkMessage.textContent = '인증 정보가 만료되었습니다. 처음부터 다시 시도해주세요.';
            return;
        }
        const response = await fetch('/api/finalize-linking', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                linkToken,
                kakaoTempToken,
                newUsername: kakaoLinkUsername.value
            })
        });
        const data = await response.json();
        if (!response.ok) {
            kakaoLinkMessage.textContent = data.message;
        } else {
            alert(data.message);
            localStorage.removeItem('link_token_for_kakao');
            sessionStorage.removeItem('kakao_temp_token');
            localStorage.setItem('jwt_token', data.token);
            startApp(data.token);
        }
    });

    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('link_token_for_kakao');
        sessionStorage.removeItem('kakao_temp_token');
        location.reload();
    });

    function startApp(token) {
        document.body.classList.remove('auth-view');
        authContainer.style.display = 'none';
        kakaoRegisterContainer.style.display = 'none';
        kakaoLinkContainer.style.display = 'none';
        gameAppContainer.style.display = 'flex';
        
        const decodedToken = decodeJwtPayload(token);
        if (!decodedToken) {
            console.error("Invalid Token: Decoding failed.");
            localStorage.removeItem('jwt_token');
            location.reload();
            return;
        }

        window.myUsername = decodedToken.username;
        window.myUserId = decodedToken.userId;

        const socket = io({ auth: { token }, transports: ['websocket'] });
window.socket = socket;
        socket.on('connect_error', (err) => { alert(err.message); localStorage.removeItem('jwt_token'); location.reload(); });
        initializeGame(socket);
    }

    const token = localStorage.getItem('jwt_token');
    if (token && !action) {
        startApp(token);
    } else if (!action) {
        document.body.classList.add('auth-view');
    }
});

function decodeJwtPayload(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error("JWT 디코딩 실패:", e);
        return null;
    }
}

function getFameDetails(score) {
    if (score >= 40000) return { icon: '💎', className: 'fame-diamond' };
    if (score >= 15000) return { icon: '🥇', className: 'fame-gold' };
    if (score >= 5000) return { icon: '🥈', className: 'fame-silver' };
    if (score >= 1000) return { icon: '🥉', className: 'fame-bronze' };
    return { icon: '🐥', className: '' };
}

function createFameUserHtml(username, score) {
    const fame = getFameDetails(score);
    return `${fame.icon} <span class="${fame.className}">${username}(${(score || 0).toLocaleString()})</span>`;
}

const createItemHTML = (item, options = {}) => {
    const { showName = true, showEffect = true, forTooltip = false, showEnchantments = true } = options;
    if (!item) return '';

    let effectText = '';
    if (showEffect) { 
        if (item.type === 'weapon') {
            let bonus = item.baseEffect || 0;
            if (item.grade === 'Primal' && item.randomizedValue) {
                bonus += (item.randomizedValue / 100);
            }
            for (let i = 1; i <= item.enhancement; i++) { 
                bonus += item.baseEffect * (i <= 10 ? 0.1 : 0.5); 
            }
            effectText = `⚔️공격력 +${(bonus * 100).toFixed(1)}%`;
        } else if (item.type === 'armor') {
            let bonus = item.baseEffect || 0;
            if (item.grade === 'Primal' && item.randomizedValue) {
                bonus += (item.randomizedValue / 100);
            }
            for (let i = 1; i <= item.enhancement; i++) { 
                bonus += item.baseEffect * (i <= 10 ? 0.1 : 0.5); 
            }
            effectText = `❤️🛡️체/방 +${(bonus * 100).toFixed(1)}%`;
        } else if (item.type === 'accessory' || item.type === 'pet') {
            effectText = item.description || '';
        } else {
            effectText = item.description || '';
        }
    }

    const nameClass = item.grade || 'Common';
    const nameHTML = showName ? `<div class="item-name ${nameClass}">${item.name}</div>` : '';
    const enhanceText = item.enhancement ? `<div class="item-enhancement-level">[+${item.enhancement}]</div>` : '';
    const quantityText = item.quantity > 1 && !forTooltip ? `<div class="item-quantity">x${item.quantity}</div>` : '';
    const imageHTML = item.image ? `<div class="item-image"><img src="/image/${item.image}" alt="${item.name}" draggable="false"></div>` : '<div class="item-image"></div>';

    let enchantmentsHTML = '';
    if (showEnchantments && item.enchantments && item.enchantments.length > 0) {
        enchantmentsHTML = '<div class="item-enchantments">';
        const gradeToColor = {
            supreme: 'var(--mystic-color)', 
            rare_enchant: 'var(--epic-color)', 
            common_enchant: 'var(--common-color)' 
        };
        const typeToName = {
            all_stats_percent: '✨모든 스탯',
            focus: '🎯집중',
            penetration: '💎관통',
            tenacity: '🛡️강인함',
            attack_percent: '⚔️공격력',
            defense_percent: '🛡️방어력',
            hp_percent: '❤️체력',
            gold_gain: '💰골드 획득',
            extra_climb_chance: '🍀추가 등반',
            def_penetration: '🛡️방어력 관통',
        };
        item.enchantments.forEach(enchant => {
            const color = gradeToColor[enchant.grade] || '#fff';
            const name = typeToName[enchant.type] || enchant.type;
            const valueSuffix = ['focus', 'penetration', 'tenacity', 'attack_percent', 'defense_percent', 'hp_percent', 'all_stats_percent', 'gold_gain', 'extra_climb_chance', 'def_penetration'].includes(enchant.type) ? '%' : '';
            enchantmentsHTML += `<div style="color: ${color}; font-size: 0.85em;">${name} +${enchant.value}${valueSuffix}</div>`;
        });
        enchantmentsHTML += '</div>';
    }

    const effectHTML = effectText ? `<div class="item-effect">${effectText}</div>` : '';
    return `${imageHTML}<div class="item-info">${nameHTML}${effectHTML}${enchantmentsHTML}</div>${quantityText}${enhanceText}`;
};

function createPlayerPanelHTML(player) {
    if (!player) return '<p>유저 정보를 찾을 수 없습니다.</p>';
    
    const weaponHTML = player.equipment?.weapon ? createItemHTML(player.equipment.weapon) : '⚔️<br>무기';
    const armorHTML = player.equipment?.armor ? createItemHTML(player.equipment.armor) : '🛡️<br>방어구';
    const petHTML = player.equippedPet ? createItemHTML(player.equippedPet) : '🐾<br>펫';
    const necklaceHTML = player.equipment?.necklace ? createItemHTML(player.equipment.necklace) : '💍<br>목걸이';
    const earringHTML = player.equipment?.earring ? createItemHTML(player.equipment.earring) : '👂<br>귀걸이';
    const wristwatchHTML = player.equipment?.wristwatch ? createItemHTML(player.equipment.wristwatch) : '⏱️<br>손목시계';
    
    const artifactSocketsHTML = (player.unlockedArtifacts || []).map(artifact => 
        artifact 
        ? `<div class="artifact-socket unlocked" title="${artifact.name}: ${artifact.description}"><img src="/image/${artifact.image}" alt="${artifact.name}"></div>` 
        : `<div class="artifact-socket" title="비활성화된 유물 소켓"><img src="/image/socket_locked.png" alt="잠김"></div>`
    ).join('');
    
   return `
        <div class="character-panel player-panel" style="background: none; box-shadow: none;">
            <div class="character-header">
                <h2>${createFameUserHtml(player.username, player.fameScore || 0)} <span style="font-size: 0.8em; color: var(--text-muted);">(최대 ${player.maxLevel}층)</span></h2>
                <div class="resource-display">💰 <span>${(player.gold || 0).toLocaleString()}</span></div>
            </div>
            <div class="stat-info-combined">
                <div class="stat-row-monster"><span>❤️ 총 체력</span><span class="stat-value">${Math.floor(player.stats?.total?.hp || 0).toLocaleString()}</span></div>
                <div class="stat-row-monster"><span>⚔️ 총 공격력</span><span class="stat-value">${Math.floor(player.stats?.total?.attack || 0).toLocaleString()}</span></div>
                <div class="stat-row-monster"><span>🛡️ 총 방어력</span><span class="stat-value">${Math.floor(player.stats?.total?.defense || 0).toLocaleString()}</span></div>
                <div class="stat-row-monster"><span>💥 치명타 확률</span><span class="stat-value">${((player.stats?.critChance || 0) * 100).toFixed(2)}%</span></div>
                <div class="stat-row-monster"><span>🔰 치명타 저항</span><span class="stat-value">${((player.stats?.critResistance || 0) * 100).toFixed(2)}%</span></div>
            </div>
            <div class="equipment-section">
                <div class="equipment-slots">
                    <div class="slot" data-item-type="weapon">${weaponHTML}</div>
                    <div class="slot" data-item-type="armor">${armorHTML}</div>
                    <div class="slot" data-item-type="pet">${petHTML}</div>
                    <div class="slot" data-item-type="necklace">${necklaceHTML}</div>
                    <div class="slot" data-item-type="earring">${earringHTML}</div>
                    <div class="slot" data-item-type="wristwatch">${wristwatchHTML}</div>
                </div>
                <div class="artifact-sockets" style="margin-top: 15px;">${artifactSocketsHTML}</div>
            </div>
        </div>
    `;
}

function initializeGame(socket) {
    let quillEditor = null;
    let currentBoardCategory = '자유';
    let currentBoardPage = 1;
    let currentPostId = null; 
    let selectedItemUidForAction = null;
    let returnCooldownTimer = null;

    const elements = {
        gold: document.getElementById('gold'),
        player: { 
            panel: document.querySelector('.player-panel'), 
            hpBar: document.getElementById('player-hp-bar'), 
            hpText: document.getElementById('player-hp-text'), 
            totalHp: document.getElementById('total-hp'), 
            totalAttack: document.getElementById('total-attack'), 
            totalDefense: document.getElementById('total-defense'),
            specialStatsGrid: document.getElementById('special-stats-grid')
        },
        monster: { 
            panel: document.querySelector('.monster-panel'), 
            level: document.getElementById('monster-level'), 
            hpBar: document.getElementById('monster-hp-bar'), 
            hpText: document.getElementById('monster-hp-text'), 
            totalHp: document.getElementById('monster-hp-total'), 
            attack: document.getElementById('monster-attack'), 
            defense: document.getElementById('monster-defense'),
            barrierBar: document.getElementById('monster-barrier-bar'),
            barrierText: document.getElementById('monster-barrier-text'),
            abilityIcons: document.getElementById('monster-ability-icons'),
leaveRaidBtn: document.getElementById('leave-raid-btn')
        },
        equipment: { 
            weapon: document.getElementById('weapon-slot'), 
            armor: document.getElementById('armor-slot'),
            pet: document.getElementById('pet-slot'),
            necklace: document.getElementById('necklace-slot'),   
            earring: document.getElementById('earring-slot'),       
            wristwatch: document.getElementById('wristwatch-slot') 
        },
        artifactSockets: document.getElementById('artifact-sockets'),
        inventory: { 
            weapon: document.getElementById('weapon-inventory'), 
            armor: document.getElementById('armor-inventory'),
            accessory: document.getElementById('accessory-inventory'),
            item: document.getElementById('item-inventory'),
            pet: document.getElementById('pet-inventory'),
            all: document.querySelectorAll('.inventory-grid'), 
        },
        log: document.getElementById('game-log'),
        tabs: { 
            buttons: document.querySelectorAll('.tab-button'), 
            contents: document.querySelectorAll('.tab-content'),
        },
        enhancement: { 
            anvil: document.querySelector('.enhancement-anvil'),
            details: document.querySelector('.enhancement-details'),
            slot: document.getElementById('enhancement-slot'), 
            before: document.getElementById('enhancement-before'), 
            after: document.getElementById('enhancement-after'), 
            info: document.getElementById('enhancement-info'), 
            button: document.getElementById('enhance-button'), 
            animation: document.getElementById('enhancement-animation'), 
            useTicketCheck: document.getElementById('use-prevention-ticket'),
            useHammerCheck: document.getElementById('use-hammer-ticket'),
            checkboxes: document.querySelector('.enhancement-checkboxes-wrapper'),
        },
        riftEnchant: {
            tabButton: document.querySelector('.tab-button[data-tab="rift-enchant-tab"]'),
            tabContent: document.getElementById('rift-enchant-tab'),
            slot: document.getElementById('rift-enchant-slot'),
            optionsContainer: document.getElementById('rift-enchant-options'),
            costDisplay: document.getElementById('rift-enchant-cost'),
            button: document.getElementById('rift-enchant-execute-btn')
        },
        fusion: {
            panel: document.getElementById('fusion-container'),
            processUI: document.getElementById('fusion-process-ui'),
            timerUI: document.getElementById('fusion-timer-ui'),
            slot1: document.getElementById('fusion-slot-1'),
            slot2: document.getElementById('fusion-slot-2'),
            info1: document.getElementById('fusion-pet-info-1'),
            info2: document.getElementById('fusion-pet-info-2'),
            timer: document.getElementById('fusion-timer'),
            button: document.getElementById('fusion-start-button')
        },
        board: {
            container: document.getElementById('board-main-container'),
            closeButton: document.getElementById('board-close-button'),
            listView: document.getElementById('board-list-view'),
            tabs: document.querySelector('.board-tabs'),
            postList: document.getElementById('board-post-list'),
            pagination: document.getElementById('board-pagination'),
            writePostBtn: document.getElementById('board-write-post-btn'),
            detailView: document.getElementById('board-detail-view'),
            postContentArea: document.getElementById('post-content-area'),
            commentArea: document.getElementById('post-comment-area'),
            commentList: document.getElementById('comment-list'),
            commentForm: document.getElementById('comment-form'),
            commentInput: document.getElementById('comment-input'),
            backToListBtn: document.getElementById('board-back-to-list-btn'),
            writeView: document.getElementById('board-write-view'),
            postForm: document.getElementById('post-form'),
            postEditId: document.getElementById('post-edit-id'),
            postCategory: document.getElementById('post-category'),
            postTitle: document.getElementById('post-title'),
            postContentInput: document.getElementById('post-content-input'),
            postSubmitBtn: document.getElementById('post-submit-btn'),
            cancelBtn: document.getElementById('board-cancel-btn')
        },
        userInfo: {
            container: document.getElementById('user-info'),
            username: document.getElementById('welcome-username'),
            icon: document.getElementById('fame-icon'),
            fameScoreDisplay: document.getElementById('fame-score-display')
        },
        incubator: {
            content: document.getElementById('incubator-content'),
            slot: document.getElementById('incubator-slot'),
            hatchButton: document.getElementById('hatch-button'),
            hatchingInfo: document.getElementById('hatching-info'),
            progressBar: document.getElementById('hatch-progress-bar'),
            timer: document.getElementById('hatch-timer'),
        },
        worldBoss: { 
            container: document.getElementById('world-boss-container'), 
            name: document.getElementById('world-boss-name'), 
            hpBar: document.getElementById('world-boss-hp-bar'), 
            hpText: document.getElementById('world-boss-hp-text'), 
            contribution: document.getElementById('world-boss-contribution'), 
            toggleBtn: document.getElementById('attack-target-toggle-btn'), 
        },
        modals: {
            board: { button: document.getElementById('board-button'), overlay: document.getElementById('board-modal') },
            auction: { button: document.getElementById('auction-button'), overlay: document.getElementById('auction-modal'), grid: document.getElementById('auction-grid'), detail: document.getElementById('auction-item-detail'), refreshBtn: document.getElementById('auction-refresh-btn'), },
            ranking: { button: document.getElementById('ranking-button'), overlay: document.getElementById('ranking-modal'), list: document.getElementById('ranking-list'), },
            loot: { button: document.getElementById('loot-record-button'), overlay: document.getElementById('loot-record-modal'), display: document.getElementById('loot-record-display'), },
            enhancement: { button: document.getElementById('enhancement-record-button'), overlay: document.getElementById('enhancement-record-modal'), display: document.getElementById('enhancement-record-display'), },
            online: { button: document.getElementById('online-users-button'), overlay: document.getElementById('online-users-modal'), list: document.getElementById('online-users-list'), title: document.getElementById('online-users-title'), },
            mailbox: { 
                button: document.getElementById('mailbox-button'), 
                overlay: document.getElementById('mailbox-modal'), 
                list: document.getElementById('mailbox-list'), 
                claimAllBtn: document.getElementById('mailbox-claim-all-btn')
            },
            primalChoice: {
                overlay: document.getElementById('primal-choice-modal'),
                enhanceBtn: document.getElementById('primal-choice-enhance-btn'),
                enchantBtn: document.getElementById('primal-choice-enchant-btn')
            },
            itemAction: {
                overlay: document.getElementById('item-action-modal'),
                title: document.getElementById('item-action-title'),
                buttons: document.getElementById('item-action-buttons')
            },
            itemInfo: {
                overlay: document.getElementById('item-info-modal'),
                content: document.getElementById('item-info-modal-content')
            }
        },
        chat: { 
            messages: document.getElementById('chat-messages'), 
            form: document.getElementById('chat-form'), 
            input: document.getElementById('chat-input'), 
        },
        announcementBanner: document.getElementById('announcement-banner'),
        zoom: { 
            gameContainer: document.getElementById('game-app-container'), 
            inBtn: document.getElementById('zoom-in-btn'), 
            outBtn: document.getElementById('zoom-out-btn'), 
        },
        codex: {
            button: document.getElementById('codex-button'),
            overlay: document.getElementById('codex-modal'),
            content: document.getElementById('codex-content')
        },

 titleCodex: { 
            button: document.getElementById('title-codex-button'),
            overlay: document.getElementById('title-codex-modal'),
            content: document.getElementById('title-codex-content'),
            footer: document.getElementById('title-codex-footer'),
            closeButton: document.getElementById('title-codex-modal').querySelector('.close-button')
        }, 

        petChoice: {
            overlay: document.getElementById('pet-choice-modal'),
            title: document.getElementById('pet-choice-title'),
            equipBtn: document.getElementById('pet-choice-equip-btn'),
            fusionBtn: document.getElementById('pet-choice-fusion-btn'),
            closeBtn: document.querySelector('#pet-choice-modal .close-button')
        },
        floorControls: {
            container: document.getElementById('floor-controls'),
            safeZoneBtn: document.getElementById('safe-zone-btn'),
            frontlineBtn: document.getElementById('frontline-btn'),
personalRaidBtn: document.getElementById('personal-raid-btn')
        }
    };
    if (elements.floorControls.safeZoneBtn) {
        elements.floorControls.safeZoneBtn.addEventListener('click', () => {
            if (confirm('50만 층 안전지대로 이동하시겠습니까?\n이동 시 30분간 최전선 복귀가 불가능합니다.')) {
                socket.emit('moveToSafeZone');
            }
        });
    }

    if (elements.floorControls.frontlineBtn) {
        elements.floorControls.frontlineBtn.addEventListener('click', () => {
            if (!elements.floorControls.frontlineBtn.disabled) {
                socket.emit('returnToFrontline');
            }
        });
    }
    
    const weaponTabInteractionPanel = document.querySelector('#weapon-inventory-tab .interaction-panel');
    if (weaponTabInteractionPanel) {
        weaponTabInteractionPanel.style.display = 'none';
    }

    const zoomLogic = {
        MIN_SCALE: 0.7, MAX_SCALE: 1.2, currentScale: 1.0,
        applyZoom(scale) { this.currentScale = Math.max(this.MIN_SCALE, Math.min(this.MAX_SCALE, scale)); document.body.style.transition = 'zoom 0.2s ease-in-out'; document.body.style.zoom = this.currentScale; },
        init() { elements.zoom.inBtn.addEventListener('click', () => this.applyZoom(this.currentScale + 0.1)); elements.zoom.outBtn.addEventListener('click', () => this.applyZoom(this.currentScale - 0.1)); this.applyZoom(1.0); }
    };
    zoomLogic.init();

 function updatePlayerFameDisplay(score, username, title) {
    const fameDetails = getFameDetails(score);
    const scoreText = `(${(score || 0).toLocaleString()})`;
    
    const userInfoEl = elements.userInfo;
    if (userInfoEl) {
        userInfoEl.icon.textContent = fameDetails.icon;
        userInfoEl.fameScoreDisplay.textContent = scoreText;
        const usernameEl = userInfoEl.username;
        usernameEl.className = ''; 
        if (fameDetails.className) {
            usernameEl.classList.add(fameDetails.className);
        }

        const titleHtml = title ? `<span class="title ${getGradeByTitle(title)}">${title}</span>` : '';
        usernameEl.innerHTML = `${titleHtml}${username}`; 
    }

    if (username === window.myUsername) {
        const myMessagesInChat = document.querySelectorAll(`#chat-messages .username[data-username="${username}"]`);
        myMessagesInChat.forEach(usernameSpan => {
            const userHtml = createFameUserHtml(username, score);
            const prefix = usernameSpan.innerHTML.startsWith('👑') ? '👑 ' : '';
            const titleHtml = title ? `<span class="title ${getGradeByTitle(title)}">${title}</span>` : '';
            usernameSpan.innerHTML = `${prefix}${titleHtml}${userHtml}:`;
        });
    }
}

    document.querySelectorAll('.modal-overlay').forEach(modal => { 
        const closeBtn = modal.querySelector('.close-button');
        if(closeBtn) {
            closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
        }
        modal.addEventListener('click', (e) => { 
            if (e.target === modal) { 
                modal.style.display = 'none'; 
            } 
        }); 
    });

    let selectedPetChoiceUid = null;

    function closePetChoiceModal() {
        elements.petChoice.overlay.style.display = 'none';
        selectedPetChoiceUid = null;
    }

    elements.petChoice.equipBtn.addEventListener('click', () => {
        if (selectedPetChoiceUid) {
            socket.emit('equipPet', selectedPetChoiceUid);
            closePetChoiceModal();
        }
    });

    elements.petChoice.fusionBtn.addEventListener('click', () => {
        if (selectedPetChoiceUid) {
            document.querySelector('.tab-button[data-tab="fusion-tab"]').click();
            socket.emit('slotPetForFusion', { uid: selectedPetChoiceUid });
            closePetChoiceModal();
        }
    });
    
    elements.petChoice.closeBtn.addEventListener('click', closePetChoiceModal);
    elements.monster.leaveRaidBtn.addEventListener('click', () => {
    if (confirm('정말로 레이드를 포기하고 일반 등반으로 복귀하시겠습니까?')) {
        socket.emit('personalRaid:leave');
    }
});
    elements.modals.ranking.button.addEventListener('click', () => { socket.emit('requestRanking'); elements.modals.ranking.overlay.style.display = 'flex'; });
    elements.modals.loot.button.addEventListener('click', () => { elements.modals.loot.overlay.style.display = 'flex'; });
    elements.modals.enhancement.button.addEventListener('click', () => { elements.modals.enhancement.overlay.style.display = 'flex'; });
    elements.modals.online.button.addEventListener('click', () => { socket.emit('requestOnlineUsers'); elements.modals.online.overlay.style.display = 'flex'; });

    elements.codex.button.addEventListener('click', () => {
        socket.emit('codex:getData', (data) => {
            if (data) {
                renderCodex(data);
                elements.codex.overlay.style.display = 'flex';
            } else {
                alert('도감 정보를 불러오는 데 실패했습니다.');
            }
        });
    }); 



 elements.titleCodex.button.addEventListener('click', () => {
        socket.emit('titles:getData', (data) => {
            if (data) {
                renderTitleCodex(data);
                elements.titleCodex.overlay.style.display = 'flex';
            } else {
                alert('칭호 정보를 불러오는 데 실패했습니다.');
            }
        });
    });

    elements.titleCodex.closeButton.addEventListener('click', () => {
        elements.titleCodex.overlay.style.display = 'none';
    });

    const setupFusionSlot = (slotElement) => {
        slotElement.addEventListener('dblclick', () => {
            const slotIndex = slotElement.dataset.slotIndex;
            const fusionData = currentPlayerState.petFusion;
            if ((slotIndex === '1' && fusionData.slot1) || (slotIndex === '2' && fusionData.slot2)) {
                socket.emit('unslotPetFromFusion', { slotIndex });
            }
        });
        slotElement.addEventListener('dragover', e => { e.preventDefault(); slotElement.classList.add('drag-over'); });
        slotElement.addEventListener('dragleave', () => slotElement.classList.remove('drag-over'));
        slotElement.addEventListener('drop', e => {
            e.preventDefault();
            slotElement.classList.remove('drag-over');
            const uid = e.dataTransfer.getData('text/plain');
            const itemType = e.dataTransfer.getData('item-type');
            if (itemType === 'pet') {
                socket.emit('slotPetForFusion', { uid });
            }
        });
    };
    setupFusionSlot(elements.fusion.slot1);
    setupFusionSlot(elements.fusion.slot2);
    
    elements.fusion.button.addEventListener('click', () => {
        if (!currentPlayerState) return;
        const { slot1, slot2 } = currentPlayerState.petFusion;
        if (slot1 && slot2 && confirm(`[${slot1.name}]와(과) [${slot2.name}]의 융합을 시작하시겠습니까?\n\n비용: 1억 골드\n(융합 시작 시 취소할 수 없으며 융합된펫을 융합시도시 시간만 날리게됩니다)`)) {
            socket.emit('startPetFusion');
        }
    });

    const htmlModeCheckbox = document.getElementById('html-mode-checkbox');
    const quillContainer = document.querySelector('#editor-container');
    const htmlTextarea = document.getElementById('html-editor-textarea');

    htmlModeCheckbox.addEventListener('change', () => {
        const quillToolbar = document.querySelector('.ql-toolbar');
        const quillEditorArea = document.querySelector('#editor-container');
        if (htmlModeCheckbox.checked) {
            htmlTextarea.value = quillEditor.root.innerHTML;
            if(quillToolbar) quillToolbar.style.display = 'none';
            if(quillEditorArea) quillEditorArea.style.display = 'none';
            htmlTextarea.style.display = 'block';
        } else {
            const htmlContent = htmlTextarea.value;
            quillEditor.setText('');
            quillEditor.clipboard.dangerouslyPasteHTML(htmlContent);
            if(quillToolbar) quillToolbar.style.display = 'block';
            if(quillEditorArea) quillEditorArea.style.display = 'block';
            htmlTextarea.style.display = 'none';
        }
    });

    elements.board.postForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const isInHtmlMode = document.getElementById('html-mode-checkbox').checked;
        const content = isInHtmlMode
            ? document.getElementById('html-editor-textarea').value
            : quillEditor.root.innerHTML;
        const data = {
            category: elements.board.postCategory.value,
            title: elements.board.postTitle.value,
            content: content,
            postId: elements.board.postEditId.value || null
        };
        const eventName = data.postId ? 'board:updatePost' : 'board:createPost';
        socket.emit(eventName, data, (success) => {
            if (success) {
                currentBoardPage = 1;
                fetchAndRenderPosts(data.category, 1);
            } else {
                alert('글 처리 중 오류가 발생했습니다.');
            }
        });
    });
  
    let auctionDataCache = { groupedList: [], allListings: [] };
    let selectedAuctionGroupKey = null;

    elements.modals.auction.button.addEventListener('click', () => {
        fetchAuctionListings();
        elements.modals.auction.overlay.style.display = 'flex';
    });

    elements.modals.auction.refreshBtn.addEventListener('click', fetchAuctionListings);

    function renderAuctionGroupedList() {
        const grid = document.getElementById('auction-grouped-grid');
        const searchKeyword = document.getElementById('auction-search-input').value.toLowerCase();
        const selectedGrade = document.getElementById('auction-grade-filter').value;
        
        const filteredList = auctionDataCache.groupedList.filter(group => {
            const nameMatch = group.item.name.toLowerCase().includes(searchKeyword);
            const gradeMatch = selectedGrade === '전체' || group.item.grade === selectedGrade;
            return nameMatch && gradeMatch;
        });

        if (!filteredList || filteredList.length === 0) {
            grid.innerHTML = '<p class="inventory-tip">표시할 물품이 없습니다.</p>';
            return;
        }
        
        grid.innerHTML = filteredList.map(group => {
            const item = group.item;
            let effectText = '';
            if (item.type === 'weapon') {
                let bonus = item.baseEffect || 0; 
                for (let i = 1; i <= (item.enhancement || 0); i++) { bonus += item.baseEffect * (i <= 10 ? 0.1 : 0.5); }
                effectText = `⚔️공격력 +${(bonus * 100).toFixed(1)}%`;
            } else if (item.type === 'armor') {
                let bonus = item.baseEffect || 0; 
                for (let i = 1; i <= (item.enhancement || 0); i++) { bonus += item.baseEffect * (i <= 10 ? 0.1 : 0.5); }
                effectText = `❤️🛡️체/방 +${(bonus * 100).toFixed(1)}%`;
            } else if (item.type === 'accessory') {
                effectText = item.description || '';
            }
            const infoHTML = `
                <div class="item-name ${item.grade}">${item.enhancement > 0 ? `+${item.enhancement} ` : ''}${item.name}</div>
                ${effectText ? `<div class="item-effect" style="font-size: 0.9em; color: var(--success-color); padding: 2px 0;">${effectText}</div>` : ''}
                <div class="item-effect" style="font-size: 0.9em;">
                    최저가: <span class="gold-text">${group.lowestPrice.toLocaleString()} G</span><br>
                    총 수량: ${group.totalQuantity.toLocaleString()} 개
                </div>`;
            return `
                <div class="inventory-item auction-item ${getEnhanceClass(item.enhancement)} ${group.key === selectedAuctionGroupKey ? 'selected' : ''}" data-group-key="${group.key}">
                    <div class="item-image"><img src="/image/${item.image}" alt="${item.name}" draggable="false"></div>
                    <div class="item-info">${infoHTML}</div>
                </div>`;
        }).join('');
    }

    function fetchAuctionListings() {
        socket.emit('getAuctionListings', (data) => {
            if (data) {
                auctionDataCache = data;
                renderAuctionGroupedList();
                if (selectedAuctionGroupKey) {
                    renderAuctionDetailList(selectedAuctionGroupKey);
                } else {
                    document.getElementById('auction-detail-list').innerHTML = `<p class="inventory-tip" style="text-align: center; margin-top: 50px;">왼쪽에서 아이템을 선택하세요.</p>`;
                }
            }
        });
    }

    function renderAuctionDetailList(groupKey) {
        const detailList = document.getElementById('auction-detail-list');
        const listingsForGroup = auctionDataCache.allListings.filter(listing => {
            const item = listing.item;
            return `${item.id}_${item.enhancement || 0}` === groupKey;
        });
        listingsForGroup.sort((a, b) => {
            if (a.price !== b.price) return a.price - b.price;
            return new Date(a.listedAt) - new Date(b.listedAt);
        });
        if (listingsForGroup.length === 0) {
            detailList.innerHTML = '<p class="inventory-tip">해당 아이템의 판매 목록이 없습니다.</p>';
            return;
        }
        detailList.innerHTML = listingsForGroup.map(listing => {
            const isMyItem = listing.sellerUsername === window.myUsername;
            const item = listing.item;
            const buttonHTML = isMyItem
                ? `<button class="action-btn cancel-auction-btn small-btn" data-listing-id="${listing._id}">취소</button>`
                : `<button class="action-btn buy-auction-btn small-btn" data-listing-id="${listing._id}" data-max-quantity="${listing.item.quantity}">구매</button>`;
            return `
                <div class="auction-detail-entry ${isMyItem ? 'my-listing-highlight' : ''}">
                    <div class="seller-info">
                        <img src="/image/${item.image}" alt="${item.name}" class="auction-detail-item-image">
                        <span class="seller-name">${listing.sellerUsername}</span>
                    </div>
                    <div class="item-price-info">
                        <span class="price">${listing.price.toLocaleString()} G</span>
                        <span class="quantity">(${listing.item.quantity.toLocaleString()}개)</span>
                    </div>
                    <div class="auction-actions">
                        ${buttonHTML}
                    </div>
                </div>`;
        }).join('');
    }

    document.getElementById('auction-search-input').addEventListener('input', renderAuctionGroupedList);
    document.getElementById('auction-grade-filter').addEventListener('change', renderAuctionGroupedList);

    document.getElementById('auction-grouped-grid').addEventListener('click', (e) => {
        const card = e.target.closest('.auction-item');
        if (!card) return;
        
        selectedAuctionGroupKey = card.dataset.groupKey;
        document.querySelectorAll('#auction-grouped-grid .auction-item').forEach(el => el.classList.remove('selected'));
        card.classList.add('selected');
        
        renderAuctionDetailList(selectedAuctionGroupKey);
    });

    document.getElementById('auction-detail-list').addEventListener('click', (e) => {
        const target = e.target;
        const listingId = target.dataset.listingId;
        if (!listingId) return;
        if (target.classList.contains('buy-auction-btn')) {
            const maxQuantity = parseInt(target.dataset.maxQuantity, 10);
            let quantity = 1;
            if (maxQuantity > 1) {
                const input = prompt(`구매할 수량을 입력하세요. (최대 ${maxQuantity}개)`, "1");
                if (input === null) return;
                quantity = parseInt(input, 10);
                if (isNaN(quantity) || quantity <= 0 || quantity > maxQuantity) {
                    return alert("올바른 수량을 입력해주세요.");
                }
            }
            if (confirm(`${quantity}개를 구매하시겠습니까?`)) {
                socket.emit('buyFromAuction', { listingId, quantity });
            }
        } else if (target.classList.contains('cancel-auction-btn')) {
            if (confirm('등록을 취소하시겠습니까?')) {
                socket.emit('cancelAuctionListing', listingId);
            }
        }
    });

    socket.on('auctionUpdate', () => {
        if (document.getElementById('auction-modal').style.display === 'flex') {
            fetchAuctionListings();
        }
    });

    socket.on('rankingData', ({ topLevel, topGold, topWeapon, topArmor }) => {
        const list = elements.modals.ranking.list;
        if (!list) return;
        let rankingHTML = '';
        const createRankItem = (rank, content) => `<li><span class="rank-badge rank-${rank}">${rank}</span> ${content}</li>`;
        if (topLevel?.length) {
            rankingHTML += `<h3>🔝 최고 등반 랭킹</h3>`;
            topLevel.forEach((p, i) => {
                const userHtml = createFameUserHtml(p.username, p.fameScore);
                rankingHTML += createRankItem(i + 1, `${userHtml} 님은 최대 <span class="rank-value">${p.maxLevel}층</span>까지 등반하였습니다.`);
            });
        }
        if (topWeapon?.length) {
            rankingHTML += `<h3>⚔️ 최고 무기 강화 랭킹</h3>`;
            topWeapon.forEach((p, i) => {
                const userHtml = createFameUserHtml(p.username, p.fameScore);
                rankingHTML += createRankItem(i + 1, `${userHtml} 님은 <span class="rank-value">${p.maxWeaponName}</span> 을(를) <span class="rank-value">${p.maxWeaponEnhancement}강</span>까지 강화하셨습니다.`);
            });
        }
        if (topArmor?.length) {
            rankingHTML += `<h3>🛡️ 최고 방어구 강화 랭킹</h3>`;
            topArmor.forEach((p, i) => {
                const userHtml = createFameUserHtml(p.username, p.fameScore);
                rankingHTML += createRankItem(i + 1, `${userHtml} 님은 <span class="rank-value">${p.maxArmorName}</span> 을(를) <span class="rank-value">${p.maxArmorEnhancement}강</span>까지 강화하셨습니다.`);
            });
        }
        if (topGold?.length) {
            rankingHTML += `<h3>💰 최고 골드 보유 랭킹</h3>`;
            topGold.forEach((p, i) => {
                const userHtml = createFameUserHtml(p.username, p.fameScore);
                rankingHTML += createRankItem(i + 1, `${userHtml} 님은 현재 <span class="rank-value">${p.gold.toLocaleString()} G</span> 를 보유하고 있습니다.`);
            });
        }
        list.innerHTML = rankingHTML || '<li>랭킹 정보가 없습니다.</li>';
    });

    function renderGlobalRecords(records) {
        const enhDisplay = elements.modals.enhancement.display;
        const enhRecord = records.topEnhancement;
        if (enhRecord) {
            const userHtml = createFameUserHtml(enhRecord.username, 0); 
            enhDisplay.innerHTML = `<div class="record-item">${userHtml} 님의 <span class="${enhRecord.itemGrade}">${enhRecord.itemName}</span> <span class="enhance-level-highlight">+${enhRecord.enhancementLevel}강</span></div>`;
        } else {
            enhDisplay.innerHTML = '<div class="no-record">아직 서버 최고 강화 기록이 없습니다.</div>';
        }
        const lootDisplay = elements.modals.loot.display;
        let lootHTML = '';
        const gradeOrder = ['Mystic', 'Epic', 'Legendary'];
        let hasLootRecord = false;
        gradeOrder.forEach(grade => {
            const record = records[`topLoot_${grade}`];
            if (record) {
                hasLootRecord = true;
                const userHtml = createFameUserHtml(record.username, 0);
                lootHTML += `<h3>🌟 ${grade} 등급 최고 기록</h3><div class="record-item">${userHtml} 님이 <span class="${record.itemGrade}">${record.itemName}</span> 획득</div>`;
            }
        });
        if (hasLootRecord) {
            lootDisplay.innerHTML = lootHTML;
        } else {
            lootDisplay.innerHTML = '<div class="no-record">아직 서버 최고 득템 기록이 없습니다.</div>';
        }
    }
    socket.on('initialGlobalRecords', renderGlobalRecords);
    socket.on('globalRecordsUpdate', renderGlobalRecords);

socket.on('fameScoreUpdated', (newFameScore) => {
    if (!currentPlayerState) return;
    currentPlayerState.fameScore = newFameScore;
    updateTopBarInfo(currentPlayerState);
});

    socket.on('onlineUsersData', ({ playersList, totalUsers, subAccountCount }) => {
        const list = elements.modals.online.list;
        const title = elements.modals.online.title;
        if (totalUsers > 0) {
            const subAccountText = subAccountCount > 0 ? ` 중 ${subAccountCount}명 부캐` : '';
            title.textContent = `👥 실시간 접속 유저 (${totalUsers}명${subAccountText})`;
        } else {
            title.textContent = '👥 실시간 접속 유저 (0명)';
        }
        if (!playersList || playersList.length === 0) {
            list.innerHTML = '<li>현재 접속 중인 유저가 없습니다.</li>';
            return;
        }
        
        list.innerHTML = playersList.map(p => {
            const userHTML = createFameUserHtml(p.username, p.fameScore);
            const weapon = p.weapon ? `<span class="user-item-name ${p.weapon.grade}">${p.weapon.name}</span>` : `<span class="user-item-none">맨손</span>`;
            const armor = p.armor ? `<span class="user-item-name ${p.armor.grade}">${p.armor.name}</span>` : `<span class="user-item-none">맨몸</span>`;
            const level = `<span class="rank-value">${p.level}층</span>`;
            return `<li>${userHTML} 님 : ${weapon}, ${armor} 을 착용하고, ${level} 등반 중</li>`;
        }).join('');
    });
    
    let selectedInventoryItemUid = null;
    let currentPlayerState = null;
    let attackTarget = 'monster';
    let enhancementRates = null;

    const formatInt = n => Math.floor(n).toLocaleString();
    const formatFloat = n => (typeof n === 'number' ? n : 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    
    const createEnhancementItemHTML = (item) => {
        if (!item) {
            return '';
        }
        let enhanceText = '';
        if ((item.type === 'weapon' || item.type === 'armor') && item.enhancement > 0) {
            enhanceText = `<div class="item-enhancement-level">[+${item.enhancement}]</div>`;
        }
        const imageHTML = item.image ? `<div class="item-image"><img src="/image/${item.image}" alt="${item.name}" draggable="false"></div>` : '<div class="item-image"></div>';
        return `${imageHTML}${enhanceText}`;
    };

    const getEnhanceClass = (lvl) => lvl > 0 ? `enhance-${Math.min(lvl, 20)}` : '';

    function findItemInState(uid) {
        if (!currentPlayerState || !uid) return null;
        let found = null;
        const inventories = [currentPlayerState.inventory, currentPlayerState.petInventory];
        for(const inv of inventories) {
            found = inv.find(i => i && i.uid === uid);
            if (found) return found;
        }
        for(const slot in currentPlayerState.equipment) {
            if(currentPlayerState.equipment[slot] && currentPlayerState.equipment[slot].uid === uid) {
                return currentPlayerState.equipment[slot];
            }
        }
        if (currentPlayerState.equippedPet && currentPlayerState.equippedPet.uid === uid) {
            return currentPlayerState.equippedPet;
        }
        return null;
    }

    const renderItemInSlot = (slotElement, item, defaultText, type) => {
        slotElement.innerHTML = '';
        if (item) {
            const itemDiv = document.createElement('div');
            itemDiv.className = `inventory-item ${getEnhanceClass(item.enhancement)}`;
            itemDiv.dataset.uid = item.uid;
            itemDiv.draggable = true;
            itemDiv.dataset.itemType = (item.type === 'accessory') ? item.accessoryType : type;
            itemDiv.innerHTML = createItemHTML(item, { showName: false }); 
            const imageDiv = itemDiv.querySelector('.item-image');
            const infoDiv = itemDiv.querySelector('.item-info');
            if (imageDiv) {}
            if (infoDiv) {
                infoDiv.style.paddingTop = '4px';
                infoDiv.style.flex = '1';
            }
            slotElement.appendChild(itemDiv);
        } else {
            slotElement.innerHTML = defaultText;
        }
    };


const updateUI = ({ player, monster, isInRaid = false }) => {
    currentPlayerState = player; 
    updateTopBarInfo(player);

    if (elements.gold.textContent !== formatInt(player.gold)) { 
        elements.gold.textContent = formatInt(player.gold); 
    }

    elements.player.hpBar.style.width = `${(player.currentHp / player.stats.total.hp) * 100}%`;
    elements.player.hpText.textContent = `${formatFloat(player.currentHp)} / ${formatFloat(player.stats.total.hp)}`;
    elements.player.totalHp.textContent = formatFloat(player.stats.total.hp);
    elements.player.totalAttack.textContent = formatFloat(player.stats.total.attack);
    elements.player.totalDefense.textContent = formatFloat(player.stats.total.defense);

    if (isInRaid) {
        elements.monster.level.innerHTML = `<span style="color:#c0392b; font-weight:bold;">[개인 레이드 ${monster.floor}층] ${monster.name}</span>`;
        elements.floorControls.container.style.display = 'none';
        elements.monster.leaveRaidBtn.style.display = 'block';
    } else {
        elements.monster.level.innerHTML = monster.isBoss 
            ? `<span style="color:var(--fail-color); font-weight:bold;">${formatInt(monster.level)}층 보스</span>` 
            : `${formatInt(monster.level)}층 몬스터`;
        elements.floorControls.container.style.display = 'flex';
        elements.monster.leaveRaidBtn.style.display = 'none';
    }
    
    if (elements.player.specialStatsGrid) {
        elements.player.specialStatsGrid.innerHTML = `
            <div>💥 치명타: <strong>${(player.stats.critChance * 100).toFixed(2)}%</strong></div>
            <div>🔰 치명 저항: <strong>${(player.stats.critResistance * 100).toFixed(2)}%</strong></div>
            <div>🎯 집 중: <strong style="color: var(--primal-color);">${(player.focus || 0).toFixed(2)}%</strong></div>
            <div>💎 관 통: <strong style="color: var(--primal-color);">${(player.penetration || 0).toFixed(2)}%</strong></div>
            <div>🛡️ 강 인 함: <strong style="color: var(--primal-color);">${(player.tenacity || 0).toFixed(2)}%</strong></div>
            <div>🩸 피의 갈망: <strong style="color: #c0392b;">${(player.bloodthirst || 0).toFixed(1)}%</strong></div>
        `;
    }

    elements.monster.hpBar.style.width = `${(monster.currentHp / monster.hp) * 100}%`;
    elements.monster.hpText.textContent = `${formatFloat(monster.currentHp)} / ${formatFloat(monster.hp)}`;
    elements.monster.totalHp.textContent = formatFloat(monster.hp);
    elements.monster.attack.textContent = formatFloat(monster.attack);
    elements.monster.defense.textContent = formatFloat(monster.defense);

    const showAbilities = monster.distortion > 0 || monster.empoweredAttack > 0;
    const barrierContainer = document.getElementById('monster-barrier-container');
    elements.monster.abilityIcons.style.display = showAbilities ? 'flex' : 'none';
    if(barrierContainer) barrierContainer.style.display = monster.barrier > 0 ? 'block' : 'none';

    if (showAbilities || monster.barrier > 0) {
        const maxBarrier = monster.barrier;
        const currentBarrier = monster.currentBarrier;
        const barrierPercent = maxBarrier > 0 ? (currentBarrier / maxBarrier) * 100 : 0;
        elements.monster.barrierBar.style.width = `${barrierPercent}%`;
        elements.monster.barrierText.textContent = `${formatFloat(currentBarrier)} / ${formatFloat(maxBarrier)}`;
        elements.monster.abilityIcons.innerHTML = `
            ${monster.barrier > 0 ? `<span title="보호막: 이 몬스터는 추가 체력을 가지고 있습니다. 보호막을 모두 파괴해야 본체에 피해를 줄 수 있습니다.">🛡️</span>` : ''}
            ${monster.distortion > 0 ? `<span title="왜곡: 이 몬스터는 ${monster.distortion}% 확률로 모든 공격을 회피합니다.">💨</span>` : ''}
            ${monster.empoweredAttack > 0 ? `<span title="권능 공격: 이 몬스터의 모든 공격은 당신의 최대 체력 ${monster.empoweredAttack}%에 해당하는 추가 피해를 입힙니다.">💀</span>` : ''}
        `;
    }

    if (elements.floorControls.container && !isInRaid) {
         const { safeZoneBtn, frontlineBtn } = elements.floorControls;
         const canUseFrontline = player.maxLevel >= 1000000;
         safeZoneBtn.style.display = 'none';
         frontlineBtn.style.display = 'none';
         if (canUseFrontline) {
             if (player.level >= 1000000) { safeZoneBtn.style.display = 'block'; } 
             else {
                 frontlineBtn.style.display = 'block';
                 const cooldown = player.safeZoneCooldownUntil ? new Date(player.safeZoneCooldownUntil) : null;
                 if (cooldown && cooldown > new Date()) {
                     frontlineBtn.disabled = true;
                     if (returnCooldownTimer) clearInterval(returnCooldownTimer);
                     returnCooldownTimer = setInterval(() => {
                         const now = new Date();
                         if (cooldown <= now) { clearInterval(returnCooldownTimer); frontlineBtn.disabled = false; frontlineBtn.textContent = '최전선 복귀'; } 
                         else { const remaining = Math.ceil((cooldown - now) / 1000); frontlineBtn.textContent = `최전선 복귀 (${remaining}초)`; }
                     }, 1000);
                 } else {
                     if (returnCooldownTimer) clearInterval(returnCooldownTimer);
                     frontlineBtn.disabled = false;
                     frontlineBtn.textContent = '최전선 복귀';
                 }
             }
         }
    }

    const buffsContainer = document.getElementById('player-buffs-container');
    buffsContainer.innerHTML = ''; 
    if (player.buffs && player.buffs.length > 0) {
        player.buffs.forEach(buff => {
            const remainingTime = Math.max(0, Math.floor((new Date(buff.endTime) - new Date()) / 1000));
            buffsContainer.innerHTML += `<div class="buff-icon" title="${buff.name}">✨ 각성 (${remainingTime}초)</div>`;
        });
    }

    renderItemInSlot(elements.equipment.weapon, player.equipment.weapon, '⚔️<br>무기', 'weapon');
    renderItemInSlot(elements.equipment.armor, player.equipment.armor, '🛡️<br>방어구', 'armor');
    renderItemInSlot(elements.equipment.pet, player.equippedPet, '🐾<br>펫', 'pet');
    renderItemInSlot(elements.equipment.necklace, player.equipment.necklace, '💍<br>목걸이', 'necklace');
    renderItemInSlot(elements.equipment.earring, player.equipment.earring, '👂<br>귀걸이', 'earring');
    renderItemInSlot(elements.equipment.wristwatch, player.equipment.wristwatch, '⏱️<br>손목시계', 'wristwatch');
    const artifactSocketsHeader = document.getElementById('artifact-sockets-header');
    if (artifactSocketsHeader) {
        artifactSocketsHeader.innerHTML = player.unlockedArtifacts.map(artifact => artifact ? `<div class="artifact-socket unlocked" title="${artifact.name}: ${artifact.description}"><img src="/image/${artifact.image}" alt="${artifact.name}"></div>` : `<div class="artifact-socket" title="비활성화된 유물 소켓"><img src="/image/socket_locked.png" alt="잠김"></div>`).join('');
    }
    
    renderAllInventories(player);
    renderIncubator(player.incubator);
    renderFusionPanel(player);
    elements.log.innerHTML = player.log.map(msg => `<li>${msg}</li>`).join('');
    elements.modals.mailbox.button.classList.toggle('new-mail', player.hasUnreadMail);
    updateAffordableButtons();
};


elements.floorControls.personalRaidBtn.addEventListener('click', () => {
    if (!currentPlayerState) return;
    const entries = currentPlayerState.personalRaid?.entries || 0;
    if (confirm(`개인 레이드는 하루 2회 입장 가능하며 매일 아침 6시에 초기화됩니다.\n현재 ${entries}회 남으셨습니다. 입장하시겠습니까?`)) {
        socket.emit('personalRaid:start');
    }
});

socket.on('personalRaid:started', (raidState) => {
    if (!currentPlayerState) return;
    currentPlayerState.raidState = raidState;
    updateUI({ player: currentPlayerState, monster: raidState.monster, isInRaid: true });
});


socket.on('personalRaid:ended', () => {
    if (!currentPlayerState) return;
    currentPlayerState.raidState = { isActive: false };

    updateUI({ player: currentPlayerState, monster: currentPlayerState.monster, isInRaid: false });
});

    const renderIncubator = (incubator) => {
        if (incubator && incubator.egg) {
            const egg = incubator.egg;
            const imageHTML = egg.image ? `<div class="item-image"><img src="/image/${egg.image}" alt="${egg.name}"></div>` : '<div class="item-image"></div>';
            elements.incubator.slot.innerHTML = `<div class="inventory-item">${imageHTML}</div>`;
            if (incubator.hatchCompleteTime) {
                const totalTime = incubator.hatchDuration;
                const remainingTime = Math.max(0, new Date(incubator.hatchCompleteTime) - new Date());
                const elapsed = totalTime - remainingTime;
                const progress = (elapsed / totalTime) * 100;
                elements.incubator.hatchingInfo.style.display = 'flex';
                elements.incubator.hatchButton.style.display = 'none';
                elements.incubator.progressBar.style.width = `${progress}%`;
                const hours = Math.floor(remainingTime / 3600000);
                const minutes = Math.floor((remainingTime % 3600000) / 60000);
                const seconds = Math.floor((remainingTime % 60000) / 1000);
                elements.incubator.timer.textContent = `${hours}시간 ${minutes}분 ${seconds}초 남음`;
            } else {
                elements.incubator.hatchingInfo.style.display = 'none';
                elements.incubator.hatchButton.style.display = 'block';
                elements.incubator.hatchButton.disabled = false;
            }
        } else {
            elements.incubator.slot.innerHTML = '부화할 알을<br>[아이템] 탭에서 선택하세요';
            elements.incubator.hatchingInfo.style.display = 'none';
            elements.incubator.hatchButton.style.display = 'block';
            elements.incubator.hatchButton.disabled = true;
        }
    };
    
    setInterval(() => { if (currentPlayerState && currentPlayerState.incubator && currentPlayerState.incubator.hatchCompleteTime) { renderIncubator(currentPlayerState.incubator); } }, 1000);
    
    const updateAffordableButtons = () => { 
        if (!currentPlayerState) return; 
        ['hp', 'attack', 'defense'].forEach(stat => { 
            const base = currentPlayerState.stats.base[stat]; 
            const gold = currentPlayerState.gold; 
            const costN = n => [...Array(n).keys()].reduce((s, i) => s + base + i, 0); 
              const affordable = { 
                1: gold >= base, 
                10: gold >= costN(10), 
                100: gold >= costN(100), 
                1000: gold >= costN(1000), 
                MAX: gold >= base, 
            }; 
            document.querySelectorAll(`.stat-row[data-stat-row="${stat}"] .upgrade-btn`).forEach(btn => { 
                btn.classList.toggle('affordable', affordable[btn.dataset.amount]); 
            }); 
        }); 
    };

    function renderFusionPanel(player) {
        const fusionData = player.petFusion;
        const { fusion } = elements;
        if (fusionData.fuseEndTime) {
            fusion.processUI.style.display = 'none';
            fusion.timerUI.style.display = 'flex';
            fusion.button.style.display = 'none';
            document.getElementById('fusion-rules').style.display = 'none';
            const remainingTime = Math.max(0, new Date(fusionData.fuseEndTime) - new Date());
            const hours = String(Math.floor(remainingTime / 3600000)).padStart(2, '0');
            const minutes = String(Math.floor((remainingTime % 3600000) / 60000)).padStart(2, '0');
            const seconds = String(Math.floor((remainingTime % 60000) / 1000)).padStart(2, '0');
            fusion.timer.textContent = `${hours}:${minutes}:${seconds}`;
            return;
        }
        fusion.processUI.style.display = 'flex';
        fusion.timerUI.style.display = 'none';
        fusion.button.style.display = 'block';
        document.getElementById('fusion-rules').style.display = 'block';
        if (fusionData.slot1) {
            fusion.slot1.innerHTML = createEnhancementItemHTML(fusionData.slot1); 
            fusion.slot1.classList.add('filled');
            fusion.info1.textContent = `[${fusionData.slot1.attribute}] ${fusionData.slot1.name}`;
        } else {
            fusion.slot1.innerHTML = `<span class="fusion-slot-placeholder">재료1 (에픽 펫)</span>`;
            fusion.slot1.classList.remove('filled');
            fusion.info1.textContent = '';
        }
        if (fusionData.slot2) {
            fusion.slot2.innerHTML = createEnhancementItemHTML(fusionData.slot2);
            fusion.slot2.classList.add('filled');
            fusion.info2.textContent = `[${fusionData.slot2.attribute}] ${fusionData.slot2.name}`;
        } else {
            fusion.slot2.innerHTML = `<span class="fusion-slot-placeholder">재료2 (에픽 펫)</span>`;
            fusion.slot2.classList.remove('filled');
            fusion.info2.textContent = '';
        }
        const canFuse = fusionData.slot1 && fusionData.slot2 && player.gold >= 100000000;
        fusion.button.disabled = !canFuse;
    }

    function showBoardView(viewName) {
        elements.board.listView.style.display = 'none';
        elements.board.detailView.style.display = 'none';
        elements.board.writeView.style.display = 'none';
        if (viewName === 'list') elements.board.listView.style.display = 'block';
        else if (viewName === 'detail') elements.board.detailView.style.display = 'flex';
        else if (viewName === 'write') elements.board.writeView.style.display = 'flex';
    }

    function fetchAndRenderPosts(category, page) {
        socket.emit('board:getPosts', { category, page }, ({ posts, totalPages }) => {
            const { postList, pagination } = elements.board;
            postList.innerHTML = ''; 
            if (!posts || posts.length === 0) {
                postList.innerHTML = `<tr><td colspan="6">게시글이 없습니다.</td></tr>`;
            } else {
                posts.forEach(post => {
                    const postRow = document.createElement('tr');
                    postRow.dataset.postId = post._id;
                    const isNotice = post.category === '공지';
                    const authorFameTier = post.authorFameTier || '';
                    
                    postRow.innerHTML = `
                        <td class="col-category">${post.category}</td>
                        <td class="col-title">
                            <span class="post-title-content ${isNotice ? 'notice' : ''}">${post.title}</span>
                            <span class="comment-count">[${post.commentCount || 0}]</span>
                        </td>
                        <td class="col-author"><span class="${authorFameTier}">${post.authorUsername}</span></td>
                        <td class="col-likes">👍 ${post.likesCount || 0}</td>
                        <td class="col-date">${new Date(post.createdAt).toLocaleDateString()}</td>
                    `;
                    postList.appendChild(postRow);
                });
            }
            pagination.innerHTML = '';
            if (totalPages > 1) {
                for (let i = 1; i <= totalPages; i++) {
                    const pageBtn = document.createElement('button');
                    pageBtn.textContent = i;
                    pageBtn.dataset.page = i;
                    if (i === currentPage) pageBtn.classList.add('active');
                    pagination.appendChild(pageBtn);
                }
            }
            showBoardView('list');
        });
    }

    function fetchAndRenderPostDetail(postId) {
        currentPostId = postId;
        socket.emit('board:getPost', { postId }, (post) => {
            if (!post) {
                alert('삭제되었거나 존재하지 않는 게시글입니다.');
                fetchAndRenderPosts(currentBoardCategory, currentBoardPage);
                return;
            }
            const { postContentArea, commentList, commentInput } = elements.board;
            const isAuthor = post.authorUsername === window.myUsername;
            postContentArea.innerHTML = `
                <div class="post-view-header">
                    <h3>${post.title}</h3>
                    <div class="post-meta">
                        <span>작성자: ${createFameUserHtml(post.authorUsername, post.authorFameTier)}</span>
                        <span>작성일: ${new Date(post.createdAt).toLocaleString()}</span>
                    </div>
                </div>
                <div class="post-view-body ql-snow"><div class="ql-editor">${post.content}</div></div>
                <div class="post-view-actions">
                    <button class="action-btn" id="post-like-btn" data-post-id="${post._id}">👍 추천 ${post.likes.length}</button>
                    ${isAuthor ? `<button class="action-btn list-auction-btn" id="post-edit-btn">수정</button>` : ''}
                    ${isAuthor ? `<button class="action-btn sell-btn" id="post-delete-btn">삭제</button>` : ''}
                </div>
            `;
            commentList.innerHTML = '';
            if (post.comments && post.comments.length > 0) {
                post.comments.forEach(comment => {
                    const isCommentAuthor = comment.authorUsername === window.myUsername;
                    const commentItem = document.createElement('div');
                    commentItem.className = 'comment-item-new';
                    commentItem.dataset.commentId = comment._id;
                    commentItem.innerHTML = `
                        <div class="comment-main-content">
                            <span class="comment-author-new">${createFameUserHtml(comment.authorUsername, comment.authorFameTier)}:</span>
                            <span class="comment-text">${comment.content}</span>
                        </div>
                        <div class="comment-meta-new">
                            <span class="comment-date-new">${new Date(comment.createdAt).toLocaleString()}</span>
                            <div class="comment-actions-new">
                                <span class="like-btn" data-action="like-comment" style="cursor:pointer;">👍 ${comment.likes.length}</span>
                                ${isCommentAuthor ? `<span class="delete-btn" data-action="delete-comment" style="cursor:pointer;">삭제</span>` : ''}
                            </div>
                        </div>
                    `;
                    commentList.appendChild(commentItem);
                });
            }
            
            commentInput.value = '';
            showBoardView('detail');
        });
    }

 function updateEnhancementPanel(item) {
    const { details, slot, before, after, info, button, checkboxes, useTicketCheck, useHammerCheck } = elements.enhancement;

    if (!item) {
        slot.innerHTML = '강화할 아이템을<br>인벤토리/장비창에서 선택하세요';
        details.style.display = 'none';
        button.style.display = 'none';
        checkboxes.style.display = 'none';
        info.innerHTML = '';
        selectedInventoryItemUid = null;
        return;
    }

    selectedInventoryItemUid = item.uid;

    document.querySelectorAll('.inventory-item.selected').forEach(el => el.classList.remove('selected'));
    const visibleCard = document.querySelector(`.inventory-item[data-uid="${item.uid}"]`);
    if (visibleCard) {
        visibleCard.classList.add('selected');
    }

    const isEnhanceable = item.type === 'weapon' || item.type === 'armor';
    slot.innerHTML = createEnhancementItemHTML(item);
    details.style.display = isEnhanceable ? 'flex' : 'none';
    button.style.display = isEnhanceable ? 'block' : 'none';
    checkboxes.style.display = isEnhanceable ? 'flex' : 'none';

    let infoContentHTML = '';
    let buttonsHTML = '<div class="interaction-buttons" style="justify-content: center; width: 100%; flex-wrap: wrap; gap: 10px;">';

    if (isEnhanceable) {

        const isPrimal = item.grade === 'Primal';
        let rates = null;
        if (enhancementRates) {
            if (isPrimal && item.enhancement >= 10) {
                rates = { success: 0.10, maintain: 0.00, fail: 0.00, destroy: 0.90 };
            } else {
                rates = enhancementRates.enhancementTable[item.enhancement + 1] || enhancementRates.highEnhancementRate;
            }
        }

        const hasHammer = currentPlayerState.inventory.some(i => i.id === 'hammer_hephaestus');
        const hasTicket = currentPlayerState.inventory.some(i => i.id === 'prevention_ticket');

        useHammerCheck.disabled = !hasHammer || isPrimal;
        if (isPrimal) useHammerCheck.parentElement.title = "태초 장비에는 사용할 수 없습니다.";
        else useHammerCheck.parentElement.title = "";
        
        const canBeDestroyed = rates ? rates.destroy > 0 : false;
        useTicketCheck.disabled = !(item.enhancement >= 10 && hasTicket && canBeDestroyed);
        if (item.enhancement >= 10 && !canBeDestroyed) useTicketCheck.parentElement.title = "이 아이템은 현재 강화 단계에서 파괴되지 않습니다.";
        else useTicketCheck.parentElement.title = "";

        let baseBonus = item.baseEffect;
        if (item.grade === 'Primal' && item.randomizedValue) baseBonus += (item.randomizedValue / 100);
        
        const enhancementBonusArr = Array.from({ length: item.enhancement }, (_, i) => item.baseEffect * (i < 10 ? 0.1 : 0.5));
        const currentEnhancementBonus = enhancementBonusArr.reduce((s, v) => s + v, 0);
        const currentTotalBonus = baseBonus + currentEnhancementBonus;
        const nextTotalBonus = currentTotalBonus + item.baseEffect * (item.enhancement < 10 ? 0.1 : 0.5);

        before.innerHTML = `<b>+${item.enhancement}</b><br>${(currentTotalBonus * 100).toFixed(1)}%`;
        after.innerHTML = `<b>+${item.enhancement + 1}</b><br>${(nextTotalBonus * 100).toFixed(1)}%`;

        let cost, riftShardCost = 0;
        let costText = '';

        if (isPrimal) {
            const nextLevel = item.enhancement + 1;
            cost = nextLevel * 1000000000;
            riftShardCost = nextLevel * 10;
            const playerShardCount = currentPlayerState.inventory.find(i => i.id === 'rift_shard')?.quantity || 0;
            const hasShards = playerShardCount >= riftShardCost;
            costText = `강화 비용: ${formatInt(cost)} G + <span class="${hasShards ? 'Legendary' : 'fail-color'}">균열의 파편 ${riftShardCost}개</span>`;
            button.disabled = currentPlayerState.gold < cost || !hasShards;
        } else {
            cost = Math.floor(1000 * Math.pow(2.1, item.enhancement));
            costText = `강화 비용: ${formatInt(cost)} G`;
            button.disabled = currentPlayerState.gold < cost;
        }

        if (rates) {
            let displaySuccess = rates.success, displayMaintain = rates.maintain, displayFail = rates.fail, displayDestroy = rates.destroy;
            if (useHammerCheck.checked && !useHammerCheck.disabled) {
                let bonusToApply = 0.15;
                const fromDestroy = Math.min(bonusToApply, displayDestroy); displayDestroy -= fromDestroy; bonusToApply -= fromDestroy;
                if (bonusToApply > 0) { const fromFail = Math.min(bonusToApply, displayFail); displayFail -= fromFail; bonusToApply -= fromFail; }
                if (bonusToApply > 0) { const fromMaintain = Math.min(bonusToApply, displayMaintain); displayMaintain -= fromMaintain; bonusToApply -= fromMaintain; }
                displaySuccess += (0.15 - bonusToApply);
            }
            const probText = `<span style="color:var(--success-color)">성공: ${(displaySuccess * 100).toFixed(1)}%</span> | <span>유지: ${(displayMaintain * 100).toFixed(1)}%</span> | <span style="color:var(--fail-color)">하락: ${(displayFail * 100).toFixed(1)}%</span> | <span style="color:var(--fail-color); font-weight:bold;">파괴: ${(displayDestroy * 100).toFixed(1)}%</span>`;
            infoContentHTML += `<div style="text-align: center; margin-bottom: 10px; font-size: 0.9em;">${probText}</div>`;
        }
        infoContentHTML += `<div style="width: 100%; text-align: center;">${costText}</div>`;
     
    } else {

         if (item.id === 'hammer_hephaestus' || item.id === 'prevention_ticket') {
            buttonsHTML += `<div style="text-align:center; color: var(--text-muted);">강화 탭에서 체크하여 사용합니다.</div>`;
        } else {
            const isEgg = item.category === 'Egg' || item.type === 'egg';
            if (isEgg) {
                buttonsHTML += `<button class="action-btn use-item-btn" data-action="hatch">부화하기</button>`;
            } 
       
            else if (['Tome', 'Consumable'].includes(item.category) || item.id === 'pure_blood_crystal'){
                buttonsHTML += `<button class="action-btn use-item-btn" data-action="use">사용하기</button>`;
                if (item.id === 'gold_pouch' && item.quantity > 1) {
                    buttonsHTML += `<button class="action-btn use-item-btn" data-action="use-all">모두 사용</button>`;
                }
            }
        }
    }
    

    const isEquipped = currentPlayerState.equipment.weapon?.uid === item.uid || currentPlayerState.equipment.armor?.uid === item.uid;
    if (!isEquipped && (item.type === 'weapon' || item.type === 'armor')) {
        const sellPrice = getSellPrice(item);
        buttonsHTML += `<button class="action-btn sell-btn" data-action="sell" data-sell-all="false">1개 판매 (${sellPrice.toLocaleString()} G)</button>`;
        if (item.enhancement === 0 && item.quantity > 1) {
            buttonsHTML += `<button class="action-btn sell-btn" data-action="sell" data-sell-all="true">전체 판매 (${(sellPrice * item.quantity).toLocaleString()} G)</button>`;
        }
    }
    if (item.tradable !== false) {
        buttonsHTML += `<button class="action-btn list-auction-btn" data-action="list-auction">거래소 등록</button>`;
    }
    
    buttonsHTML += '</div>';
    info.innerHTML = infoContentHTML + buttonsHTML;
}


function updateRiftEnchantPanel(item, previouslyLockedIndices = []) {
    const { slot, optionsContainer, costDisplay, button } = elements.riftEnchant;
    if (!item || (item.type !== 'weapon' && item.type !== 'armor')) {
        slot.innerHTML = '마법을 부여할 장비를 선택하세요 (무기/방어구)';
        optionsContainer.innerHTML = '';
        costDisplay.innerHTML = '';
        button.disabled = true;
        return;
    }

    selectedInventoryItemUid = item.uid;
    document.querySelectorAll('.inventory-item.selected').forEach(el => el.classList.remove('selected'));
    const visibleCard = document.querySelector(`.inventory-item[data-uid="${item.uid}"]`);
    if (visibleCard) {
        visibleCard.classList.add('selected');
    }


    if (item.image) {
        slot.innerHTML = `<img src="/image/${item.image}" alt="${item.name}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 5px;">`;
    } else {

        slot.innerHTML = '이미지 없음';
    }


    const gradeToColor = {
        supreme: 'var(--mystic-color)',
        rare_enchant: 'var(--epic-color)',
        common_enchant: 'var(--common-color)'
    };
    const typeToName = {
        all_stats_percent: '✨모든 스탯',
        focus: '🎯집중',
        penetration: '💎관통',
        tenacity: '🛡️강인함',
        attack_percent: '⚔️공격력',
        defense_percent: '🛡️방어력',
        hp_percent: '❤️체력',
        gold_gain: '💰골드 획득',
        extra_climb_chance: '🍀추가 등반',
        def_penetration: '🛡️방어력 관통'
    };

    optionsContainer.innerHTML = '';
    for (let i = 0; i < 4; i++) {
        const enchant = item.enchantments ? item.enchantments[i] : null;
        const optionDiv = document.createElement('div');
        optionDiv.className = 'checkbox-wrapper';

        let labelContent = '빈 슬롯';
        if (enchant) {
            const color = gradeToColor[enchant.grade] || '#fff';
            const name = typeToName[enchant.type] || enchant.type;
            const valueSuffix = ['focus', 'penetration', 'tenacity', 'attack_percent', 'defense_percent', 'hp_percent', 'all_stats_percent', 'gold_gain', 'extra_climb_chance', 'def_penetration'].includes(enchant.type) ? '%' : '';
            labelContent = `<span style="color: ${color};">${name} +${enchant.value}${valueSuffix}</span>`;
        }
        
        const isDisabled = !enchant;
        const isChecked = previouslyLockedIndices.includes(i) ? 'checked' : '';
        optionDiv.innerHTML = `
            <input type="checkbox" id="lock-enchant-${i}" data-index="${i}" ${isChecked} ${isDisabled ? 'disabled' : ''}>
            <label for="lock-enchant-${i}">${labelContent}</label>
        `;
        optionsContainer.appendChild(optionDiv);
    }

    const updateCost = () => {
        const lockedCount = optionsContainer.querySelectorAll('input[type="checkbox"]:checked').length;
        const hasStones = (currentPlayerState.inventory.find(i => i.id === 'form_locking_stone')?.quantity || 0) >= lockedCount;
        const stoneCostText = lockedCount > 0 ? `+ <span class="${hasStones ? 'Mystic' : 'fail-color'}">고정석 ${lockedCount}개</span>` : '';
        const playerShardCount = currentPlayerState.inventory.find(i => i.id === 'rift_shard')?.quantity || 0;
        const hasShards = playerShardCount >= 100;
        costDisplay.innerHTML = `비용: 1억 G + <span class="${hasShards ? 'Legendary' : 'fail-color'}">균열의 파편 100개</span> ${stoneCostText}`;
        button.disabled = currentPlayerState.gold < 100000000 || !hasShards || !hasStones;
    };

    optionsContainer.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', updateCost);
    });

    updateCost();
}

    const getSellPrice = (item) => {
        if (!item || (item.type !== 'weapon' && item.type !== 'armor')) return 0;
        const SELL_PRICES = { Common: 3000, Rare: 50000, Legendary: 400000, Epic: 2000000, Mystic: 100000000 };
        const basePrice = SELL_PRICES[item.grade] || 0;
        if (item.enhancement === 0) return basePrice;
        let totalEnhancementCost = 0;
        for (let i = 0; i < item.enhancement; i++) { totalEnhancementCost += Math.floor(1000 * Math.pow(2.1, i)); }
        const priceWithEnhancement = basePrice + totalEnhancementCost;
        if (item.enhancement <= 8) return priceWithEnhancement;
        if (item.enhancement <= 10) return priceWithEnhancement + 10000;
        return Math.floor(priceWithEnhancement * 1.5);
    };

    const playEnhancementAnimation = (result) => {
        const anim = elements.enhancement.animation; let text = ''; let animClass = '';
        switch (result) {
            case 'success': text = '성공!'; animClass = 'success'; break;
            case 'maintain': text = '유지'; animClass = 'maintain'; break;
            case 'fail': text = '하락'; animClass = 'fail'; break;
            case 'destroy': text = '파괴'; animClass = 'destroy'; break;
        }
        anim.textContent = text; anim.className = `enhancement-animation ${animClass}`;
        setTimeout(() => { anim.className = 'enhancement-animation'; anim.textContent = ''; }, 1500);
    };

    socket.on('initialState', (data) => {
        if (!data || !data.player) {
            console.error("비정상적인 초기 데이터 수신:", data);
            return;
        }
        updateUI(data);
    });

socket.on('stateUpdate', (data) => {
    if (!currentPlayerState || !data || !data.player) {
        return;
    }
    Object.assign(currentPlayerState, data.player);
    updateUI(data);
});

    socket.on('inventoryUpdate', (data) => {
        if (!currentPlayerState || !data) return;
        currentPlayerState.inventory = data.inventory;
        currentPlayerState.petInventory = data.petInventory;
        currentPlayerState.incubator = data.incubator;
        renderAllInventories(currentPlayerState);
        renderIncubator(currentPlayerState.incubator);
    });

    socket.on('logUpdate', (logs) => {
        if (!currentPlayerState || !logs) return;
        currentPlayerState.log = logs;
        elements.log.innerHTML = logs.map(msg => `<li>${msg}</li>`).join('');
    });

    function updateEquipmentAndArtifacts(player) {
        if (!player) return;
        renderItemInSlot(elements.equipment.weapon, player.equipment.weapon, '⚔️<br>무기', 'weapon');
        renderItemInSlot(elements.equipment.armor, player.equipment.armor, '🛡️<br>방어구', 'armor');
        renderItemInSlot(elements.equipment.pet, player.equippedPet, '🐾<br>펫', 'pet');
        renderItemInSlot(elements.equipment.necklace, player.equipment.necklace, '💍<br>목걸이', 'necklace');
        renderItemInSlot(elements.equipment.earring, player.equipment.earring, '👂<br>귀걸이', 'earring');
        renderItemInSlot(elements.equipment.wristwatch, player.equipment.wristwatch, '⏱️<br>손목시계', 'wristwatch');
        elements.artifactSockets.innerHTML = player.unlockedArtifacts.map(artifact => artifact ? `<div class="artifact-socket unlocked" title="${artifact.name}: ${artifact.description}"><img src="/image/${artifact.image}" alt="${artifact.name}"></div>` : `<div class="artifact-socket" title="비활성화된 유물 소켓"><img src="/image/socket_locked.png" alt="잠김"></div>`).join('');
    }

    function renderAllInventories(player) {
        if (!player) return;
        const renderGrid = (items) => items.map(item => {
            const itemType = (item.type === 'accessory') ? item.accessoryType : item.type;
            return `<div class="inventory-item ${getEnhanceClass(item.enhancement)} ${selectedInventoryItemUid === item.uid ? 'selected' : ''}" data-uid="${item.uid}" draggable="true" data-item-type="${itemType}">${createItemHTML(item)}</div>`;
        }).join('');
        elements.inventory.weapon.innerHTML = renderGrid(player.inventory.filter(i => i.type === 'weapon'));
        elements.inventory.armor.innerHTML = renderGrid(player.inventory.filter(i => i.type === 'armor'));
        elements.inventory.accessory.innerHTML = renderGrid(player.inventory.filter(i => i.type === 'accessory'));
        elements.inventory.item.innerHTML = renderGrid(player.inventory.filter(i => i.type !== 'weapon' && i.type !== 'armor' && i.type !== 'accessory'));
        elements.inventory.pet.innerHTML = renderGrid(player.petInventory);
    }

    socket.on('combatResult', (damages) => { 
        if (currentPlayerState.isExploring) { 
            const m = elements.monster.panel; 
            m.classList.add('hit-flash'); 
            setTimeout(() => m.classList.remove('hit-flash'), 100);
        } else {
            if (damages.playerTook > 0) { 
                const p = elements.player.panel; 
                p.classList.add('hit-flash'); 
                setTimeout(() => p.classList.remove('hit-flash'), 100); 
            } 
            if (damages.monsterTook > 0) { 
                const m = elements.monster.panel; 
                m.classList.add('hit-flash'); 
                setTimeout(() => m.classList.remove('hit-flash'), 100); 
            }
        }
    });
    
    socket.on('enhancementResult', d => {
        playEnhancementAnimation(d.result);
        if (d.newItem) {
            updateEnhancementPanel(d.newItem);
        } else {
            selectedInventoryItemUid = null;
            updateEnhancementPanel(null);
        }
    });
    socket.on('serverAlert', (message) => { alert(message); });
    socket.on('useItemResult', ({messages}) => { alert(messages.join('\n')); });
    
    socket.on('enhancementData', (data) => {
        enhancementRates = data;
    });

    elements.tabs.buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedInventoryItemUid = null;
            document.querySelectorAll('.inventory-item.selected').forEach(el => el.classList.remove('selected'));
            updateEnhancementPanel(null);
            elements.tabs.buttons.forEach(b => b.classList.remove('active'));
            elements.tabs.contents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const tabId = btn.dataset.tab;
            const activeTabContent = document.getElementById(tabId);
            if (activeTabContent) { 
                activeTabContent.classList.add('active'); 
            }
            if (tabId === 'chat-tab') {
                setTimeout(() => {
                    elements.chat.messages.scrollTop = elements.chat.messages.scrollHeight;
                }, 0);
            }
const currentActiveTab = document.querySelector('.tab-button.active');
if (currentActiveTab && currentActiveTab.dataset.tab === 'rift-enchant-tab') {
    updateRiftEnchantPanel(null); 
    selectedInventoryItemUid = null; 
}
        });
    });




 function handleLegacyItemSelection(item) {
    if (!item) return;
    selectedInventoryItemUid = item.uid;

    if (item.type === 'pet') {
        if (item.grade === 'Epic' && !item.fused) {
            selectedPetChoiceUid = item.uid;
            elements.petChoice.title.textContent = `[${item.name}] 어떻게 할까요?`;
            elements.petChoice.overlay.style.display = 'flex';
            return;
        }
    }

    let targetTabId;
    if (item.category === 'Egg' || item.type === 'egg') {
        targetTabId = 'enhancement-tab';
    } else {
        targetTabId = 'enhancement-tab';
    }

    document.querySelector(`.tab-button[data-tab="${targetTabId}"]`).click();

    setTimeout(() => {
        selectedInventoryItemUid = item.uid;
        updateEnhancementPanel(item);
    }, 50);
}

    function handleItemClick(e) {
        const card = e.target.closest('.inventory-item');
        if (!card || card.closest('#auction-grid')) return;

        const uid = card.dataset.uid;
        const item = findItemInState(uid);
        if (!item) return;

        selectedItemUidForAction = uid;

if (item.type === 'weapon' || item.type === 'armor' || item.type === 'pet' || item.type === 'accessory') {
            openItemActionModal(item);
        } else {
            handleLegacyItemSelection(item);
        }
    }

    function openItemActionModal(item) {
        if (!item) return;
        const { overlay, title, buttons } = elements.modals.itemAction;
        title.innerHTML = `<span class="${item.grade}">${item.name}</span>`;
        
        buttons.innerHTML = '';

        const isEquipped = Object.values(currentPlayerState.equipment).some(eq => eq && eq.uid === item.uid) || (currentPlayerState.equippedPet && currentPlayerState.equippedPet.uid === item.uid);

        const equipAction = document.createElement('button');
        equipAction.className = 'action-btn equip-btn';
        equipAction.textContent = isEquipped ? '해제하기' : '장착하기';
        equipAction.dataset.action = isEquipped ? 'unequip' : 'equip';
        buttons.appendChild(equipAction);

if (['weapon', 'armor', 'accessory'].includes(item.type)) {
    const enhanceAction = document.createElement('button');
    enhanceAction.className = 'action-btn';
    enhanceAction.textContent = '대장간가기';
    enhanceAction.dataset.action = 'go-enhance';
    buttons.appendChild(enhanceAction);
}

        const showOffAction = document.createElement('button');
        showOffAction.className = 'action-btn';
        showOffAction.textContent = '자랑하기';
        showOffAction.dataset.action = 'show-off';
        buttons.appendChild(showOffAction);

if (item.type === 'pet' && item.grade === 'Epic' && !item.fused) {
    const fusionAction = document.createElement('button');
    fusionAction.className = 'action-btn list-auction-btn';
    fusionAction.style.backgroundColor = 'var(--epic-color)';
    fusionAction.textContent = '융합하러가기';
    fusionAction.dataset.action = 'go-fusion';
    buttons.appendChild(fusionAction);
}

if (item.type === 'weapon' || item.type === 'armor') {
            const enchantAction = document.createElement('button');
            enchantAction.className = 'action-btn list-auction-btn';
            enchantAction.textContent = '마법부여하기';
            enchantAction.dataset.action = 'go-enchant';
            buttons.appendChild(enchantAction);
        }
        
        overlay.style.display = 'flex';
    }

    document.querySelector('.management-panel').addEventListener('click', handleItemClick);
    document.querySelector('.equipment-slots').addEventListener('click', handleItemClick);

  elements.modals.itemAction.buttons.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (!action || !selectedItemUidForAction) return;

    const item = findItemInState(selectedItemUidForAction);
    if (!item) return;

    switch(action) {
        case 'go-fusion':
            document.querySelector('.tab-button[data-tab="fusion-tab"]').click();
            socket.emit('slotPetForFusion', { uid: item.uid });
            break;
        case 'equip':
            if (item.type === 'pet') {
                socket.emit('equipPet', item.uid);
            } else {
                socket.emit('equipItem', item.uid);
            }
            break;
      case 'unequip':
    if (item.type === 'pet') {
        socket.emit('unequipPet');
    } else {
        const slotToUnequip = item.type === 'accessory' ? item.accessoryType : item.type;
        socket.emit('unequipItem', slotToUnequip);
    }
    break;
        case 'go-enhance':
            document.querySelector('.tab-button[data-tab="enhancement-tab"]').click();
            setTimeout(() => updateEnhancementPanel(item), 50);
            break;
        case 'show-off':
            socket.emit('showOffItem', { uid: item.uid });
            document.querySelector('.tab-button[data-tab="chat-tab"]').click();
            break;
        case 'go-enchant':
            document.querySelector('.tab-button[data-tab="rift-enchant-tab"]').click();
            setTimeout(() => updateRiftEnchantPanel(item), 50);
            break;
    }
    elements.modals.itemAction.overlay.style.display = 'none';
});
    
    elements.enhancement.anvil.addEventListener('click', (e) => {
        const target = e.target.closest('.action-btn');
        if (!target) return;
        const action = target.dataset.action;
        if (!action || !selectedInventoryItemUid) return;
        
        const item = findItemInState(selectedInventoryItemUid);
        if (!item) return;

        switch (action) {
            case 'sell':
                if (confirm("상점에 판매하면 거래소보다 낮은 가격을 받습니다. 정말 판매하시겠습니까?")) {
                    socket.emit('sellItem', { uid: selectedInventoryItemUid, sellAll: target.dataset.sellAll === 'true' });
                    selectedInventoryItemUid = null;
                    updateEnhancementPanel(null); 
                }
                break;
            case 'list-auction':
                let quantity = 1;
                if (item.quantity > 1) {
                    const inputQty = prompt(`등록할 수량을 입력하세요. (최대 ${item.quantity}개)`, item.quantity);
                    if (inputQty === null) return;
                    quantity = parseInt(inputQty, 10);
                    if (isNaN(quantity) || quantity <= 0 || quantity > item.quantity) {
                        return alert("올바른 수량을 입력해주세요.");
                    }
                }
                const price = prompt("개당 판매할 가격(골드)을 숫자로만 입력하세요:");
                if (price && !isNaN(price) && parseInt(price, 10) > 0) {
                    socket.emit('listOnAuction', { uid: selectedInventoryItemUid, price: parseInt(price, 10), quantity }, (response) => {
                        if (response.success) {
                            alert('거래소에 아이템을 등록했습니다.');
                            selectedInventoryItemUid = null;
                            updateEnhancementPanel(null);
                        } else {
                            alert(`등록 실패!: ${response.message}`);
                        }
                    });
                } else if (price !== null) {
                    alert("올바른 가격을 입력해주세요.");
                }
                break;
            case 'use': { 
                const itemToUse = findItemInState(selectedInventoryItemUid);
                if (itemToUse && itemToUse.id === 'return_scroll') {
                    if (confirm(`[복귀 스크롤]을 사용하시겠습니까?\n사용 시 최고층으로 이동하며 10초간 각성 상태가 됩니다.`)) {
                        socket.emit('useItem', { uid: selectedInventoryItemUid, useAll: false });
                    }
                } else {
                    socket.emit('useItem', { uid: selectedInventoryItemUid, useAll: false });
                }
            }
            break;
            case 'use-all':
                socket.emit('useItem', { uid: selectedInventoryItemUid, useAll: true });
                break;
            case 'hatch':
                if (confirm(`[${item.name}]을(를) 부화기에 넣으시겠습니까?`)) {
                    socket.emit('placeEggInIncubator', { uid: selectedInventoryItemUid });
                    selectedInventoryItemUid = null;
                    updateEnhancementPanel(null);
                    document.querySelector('.tab-button[data-tab="incubator-tab"]').click();
                }
                break;
        }
    });

    elements.incubator.slot.addEventListener('click', () => {
        if (currentPlayerState && currentPlayerState.incubator.egg && !currentPlayerState.incubator.hatchCompleteTime) {
            if (confirm('부화기에서 알을 꺼내시겠습니까?')) {
                socket.emit('removeEggFromIncubator');
            }
        }
    });
    
    document.querySelectorAll('.upgrade-btn').forEach(btn => btn.addEventListener('click', () => {
        const stat = btn.dataset.stat;
        const amountStr = btn.dataset.amount;
        if (!currentPlayerState) return;
        let cost = 0;
        let amount = 0;
        const base = currentPlayerState.stats.base[stat];
        if (amountStr === 'MAX') {
            let gold = currentPlayerState.gold;
            let inc = 0;
            while (true) {
                const nextCost = base + inc;
                if (cost + nextCost > gold) break;
                cost += nextCost;
                inc++;
            }
            amount = inc;
        } else {
            amount = parseInt(amountStr, 10);
            for (let i = 0; i < amount; i++) { cost += base + i; }
        }
        
        if (amount > 0 && currentPlayerState.gold >= cost) {
            currentPlayerState.gold -= cost;
            elements.gold.textContent = formatInt(currentPlayerState.gold);
            elements.gold.classList.add('flash');
            setTimeout(() => elements.gold.classList.remove('flash'), 300);
            
            const activeTabIsEnhance = document.getElementById('enhancement-tab').classList.contains('active');
            if (activeTabIsEnhance && selectedInventoryItemUid && findItemInState(selectedInventoryItemUid)) {
                updateEnhancementPanel(findItemInState(selectedInventoryItemUid));
            }
            socket.emit('upgradeStat', { stat, amount: amountStr });
        }
    }));
    
    elements.enhancement.button.addEventListener('click', () => { 
        if (selectedInventoryItemUid) { 
            const useTicket = elements.enhancement.useTicketCheck.checked; 
            const useHammer = elements.enhancement.useHammerCheck.checked;
            socket.emit('attemptEnhancement', { uid: selectedInventoryItemUid, useTicket, useHammer }); 
        } 
    });

 elements.riftEnchant.button.addEventListener('click', () => {
    if (selectedInventoryItemUid) {
        const lockedIndices = Array.from(elements.riftEnchant.optionsContainer.querySelectorAll('input[type="checkbox"]:checked')).map(cb => parseInt(cb.dataset.index, 10));

        socket.emit('enchantRiftItem', { uid: selectedInventoryItemUid, lockedIndices }, (response) => {
            if (response && response.success) {
                updateRiftEnchantPanel(response.newItem, lockedIndices);
            }
        });
    }
});


    elements.enhancement.useHammerCheck.addEventListener('change', () => {
        if(selectedInventoryItemUid) {
            updateEnhancementPanel(findItemInState(selectedInventoryItemUid));
        }
    });
    
    elements.enhancement.useTicketCheck.addEventListener('change', () => {
        if(selectedInventoryItemUid) {
            updateEnhancementPanel(findItemInState(selectedInventoryItemUid));
        }
    });

    elements.incubator.hatchButton.addEventListener('click', () => { if (currentPlayerState && currentPlayerState.incubator.egg) { socket.emit('startHatching'); } });
    
  
    
    document.getElementById('game-app-container').addEventListener('dragstart', e => {
        const card = e.target.closest('.inventory-item');
        if (card) { e.dataTransfer.setData('text/plain', card.dataset.uid); e.dataTransfer.setData('item-type', card.dataset.itemType); }
    });
    
    Object.values(elements.equipment).forEach(slot => {
        slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('drag-over'); });
        slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
        slot.addEventListener('drop', e => {
            e.preventDefault(); slot.classList.remove('drag-over');
            const uid = e.dataTransfer.getData('text/plain'); const itemType = e.dataTransfer.getData('item-type'); const slotType = slot.dataset.slot;
            if (itemType === slotType) {
                 if(slotType === 'pet'){ socket.emit('equipPet', uid); } else { socket.emit('equipItem', uid); }
            }
        });
    });

    elements.worldBoss.toggleBtn.addEventListener('click', () => { attackTarget = attackTarget === 'monster' ? 'worldBoss' : 'monster'; socket.emit('setAttackTarget', attackTarget); });
    
    socket.on('attackTargetChanged', (target) => {
        attackTarget = target;
        const button = elements.worldBoss.toggleBtn;
        if (target === 'worldBoss') {
            button.textContent = '일반 몬스터 공격';
            button.className = 'climb'; 
        } else {
            button.textContent = '월드 보스 공격';
            button.className = 'explore'; 
        }
    });
    socket.on('worldBossSpawned', (bossState) => { elements.worldBoss.container.style.display = 'flex'; socket.emit('setAttackTarget', 'monster'); updateWorldBossUI(bossState); });
    socket.on('worldBossUpdate', (bossState) => {
        if (!bossState || !bossState.isActive) { elements.worldBoss.container.style.display = 'none'; return; };
        if (elements.worldBoss.container.style.display !== 'flex') { elements.worldBoss.container.style.display = 'flex'; }
        updateWorldBossUI(bossState);
    });
    socket.on('worldBossDefeated', () => { elements.worldBoss.container.style.display = 'none'; selectedInventoryItemUid = null; updateEnhancementPanel(null); });
    
socket.on('myBossContributionUpdate', (contributionData) => {
    if (contributionData) {
        const myContribution = contributionData.myContribution || 0;
        const myShare = contributionData.myShare || 0;
        elements.worldBoss.contribution.textContent = `내 기여도: ${formatInt(myContribution)} (${myShare.toFixed(2)}%)`;
    }
});

  function updateWorldBossUI(bossState) {
    if (!bossState) return;
    elements.worldBoss.name.textContent = `🔥 ${bossState.name} 🔥`;
    const currentHp = bossState.currentHp || 0; 
    const maxHp = bossState.maxHp || 1; 
    const hpPercent = (currentHp / maxHp) * 100;
    elements.worldBoss.hpBar.style.width = `${hpPercent}%`;
    elements.worldBoss.hpText.textContent = `${formatInt(currentHp)} / ${formatInt(maxHp)}`;
}
    elements.chat.form.addEventListener('submit', (e) => { e.preventDefault(); e.stopPropagation();  const message = elements.chat.input.value.trim(); if (message) { socket.emit('chatMessage', message); elements.chat.input.value = ''; } });

    elements.chat.messages.addEventListener('click', (e) => {
        const targetUsernameSpan = e.target.closest('[data-username]');
        if (targetUsernameSpan) {
            const username = targetUsernameSpan.dataset.username;
            if (username) {
                socket.emit('requestUserInfo', username);
            }
        }
        const itemLink = e.target.closest('.item-link');
        if (itemLink) {
            const itemData = JSON.parse(itemLink.dataset.iteminfo);
            const modalContent = elements.modals.itemInfo.content;
            modalContent.innerHTML = `
                <div class="inventory-item" style="width: 200px; margin: 0 auto; border: none; cursor: default;">
                    ${createItemHTML(itemData, { forTooltip: true })}
                </div>
            `;
            elements.modals.itemInfo.overlay.style.display = 'flex';
        }
    });

    socket.on('userInfoResponse', (playerData) => {
        const modal = document.getElementById('user-info-modal');
        const contentDiv = document.getElementById('user-info-modal-content');
        if (playerData) {
            contentDiv.innerHTML = createPlayerPanelHTML(playerData);
        } else {
            contentDiv.innerHTML = '<p style="text-align: center; padding: 50px 0;">현재 접속 중인 유저가 아니거나, 정보를 찾을 수 없습니다.</p>';
        }
        modal.style.display = 'flex';
    });

    function addChatMessage(data) {
        const { type, username, role, message, isSystem, fameScore, itemData, title } = data;
        const item = document.createElement('li');
        const isScrolledToBottom = elements.chat.messages.scrollHeight - elements.chat.messages.clientHeight <= elements.chat.messages.scrollTop + 1;

        if (isSystem) {
            item.classList.add('system-message');
            item.innerHTML = message;
        } else if (type === 'item_show_off' && itemData) {
            const userHtml = createFameUserHtml(username, fameScore || 0);
            const itemLink = `<span class="item-link ${itemData.grade}" data-iteminfo='${JSON.stringify(itemData)}'>[${itemData.name}]</span>`;
            const titleHtml = title ? `<span class="title ${getGradeByTitle(title)}">${title}</span>` : '';
            item.innerHTML = `<span class="username" data-username="${username}">${titleHtml}${userHtml}:</span>님이 ${itemLink} 아이템을 자랑합니다!`;

        } else {
            item.classList.add(`${type || 'user'}-message`);
            const usernameSpan = document.createElement('span');
            usernameSpan.classList.add('username');
            usernameSpan.dataset.username = username;
            usernameSpan.style.cursor = 'pointer';
            const messageSpan = document.createElement('span');
            messageSpan.classList.add('message');
            const userHtml = createFameUserHtml(username, fameScore || 0);

            const titleHtml = title ? `<span class="title ${getGradeByTitle(title)}">${title}</span>` : '';
            
            if (role === 'admin') {
                item.classList.add('admin-message');
                usernameSpan.innerHTML = `👑 ${titleHtml}${userHtml}:`;
            } else {
                usernameSpan.innerHTML = `${titleHtml}${userHtml}:`;
            }
            if (type === 'announcement') {
                item.classList.add('announcement-message');
                messageSpan.innerHTML = `📢 ${message}`;
                if (role === 'admin') {
                    usernameSpan.innerHTML = `[공지] 👑 ${titleHtml}${userHtml}:`;
                } else {
                    usernameSpan.innerHTML = `[공지] ${titleHtml}${userHtml}:`;
                }
            } else {
                messageSpan.textContent = message;
            }
            item.appendChild(usernameSpan);
            item.appendChild(messageSpan);
        }
        elements.chat.messages.appendChild(item);
        if (isScrolledToBottom) {
            elements.chat.messages.scrollTop = elements.chat.messages.scrollHeight;
        }
    }
    
    socket.on('chatHistory', (history) => { elements.chat.messages.innerHTML = ''; history.forEach(msg => addChatMessage(msg)); });
    socket.on('chatMessage', (data) => addChatMessage(data));
    let announcementTimer = null;
    elements.announcementBanner.addEventListener('click', (e) => {
        if (e.target.id === 'announcement-close-btn') {
            elements.announcementBanner.classList.remove('active');
            if (announcementTimer) {
                clearTimeout(announcementTimer);
            }
        }
    });

   socket.on('globalAnnouncement', (notice, options) => {
    const banner = elements.announcementBanner;
    if (banner) {
        if (announcementTimer) {
            clearTimeout(announcementTimer);
        }
        banner.innerHTML = `📢 ${notice} <span id="announcement-close-btn">&times;</span>`;
        banner.classList.add('active');
        
   
        if (options && options.style === 'primal') {
            banner.style.background = 'linear-gradient(45deg, #00e6d2, #00c4b3)'; 
            banner.style.color = '#000';
            banner.style.textShadow = '0 0 5px #fff';
        } else {

            banner.style.background = 'linear-gradient(45deg, var(--secondary-color), gold)';
            banner.style.color = '#000';
            banner.style.textShadow = 'none';
        }

        announcementTimer = setTimeout(() => {
            banner.classList.remove('active');
        }, 10000); 
    }
});

    elements.modals.mailbox.button.addEventListener('click', () => {
        elements.modals.mailbox.button.classList.remove('new-mail');
        socket.emit('mailbox:get', (mails) => {
            renderMailbox(mails);
            elements.modals.mailbox.overlay.style.display = 'flex';
        });
    });

    elements.modals.mailbox.list.addEventListener('click', (e) => {
        if (e.target.classList.contains('claim-mail-btn')) {
            const mailId = e.target.dataset.mailId;
            e.target.disabled = true;
            e.target.textContent = '수령중...';
            socket.emit('mailbox:claim', { mailId }, (response) => {
                if (response.success) {
                    socket.emit('mailbox:get', renderMailbox);
                } else {
                    alert(response.message);
                    e.target.disabled = false;
                    e.target.textContent = '수령';
                }
            });
        }
    });

    elements.modals.mailbox.claimAllBtn.addEventListener('click', () => {
        elements.modals.mailbox.claimAllBtn.disabled = true;
        socket.emit('mailbox:claimAll', (response) => {
            if (response.success) {
                socket.emit('mailbox:get', renderMailbox);
            }
            elements.modals.mailbox.claimAllBtn.disabled = false;
        });
    });





    socket.on('newMailNotification', () => {
         elements.modals.mailbox.button.classList.add('new-mail');
    });

    function renderMailbox(mails) {
        const listEl = elements.modals.mailbox.list;
        listEl.innerHTML = '';
        if (!mails || mails.length === 0) {
            listEl.innerHTML = '<li style="text-align:center; padding: 50px; color: var(--text-muted);">받은 우편이 없습니다.</li>';
            elements.modals.mailbox.claimAllBtn.style.display = 'none';
            return;
        }
        elements.modals.mailbox.claimAllBtn.style.display = 'block';
        mails.forEach(mail => {
            const li = document.createElement('li');
            li.className = 'mail-item';
            let iconHTML = '';
            let infoHTML = '';
            if (mail.item) {
                const itemDiv = document.createElement('div');
                itemDiv.className = 'inventory-item';
                itemDiv.innerHTML = createItemHTML(mail.item, { showName: false, showEffect: false });
                iconHTML = `<div class="mail-item-icon">${itemDiv.outerHTML}</div>`;
                infoHTML = `
                    <h4>${mail.description}</h4>
                    <p>(From: ${mail.senderUsername})</p>
                `;
            } else if (mail.gold > 0) {
                iconHTML = `
                    <div class="mail-item-icon">
                        <div class="inventory-item">
                            <div class="item-image"><img src="/image/gold_pouch.png"></div>
                        </div>
                    </div>
                `;
                const reasonText = mail.description ? ` (${mail.description})` : '';
                infoHTML = `
                    <h4><span class="gold-text">${mail.gold.toLocaleString()} G</span> 를 획득했습니다.${reasonText}</h4>
                    <p>(From: ${mail.senderUsername})</p>
                `;
            }
            li.innerHTML = `
                ${iconHTML}
                <div class="mail-item-info">
                    ${infoHTML}
                </div>
                <div class="mail-item-actions">
                    <button class="action-btn claim-mail-btn" data-mail-id="${mail._id}">수령</button>
                </div>
            `;
            listEl.appendChild(li);
        });
    }

    socket.on('forceDisconnect', (data) => { alert(data.message); socket.disconnect(); localStorage.removeItem('jwt_token'); location.reload(); });
    setInterval(() => {
        if (socket.connected) {
            socket.emit('client-heartbeat');
        }
    }, 45000);
}

function renderCodex({ allItems, discovered, totalItemCount, discoveredCount, completionPercentage }) {
    const modal = document.getElementById('codex-modal');
    if (!modal) return;
    const title = modal.querySelector('h2');
    const content = modal.querySelector('#codex-content');
    const footer = modal.querySelector('#codex-footer');
    if (!title || !content || !footer) return;
    const completionText = `📖 아이템 도감 (${completionPercentage.toFixed(1)}%)`;
    title.textContent = completionText;
    if (completionPercentage === 100) {
       title.classList.add('codex-completion-full');
    } else {
       title.classList.remove('codex-completion-full');
    }
    content.innerHTML = '';
    const categoryTitles = {
        weapons: '⚔️ 무기',
        armors: '🛡️ 방어구',
        accessories: '💍 액세서리',
        etc: '✨ 기타 아이템',
        pets: '🐾 펫',
        artifacts: '📜 유물'
    };
    for (const category in allItems) {
        const items = allItems[category];
        if (items.length === 0) continue;
        const categoryTitle = document.createElement('h3');
        categoryTitle.textContent = categoryTitles[category] || category;
        content.appendChild(categoryTitle);
        const grid = document.createElement('div');
        grid.className = 'codex-grid inventory-grid';
        items.forEach(item => {
            const isDiscovered = discovered.includes(item.id);
            
            let effectText = '';
            if (item.grade === 'Primal' && item.randomStat) {
                const typeText = item.type === 'weapon' ? '⚔️공격력' : '❤️🛡️체/방';
                const minBonus = (item.baseEffect + (item.randomStat.min / 100)) * 100;
                const maxBonus = (item.baseEffect + (item.randomStat.max / 100)) * 100;
                effectText = `${typeText} +${minBonus.toLocaleString()}% ~ ${maxBonus.toLocaleString()}%`;
            } else if (item.type === 'weapon' || item.type === 'armor') {
                const typeText = item.type === 'weapon' ? '⚔️공격력' : '❤️🛡️체/방';
                effectText = `${typeText} +${(item.baseEffect * 100).toFixed(1)}%`;
            } else {
                effectText = item.description || '';
            }

            const itemHTML = `
                <div class="item-image ${isDiscovered ? '' : 'undiscovered'}">
                    <img src="/image/${item.image}" alt="${item.name}" draggable="false">
                </div>
                <div class="item-info">
                    <div class="item-name ${item.grade || 'Common'}">${item.name}</div>
                    <div class="item-effect" style="font-size: 0.9em;">${effectText}</div>
                </div>`;
            
            const itemDiv = document.createElement('div');
            itemDiv.className = 'inventory-item';
            itemDiv.innerHTML = itemHTML;
            grid.appendChild(itemDiv);
        });
        content.appendChild(grid);
    }
    footer.innerHTML = `
        <p style="font-size: 1.1em;"><strong>도감 수집률:</strong> ${discoveredCount} / ${totalItemCount}</p>
        <p style="margin-top: 10px; font-size: 1.2em; color: var(--gold-color);">
            <strong>✨ 100% 달성 보상 ✨</strong>
        </p>
        <div style="margin-top: 8px; font-size: 1.1em; display: flex; justify-content: center; flex-wrap: wrap; gap: 15px;">
            <span>❤️ 체력 +5%</span>
            <span>⚔️ 공격력 +5%</span>
            <span>🛡️ 방어력 +5%</span>
            <span>💰 골드 획득 +5%</span>
            <span>💥 치명타 확률 +5%   (최종 기준 5% 복리적용)</span>
        </div>
    `;
}

function renderTitleCodex(data) {
    const { allTitles, unlockedTitles, equippedTitle } = data;
    const contentEl = document.getElementById('title-codex-content');
    const footerEl = document.getElementById('title-codex-footer');
    contentEl.innerHTML = '';

    const titleOrder = Object.keys(allTitles);

    titleOrder.forEach(titleName => {
        const titleInfo = allTitles[titleName];
        const isUnlocked = unlockedTitles.includes(titleName);
        const isEquipped = equippedTitle === titleName;
        const gradeClass = getGradeByTitle(titleName);

        const card = document.createElement('div');
        card.className = `title-card ${isUnlocked ? 'unlocked' : 'locked'}`;
        card.dataset.titleName = titleName;
        

        card.title = isUnlocked ? getTitleCondition(titleName) : titleInfo.hint;

        let actionsHtml = '';
        if (isUnlocked) {
            if (isEquipped) {
                actionsHtml = `<button class="action-btn sell-btn unequip-title-btn">해제하기</button>`;
            } else {
                actionsHtml = `<button class="action-btn list-auction-btn equip-title-btn">장착하기</button>`;
            }
        }
        
        const nameHtml = `<div class="title-card-name ${gradeClass}">${titleName}</div>`;
        const effectHtml = isUnlocked ? `<div class="title-card-effect">${getEffectDescription(titleInfo.effect)}</div>` : `<div class="title-card-effect" style="color: #555;">(효과 숨김)</div>`;
        const equippedBadge = isEquipped ? `<div class="title-card-equipped-badge">-- 장착 중 --</div>` : '';

        card.innerHTML = `
            ${nameHtml}
            ${effectHtml}
            <div class="title-card-actions">${actionsHtml}</div>
            ${equippedBadge}
        `;

        if (isUnlocked) {
            const equipBtn = card.querySelector('.equip-title-btn');
            const unequipBtn = card.querySelector('.unequip-title-btn');
            const socket = window.socket;

            if (equipBtn) {
                equipBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    socket.emit('titles:equip', titleName);
                    document.getElementById('title-codex-modal').style.display = 'none'; 
                });
            }
            if (unequipBtn) {
                unequipBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    socket.emit('titles:unequip');
                    document.getElementById('title-codex-modal').style.display = 'none';
                });
            }
        }
        contentEl.appendChild(card);
    });

    const totalTitles = titleOrder.length;
    const collectedTitles = unlockedTitles.length;
    const isCompleted = collectedTitles >= totalTitles;
    footerEl.innerHTML = `
        <p>수집 현황: ${collectedTitles} / ${totalTitles}</p>
        <p style="margin-top: 10px; color: ${isCompleted ? 'var(--success-color)' : 'var(--text-muted)'}; font-weight: bold;">
            ${isCompleted ? '모든 칭호를 수집하여 마스터 보너스가 활성화되었습니다!' : '칭호 20개를 모두 수집하면 모든 능력치가 영구적으로 5% 증가합니다.'}
        </p>
    `;
}

function getEffectDescription(effect) {
    if (!effect) return '효과 없음';
    const key = Object.keys(effect)[0];
    const value = effect[key];
    switch (key) {
        case 'enhancementSuccessRate': return `강화 성공 확률 +${value * 100}%p`;
        case 'enhancementCostReduction': return `강화 비용 ${value * 100}% 감소`;
        case 'enhancementMaintainChance': return `강화 실패 시 '유지'될 확률 +${value * 100}%`;
        case 'critChance': return `치명타 확률 +${value * 100}%`;
        case 'enchantCostReduction': return `마법부여 비용(골드) ${value * 100}% 감소`;
        case 'bossDamage': return `보스 몬스터에게 주는 데미지 +${value * 100}%`;
        case 'petStatBonus': return `펫의 모든 능력치 효과 +${value * 100}%`;
        case 'goldGain': return `골드 획득량 +${value * 100}%`;
        case 'attack': return `공격력 +${value * 100}%`;
        case 'riftShardDropRate': return `'균열의 파편' 획득 확률 +${value * 100}% (상대값)`;
        case 'hatchTimeReduction': return `펫 알 부화 시간 ${value * 100}% 감소`;
        case 'goldPouchMinBonus': return `'골드 주머니' 최소 골드량 +${value * 100}%`;
        case 'sellPriceBonus': return `상점 판매 가격 +${value * 100}%`;
        case 'maxHp': return `최대 체력 +${value * 100}%`;
        case 'scrollBuffDuration': return `'복귀 스크롤' 각성 버프 지속시간 +${value}초`;
        case 'goldOnDeath': return `사망 시 ${value.toLocaleString()} 골드 지급`;
        case 'worldBossContribution': return `월드보스 기여도 획득량 +${value * 100}%`;
        case 'worldBossDamage': return `월드보스에게 주는 데미지 +${value * 100}%`;
        case 'commonWeaponAttackBonus': return `'Common' 등급 무기 공격력 +${value * 100}%`;
        default: return '알 수 없는 효과';
    }
}

function getTitleCondition(titleName) {
    const conditions = {
        '[대체왜?]': "획득: '낡은 단검'(Common) 아이템 +15강 만들기",
        '[펑..]': "획득: 강화 실패로 아이템 50회 파괴",
        '[키리]': "획득: 강화 500회 실패 (하락/유지 포함)",
        '[유리대포]': "획득: 무기는 'Mystic' 등급, 방어구는 'Common' 등급으로 장착",
        '[마부장인]': "획득: 무기와 방어구 슬롯에 마법부여가 적용된 아이템을 모두 장착",
        '[로포비아]': "획득: '바하무트' 펫 보유",
        '[원소술사]': "획득: 불/물/바람 속성 융합 펫 3종 모두 보유",
        '[전당포]': "획득: 신화 등급 액세서리 3종 모두 보유",
        '[인과율의 밖]': "획득: 'Primal' 등급 무기와 방어구 모두 장착",
        '[랭커]': "획득: 'Mystic' 등급 무기와 방어구 모두 장착",
        '[균열석]': "획득: '균열의 파편' 10,000개 이상 보유",
        '[생명의 은인]': "획득: 펫 알 30회 부화",
        '[탐욕]': "획득: '수수께끼 골드 주머니' 100회 사용",
        '[대장간]': "획득: 상점에 아이템 1,000회 판매",
        '[큰손]': "획득: 거래소에서 아이템 100회 구매",
        '[회귀자]': "획득: '복귀 스크롤' 50회 사용",
        '[오뚝이]': "획득: 사망(1층 귀환) 500회 달성",
        '[용사]': "획득: 월드보스에게 마지막 일격(Last Hit) 5회 가하기",
        '[토벌대원]': "획득: 월드보스 토벌 10회 참여",
        '[날먹최강자]': "획득: '낡은 단검'을 장착한 상태로 월드보스 토벌 성공 (기여도 1 이상)"
    };
    return conditions[titleName] || "획득 조건을 알 수 없습니다.";
}

function getGradeByTitle(titleName) {
    const grades = {
        '[인과율의 밖]': 'Primal',
        '[랭커]': 'Mystic',
        '[로포비아]': 'Mystic',
        '[전당포]': 'Mystic',
        '[키리]': 'Epic',
        '[용사]': 'Epic',
        '[날먹최강자]': 'Epic',
        '[원소술사]': 'Legendary',
        '[대체왜?]': 'Legendary',
        '[균열석]': 'Legendary'
    };
    return grades[titleName] || 'Rare'; 
}

function updateTopBarInfo(player) {
    if (!player) return;

    const { username, fameScore, equippedTitle } = player;
    
    const fameDetails = getFameDetails(fameScore);
    const scoreText = `(${(fameScore || 0).toLocaleString()})`;
    const titleHtml = equippedTitle ? `<span class="title ${getGradeByTitle(equippedTitle)}">${equippedTitle}</span>` : '';

    const userInfoEl = document.getElementById('user-info');
    if (userInfoEl) {
        const iconEl = userInfoEl.querySelector('#fame-icon');
        const scoreEl = userInfoEl.querySelector('#fame-score-display');
        const usernameEl = userInfoEl.querySelector('#welcome-username');

        if (iconEl) iconEl.textContent = fameDetails.icon;
        if (scoreEl) scoreEl.textContent = scoreText;
        if (usernameEl) {
            usernameEl.className = '';
            if (fameDetails.className) {
                usernameEl.classList.add(fameDetails.className);
            }
            usernameEl.innerHTML = `${titleHtml}${username}`;
        }
    }
}