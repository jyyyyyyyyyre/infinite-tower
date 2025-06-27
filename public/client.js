// client.js 전체 코드 (오류 수정 완료)

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

    let isLogin = true;

    function addToggleListener() {
        const toggleLink = document.getElementById('toggle-link');
        if (toggleLink) {
            toggleLink.addEventListener('click', () => {
                isLogin = !isLogin;
                authTitle.textContent = isLogin ? '로그인' : '회원가입';
                submitButton.textContent = isLogin ? '로그인' : '회원가입';
                toggleAuth.innerHTML = isLogin ? '계정이 없으신가요? <span id="toggle-link">회원가입</span>' : '이미 계정이 있으신가요? <span id="toggle-link">로그인</span>';
                addToggleListener();
                authMessage.textContent = '';
            });
        }
    }
    addToggleListener();

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
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
                localStorage.setItem('jwt_token', data.token);
                startApp(data.token);
            } else {
                authMessage.textContent = '회원가입 성공! 이제 로그인해주세요.';
                isLogin = true; 
                authTitle.textContent = '로그인';
                submitButton.textContent = '로그인';
                toggleAuth.innerHTML = '계정이 없으신가요? <span id="toggle-link">회원가입</span>';
                addToggleListener();
                usernameInput.value = username;
                passwordInput.value = '';
                passwordInput.focus();
            }

        } catch (error) {
            authMessage.textContent = '서버와 통신할 수 없습니다.';
        }
    });
    
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('jwt_token');
        location.reload();
    });

    function startApp(token) {
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

        const socket = io({
            auth: { token }
        });

        socket.on('connect_error', (err) => {
            alert(err.message);
            localStorage.removeItem('jwt_token');
            location.reload();
        });

        initializeGame(socket);
    }
    
    const token = localStorage.getItem('jwt_token');
    if (token) {
        startApp(token);
    }

});

