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
            const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
            const data = await response.json();
            if (!response.ok) { authMessage.textContent = data.message; return; }
            if (isLogin) { localStorage.setItem('jwt_token', data.token); startApp(data.token); }
            else { authMessage.textContent = '회원가입 성공! 이제 로그인해주세요.'; isLogin = true; authTitle.textContent = '로그인'; submitButton.textContent = '로그인'; toggleAuth.innerHTML = '계정이 없으신가요? <span id="toggle-link">회원가입</span>'; addToggleListener(); usernameInput.value = username; passwordInput.value = ''; passwordInput.focus(); }
        } catch (error) { authMessage.textContent = '서버와 통신할 수 없습니다.'; }
    });

    logoutButton.addEventListener('click', () => { localStorage.removeItem('jwt_token'); location.reload(); });

    function startApp(token) {
        document.body.classList.remove('auth-view');
        authContainer.style.display = 'none';
        gameAppContainer.style.display = 'flex';
        try {
            const decodedToken = JSON.parse(atob(token.split('.')[1]));
            welcomeUsername.textContent = decodedToken.username;
            window.myUsername = decodedToken.username;
        } catch (e) { console.error("Invalid Token:", e); localStorage.removeItem('jwt_token'); location.reload(); return; }
        const socket = io({ auth: { token } });
        socket.on('connect_error', (err) => { alert(err.message); localStorage.removeItem('jwt_token'); location.reload(); });
        initializeGame(socket);
    }

    const token = localStorage.getItem('jwt_token');
    if (token) { startApp(token); } else { document.body.classList.add('auth-view'); }
});

