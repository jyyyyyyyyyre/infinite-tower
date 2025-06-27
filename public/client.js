// client.js 전체 코드

document.addEventListener('DOMContentLoaded', () => {

    // --- DOM 요소 캐싱 (인증 관련) ---
    const authContainer = document.getElementById('auth-container');
    const gameAppContainer = document.getElementById('game-app-container');
    const authForm = document.getElementById('auth-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const authTitle = document.getElementById('auth-title');
    const submitButton = document.getElementById('submit-button');
    const toggleAuth = document.getElementById('toggle-auth');
    const authMessage = document.getElementById('auth-message');
    const welcomeUsername = document.getElementById('welcome-username');
    const logoutButton = document.getElementById('logout-button');

    let isLogin = true; // 현재 폼이 로그인 폼인지 여부

    // --- 인증 폼 <-> 회원가입 폼 전환 ---
    function addToggleListener() {
        const toggleLink = document.getElementById('toggle-link');
        if (toggleLink) {
            toggleLink.addEventListener('click', () => {
                isLogin = !isLogin;
                authTitle.textContent = isLogin ? '로그인' : '회원가입';
                submitButton.textContent = isLogin ? '로그인' : '회원가입';
                toggleAuth.innerHTML = isLogin ? '계정이 없으신가요? <span id="toggle-link">회원가입</span>' : '이미 계정이 있으신가요? <span id="toggle-link">로그인</span>';
                addToggleListener(); // 새로 생긴 span에 다시 이벤트 리스너를 붙여줌
                authMessage.textContent = '';
            });
        }
    }
    addToggleListener();


    // --- 폼 제출 (로그인/회원가입) 이벤트 처리 ---
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // 폼 기본 제출 동작 방지
        const username = usernameInput.value;
        const password = passwordInput.value;
        const url = isLogin ? '/api/login' : '/api/register';

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                authMessage.textContent = data.message;
                return;
            }

            if (isLogin) {
                // 로그인 성공
                localStorage.setItem('jwt_token', data.token);
                startApp(data.token);
            } else {
                // 회원가입 성공
                authMessage.textContent = '회원가입 성공! 이제 로그인해주세요.';
                
                // 로그인 폼으로 전환
                isLogin = true; 
                authTitle.textContent = '로그인';
                submitButton.textContent = '로그인';
                toggleAuth.innerHTML = '계정이 없으신가요? <span id="toggle-link">회원가입</span>';
                addToggleListener();
                usernameInput.value = username; // 아이디는 그대로 둠
                passwordInput.value = '';
                passwordInput.focus();
            }

        } catch (error) {
            authMessage.textContent = '서버와 통신할 수 없습니다.';
        }
    });
    
    // --- 로그아웃 처리 ---
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('jwt_token');
        location.reload(); // 페이지 새로고침으로 초기화
    });


    // --- 앱 시작 함수 ---
    function startApp(token) {
        // 인증 화면 숨기고 게임 화면 표시
        authContainer.style.display = 'none';
        gameAppContainer.style.display = 'flex';

        try {
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            welcomeUsername.textContent = decodedToken.username;
        } catch (e) {
            console.error("Invalid Token:", e);
            localStorage.removeItem('jwt_token');
            location.reload();
            return;
        }

        // 소켓 서버에 토큰과 함께 연결
        const socket = io({
            auth: { token }
        });

        // 소켓 연결 에러 처리
        socket.on('connect_error', (err) => {
            alert(err.message);
            localStorage.removeItem('jwt_token');
            location.reload();
        });

        // 여기서부터는 기존 client.js의 게임 로직이 시작됩니다.
        initializeGame(socket);
    }
    
    // 페이지 로드 시 토큰이 있으면 자동 로그인 시도
    const token = localStorage.getItem('jwt_token');
    if (token) {
        startApp(token);
    }

});