function initializeGame(socket) {
    const testItemsBtn = document.getElementById('btn-test-items');
    const testGoldBtn = document.getElementById('btn-test-gold');
    if (testItemsBtn && testGoldBtn) {
        testItemsBtn.addEventListener('click', () => socket.emit('grantTestItems'));
        testGoldBtn.addEventListener('click', () => socket.emit('grantTestGold'));
    }

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
        modals: {
            ranking: { button: document.getElementById('ranking-button'), overlay: document.getElementById('ranking-modal'), list: document.getElementById('ranking-list'),},
            loot: { button: document.getElementById('loot-record-button'), overlay: document.getElementById('loot-record-modal'), display: document.getElementById('loot-record-display'), },
            enhancement: { button: document.getElementById('enhancement-record-button'), overlay: document.getElementById('enhancement-record-modal'), display: document.getElementById('enhancement-record-display'), },
            online: { button: document.getElementById('online-users-button'), overlay: document.getElementById('online-users-modal'), list: document.getElementById('online-users-list'),},
        }
    };
    
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.querySelector('.close-button').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });

    elements.modals.ranking.button.addEventListener('click', () => {
        socket.emit('requestRanking'); 
        elements.modals.ranking.overlay.style.display = 'flex';
    });
    elements.modals.loot.button.addEventListener('click', () => {
        elements.modals.loot.overlay.style.display = 'flex';
    });
    elements.modals.enhancement.button.addEventListener('click', () => {
        elements.modals.enhancement.overlay.style.display = 'flex';
    });
    elements.modals.online.button.addEventListener('click', () => {
        socket.emit('requestOnlineUsers');
        elements.modals.online.overlay.style.display = 'flex';
    });
    
    socket.on('rankingData', ({ topLevel, topGold, topWeapon, topArmor }) => {
        const list = elements.modals.ranking.list;
        if (!list) return;

        let rankingHTML = '';
        const createRankItem = (rank, content) => `<li><span class="rank-badge rank-${rank}">${rank}</span> ${content}</li>`;
        
        if (topLevel.length > 0) {
            rankingHTML += `<h3>🔝 최고 등반 랭킹</h3>`;
            topLevel.forEach((p, i) => {
                const content = `<span class="rank-name">${p.username}</span> 님은 최대 <span class="rank-value">${p.maxLevel}층</span>까지 등반하였습니다.`;
                rankingHTML += createRankItem(i + 1, content);
            });
        }
        if (topWeapon.length > 0) {
            rankingHTML += `<h3>⚔️ 최고 무기 강화 랭킹</h3>`;
            topWeapon.forEach((p, i) => {
                const content = `<span class="rank-name">${p.username}</span> 님은 <span class="rank-value">${p.maxWeaponName}</span> 을(를) <span class="rank-value">${p.maxWeaponEnhancement}강</span>까지 강화하셨습니다.`;
                rankingHTML += createRankItem(i + 1, content);
            });
        }
        if (topArmor.length > 0) {
            rankingHTML += `<h3>🛡️ 최고 방어구 강화 랭킹</h3>`;
            topArmor.forEach((p, i) => {
                const content = `<span class="rank-name">${p.username}</span> 님은 <span class="rank-value">${p.maxArmorName}</span> 을(를) <span class="rank-value">${p.maxArmorEnhancement}강</span>까지 강화하셨습니다.`;
                rankingHTML += createRankItem(i + 1, content);
            });
        }
        if (topGold.length > 0) {
            rankingHTML += `<h3>💰 최고 골드 보유 랭킹</h3>`;
            topGold.forEach((p, i) => {
                const content = `<span class="rank-name">${p.username}</span> 님은 현재 <span class="rank-value">${p.gold.toLocaleString()} G</span> 를 보유하고 있습니다.`;
                rankingHTML += createRankItem(i + 1, content);
            });
        }
        list.innerHTML = rankingHTML;
    });

    function renderGlobalRecords(records) {
        const enhDisplay = elements.modals.enhancement.display;
        const enhRecord = records.topEnhancement;
        if (enhRecord) {
            enhDisplay.innerHTML = `
                <div class="record-item">
                    <span class="rank-name">${enhRecord.username}</span> 님의
                    <span class="${enhRecord.itemGrade}">${enhRecord.itemName}</span>
                    <span class="enhance-level-highlight">+${enhRecord.enhancementLevel}강</span>
                </div>
            `;
        } else {
            enhDisplay.innerHTML = '<div class="no-record">아직 서버 최고 강화 기록이 없습니다.</div>';
        }

        const lootDisplay = elements.modals.loot.display;
        let lootHTML = '';
        const gradeOrder = ['Mystic', 'Epic', 'Legendary'];
        let hasLootRecord = false;

        gradeOrder.forEach(grade => {
            const record = records[`topLoot_${grade}`];
            if(record) {
                hasLootRecord = true;
                lootHTML += `
                    <h3>🌟 ${grade} 등급 최고 기록</h3>
                    <div class="record-item">
                        <span class="rank-name">${record.username}</span> 님이
                        <span class="${record.itemGrade}">${record.itemName}</span> 획득
                    </div>
                `;
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

    socket.on('onlineUsersData', (players) => {
        const list = elements.modals.online.list;
        if (!players || players.length === 0) {
            list.innerHTML = '<li>현재 접속 중인 유저가 없습니다.</li>';
            return;
        }

        const listHTML = players.map(p => {
            const userHTML = `<span class="rank-name">${p.username}</span>`;
            const weapon = p.weapon ? `<span class="user-item-name ${p.weapon.grade}">${p.weapon.name}</span>` : `<span class="user-item-none">맨손</span>`;
            const armor = p.armor ? `<span class="user-item-name ${p.armor.grade}">${p.armor.name}</span>` : `<span class="user-item-none">맨몸</span>`;
            const level = `<span class="rank-value">${p.level}층</span>`
            return `<li>${userHTML} 님 : ${weapon}, ${armor} 을 착용하고, ${level} 등반 중</li>`;
        }).join('');
        list.innerHTML = listHTML;
    });
    
    let selectedInventoryItemUid = null;
    let currentPlayerState = null;

    const formatInt = n => Math.floor(n).toLocaleString();
    const formatFloat = n => n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

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

    const showDamagePopup = (target) => {
        const panel = elements[target]?.panel;
        if (!panel) return;
        panel.classList.add('hit-flash');
        setTimeout(() => panel.classList.remove('hit-flash'), 100);
    };

    const playEnhancementAnimation = (result) => {
        const anim = elements.enhancement.animation;
        let text = ''; let animClass = '';
        switch (result) {
            case 'success': text = '성공!'; animClass = 'success'; break;
            case 'maintain': text = '실패'; animClass = 'maintain'; break;
            case 'fail': text = '다운'; animClass = 'fail'; break;
            case 'destroy': text = '펑ㅋ'; animClass = 'destroy'; break;
            default: text = '오류'; animClass = 'fail';
        }
        anim.textContent = text;
        anim.className = `enhancement-animation ${animClass}`;
        setTimeout(() => (anim.className = 'enhancement-animation'), 1500);
    };

    socket.on('gameState', updateUI);
    socket.on('combatResult', (damages) => {
        if (damages.playerTook > 0) showDamagePopup('player');
        if (damages.monsterTook > 0) showDamagePopup('monster');
    });
    socket.on('enhancementResult', d => {
        playEnhancementAnimation(d.result);
        if (d.newItem) {
            selectedInventoryItemUid = d.newItem.uid;
        } else if (d.destroyed) {
            selectedInventoryItemUid = null;
        }
    });

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