function initializeGame(socket) {
    const elements = {
        gold: document.getElementById('gold'),
        player: { panel: document.querySelector('.player-panel'), hpBar: document.getElementById('player-hp-bar'), hpText: document.getElementById('player-hp-text'), totalHp: document.getElementById('total-hp'), totalAttack: document.getElementById('total-attack'), totalDefense: document.getElementById('total-defense'), },
        monster: { panel: document.querySelector('.monster-panel'), level: document.getElementById('monster-level'), hpBar: document.getElementById('monster-hp-bar'), hpText: document.getElementById('monster-hp-text'), totalHp: document.getElementById('monster-hp-total'), attack: document.getElementById('monster-attack'), defense: document.getElementById('monster-defense'), },
        equipment: { weapon: document.getElementById('weapon-slot'), armor: document.getElementById('armor-slot'), },
        inventory: { weapon: document.getElementById('weapon-inventory'), armor: document.getElementById('armor-inventory'), all: document.querySelectorAll('.inventory-grid'), },
        log: document.getElementById('game-log'),
        tabs: { buttons: document.querySelectorAll('.tab-button'), contents: document.querySelectorAll('.tab-content'), itemTab: document.getElementById('item-tab'), },
        enhancement: { slot: document.getElementById('enhancement-slot'), before: document.getElementById('enhancement-before'), after: document.getElementById('enhancement-after'), info: document.getElementById('enhancement-info'), button: document.getElementById('enhance-button'), animation: document.getElementById('enhancement-animation'), useTicketCheck: document.getElementById('use-prevention-ticket'), },
        worldBoss: { container: document.getElementById('world-boss-container'), name: document.getElementById('world-boss-name'), hpBar: document.getElementById('world-boss-hp-bar'), hpText: document.getElementById('world-boss-hp-text'), contribution: document.getElementById('world-boss-contribution'), toggleBtn: document.getElementById('attack-target-toggle-btn'), },
        modals: {
            auction: { button: document.getElementById('auction-button'), overlay: document.getElementById('auction-modal'), grid: document.getElementById('auction-grid'), detail: document.getElementById('auction-item-detail'), refreshBtn: document.getElementById('auction-refresh-btn'), },
            ranking: { button: document.getElementById('ranking-button'), overlay: document.getElementById('ranking-modal'), list: document.getElementById('ranking-list'), },
            loot: { button: document.getElementById('loot-record-button'), overlay: document.getElementById('loot-record-modal'), display: document.getElementById('loot-record-display'), },
            enhancement: { button: document.getElementById('enhancement-record-button'), overlay: document.getElementById('enhancement-record-modal'), display: document.getElementById('enhancement-record-display'), },
            online: { button: document.getElementById('online-users-button'), overlay: document.getElementById('online-users-modal'), list: document.getElementById('online-users-list'), },
        },
        chat: { messages: document.getElementById('chat-messages'), form: document.getElementById('chat-form'), input: document.getElementById('chat-input'), },
        announcementBanner: document.getElementById('announcement-banner'),
        zoom: { gameContainer: document.getElementById('game-app-container'), inBtn: document.getElementById('zoom-in-btn'), outBtn: document.getElementById('zoom-out-btn'), }
    };

 const zoomLogic = {
    MIN_SCALE: 0.7,
    MAX_SCALE: 1.2,
    currentScale: 1.0,
    applyZoom(scale) {
        this.currentScale = Math.max(this.MIN_SCALE, Math.min(this.MAX_SCALE, scale));
        
        // [수정] #game-app-container의 transform 대신 body의 zoom 속성을 직접 제어합니다.
        document.body.style.transition = 'zoom 0.2s ease-in-out';
        document.body.style.zoom = this.currentScale;
    },
    init() {
        elements.zoom.inBtn.addEventListener('click', () => this.applyZoom(this.currentScale + 0.1));
        elements.zoom.outBtn.addEventListener('click', () => this.applyZoom(this.currentScale - 0.1));
        this.applyZoom(1.0); // 페이지 로드 시 초기 줌 설정
    }
};
zoomLogic.init();
    document.querySelectorAll('.modal-overlay').forEach(modal => { modal.querySelector('.close-button').addEventListener('click', () => { modal.style.display = 'none'; }); modal.addEventListener('click', (e) => { if (e.target === modal || e.target.classList.contains('modal-overlay')) { modal.style.display = 'none'; } }); });
    elements.modals.ranking.button.addEventListener('click', () => { socket.emit('requestRanking'); elements.modals.ranking.overlay.style.display = 'flex'; });
    elements.modals.loot.button.addEventListener('click', () => { elements.modals.loot.overlay.style.display = 'flex'; });
    elements.modals.enhancement.button.addEventListener('click', () => { elements.modals.enhancement.overlay.style.display = 'flex'; });
    elements.modals.online.button.addEventListener('click', () => { socket.emit('requestOnlineUsers'); elements.modals.online.overlay.style.display = 'flex'; });
    elements.modals.auction.button.addEventListener('click', () => { fetchAuctionListings(); elements.modals.auction.overlay.style.display = 'flex'; });

    socket.on('rankingData', ({ topLevel, topGold, topWeapon, topArmor }) => {
        const list = elements.modals.ranking.list; if (!list) return; let rankingHTML = ''; const createRankItem = (rank, content) => `<li><span class="rank-badge rank-${rank}">${rank}</span> ${content}</li>`;
        if (topLevel?.length) { rankingHTML += `<h3>🔝 최고 등반 랭킹</h3>`; topLevel.forEach((p, i) => { rankingHTML += createRankItem(i + 1, `<span class="rank-name">${p.username}</span> 님은 최대 <span class="rank-value">${p.maxLevel}층</span>까지 등반하였습니다.`); }); }
        if (topWeapon?.length) { rankingHTML += `<h3>⚔️ 최고 무기 강화 랭킹</h3>`; topWeapon.forEach((p, i) => { rankingHTML += createRankItem(i + 1, `<span class="rank-name">${p.username}</span> 님은 <span class="rank-value">${p.maxWeaponName}</span> 을(를) <span class="rank-value">${p.maxWeaponEnhancement}강</span>까지 강화하셨습니다.`); }); }
        if (topArmor?.length) { rankingHTML += `<h3>🛡️ 최고 방어구 강화 랭킹</h3>`; topArmor.forEach((p, i) => { rankingHTML += createRankItem(i + 1, `<span class="rank-name">${p.username}</span> 님은 <span class="rank-value">${p.maxArmorName}</span> 을(를) <span class="rank-value">${p.maxArmorEnhancement}강</span>까지 강화하셨습니다.`); }); }
        if (topGold?.length) { rankingHTML += `<h3>💰 최고 골드 보유 랭킹</h3>`; topGold.forEach((p, i) => { rankingHTML += createRankItem(i + 1, `<span class="rank-name">${p.username}</span> 님은 현재 <span class="rank-value">${p.gold.toLocaleString()} G</span> 를 보유하고 있습니다.`); }); }
        list.innerHTML = rankingHTML || '<li>랭킹 정보가 없습니다.</li>';
    });

    function renderGlobalRecords(records) {
        const enhDisplay = elements.modals.enhancement.display; const enhRecord = records.topEnhancement; if (enhRecord) { enhDisplay.innerHTML = `<div class="record-item"><span class="rank-name">${enhRecord.username}</span> 님의 <span class="${enhRecord.itemGrade}">${enhRecord.itemName}</span> <span class="enhance-level-highlight">+${enhRecord.enhancementLevel}강</span></div>`; } else { enhDisplay.innerHTML = '<div class="no-record">아직 서버 최고 강화 기록이 없습니다.</div>'; }
        const lootDisplay = elements.modals.loot.display; let lootHTML = ''; const gradeOrder = ['Mystic', 'Epic', 'Legendary']; let hasLootRecord = false; gradeOrder.forEach(grade => { const record = records[`topLoot_${grade}`]; if (record) { hasLootRecord = true; lootHTML += `<h3>🌟 ${grade} 등급 최고 기록</h3><div class="record-item"><span class="rank-name">${record.username}</span> 님이 <span class="${record.itemGrade}">${record.itemName}</span> 획득</div>`; } }); if (hasLootRecord) { lootDisplay.innerHTML = lootHTML; } else { lootDisplay.innerHTML = '<div class="no-record">아직 서버 최고 득템 기록이 없습니다.</div>'; }
    }

    socket.on('initialGlobalRecords', renderGlobalRecords);
    socket.on('globalRecordsUpdate', renderGlobalRecords);

    socket.on('onlineUsersData', (players) => {
        const list = elements.modals.online.list; if (!players || !players.length) { list.innerHTML = '<li>현재 접속 중인 유저가 없습니다.</li>'; return; }
        list.innerHTML = players.map(p => { const userHTML = `<span class="rank-name">${p.username}</span>`; const weapon = p.weapon ? `<span class="user-item-name ${p.weapon.grade}">${p.weapon.name}</span>` : `<span class="user-item-none">맨손</span>`; const armor = p.armor ? `<span class="user-item-name ${p.armor.grade}">${p.armor.name}</span>` : `<span class="user-item-none">맨몸</span>`; const level = `<span class="rank-value">${p.level}층</span>`; return `<li>${userHTML} 님 : ${weapon}, ${armor} 을 착용하고, ${level} 등반 중</li>`; }).join('');
    });

    let selectedInventoryItemUid = null;
    let currentPlayerState = null;
    let attackTarget = 'monster';

    const formatInt = n => Math.floor(n).toLocaleString();
    const formatFloat = n => n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    const createItemHTML = (item) => {
        if (!item) return ''; let bonus = item.baseEffect; for (let i = 1; i <= item.enhancement; i++) { bonus += item.baseEffect * (i <= 10 ? 0.1 : 0.5); }
        const effectText = item.type === 'weapon' ? `⚔️공격력 +${(bonus * 100).toFixed(1)}%` : `❤️🛡️체/방 +${(bonus * 100).toFixed(1)}%`;
        const nameClass = item.grade || 'Common'; const enhanceText = item.enhancement ? `<div class="item-enhancement-level">[+${item.enhancement}]</div>` : '';
        const quantityText = item.quantity > 1 ? `<div class="item-quantity">x${item.quantity}</div>` : '';
        const imageHTML = item.image ? `<div class="item-image"><img src="/image/${item.image}" alt="${item.name}" draggable="false"></div>` : '<div class="item-image"></div>';
        return `${imageHTML}<div class="item-info"><div class="item-name ${nameClass}">${item.name}</div><div class="item-effect">${effectText}</div></div>${quantityText}${enhanceText}`;
    };

    const getEnhanceClass = (lvl) => lvl > 0 ? `enhance-${Math.min(lvl, 20)}` : '';

    const updateUI = ({ player, monster }) => {
        currentPlayerState = player;
        if (elements.gold.textContent !== formatInt(player.gold)) { elements.gold.textContent = formatInt(player.gold); elements.gold.classList.add('flash'); setTimeout(() => elements.gold.classList.remove('flash'), 300); }
        elements.player.hpBar.style.width = `${(player.currentHp / player.stats.total.hp) * 100}%`;
        elements.player.hpText.textContent = `${formatFloat(player.currentHp)} / ${formatFloat(player.stats.total.hp)}`;
        elements.player.totalHp.textContent = formatFloat(player.stats.total.hp);
        elements.player.totalAttack.textContent = formatFloat(player.stats.total.attack);
        elements.player.totalDefense.textContent = formatFloat(player.stats.total.defense);
        elements.monster.level.innerHTML = monster.isBoss ? `<span style="color:var(--fail-color); font-weight:bold;">${formatInt(monster.level)}층 보스</span>` : `${formatInt(monster.level)}층 몬스터`;
        elements.monster.hpBar.style.width = `${(monster.currentHp / monster.hp) * 100}%`;
        elements.monster.hpText.textContent = `${formatFloat(monster.currentHp)} / ${formatFloat(monster.hp)}`;
        elements.monster.totalHp.textContent = formatFloat(monster.hp);
        elements.monster.attack.textContent = formatFloat(monster.attack);
        elements.monster.defense.textContent = formatFloat(monster.defense);
        const renderItemInSlot = (slotElement, item) => { if (item) { slotElement.innerHTML = `<div class="inventory-item ${getEnhanceClass(item.enhancement)}" data-uid="${item.uid}">${createItemHTML(item)}</div>`; } else { const type = slotElement.dataset.slot === 'weapon' ? '⚔️' : '🛡️'; slotElement.innerHTML = `${type}<br>${slotElement.dataset.slot === 'weapon' ? '무기' : '방어구'} 없음`; } };
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

    const renderItemTab = () => {
        if (!currentPlayerState) return;
        const ticketCount = currentPlayerState.destructionPreventionTickets || 0;
        const itemTab = elements.tabs.itemTab;
        if (ticketCount > 0) {
            itemTab.innerHTML = `<div class="item-display">
                <h3>소모품</h3>
                <div class="consumable-item">
                    <img src="/image/ticket.png" alt="파괴 방지권">
                    <div class="consumable-info">
                        <h4>강화 파괴 방지권</h4>
                        <p>10강 이상의 아이템 강화 시, 실패로 인한 파괴를 1회 막아줍니다. (강화 수치는 그대로 유지)</p>
                        <p class="consumable-count">보유 개수: <span>${ticketCount}</span>개</p>
                    </div>
                </div>
            </div>`;
        } else {
            itemTab.innerHTML = '';
        }
    };

    const updateAffordableButtons = () => { if (!currentPlayerState) return; ['hp', 'attack', 'defense'].forEach(stat => { const base = currentPlayerState.stats.base[stat]; const gold = currentPlayerState.gold; const costN = n => [...Array(n).keys()].reduce((s, i) => s + base + i, 0); const affordable = { 1: gold >= base, 10: gold >= costN(10), 100: gold >= costN(100), MAX: gold >= base, }; document.querySelectorAll(`.stat-row[data-stat-row="${stat}"] .upgrade-btn`).forEach(btn => { btn.classList.toggle('affordable', affordable[btn.dataset.amount]); }); }); };
    
    function getSellPrice(item) {
        if (!item) return 0;
        const SELL_PRICES = { Common: 3000, Rare: 50000, Legendary: 400000, Epic: 2000000, Mystic: 100000000 };
        const basePrice = SELL_PRICES[item.grade] || 0;
        if (item.enhancement === 0) return basePrice;
        let totalEnhancementCost = 0;
        for (let i = 0; i < item.enhancement; i++) { totalEnhancementCost += Math.floor(1000 * Math.pow(2.1, i)); }
        const priceWithEnhancement = basePrice + totalEnhancementCost;
        if (item.enhancement <= 8) return priceWithEnhancement;
        if (item.enhancement <= 10) return priceWithEnhancement + 10000;
        return Math.floor(priceWithEnhancement * 1.5);
    }
    
    const updateInteractionPanel = () => {
        const item = (currentPlayerState?.inventory.find(i => i.uid === selectedInventoryItemUid)) || (currentPlayerState?.equipment.weapon?.uid === selectedInventoryItemUid ? currentPlayerState.equipment.weapon : null) || (currentPlayerState?.equipment.armor?.uid === selectedInventoryItemUid ? currentPlayerState.equipment.armor : null);
        
        if (!item) {
            selectedInventoryItemUid = null;
            elements.enhancement.slot.innerHTML = '강화할 아이템을<br>인벤토리/장비창에서 선택하세요';
            elements.enhancement.before.textContent = '';
            elements.enhancement.after.textContent = '';
            elements.enhancement.info.innerHTML = '';
            elements.enhancement.button.disabled = true;
            elements.enhancement.useTicketCheck.disabled = true;
            elements.enhancement.useTicketCheck.checked = false;
            return;
        }

        document.querySelectorAll('.inventory-item').forEach(el => el.classList.remove('selected'));
        const selectedEl = document.querySelector(`.inventory-item[data-uid="${item.uid}"]`);
        if (selectedEl) selectedEl.classList.add('selected');
        
        elements.enhancement.slot.innerHTML = createItemHTML(item);
        const bonusArr = Array.from({ length: item.enhancement }, (_, i) => item.baseEffect * (i < 10 ? 0.1 : 0.5));
        const currentBonus = bonusArr.reduce((s, v) => s + v, item.baseEffect);
        const nextBonus = currentBonus + item.baseEffect * (item.enhancement < 10 ? 0.1 : 0.5);
        elements.enhancement.before.innerHTML = `<b>+${item.enhancement}</b><br>${(currentBonus * 100).toFixed(1)}%`;
        elements.enhancement.after.innerHTML = `<b>+${item.enhancement + 1}</b><br>${(nextBonus * 100).toFixed(1)}%`;
        
        const cost = Math.floor(1000 * Math.pow(2.1, item.enhancement));
        elements.enhancement.button.disabled = currentPlayerState.gold < cost;
        
        const canUseTicket = item.enhancement >= 10 && (currentPlayerState.destructionPreventionTickets || 0) > 0;
        elements.enhancement.useTicketCheck.disabled = !canUseTicket;
        
        let infoHTML = `<div>강화 비용: ${formatInt(cost)} G</div>`;
        const isEquipped = currentPlayerState.equipment.weapon?.uid === item.uid || currentPlayerState.equipment.armor?.uid === item.uid;
    
        if (!isEquipped) {
            const finalSellPrice = getSellPrice(item);
            let sellHtml = `<div class="interaction-buttons">`;
            sellHtml += `<button class="action-btn sell-btn" data-uid="${item.uid}" data-sell-all="false">1개 판매 (${finalSellPrice.toLocaleString()} G)</button>`;
            if (item.enhancement === 0 && item.quantity > 1) {
                const totalSellPrice = getSellPrice(item) * item.quantity;
                sellHtml += `<button class="action-btn sell-btn" data-uid="${item.uid}" data-sell-all="true">전체 (${item.quantity}개) 판매 (${totalSellPrice.toLocaleString()} G)</button>`;
            }
            sellHtml += `<button class="action-btn list-auction-btn" data-uid="${item.uid}" data-max-quantity="${item.quantity}">거래소 등록</button>`;
            sellHtml += `</div>`;
            infoHTML += sellHtml;
        }
        elements.enhancement.info.innerHTML = infoHTML;
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
        setTimeout(() => {
            anim.className = 'enhancement-animation';
            anim.textContent = '';
        }, 1500);
    };

    socket.on('gameState', updateUI);
    socket.on('combatResult', (damages) => { if (damages.playerTook > 0) { const p = elements.player.panel; p.classList.add('hit-flash'); setTimeout(() => p.classList.remove('hit-flash'), 100); } if (damages.monsterTook > 0) { const m = elements.monster.panel; m.classList.add('hit-flash'); setTimeout(() => m.classList.remove('hit-flash'), 100); }});
    socket.on('enhancementResult', d => { playEnhancementAnimation(d.result); if (d.newItem) { selectedInventoryItemUid = d.newItem.uid; } else if (d.destroyed) { selectedInventoryItemUid = null; } });
    socket.on('serverAlert', (message) => { alert(message); });

    elements.tabs.buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            elements.tabs.buttons.forEach(b => b.classList.remove('active'));
            elements.tabs.contents.forEach(c => c.classList.remove('active'));
            
            elements.tabs.itemTab.innerHTML = '';
            
            btn.classList.add('active');
            const activeTabContent = document.getElementById(btn.dataset.tab);
            if (activeTabContent) {
                activeTabContent.classList.add('active');
                if (btn.dataset.tab === 'item-tab') {
                    renderItemTab();
                }
            }
        });
    });
    
    function handleItemSelection(e) {
        const card = e.target.closest('.inventory-item');
        if (!card || card.closest('#auction-grid')) return;
        selectedInventoryItemUid = card.dataset.uid;
        updateInteractionPanel();
        elements.tabs.buttons.forEach(b => { if (b.dataset.tab === 'enhancement-tab') b.click(); });
    }

    elements.inventory.all.forEach(grid => grid.addEventListener('click', handleItemSelection));
    Object.values(elements.equipment).forEach(slot => slot.addEventListener('click', handleItemSelection));
    
    elements.inventory.all.forEach(grid => { grid.addEventListener('dragstart', e => { const card = e.target.closest('.inventory-item'); if (card) e.dataTransfer.setData('text/plain', card.dataset.uid); }); });
    Object.values(elements.equipment).forEach(slot => { slot.addEventListener('dragover', e => { e.preventDefault(); slot.classList.add('drag-over'); }); slot.addEventListener('dragleave', () => slot.classList.remove('drag-over')); slot.addEventListener('drop', e => { e.preventDefault(); slot.classList.remove('drag-over'); const uid = e.dataTransfer.getData('text/plain'); const item = currentPlayerState?.inventory.find(i => i.uid === uid); if (item && item.type === slot.dataset.slot) socket.emit('equipItem', uid); }); });

    document.querySelectorAll('.upgrade-btn').forEach(btn => btn.addEventListener('click', () => { socket.emit('upgradeStat', { stat: btn.dataset.stat, amount: btn.dataset.amount, }); }));
    
    elements.enhancement.button.addEventListener('click', () => { if (selectedInventoryItemUid) { const useTicket = elements.enhancement.useTicketCheck.checked; socket.emit('attemptEnhancement', { uid: selectedInventoryItemUid, useTicket }); } });
    
