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
    const SERVER_URL = "https://climbtower-server.onrender.com"; 
    const socket = io(SERVER_URL, {
        auth: { token }, 
        transports: ['websocket'] 
    });

    document.body.classList.remove('auth-view');
    authContainer.style.display = 'none';
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
    
    socket.on('connect_error', (err) => { 
        alert(err.message); 
        localStorage.removeItem('jwt_token'); 
        location.reload(); 
    });
    initializeGame(socket);
}

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

    const { showName = true, showEffect = true } = options;

    if (!item) return '';

    let effectText = '';
    if (showEffect) { 
        if (item.type === 'weapon') {
            let bonus = item.baseEffect; for (let i = 1; i <= item.enhancement; i++) { bonus += item.baseEffect * (i <= 10 ? 0.1 : 0.5); }
            effectText = `⚔️공격력 +${(bonus * 100).toFixed(1)}%`;
        } else if (item.type === 'armor') {
            let bonus = item.baseEffect; for (let i = 1; i <= item.enhancement; i++) { bonus += item.baseEffect * (i <= 10 ? 0.1 : 0.5); }
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
    const quantityText = item.quantity > 1 ? `<div class="item-quantity">x${item.quantity}</div>` : '';
    const imageHTML = item.image ? `<div class="item-image"><img src="/image/${item.image}" alt="${item.name}" draggable="false"></div>` : '<div class="item-image"></div>';

    const effectHTML = effectText ? `<div class="item-effect">${effectText}</div>` : '';

    return `${imageHTML}<div class="item-info">${nameHTML}${effectHTML}</div>${quantityText}${enhanceText}`;
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
                <h2>${createFameUserHtml(player.username, player.fameScore || 0)}</h2>
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
                    <div class="slot">${weaponHTML}</div>
                    <div class="slot">${armorHTML}</div>
                    <div class="slot">${petHTML}</div>
                    <div class="slot">${necklaceHTML}</div>
                    <div class="slot">${earringHTML}</div>
                    <div class="slot">${wristwatchHTML}</div>
                </div>
                <div class="artifact-sockets" style="margin-top: 15px;">${artifactSocketsHTML}</div>
            </div>
        </div>
    `;
}

 function closePetChoiceModal() {
        elements.petChoice.overlay.style.display = 'none';
        selectedPetChoiceUid = null;
    }

function initializeGame(socket) {
let quillEditor = null;
 let currentBoardCategory = '자유';
    let currentBoardPage = 1;
    let currentPostId = null; 

    const elements = {
        gold: document.getElementById('gold'),
        player: { 
            panel: document.querySelector('.player-panel'), 
            hpBar: document.getElementById('player-hp-bar'), 
            hpText: document.getElementById('player-hp-text'), 
            totalHp: document.getElementById('total-hp'), 
            totalAttack: document.getElementById('total-attack'), 
            totalDefense: document.getElementById('total-defense'),
            critChance: document.getElementById('crit-chance'),
            critResistance: document.getElementById('crit-resistance') 
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
            icon: document.getElementById('fame-icon')
        },
        incubator: {
            content: document.getElementById('incubator-content'),
            slot: document.getElementById('incubator-slot'),
            hatchButton: document.getElementById('hatch-button'),
            hatchingInfo: document.getElementById('hatching-info'),
            progressBar: document.getElementById('hatch-progress-bar'),
            timer: document.getElementById('hatch-timer'),
        },
        explorationButton: document.getElementById('exploration-button'),
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
            online: { button: document.getElementById('online-users-button'), overlay: document.getElementById('online-users-modal'), list: document.getElementById('online-users-list'), },
            mailbox: { 
                button: document.getElementById('mailbox-button'), 
                overlay: document.getElementById('mailbox-modal'), 
                list: document.getElementById('mailbox-list'), 
                claimAllBtn: document.getElementById('mailbox-claim-all-btn')
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
        petChoice: {
            overlay: document.getElementById('pet-choice-modal'),
            title: document.getElementById('pet-choice-title'),
            equipBtn: document.getElementById('pet-choice-equip-btn'),
            fusionBtn: document.getElementById('pet-choice-fusion-btn'),
            closeBtn: document.querySelector('#pet-choice-modal .close-button')
        }
    };
    
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

 document.querySelectorAll('.modal-overlay').forEach(modal => { 
        const closeBtn = modal.querySelector('.close-button');
        if(closeBtn) {
            closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
        }
        modal.addEventListener('click', (e) => { 
            if (e.target === modal && modal.id !== 'board-modal') { 
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
    
    elements.petChoice.overlay.addEventListener('click', (e) => {
        if (e.target === elements.petChoice.overlay) {
            closePetChoiceModal();
        }
    });

    elements.modals.ranking.button.addEventListener('click', () => { socket.emit('requestRanking'); elements.modals.ranking.overlay.style.display = 'flex'; });
    elements.modals.loot.button.addEventListener('click', () => { elements.modals.loot.overlay.style.display = 'flex'; });
    elements.modals.enhancement.button.addEventListener('click', () => { elements.modals.enhancement.overlay.style.display = 'flex'; });
    elements.modals.online.button.addEventListener('click', () => { socket.emit('requestOnlineUsers'); elements.modals.online.overlay.style.display = 'flex'; });
    
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
    
    elements.inventory.pet.addEventListener('click', (e) => {
        const card = e.target.closest('.inventory-item');
        if (!card) return;

        const uid = card.dataset.uid;
        const item = findItemInState(uid);

        if (!item || item.type !== 'pet') return;

        if (item.grade === 'Epic' && !item.fused) {
            selectedPetChoiceUid = uid;
            elements.petChoice.title.textContent = `[${item.name}] 어떻게 할까요?`;
            elements.petChoice.overlay.style.display = 'flex';
        } else {
            handleItemSelection(e);
        }
    });

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

    elements.modals.board.button.addEventListener('click', () => {
        elements.modals.board.overlay.style.display = 'flex';
        fetchAndRenderPosts(currentBoardCategory, currentBoardPage);
    });

    elements.board.tabs.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            currentBoardCategory = e.target.dataset.category;
            currentBoardPage = 1;
            elements.board.tabs.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            fetchAndRenderPosts(currentBoardCategory, currentBoardPage);
        }
    });

    elements.board.postList.addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        if (row && row.dataset.postId) {
            fetchAndRenderPostDetail(row.dataset.postId);
        }
    });

    elements.board.pagination.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON' && !e.target.disabled) {
            currentBoardPage = parseInt(e.target.dataset.page, 10);
            fetchAndRenderPosts(currentBoardCategory, currentBoardPage);
        }
    });
    
    const backToListButtons = document.querySelectorAll('.js-board-back-to-list');
    
backToListButtons.forEach(button => {
    button.addEventListener('click', () => {
        showBoardView('list');
    });
});

const backArrowBtn = document.getElementById('board-back-arrow-btn');
backArrowBtn.addEventListener('click', () => showBoardView('list'));

 elements.board.writePostBtn.addEventListener('click', () => {
    const postCategorySelect = elements.board.postCategory;

    postCategorySelect.innerHTML = '<option value="자유">자유</option><option value="공략">공략</option>';

    const token = localStorage.getItem('jwt_token');
    if (token) {
        const decoded = decodeJwtPayload(token);
        if (decoded && decoded.role === 'admin') {
 
            postCategorySelect.insertAdjacentHTML('afterbegin', '<option value="공지">공지</option>');
        }
    }

    if (!quillEditor) {
        quillEditor = new Quill('#editor-container', {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['link'] 
                ]
            }
        });
    }


    elements.board.postForm.reset();
    elements.board.postEditId.value = '';
    quillEditor.root.innerHTML = '';
    elements.board.postSubmitBtn.textContent = '등록하기';
    showBoardView('write');
});
    
    elements.board.cancelBtn.addEventListener('click', () => showBoardView('list'));

    elements.board.postContentArea.addEventListener('click', (e) => {
        const action = e.target.id;

 if (action === 'post-edit-btn') {
        socket.emit('board:getPost', { postId: currentPostId }, (post) => {
            if (!post) return;
            showBoardView('write');
            elements.board.postEditId.value = post._id;
            elements.board.postCategory.value = post.category;
            elements.board.postTitle.value = post.title;
            elements.board.postSubmitBtn.textContent = '수정하기';
            if (!quillEditor) {
                quillEditor = new Quill('#editor-container', {
                    theme: 'snow',
                    modules: {
                        toolbar: [
                            [{ 'header': [1, 2, 3, false] }],
                            ['bold', 'italic', 'underline', 'strike'],
                            [{ 'color': [] }, { 'background': [] }],
                            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                            ['link', 'image']
                        ]
                    }
                });
            }
            quillEditor.root.innerHTML = post.content;
        });
    } 
         else if (action === 'post-delete-btn') {
            if (confirm('정말로 이 게시글을 삭제하시겠습니까?')) {
                socket.emit('board:deletePost', { postId: currentPostId }, (success) => {
                    if (success) fetchAndRenderPosts(currentBoardCategory, currentBoardPage);
                    else alert('삭제에 실패했습니다.');
                });
            }
        } else if (action === 'post-like-btn') {
            socket.emit('board:likePost', { postId: currentPostId }, ({ likesCount }) => {
                if (likesCount !== null) e.target.textContent = `👍 추천 ${likesCount}`;
            });
        }
    });
    
    elements.board.commentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const content = elements.board.commentInput.value.trim();
        if (content && currentPostId) {
            socket.emit('board:createComment', { postId: currentPostId, content }, (success) => {
                if (success) {
                    elements.board.commentInput.value = '';
                    fetchAndRenderPostDetail(currentPostId);
                } else {
                    alert('댓글 작성에 실패했습니다.');
                }
            });
        }
    });
    
    elements.board.commentList.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        if (!action) return;
        
        const commentItem = e.target.closest('.comment-item');
        const commentId = commentItem.dataset.commentId;

        if (action === 'delete-comment') {
            if (confirm('정말로 이 댓글을 삭제하시겠습니까?')) {
                socket.emit('board:deleteComment', { postId: currentPostId, commentId }, (success) => {
                    if (success) fetchAndRenderPostDetail(currentPostId);
                    else alert('댓글 삭제에 실패했습니다.');
                });
            }
        } else if (action === 'like-comment') {
            socket.emit('board:likeComment', { postId: currentPostId, commentId }, ({ likesCount }) => {
                 if (likesCount !== null) e.target.textContent = `👍 ${likesCount}`;
            });
        }
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
        const infoHTML = `
            <div class="item-name ${item.grade}">${item.enhancement > 0 ? `+${item.enhancement} ` : ''}${item.name}</div>
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
        const item      = listing.item;
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
socket.on('onlineUsersData', (players) => {
    const list = elements.modals.online.list; 
    if (!players || !players.length) {
        list.innerHTML = '<li>현재 접속 중인 유저가 없습니다.</li>';
        return;
    }
    list.innerHTML = players.map(p => {
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
        const allItems = [
            ...(currentPlayerState.inventory || []),
            ...(currentPlayerState.petInventory || []),
            currentPlayerState.equipment.weapon,
            currentPlayerState.equipment.armor,
            currentPlayerState.equippedPet
        ];
        return allItems.find(i => i && i.uid === uid);
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

    const updateUI = ({ player, monster }) => {

        currentPlayerState = player;
        const fameDetails = getFameDetails(player.fameScore);
elements.userInfo.icon.textContent = fameDetails.icon;
elements.userInfo.username.textContent = player.username;
elements.userInfo.username.className = fameDetails.className;
        if (elements.gold.textContent !== formatInt(player.gold)) { elements.gold.textContent = formatInt(player.gold); }
        elements.player.hpBar.style.width = `${(player.currentHp / player.stats.total.hp) * 100}%`;
        elements.player.hpText.textContent = `${formatFloat(player.currentHp)} / ${formatFloat(player.stats.total.hp)}`;
        elements.player.totalHp.textContent = formatFloat(player.stats.total.hp);
        elements.player.totalAttack.textContent = formatFloat(player.stats.total.attack);
        elements.player.totalDefense.textContent = formatFloat(player.stats.total.defense);
elements.player.critChance.textContent = `${(player.stats.critChance * 100).toFixed(2)}%`;
elements.player.critResistance.textContent = `${(player.stats.critResistance * 100).toFixed(2)}%`;
        if (player.isExploring) {
            elements.monster.level.innerHTML = `<span style="color:var(--fail-color); font-weight:bold;">탐험 중</span>`;
            elements.monster.hpBar.style.width = `100%`;
            elements.monster.hpText.textContent = `1 / 1`;
            elements.monster.totalHp.textContent = `1`;
            elements.monster.attack.textContent = `0`;
            elements.monster.defense.textContent = `0`;
            elements.explorationButton.textContent = '등반하기';
            elements.explorationButton.className = 'climb';
        } else {
            elements.monster.level.innerHTML = monster.isBoss ? `<span style="color:var(--fail-color); font-weight:bold;">${formatInt(monster.level)}층 보스</span>` : `${formatInt(monster.level)}층 몬스터`;
            elements.monster.hpBar.style.width = `${(monster.currentHp / monster.hp) * 100}%`;
            elements.monster.hpText.textContent = `${formatFloat(monster.currentHp)} / ${formatFloat(monster.hp)}`;
            elements.monster.totalHp.textContent = formatFloat(monster.hp);
            elements.monster.attack.textContent = formatFloat(monster.attack);
            elements.monster.defense.textContent = formatFloat(monster.defense);
            elements.explorationButton.textContent = '탐험하기';
            elements.explorationButton.className = 'explore';
        }

 const buffsContainer = document.getElementById('player-buffs-container');
    buffsContainer.innerHTML = ''; 
    if (player.buffs && player.buffs.length > 0) {
        player.buffs.forEach(buff => {
            const remainingTime = Math.max(0, Math.floor((new Date(buff.endTime) - new Date()) / 1000));
            buffsContainer.innerHTML += `
                <div class="buff-icon" title="${buff.name}">
                    ✨ 각성 (${remainingTime}초)
                </div>
            `;
        });
    }

        renderItemInSlot(elements.equipment.weapon, player.equipment.weapon, '⚔️<br>무기', 'weapon');
        renderItemInSlot(elements.equipment.armor, player.equipment.armor, '🛡️<br>방어구', 'armor');
        renderItemInSlot(elements.equipment.pet, player.equippedPet, '🐾<br>펫', 'pet');
renderItemInSlot(elements.equipment.necklace, player.equipment.necklace, '💍<br>목걸이', 'necklace');
renderItemInSlot(elements.equipment.earring, player.equipment.earring, '👂<br>귀걸이', 'earring');
renderItemInSlot(elements.equipment.wristwatch, player.equipment.wristwatch, '⏱️<br>손목시계', 'wristwatch');
        
        elements.artifactSockets.innerHTML = player.unlockedArtifacts.map(artifact => artifact ? `<div class="artifact-socket unlocked" title="${artifact.name}: ${artifact.description}"><img src="/image/${artifact.image}" alt="${artifact.name}"></div>` : `<div class="artifact-socket" title="비활성화된 유물 소켓"><img src="/image/socket_locked.png" alt="잠김"></div>`).join('');
const renderGrid = (items) => items.map(item => {
    const itemType = (item.type === 'accessory') ? item.accessoryType : item.type;
    return `<div class="inventory-item ${getEnhanceClass(item.enhancement)} ${selectedInventoryItemUid === item.uid ? 'selected' : ''}" data-uid="${item.uid}" draggable="true" data-item-type="${itemType}">${createItemHTML(item)}</div>`;
}).join('');

elements.inventory.weapon.innerHTML = renderGrid(player.inventory.filter(i => i.type === 'weapon'));
elements.inventory.armor.innerHTML = renderGrid(player.inventory.filter(i => i.type === 'armor'));
elements.inventory.accessory.innerHTML = renderGrid(player.inventory.filter(i => i.type === 'accessory'));
elements.inventory.item.innerHTML = renderGrid(player.inventory.filter(i => i.type !== 'weapon' && i.type !== 'armor' && i.type !== 'accessory'));
elements.inventory.pet.innerHTML = renderGrid(player.petInventory);
        renderIncubator(player.incubator);
renderFusionPanel(player);
        elements.log.innerHTML = player.log.map(msg => `<li>${msg}</li>`).join('');
elements.modals.mailbox.button.classList.toggle('new-mail', player.hasUnreadMail);
        updateAffordableButtons();
    };

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
    const updateAffordableButtons = () => { if (!currentPlayerState) return; ['hp', 'attack', 'defense'].forEach(stat => { const base = currentPlayerState.stats.base[stat]; const gold = currentPlayerState.gold; const costN = n => [...Array(n).keys()].reduce((s, i) => s + base + i, 0); const affordable = { 1: gold >= base, 10: gold >= costN(10), 100: gold >= costN(100), MAX: gold >= base, }; document.querySelectorAll(`.stat-row[data-stat-row="${stat}"] .upgrade-btn`).forEach(btn => { btn.classList.toggle('affordable', affordable[btn.dataset.amount]); }); }); 




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

   function updateInteractionPanel(overrideItem = null) {
    const item = overrideItem || findItemInState(selectedInventoryItemUid);
    const { details, slot, before, after, info, button, checkboxes, useTicketCheck, useHammerCheck } = elements.enhancement;
    if (!item) {
        slot.innerHTML = '강화 또는 사용할 아이템을<br>인벤토리/장비창에서 선택하세요';
        details.style.display = 'none';
        button.style.display = 'none';
        checkboxes.style.display = 'none';
        info.innerHTML = '';
        return;
    }

    const isEnhanceable = item.type === 'weapon' || item.type === 'armor';

    details.style.display = isEnhanceable ? 'flex' : 'none';
    button.style.display = isEnhanceable ? 'block' : 'none';
    checkboxes.style.display = isEnhanceable ? 'flex' : 'none';

    slot.innerHTML = createEnhancementItemHTML(item); 

    let infoContentHTML = '';
    let buttonsHTML = '<div class="interaction-buttons" style="justify-content: center; width: 100%; flex-wrap: wrap; gap: 10px;">';


    if (item.type === 'weapon' || item.type === 'armor' || item.type === 'pet' || item.type === 'accessory') {

        const isEquipped = (currentPlayerState.equipment.weapon?.uid === item.uid) || 
                           (currentPlayerState.equipment.armor?.uid === item.uid) ||
                           (currentPlayerState.equipment.necklace?.uid === item.uid) ||
                           (currentPlayerState.equipment.earring?.uid === item.uid) ||
                           (currentPlayerState.equipment.wristwatch?.uid === item.uid) ||
                           (currentPlayerState.equippedPet?.uid === item.uid);
        
        if (!isEquipped) {
            buttonsHTML += `<button class="action-btn equip-btn" data-action="equip">✔️ 장착하기</button>`;
        }
    }

        if (isEnhanceable) {
            const bonusArr = Array.from({ length: item.enhancement }, (_, i) => item.baseEffect * (i < 10 ? 0.1 : 0.5));
            const currentBonus = bonusArr.reduce((s, v) => s + v, item.baseEffect);
            const nextBonus = currentBonus + item.baseEffect * (item.enhancement < 10 ? 0.1 : 0.5);
            before.innerHTML = `<b>+${item.enhancement}</b><br>${(currentBonus * 100).toFixed(1)}%`;
            after.innerHTML = `<b>+${item.enhancement + 1}</b><br>${(nextBonus * 100).toFixed(1)}%`;
            const cost = Math.floor(1000 * Math.pow(2.1, item.enhancement));
            button.disabled = currentPlayerState.gold < cost;

            const isEquipped = currentPlayerState.equipment.weapon?.uid === item.uid || currentPlayerState.equipment.armor?.uid === item.uid;
            if (!isEquipped) {
                const sellPrice = getSellPrice(item);
                buttonsHTML += `<button class="action-btn sell-btn" data-action="sell" data-sell-all="false">1개 판매 (${sellPrice.toLocaleString()} G)</button>`;
                if (item.enhancement === 0 && item.quantity > 1) {
                    buttonsHTML += `<button class="action-btn sell-btn" data-action="sell" data-sell-all="true">전체 판매 (${(sellPrice * item.quantity).toLocaleString()} G)</button>`;
                }
            }
            
            if (item.tradable !== false) {
                buttonsHTML += `<button class="action-btn list-auction-btn" data-action="list-auction">거래소 등록</button>`;
            }
            
            if (enhancementRates) {
                const rates = enhancementRates.enhancementTable[item.enhancement + 1] || enhancementRates.highEnhancementRate;

                let displaySuccess = rates.success;
                let displayMaintain = rates.maintain;
                let displayFail = rates.fail;
                let displayDestroy = rates.destroy;

                if (useHammerCheck.checked && !useHammerCheck.disabled) {
                    let bonusToApply = 0.15;
                    
                    const fromDestroy = Math.min(bonusToApply, displayDestroy);
                    displayDestroy -= fromDestroy;
                    bonusToApply -= fromDestroy;

                    if (bonusToApply > 0) {
                        const fromFail = Math.min(bonusToApply, displayFail);
                        displayFail -= fromFail;
                        bonusToApply -= fromFail;
                    }
                    if (bonusToApply > 0) {
                        const fromMaintain = Math.min(bonusToApply, displayMaintain);
                        displayMaintain -= fromMaintain;
                        bonusToApply -= fromMaintain;
                    }
                    displaySuccess += (0.15 - bonusToApply);
                }

                const probText = `<span style="color:var(--success-color)">성공: ${(displaySuccess * 100).toFixed(1)}%</span> | <span>유지: ${(displayMaintain * 100).toFixed(1)}%</span> | <span style="color:var(--fail-color)">하락: ${(displayFail * 100).toFixed(1)}%</span> | <span style="color:var(--fail-color); font-weight:bold;">파괴: ${(displayDestroy * 100).toFixed(1)}%</span>`;
                infoContentHTML += `<div style="text-align: center; margin-bottom: 10px; font-size: 0.9em;">${probText}</div>`;
            }

            infoContentHTML += `<div style="width: 100%; text-align: center;">강화 비용: ${formatInt(cost)} G</div>`;
         
            const hasTicket = currentPlayerState.inventory.some(i => i.id === 'prevention_ticket');
            useTicketCheck.disabled = !(item.enhancement >= 10 && hasTicket);

            const hasHammer = currentPlayerState.inventory.some(i => i.id === 'hammer_hephaestus');
            useHammerCheck.disabled = !hasHammer;

        } else {
            if (item.id === 'hammer_hephaestus' || item.id === 'prevention_ticket') {
                buttonsHTML += `<div style="text-align:center; color: var(--text-muted);">강화 탭에서 체크하여 사용합니다.</div>`;
            } else {
                const isEgg = item.category === 'Egg' || item.type === 'egg';
                if (isEgg) {
                    buttonsHTML += `<button class="action-btn use-item-btn" data-action="hatch">부화하기</button>`;
                } else if (['Tome', 'Consumable'].includes(item.category)){
                    buttonsHTML += `<button class="action-btn use-item-btn" data-action="use">사용하기</button>`;
                    if (item.id === 'gold_pouch' && item.quantity > 1) {
                        buttonsHTML += `<button class="action-btn use-item-btn" data-action="use-all">모두 사용</button>`;
                    }
                }
            }
            if (item.tradable !== false) {
                buttonsHTML += `<button class="action-btn list-auction-btn" data-action="list-auction">거래소 등록</button>`;
            }
        }
        
        buttonsHTML += '</div>';
        info.innerHTML = infoContentHTML + buttonsHTML;
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
    const player = currentPlayerState;
    const monster = data.monster;

    elements.gold.textContent = formatInt(player.gold);

    elements.player.hpBar.style.width = `${(player.currentHp / player.stats.total.hp) * 100}%`;
    elements.player.hpText.textContent = `${formatFloat(player.currentHp)} / ${formatFloat(player.stats.total.hp)}`;
    elements.player.totalHp.textContent = formatFloat(player.stats.total.hp);
    elements.player.totalAttack.textContent = formatFloat(player.stats.total.attack);
    elements.player.totalDefense.textContent = formatFloat(player.stats.total.defense);
    elements.player.critChance.textContent = `${(player.stats.critChance * 100).toFixed(2)}%`;
    elements.player.critResistance.textContent = `${(player.stats.critResistance * 100).toFixed(2)}%`;


    if (player.isExploring) {
        elements.monster.level.innerHTML = `<span style="color:var(--fail-color); font-weight:bold;">탐험 중</span>`;
        elements.monster.hpBar.style.width = `100%`;
        elements.monster.hpText.textContent = `1 / 1`;
        elements.monster.totalHp.textContent = `1`;
        elements.monster.attack.textContent = `0`;
        elements.monster.defense.textContent = `0`;
    } else {
        elements.monster.level.innerHTML = monster.isBoss ? `<span style="color:var(--fail-color); font-weight:bold;">${formatInt(monster.level)}층 보스</span>` : `${formatInt(monster.level)}층 몬스터`;
        elements.monster.hpBar.style.width = `${(monster.currentHp / monster.hp) * 100}%`;
        elements.monster.hpText.textContent = `${formatFloat(monster.currentHp)} / ${formatFloat(monster.hp)}`;
        elements.monster.totalHp.textContent = formatFloat(monster.hp);
        elements.monster.attack.textContent = formatFloat(monster.attack);
        elements.monster.defense.textContent = formatFloat(monster.defense);
    }
    

    const buffsContainer = document.getElementById('player-buffs-container');
    buffsContainer.innerHTML = ''; 
    if (player.buffs && player.buffs.length > 0) {
        player.buffs.forEach(buff => {
            const remainingTime = Math.max(0, Math.floor((new Date(buff.endTime) - new Date()) / 1000));
            buffsContainer.innerHTML += `
                <div class="buff-icon" title="${buff.name}">
                    ✨ 각성 (${remainingTime}초)
                </div>
            `;
        });
    }

    updateEquipmentAndArtifacts(player);
    elements.modals.mailbox.button.classList.toggle('new-mail', player.hasUnreadMail);
updateAffordableButtons(); 
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
        if (currentPlayerState.isExploring) { const m = elements.monster.panel; m.classList.add('hit-flash'); setTimeout(() => m.classList.remove('hit-flash'), 100);
        } else {
            if (damages.playerTook > 0) { const p = elements.player.panel; p.classList.add('hit-flash'); setTimeout(() => p.classList.remove('hit-flash'), 100); } 
            if (damages.monsterTook > 0) { const m = elements.monster.panel; m.classList.add('hit-flash'); setTimeout(() => m.classList.remove('hit-flash'), 100); }
        }
    });
    
    socket.on('enhancementResult', d => {
        playEnhancementAnimation(d.result);
        if (d.newItem) {
            selectedInventoryItemUid = d.newItem.uid;
            updateInteractionPanel(d.newItem);
        } else {
            selectedInventoryItemUid = null;
            updateInteractionPanel();
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
            updateInteractionPanel();
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
        });
    });

function handleItemSelection(e) {
    const card = e.target.closest('.inventory-item');

    if (!card || card.closest('#auction-grid') || card.closest('.equipment-slots')) return;

    const uid = card.dataset.uid;

    selectedInventoryItemUid = uid;
    document.querySelector('.tab-button[data-tab="enhancement-tab"]').click();

    setTimeout(() => {
        selectedInventoryItemUid = uid;
        const updatedItem = findItemInState(uid);
        if (updatedItem) {
            document.querySelectorAll('.inventory-item.selected').forEach(el => el.classList.remove('selected'));

            const visibleCard = document.querySelector(`.inventory-item[data-uid="${uid}"]`);
            if (visibleCard) {
                visibleCard.classList.add('selected');
            }
            
            updateInteractionPanel(updatedItem);
        }
    }, 10);
}
    document.querySelector('.management-panel').addEventListener('click', handleItemSelection);

  elements.enhancement.anvil.addEventListener('click', (e) => {
    const target = e.target;
    const action = target.dataset.action;
    if (!action || !selectedInventoryItemUid) return;

    const item = findItemInState(selectedInventoryItemUid);
    if (!item) return;

    switch (action) {
        case 'equip':
            if (item.type === 'pet') {
                socket.emit('equipPet', selectedInventoryItemUid);
            } else {
                socket.emit('equipItem', selectedInventoryItemUid);
            }
            alert(`[${item.name}] 을(를) 장착했습니다.`);
            selectedInventoryItemUid = null;
            updateInteractionPanel();
            break;

        case 'sell':
            if (confirm("상점에 판매하면 거래소보다 낮은 가격을 받습니다. 정말 판매하시겠습니까?")) {
                socket.emit('sellItem', { uid: selectedInventoryItemUid, sellAll: target.dataset.sellAll === 'true' });
                alert('아이템을 판매했습니다.');
                selectedInventoryItemUid = null;
                updateInteractionPanel(); 
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
                updateInteractionPanel();
            } else {
alert(`등록 실패!: ${response.message}`);
            }
        });
    } else if (price !== null) {
        alert("올바른 가격을 입력해주세요.");
    }
    break;

         case 'use':
    { 
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
        updateInteractionPanel();
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
                updateInteractionPanel();
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

    elements.enhancement.useHammerCheck.addEventListener('change', () => {
        if(selectedInventoryItemUid) {
            updateInteractionPanel();
        }
    });
    
    elements.enhancement.useTicketCheck.addEventListener('change', () => {
        if(selectedInventoryItemUid) {
            updateInteractionPanel();
        }
    });

    elements.incubator.hatchButton.addEventListener('click', () => { if (currentPlayerState && currentPlayerState.incubator.egg) { socket.emit('startHatching'); } });
    elements.explorationButton.addEventListener('click', () => socket.emit('toggleExploration'));
    
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
        slot.addEventListener('dblclick', (e) => {
            const slotType = e.currentTarget.dataset.slot;
            if(slotType === 'pet'){ 
                socket.emit('unequipPet'); 
            } else if (slotType) {
                socket.emit('unequipItem', slotType); 
            }
        });


     slot.addEventListener('click', () => {
            const slotType = slot.dataset.slot;
            if (slotType !== 'pet' && currentPlayerState.equipment[slotType]) {
                const item = currentPlayerState.equipment[slotType];

                document.querySelector('.tab-button[data-tab="enhancement-tab"]').click();
                

                setTimeout(() => {
                    selectedInventoryItemUid = item.uid;
                   
                    updateInteractionPanel(item);
                }, 50);
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
    socket.on('worldBossDefeated', () => { elements.worldBoss.container.style.display = 'none'; selectedInventoryItemUid = null; updateInteractionPanel(); });
    function updateWorldBossUI(bossState) {
        if (!bossState || !currentPlayerState) return;
        elements.worldBoss.name.textContent = `🔥 ${bossState.name} 🔥`;
        const currentHp = bossState.currentHp || 0; const maxHp = bossState.maxHp || 1; const hpPercent = (currentHp / maxHp) * 100;
        elements.worldBoss.hpBar.style.width = `${hpPercent}%`;
        elements.worldBoss.hpText.textContent = `${formatInt(currentHp)} / ${formatInt(maxHp)}`;
        const myId = currentPlayerState.user.toString(); const participantsObject = bossState.participants || {}; const myParticipantData = participantsObject[myId];
        const myContribution = myParticipantData ? (myParticipantData.damageDealt || 0) : 0;
        let totalContribution = Object.values(participantsObject).reduce((sum, p) => sum + (p.damageDealt || 0), 0);
        const myShare = totalContribution > 0 ? (myContribution / totalContribution) * 100 : 0;
        elements.worldBoss.contribution.textContent = `내 기여도: ${formatInt(myContribution)} (${myShare.toFixed(2)}%)`;
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
    const { type, username, role, message, isSystem, fameScore } = data;
    const item = document.createElement('li');

    if (isSystem) {
        item.classList.add('system-message');
        item.innerHTML = message;
    } else {
        item.classList.add(`${type || 'user'}-message`);
        const usernameSpan = document.createElement('span');
        usernameSpan.classList.add('username');

        usernameSpan.dataset.username = username;
        usernameSpan.style.cursor = 'pointer';

        const messageSpan = document.createElement('span');
        messageSpan.classList.add('message');

        const userHtml = createFameUserHtml(username, fameScore || 0);

        if (role === 'admin') {
            item.classList.add('admin-message');
            usernameSpan.innerHTML = `👑 ${userHtml}:`;
        } else {
            usernameSpan.innerHTML = `${userHtml}:`;
        }

        if (type === 'announcement') {
            item.classList.add('announcement-message');
            messageSpan.innerHTML = `📢 ${message}`;
            if (role === 'admin') {
                usernameSpan.innerHTML = `[공지] 👑 ${userHtml}:`;
            } else {
                usernameSpan.innerHTML = `[공지] ${userHtml}:`;
            }
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
   let announcementTimer = null;
    elements.announcementBanner.addEventListener('click', (e) => {
        if (e.target.id === 'announcement-close-btn') {
            elements.announcementBanner.classList.remove('active');
            if (announcementTimer) {
                clearTimeout(announcementTimer);
            }
        }
    });

    socket.on('globalAnnouncement', (notice) => {
        const banner = elements.announcementBanner;
        if (banner) {
            if (announcementTimer) {
                clearTimeout(announcementTimer);
            }
            banner.innerHTML = `📢 ${notice} <span id="announcement-close-btn">&times;</span>`;
            banner.classList.add('active');
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

const token = localStorage.getItem('jwt_token');
if (token) {
    startApp(token);
} else {
    document.body.classList.add('auth-view');
    authContainer.style.display = 'flex';
}



}); 