// ==========================================================
//  게임 초기화 및 로직 함수 (기존 client.js 내용)
// ==========================================================
function initializeGame(socket) {
    /* ---- 테스트용 버튼 ---- */
    const testItemsBtn = document.getElementById('btn-test-items');
    const testGoldBtn = document.getElementById('btn-test-gold');
    if (testItemsBtn && testGoldBtn) {
        testItemsBtn.addEventListener('click', () => socket.emit('grantTestItems'));
        testGoldBtn.addEventListener('click', () => socket.emit('grantTestGold'));
    }

    /* ────────── DOM 캐싱 ────────── */
    const elements = {
        gold: document.getElementById('gold'),

        player: {
            panel: document.querySelector('.player-panel'),
            hpBar: document.getElementById('player-hp-bar'),
            hpText: document.getElementById('player-hp-text'),
            totalHp: document.getElementById('total-hp'),
            totalAttack: document.getElementById('total-attack'),
            totalDefense: document.getElementById('total-defense'),
        },

        monster: {
            panel: document.querySelector('.monster-panel'),
            level: document.getElementById('monster-level'),
            hpBar: document.getElementById('monster-hp-bar'),
            hpText: document.getElementById('monster-hp-text'),
            totalHp: document.getElementById('monster-hp-total'),
            attack: document.getElementById('monster-attack'),
            defense: document.getElementById('monster-defense'),
        },

        equipment: {
            weapon: document.getElementById('weapon-slot'),
            armor: document.getElementById('armor-slot'),
        },

        inventory: {
            weapon: document.getElementById('weapon-inventory'),
            armor: document.getElementById('armor-inventory'),
            all: document.querySelectorAll('.inventory-grid'),
        },

        log: document.getElementById('game-log'),
        damageContainer: document.getElementById('damage-container'),

        tabs: {
            buttons: document.querySelectorAll('.tab-button'),
            contents: document.querySelectorAll('.tab-content'),
        },

        enhancement: {
            slot: document.getElementById('enhancement-slot'),
            before: document.getElementById('enhancement-before'),
            after: document.getElementById('enhancement-after'),
            info: document.getElementById('enhancement-info'),
            button: document.getElementById('enhance-button'),
            animation: document.getElementById('enhancement-animation'),
        },
        
        // 랭킹 관련 DOM
        rankingModal: document.getElementById('ranking-modal'),
        rankingButton: document.getElementById('ranking-button'),
        closeRankingButton: document.querySelector('#ranking-modal .close-button'),
        levelRankingList: document.getElementById('level-ranking-list'),
        enhancementRankingList: document.getElementById('enhancement-ranking-list'),
    };
    
    // 랭킹 모달 열기/닫기
    elements.rankingButton.addEventListener('click', () => {
        socket.emit('requestRanking'); // 서버에 랭킹 정보 요청
        elements.rankingModal.style.display = 'flex';
    });
    elements.closeRankingButton.addEventListener('click', () => {
        elements.rankingModal.style.display = 'none';
    });
    window.addEventListener('click', (e) => {
        if (e.target === elements.rankingModal) {
            elements.rankingModal.style.display = 'none';
        }
    });

    // 서버로부터 랭킹 데이터 수신
// initializeGame 함수 안에 있는 socket.on('rankingData', ...) 부분을 찾아서 아래 코드로 교체하세요.

    socket.on('rankingData', ({ topLevel, topGold, topWeapon, topArmor }) => {
        const list = document.getElementById('ranking-list');
        if (!list) return;

        let rankingHTML = '';
        
        // 랭킹 항목을 생성하는 헬퍼 함수
        const createRankItem = (rank, content) => {
            return `<li><span class="rank-badge rank-${rank}">${rank}</span> ${content}</li>`;
        };
        
        // 1. 최고 등반 랭킹
        if (topLevel.length > 0) {
            rankingHTML += `<h3>🔝 최고 등반 랭킹</h3>`;
            topLevel.forEach((p, i) => {
                const content = `<span class="rank-name">${p.username}</span> 님은 최대 <span class="rank-value">${p.maxLevel}층</span>까지 등반하였습니다.`;
                rankingHTML += createRankItem(i + 1, content);
            });
        }
        
        // 2. 최고 무기 강화 랭킹
        if (topWeapon.length > 0) {
            rankingHTML += `<h3 style="margin-top:20px;">⚔️ 최고 무기 강화 랭킹</h3>`;
            topWeapon.forEach((p, i) => {
                const content = `<span class="rank-name">${p.username}</span> 님은 <span class="rank-value">${p.maxWeaponName}</span> 을(를) <span class="rank-value">${p.maxWeaponEnhancement}강</span>까지 강화하셨습니다.`;
                rankingHTML += createRankItem(i + 1, content);
            });
        }
        
        // 3. 최고 방어구 강화 랭킹
        if (topArmor.length > 0) {
            rankingHTML += `<h3 style="margin-top:20px;">🛡️ 최고 방어구 강화 랭킹</h3>`;
            topArmor.forEach((p, i) => {
                const content = `<span class="rank-name">${p.username}</span> 님은 <span class="rank-value">${p.maxArmorName}</span> 을(를) <span class="rank-value">${p.maxArmorEnhancement}강</span>까지 강화하셨습니다.`;
                rankingHTML += createRankItem(i + 1, content);
            });
        }
        
        // 4. 최고 골드 보유 랭킹
        if (topGold.length > 0) {
            rankingHTML += `<h3 style="margin-top:20px;">💰 최고 골드 보유 랭킹</h3>`;
            topGold.forEach((p, i) => {
                const content = `<span class="rank-name">${p.username}</span> 님은 현재 <span class="rank-value">${p.gold.toLocaleString()} G</span> 를 보유하고 있습니다.`;
                rankingHTML += createRankItem(i + 1, content);
            });
        }

        list.innerHTML = rankingHTML;
    });


    /* ────────── 상태 ────────── */
    let selectedInventoryItemUid = null;
    let currentPlayerState = null;

    /* ────────── 포맷터 ────────── */
    const formatInt = n => Math.floor(n).toLocaleString();
    const formatFloat = n => n.toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    });

    /* ────────── HTML 생성 ────────── */
    const createItemHTML = (item) => {
        let bonus = item.baseEffect;
        for (let i = 1; i <= item.enhancement; i++) {
            bonus += item.baseEffect * (i <= 10 ? 0.1 : 0.5);
        }
        const effectText = item.type === 'weapon' ? `⚔️공격력 +${(bonus * 100).toFixed(1)}%` : `❤️🛡️체/방 +${(bonus * 100).toFixed(1)}%`;
        const nameClass = item.grade || 'Common';
        const enhanceText = item.enhancement ? `<div class="item-enhancement-level">[+${item.enhancement}]</div>` : '';
        const quantityText = item.quantity > 1 ? `<div class="item-quantity">x${item.quantity}</div>` : '';
        const imageHTML = item.image ? `<div class="item-image"><img src="/image/${item.image}" alt="${item.name}" draggable="false"></div>` : '<div class="item-image"></div>';

        return `${imageHTML}<div class="item-info"><div class="item-name ${nameClass}">${item.name}</div><div class="item-effect">${effectText}</div></div>${quantityText}${enhanceText}`;
    };

    const getEnhanceClass = (lvl) => lvl > 0 ? `enhance-${Math.min(lvl, 20)}` : '';

    /* ────────── UI 업데이트 ────────── */
    const updateUI = ({ player, monster }) => {
        currentPlayerState = player;

        if (elements.gold.textContent !== formatInt(player.gold)) {
            elements.gold.textContent = formatInt(player.gold);
            elements.gold.classList.add('flash');
            setTimeout(() => elements.gold.classList.remove('flash'), 300);
        }

        elements.player.hpBar.style.width = `${(player.currentHp / player.stats.total.hp) * 100}%`;
        elements.player.hpText.textContent = `${formatFloat(player.currentHp)} / ${formatFloat(player.stats.total.hp)}`;
        elements.player.totalHp.textContent = formatFloat(player.stats.total.hp);
        elements.player.totalAttack.textContent = formatFloat(player.stats.total.attack);
        elements.player.totalDefense.textContent = formatFloat(player.stats.total.defense);

        elements.monster.level.textContent = formatInt(monster.level);
        elements.monster.hpBar.style.width = `${(monster.currentHp / monster.hp) * 100}%`;
        elements.monster.hpText.textContent = `${formatFloat(monster.currentHp)} / ${formatFloat(monster.hp)}`;
        elements.monster.totalHp.textContent = formatFloat(monster.hp);
        elements.monster.attack.textContent = formatFloat(monster.attack);
        elements.monster.defense.textContent = formatFloat(monster.defense);

        const renderItemInSlot = (slotElement, item) => {
            if (item) {
                slotElement.innerHTML = `<div class="inventory-item ${getEnhanceClass(item.enhancement)}" data-uid="${item.uid}">${createItemHTML(item)}</div>`;
            } else {
                const type = slotElement.dataset.slot === 'weapon' ? '⚔️' : '🛡️';
                slotElement.innerHTML = `${type}<br>${slotElement.dataset.slot === 'weapon' ? '무기' : '방어구'} 없음`;
            }
        };

        renderItemInSlot(elements.equipment.weapon, player.equipment.weapon);
        renderItemInSlot(elements.equipment.armor, player.equipment.armor);

        const weapons = player.inventory.filter(item => item.type === 'weapon');
        const armors = player.inventory.filter(item => item.type === 'armor');
        const renderGrid = (items) => items.map(item => `<div class="inventory-item ${getEnhanceClass(item.enhancement)}" data-uid="${item.uid}" draggable="true">${createItemHTML(item)}</div>`).join('');
        elements.inventory.weapon.innerHTML = renderGrid(weapons);
        elements.inventory.armor.innerHTML = renderGrid(armors);

        elements.log.innerHTML = player.log.map(msg => `<li>${msg}</li>`).join('');
        updateInteractionPanel();
        updateAffordableButtons();
    };

    /* ────────── 스탯 버튼 활성화 ────────── */
    const updateAffordableButtons = () => {
        if (!currentPlayerState) return;
        ['hp', 'attack', 'defense'].forEach(stat => {
            const base = currentPlayerState.stats.base[stat];
            const gold = currentPlayerState.gold;
            const costN = n => [...Array(n).keys()].reduce((s, i) => s + base + i, 0);
            const affordable = { 1: gold >= base, 10: gold >= costN(10), 100: gold >= costN(100), MAX: gold >= base, };
            document.querySelectorAll(`.stat-row[data-stat-row="${stat}"] .upgrade-btn`).forEach(btn => {
                btn.classList.toggle('affordable', affordable[btn.dataset.amount]);
            });
        });
    };

    /* ────────── 강화 패널 ────────── */
    const updateInteractionPanel = () => {
        const item = (currentPlayerState?.inventory.find(i => i.uid === selectedInventoryItemUid)) 
            || (currentPlayerState?.equipment.weapon?.uid === selectedInventoryItemUid ? currentPlayerState.equipment.weapon : null)
            || (currentPlayerState?.equipment.armor?.uid === selectedInventoryItemUid ? currentPlayerState.equipment.armor : null);


        if (!item) {
            selectedInventoryItemUid = null;
            elements.enhancement.slot.innerHTML = '강화할 아이템을<br>인벤토리/장비창에서 선택하세요';
            elements.enhancement.before.textContent = '';
            elements.enhancement.after.textContent = '';
            elements.enhancement.info.textContent = '';
            elements.enhancement.button.disabled = true;
            return;
        }

        document.querySelectorAll('.inventory-item').forEach(el => el.classList.remove('selected'));
        const selectedEl = document.querySelector(`.inventory-item[data-uid="${item.uid}"]`);
        if(selectedEl) selectedEl.classList.add('selected');
        
        elements.enhancement.slot.innerHTML = createItemHTML(item);
        const bonusArr = Array.from({ length: item.enhancement }, (_, i) => item.baseEffect * (i < 10 ? 0.1 : 0.5));
        const currentBonus = bonusArr.reduce((s, v) => s + v, item.baseEffect);
        const nextBonus = currentBonus + item.baseEffect * (item.enhancement < 10 ? 0.1 : 0.5);
        elements.enhancement.before.innerHTML = `<b>+${item.enhancement}</b><br>${(currentBonus * 100).toFixed(1)}%`;
        elements.enhancement.after.innerHTML = `<b>+${item.enhancement + 1}</b><br>${(nextBonus * 100).toFixed(1)}%`;
        const cost = Math.floor(1000 * Math.pow(2.1, item.enhancement));
        elements.enhancement.info.textContent = `비용: ${formatInt(cost)} G`;
        elements.enhancement.button.disabled = false;
    };

    /* ────────── 시각 효과 ────────── */
 const showDamagePopup = (target, dmg) => {
        // 데미지 숫자 텍스트를 만드는 부분은 모두 제거합니다.
        
        // 어떤 패널(플레이어 또는 몬스터)에 효과를 줄지 결정합니다.
        const panel = elements[target]?.panel;
        if (!panel) return; // 안전장치

        // 'hit-flash' 클래스를 추가하여 테두리를 반짝이게 합니다.
        panel.classList.add('hit-flash');
        
        // 0.1초(100ms) 후에 클래스를 제거하여 효과를 종료합니다.
        setTimeout(() => panel.classList.remove('hit-flash'), 100);
    };

 const playEnhancementAnimation = (result) => {
        const anim = elements.enhancement.animation;
        let text = '';
        let animClass = '';

        switch (result) {
            case 'success':
                text = '성공!';
                animClass = 'success';
                break;
            case 'maintain':
                text = '유지...';
                animClass = 'maintain';
                break;
            case 'fail':
                text = '실패...';
                animClass = 'fail';
                break;
            case 'destroy':
                text = '파괴!';
                animClass = 'destroy';
                break;
            default:
                text = '오류';
                animClass = 'fail';
        }

        anim.textContent = text;
        anim.className = `enhancement-animation ${animClass}`;

        // 애니메이션이 끝난 후 클래스를 깔끔하게 정리합니다.
        setTimeout(() => (anim.className = 'enhancement-animation'), 1500);
    };

    /* ────────── 소켓 수신 ────────── */
    socket.on('gameState', updateUI);
     socket.on('combatResult', (damages) => {
        if (damages.playerTook > 0) {
            showDamagePopup('player', damages.playerTook);
        }
        if (damages.monsterTook > 0) {
            showDamagePopup('monster', damages.monsterTook);
        }
    });
    socket.on('enhancementResult', d => {
        playEnhancementAnimation(d.result);
        if (d.newItem) {
            // 강화 결과가 반영된 아이템으로 선택 아이템 UID를 업데이트
            selectedInventoryItemUid = d.newItem.uid;
        } else if (d.destroyed) {
            selectedInventoryItemUid = null;
        }
    });

    /* ────────── UI 이벤트 ────────── */
    elements.tabs.buttons.forEach(btn => btn.addEventListener('click', () => {
        elements.tabs.buttons.forEach(b => b.classList.remove('active'));
        elements.tabs.contents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    }));

    function handleItemSelection(e) {
        const card = e.target.closest('.inventory-item');
        if (!card) return;
        selectedInventoryItemUid = card.dataset.uid;
        updateInteractionPanel();
        elements.tabs.buttons.forEach(b => {
            if (b.dataset.tab === 'enhancement-tab') b.click();
        });
    }

    elements.inventory.all.forEach(grid => grid.addEventListener('click', handleItemSelection));
    Object.values(elements.equipment).forEach(slot => slot.addEventListener('click', handleItemSelection));
    
    elements.inventory.all.forEach(grid => {
        grid.addEventListener('dragstart', e => {
            const card = e.target.closest('.inventory-item');
            if (card) e.dataTransfer.setData('text/plain', card.dataset.uid);
        });
    });

    Object.values(elements.equipment).forEach(slot => {
        slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('drag-over'); });
        slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
        slot.addEventListener('drop', e => {
            e.preventDefault();
            slot.classList.remove('drag-over');
            const uid = e.dataTransfer.getData('text/plain');
            const item = currentPlayerState?.inventory.find(i => i.uid === uid);
            if (item && item.type === slot.dataset.slot) socket.emit('equipItem', uid);
        });
    });

    document.querySelectorAll('.upgrade-btn').forEach(btn =>
        btn.addEventListener('click', () => {
            socket.emit('upgradeStat', {
                stat: btn.dataset.stat,
                amount: btn.dataset.amount,
            });
        }),
    );

    elements.enhancement.button.addEventListener('click', () => {
        if (selectedInventoryItemUid) socket.emit('attemptEnhancement', selectedInventoryItemUid);
    });
    
    elements.equipment.weapon.addEventListener('dblclick', () => socket.emit('unequipItem', 'weapon'));
    elements.equipment.armor.addEventListener('dblclick', () => socket.emit('unequipItem', 'armor'));
}