document.getElementById('enhancement-tab').addEventListener('click', (e) => {
    const target = e.target;
    if (target.classList.contains('sell-btn')) {
        if (confirm("이건 거래하기가 아닌 자동판매기능입니다. 판매하시겠습니까?")) {
            const uid = target.dataset.uid;
            const sellAll = target.dataset.sellAll === 'true';
            socket.emit('sellItem', { uid, sellAll });
            selectedInventoryItemUid = null;
            updateInteractionPanel();
        }
        // '취소'를 누르면 아무 일도 일어나지 않습니다.
    }
    if (target.classList.contains('list-auction-btn')) {
        const uid = target.dataset.uid;
        const maxQuantity = parseInt(target.dataset.maxQuantity, 10);
        let quantity = 1;

        if (maxQuantity > 1) {
            const inputQty = prompt(`등록할 수량을 입력하세요. (최대 ${maxQuantity}개)`, maxQuantity);
            if (inputQty === null) return;
            quantity = parseInt(inputQty, 10);
            if (isNaN(quantity) || quantity <= 0 || quantity > maxQuantity) {
                alert("올바른 수량을 입력해주세요.");
                return;
            }
        }
        
        const price = prompt("개당 판매할 가격(골드)을 숫자로만 입력하세요:");
        if (price && !isNaN(price) && parseInt(price, 10) > 0) {
            socket.emit('listOnAuction', { uid, price: parseInt(price, 10), quantity });
            selectedInventoryItemUid = null;
            updateInteractionPanel();
        } else if (price !== null) {
            alert("올바른 가격을 입력해주세요.");
        }
    }
});

    elements.equipment.weapon.addEventListener('dblclick', () => socket.emit('unequipItem', 'weapon'));
    elements.equipment.armor.addEventListener('dblclick', () => socket.emit('unequipItem', 'armor'));

    function fetchAuctionListings() { socket.emit('getAuctionListings', (items) => { renderAuctionListings(items); }); }

    function renderAuctionListings(items) {
        const grid = elements.modals.auction.grid;
        if (!items || items.length === 0) { grid.innerHTML = '<p class="inventory-tip">등록된 물품이 없습니다.</p>'; return; }
        grid.innerHTML = items.map(listing => `<div class="inventory-item auction-item ${getEnhanceClass(listing.item.enhancement)}" data-listing-id="${listing._id}" draggable="false">${createItemHTML(listing.item)}</div>`).join('');
    }

    elements.modals.auction.grid.addEventListener('click', (e) => {
        const card = e.target.closest('.auction-item'); if (!card) return;
        document.querySelectorAll('.auction-item').forEach(el => el.classList.remove('selected'));
        card.classList.add('selected');
        const listingId = card.dataset.listingId;
        socket.emit('getAuctionListings', (items) => { const listing = items.find(i => i._id === listingId); if (listing) { renderAuctionDetail(listing); } });
    });
    
    function renderAuctionDetail(listing) {
        const detail = elements.modals.auction.detail; const isMyItem = listing.sellerUsername === window.myUsername;
        let html = `<h3>아이템 정보</h3><div class="auction-detail-item ${getEnhanceClass(listing.item.enhancement)}">${createItemHTML(listing.item)}</div><p>판매자: ${listing.sellerUsername}</p><p>개당 가격: <span class="gold-text">${listing.price.toLocaleString()} G</span></p>`;
        if (isMyItem) { html += `<button class="action-btn cancel-auction-btn" data-listing-id="${listing._id}">등록 취소</button>`; }
        else { html += `<button class="action-btn buy-auction-btn" data-listing-id="${listing._id}" data-max-quantity="${listing.item.quantity}">구매하기</button>`; }
        detail.innerHTML = html;
    }

    elements.modals.auction.detail.addEventListener('click', (e) => {
        const target = e.target; const listingId = target.dataset.listingId; if (!listingId) return;
        if(target.classList.contains('buy-auction-btn')) {
            const maxQuantity = parseInt(target.dataset.maxQuantity, 10);
            let quantity = 1;
            if (maxQuantity > 1) {
                const input = prompt(`구매할 수량을 입력하세요. (최대 ${maxQuantity}개)`, "1");
                if (input === null) return;
                quantity = parseInt(input, 10);
                if (isNaN(quantity) || quantity <= 0 || quantity > maxQuantity) {
                    alert("올바른 수량을 입력해주세요.");
                    return;
                }
            }
            if (confirm(`${quantity}개를 구매하시겠습니까?`)) { 
                socket.emit('buyFromAuction', { listingId, quantity });
            }
        }
        else if (target.classList.contains('cancel-auction-btn')) { if (confirm('등록을 취소하시겠습니까?')) { socket.emit('cancelAuctionListing', listingId); } }
    });
    
    elements.modals.auction.refreshBtn.addEventListener('click', fetchAuctionListings);
    socket.on('auctionUpdate', () => { fetchAuctionListings(); elements.modals.auction.detail.innerHTML = '<p>아이템을 선택하여 상세 정보를 확인하세요.</p>'; });

    elements.worldBoss.toggleBtn.addEventListener('click', () => {
        attackTarget = attackTarget === 'monster' ? 'worldBoss' : 'monster';
        socket.emit('setAttackTarget', attackTarget);
    });

    socket.on('attackTargetChanged', (target) => {
        attackTarget = target;
        elements.worldBoss.toggleBtn.textContent = target === 'monster' ? '월드 보스 공격' : '일반 몬스터 공격';
        elements.worldBoss.toggleBtn.classList.toggle('target-monster', target === 'worldBoss');
        elements.worldBoss.toggleBtn.classList.toggle('target-boss', target === 'monster');
    });
    
    socket.on('worldBossSpawned', (bossState) => {
        elements.worldBoss.container.style.display = 'flex';
        socket.emit('setAttackTarget', 'monster');
        updateWorldBossUI(bossState);
    });
    
    socket.on('worldBossUpdate', (bossState) => {
        if (!bossState) return;
        if (elements.worldBoss.container.style.display !== 'flex') {
            elements.worldBoss.container.style.display = 'flex';
        }
        updateWorldBossUI(bossState);
    });

    socket.on('worldBossDefeated', () => {
        elements.worldBoss.container.style.display = 'none';
        selectedInventoryItemUid = null;
        updateInteractionPanel();
    });
    
    function updateWorldBossUI(bossState) {
        if (!bossState || !currentPlayerState) return;
        elements.worldBoss.name.textContent = `🔥 ${bossState.name} 🔥`;
        
        const currentHp = bossState.currentHp || 0;
        const maxHp = bossState.maxHp || 1;
        const hpPercent = (currentHp / maxHp) * 100;
        elements.worldBoss.hpBar.style.width = `${hpPercent}%`;
        elements.worldBoss.hpText.textContent = `${formatInt(currentHp)} / ${formatInt(maxHp)}`;
        
        const myId = currentPlayerState.user.toString();
        const participantsObject = bossState.participants || {};
        
        const myParticipantData = participantsObject[myId];
        const myContribution = myParticipantData ? (myParticipantData.damageDealt || 0) : 0;
        
        let totalContribution = 0;
        for (const key in participantsObject) {
            if (Object.prototype.hasOwnProperty.call(participantsObject, key)) {
                totalContribution += participantsObject[key].damageDealt || 0;
            }
        }
        
        const myShare = totalContribution > 0 ? (myContribution / totalContribution) * 100 : 0;
        
        elements.worldBoss.contribution.textContent = `내 기여도: ${formatInt(myContribution)} (${myShare.toFixed(2)}%)`;
    }

    elements.chat.form.addEventListener('submit', (e) => { e.preventDefault(); const message = elements.chat.input.value.trim(); if (message) { socket.emit('chatMessage', message); elements.chat.input.value = ''; } });
    
    function addChatMessage(data) {
        const { type, username, role, message, isSystem } = data;
        const item = document.createElement('li');
        
        if (isSystem) {
            item.classList.add('system-message');
            item.innerHTML = message; // .textContent에서 .innerHTML로 변경
        } else {
            item.classList.add(`${type || 'user'}-message`);
            const usernameSpan = document.createElement('span');
            usernameSpan.classList.add('username');
            const messageSpan = document.createElement('span');
            messageSpan.classList.add('message');
            
            if (role === 'admin') {
                item.classList.add('admin-message');
                usernameSpan.innerHTML = `👑 ${username}:`;
            } else {
                usernameSpan.textContent = `${username}:`;
            }
            
            if (type === 'announcement') {
                item.classList.add('announcement-message');
                messageSpan.innerHTML = `📢 ${message}`; // 'announcement' 타입도 innerHTML을 사용
                usernameSpan.innerHTML = `[공지] ${username}:`;
            } else {
                messageSpan.textContent = message;
            }
            
            item.appendChild(usernameSpan);
            item.appendChild(messageSpan);
        }
        
        elements.chat.messages.appendChild(item);
        elements.chat.messages.scrollTop = elements.chat.messages.scrollHeight;
    }

    socket.on('chatHistory', (history) => { elements.chat.messages.innerHTML = ''; history.forEach(msg => addChatMessage(msg)); });
    socket.on('chatMessage', (data) => addChatMessage(data));
 socket.on('globalAnnouncement', (notice) => {
    const banner = elements.announcementBanner;
    if (banner) {
        banner.innerHTML = `📢 ${notice}`; // .textContent를 .innerHTML로 변경
        banner.classList.add('active');
        setTimeout(() => { banner.classList.remove('active'); }, 10000);
    }
});
   socket.on('forceDisconnect', (data) => { alert(data.message); socket.disconnect(); localStorage.removeItem('jwt_token'); location.reload(); });
}