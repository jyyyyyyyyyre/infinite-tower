const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    pingInterval: 25000,
    pingTimeout: 80000,
});

const PORT = 3000;
const TICK_RATE = 1000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_OBJECT_ID = '685ff341faad66a3f7d58a96';
const BOSS_INTERVAL = 100;
const SELL_PRICES = { // 등급별 아이템 판매 가격
    Common: 3000,
    Rare: 50000,
    Legendary: 400000,
    Epic: 2000000,
    Mystic: 100000000,
};
// ------------------------------

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('MongoDB 데이터베이스에 성공적으로 연결되었습니다.');
        loadGlobalRecords();
    })
    .catch(err => console.error('MongoDB 연결 오류:', err));

app.use(express.json());
app.use(express.static('public'));
app.use('/image', express.static('image'));
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

const itemData = { w001: { name: '낡은 단검', type: 'weapon', grade: 'Common', baseEffect: 0.05, image: 'sword1.png' }, a001: { name: '가죽 갑옷', type: 'armor', grade: 'Common', baseEffect: 0.05, image: 'armor1.png' }, w002: { name: '강철 검', type: 'weapon', grade: 'Rare', baseEffect: 0.12, image: 'sword2.png' }, a002: { name: '판금 갑옷', type: 'armor', grade: 'Rare', baseEffect: 0.12, image: 'armor2.png' }, w003: { name: '용살자 대검', type: 'weapon', grade: 'Legendary', baseEffect: 0.25, image: 'sword3.png' }, a003: { name: '수호자의 갑주', type: 'armor', grade: 'Legendary', baseEffect: 0.25, image: 'armor3.png' }, w004: { name: '지배자의 롱소드', type: 'weapon', grade: 'Epic', baseEffect: 0.50, image: 'sword4.png' }, a004: { name: '영겁의 흉갑', type: 'armor', grade: 'Epic', baseEffect: 0.50, image: 'armor4.png' }, w005: { name: '태초의 파편', type: 'weapon', grade: 'Mystic', baseEffect: 2.50, image: 'sword5.png' }, a005: { name: '세계수의 심장', type: 'armor', grade: 'Mystic', baseEffect: 2.50, image: 'armor5.png' }, };
const dropTable = { 1: { itemsByGrade: { Common: ['w001', 'a001'] }, rates: { Common: 0.98, Rare: 0.02 } }, 2: { itemsByGrade: { Common: ['w001', 'a001'], Rare: ['w002', 'a002'], Legendary: ['w003', 'a003'] }, rates: { Common: 0.90, Rare: 0.09, Legendary: 0.01 } }, 3: { itemsByGrade: { Common: ['w001', 'a001'], Rare: ['w002', 'a002'], Legendary: ['w003', 'a003'], Epic: ['w004', 'a004'] }, rates: { Common: 0.78, Rare: 0.16, Legendary: 0.055, Epic: 0.005 } }, 4: { itemsByGrade: { Common: ['w001', 'a001'], Rare: ['w002', 'a002'], Legendary: ['w003', 'a003'], Epic: ['w004', 'a004'], Mystic: ['w005', 'a005'] }, rates: { Common: 0.65, Rare: 0.25, Legendary: 0.09, Epic: 0.0098, Mystic: 0.0002 } }, };
const enhancementTable = { 1: { success: 1.00, maintain: 0.00, fail: 0.00, destroy: 0.00 }, 2: { success: 1.00, maintain: 0.00, fail: 0.00, destroy: 0.00 }, 3: { success: 1.00, maintain: 0.00, fail: 0.00, destroy: 0.00 }, 4: { success: 1.00, maintain: 0.00, fail: 0.00, destroy: 0.00 }, 5: { success: 0.90, maintain: 0.10, fail: 0.00, destroy: 0.00 }, 6: { success: 0.80, maintain: 0.20, fail: 0.00, destroy: 0.00 }, 7: { success: 0.70, maintain: 0.25, fail: 0.05, destroy: 0.00 }, 8: { success: 0.50, maintain: 0.30, fail: 0.20, destroy: 0.00 }, 9: { success: 0.40, maintain: 0.40, fail: 0.20, destroy: 0.00 }, 10: { success: 0.30, maintain: 0.45, fail: 0.25, destroy: 0.00 }, 11: { success: 0.20, maintain: 0.00, fail: 0.00, destroy: 0.80 }, 12: { success: 0.15, maintain: 0.00, fail: 0.00, destroy: 0.85 }, 13: { success: 0.15, maintain: 0.00, fail: 0.00, destroy: 0.85 }, 14: { success: 0.15, maintain: 0.00, fail: 0.00, destroy: 0.85 }, 15: { success: 0.15, maintain: 0.00, fail: 0.00, destroy: 0.85 } };
const highEnhancementRate = { success: 0.10, maintain: 0.90, fail: 0.00, destroy: 0.00 };

const UserSchema = new mongoose.Schema({ username: { type: String, required: true, unique: true, trim: true }, password: { type: String, required: true } });
const GameDataSchema = new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, username: { type: String, required: true }, gold: { type: Number, default: 0 }, level: { type: Number, default: 1 }, maxLevel: { type: Number, default: 1 }, maxWeaponEnhancement: { type: Number, default: 0 }, maxWeaponName: { type: String, default: '' }, maxArmorEnhancement: { type: Number, default: 0 }, maxArmorName: { type: String, default: '' }, stats: { base: { hp: { type: Number, default: 100 }, attack: { type: Number, default: 1 }, defense: { type: Number, default: 1 } } }, inventory: { type: [Object], default: [] }, equipment: { weapon: { type: Object, default: null }, armor: { type: Object, default: null } }, log: { type: [String], default: ["'무한의 탑'에 오신 것을 환영합니다!"] } });
const GlobalRecordSchema = new mongoose.Schema({ recordType: { type: String, required: true, unique: true }, username: { type: String }, itemName: { type: String }, itemGrade: { type: String }, enhancementLevel: { type: Number }, updatedAt: { type: Date, default: Date.now } });
const ChatMessageSchema = new mongoose.Schema({ type: { type: String, default: 'user' }, username: { type: String, required: true }, role: { type: String, default: 'user' }, message: { type: String, required: true }, timestamp: { type: Date, default: Date.now } });

UserSchema.pre('save', async function(next) { if (!this.isModified('password')) return next(); this.password = await bcrypt.hash(this.password, 10); next(); });
UserSchema.methods.comparePassword = function(plainPassword) { return bcrypt.compare(plainPassword, this.password); };

const User = mongoose.model('User', UserSchema);
const GameData = mongoose.model('GameData', GameDataSchema);
const GlobalRecord = mongoose.model('GlobalRecord', GlobalRecordSchema);
const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema);

app.post('/api/register', async (req, res) => { try { const { username, password } = req.body; if (!username || !password) return res.status(400).json({ message: '아이디와 비밀번호를 모두 입력해주세요.' }); const existingUser = await User.findOne({ username }); if (existingUser) return res.status(409).json({ message: '이미 사용중인 아이디입니다.' }); const newUser = new User({ username, password }); await newUser.save(); const newGameData = new GameData({ user: newUser._id, username: newUser.username }); await newGameData.save(); res.status(201).json({ message: '회원가입에 성공했습니다!' }); } catch (error) { console.error('회원가입 오류:', error); res.status(500).json({ message: '서버 내부 오류가 발생했습니다.' }); } });
app.post('/api/login', async (req, res) => { try { const { username, password } = req.body; if (!username || !password) return res.status(400).json({ message: '아이디와 비밀번호를 모두 입력해주세요.' }); const user = await User.findOne({ username }); if (!user) return res.status(401).json({ message: '아이디 또는 비밀번호가 일치하지 않습니다.' }); const isMatch = await user.comparePassword(password); if (!isMatch) return res.status(401).json({ message: '아이디 또는 비밀번호가 일치하지 않습니다.' }); const payload = { userId: user._id, username: user.username, }; if (user._id.toString() === ADMIN_OBJECT_ID) { payload.role = 'admin'; } const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '3h' }); res.json({ message: '로그인 성공!', token }); } catch (error) { console.error('로그인 오류:', error); res.status(500).json({ message: '서버 내부 오류가 발생했습니다.' }); } });

function createItemInstance(id) { const d = itemData[id]; return { uid: Date.now() + Math.random().toString(36).slice(2, 11), id, name: d.name, type: d.type, grade: d.grade, baseEffect: d.baseEffect, image: d.image, enhancement: 0, quantity: 1 }; }
function handleItemStacking(player, item) { if (item.enhancement > 0) { player.inventory.push(item); return; } const stack = player.inventory.find(i => i.id === item.id && i.enhancement === 0); stack ? stack.quantity++ : player.inventory.push(item); }
function computeEnhanceBonus(item) { let bonus = item.baseEffect; for (let i = 1; i <= item.enhancement; i++) { bonus += item.baseEffect * (i <= 10 ? 0.1 : 0.5); } return bonus; }
function calculateTotalStats(player) { if (!player || !player.stats) return; const base = player.stats.base; let weaponBonus = 0; let armorBonus = 0; if (player.equipment.weapon) { weaponBonus = computeEnhanceBonus(player.equipment.weapon); } if (player.equipment.armor) { armorBonus = computeEnhanceBonus(player.equipment.armor); } player.stats.total = { hp: base.hp * (1 + armorBonus), attack: base.attack * (1 + weaponBonus), defense: base.defense * (1 + armorBonus) }; }

const onlinePlayers = {};
let globalRecordsCache = {};

async function loadGlobalRecords() { try { const records = await GlobalRecord.find({}); records.forEach(record => { globalRecordsCache[record.recordType] = record; }); console.log('전역 최고 기록을 DB에서 로드했습니다.', globalRecordsCache); } catch (error) { console.error('전역 기록 로드 중 오류 발생:', error); } }
async function updateGlobalRecord(recordType, data) { try { const updatedRecord = await GlobalRecord.findOneAndUpdate({ recordType }, { $set: { ...data, updatedAt: new Date() } }, { new: true, upsert: true }); globalRecordsCache[recordType] = updatedRecord; io.emit('globalRecordsUpdate', globalRecordsCache); console.log(`[기록 갱신] ${recordType}:`, data.username, data.itemName || `+${data.enhancementLevel}강`); } catch (error) { console.error(`${recordType} 기록 업데이트 중 오류 발생:`, error); } }

io.use(async (socket, next) => { const token = socket.handshake.auth.token; if (!token) { return next(new Error('인증 오류: 토큰이 제공되지 않았습니다.')); } try { const decoded = jwt.verify(token, JWT_SECRET); socket.userId = decoded.userId; socket.username = decoded.username; socket.role = decoded.role || 'user'; next(); } catch (error) { return next(new Error('인증 오류: 유효하지 않은 토큰입니다.')); } });

io.on('connection', async (socket) => {
    if (onlinePlayers[socket.userId]) {
        const oldSocket = onlinePlayers[socket.userId].socket;
        oldSocket.emit('forceDisconnect', { message: '다른 기기 또는 탭에서 접속하여 연결을 종료합니다.' });
        oldSocket.disconnect(true);
    }
    console.log(`[연결] 유저: ${socket.username} (Role: ${socket.role})`);
    let gameData = await GameData.findOne({ user: socket.userId }).lean();
    if (!gameData) { console.error(`[오류] ${socket.username}의 게임 데이터를 찾을 수 없습니다.`); return socket.disconnect(); }
    onlinePlayers[socket.userId] = { ...gameData, monster: { currentHp: 1 }, socket: socket };
    calculateTotalStats(onlinePlayers[socket.userId]);
    if (!onlinePlayers[socket.userId].stats.total) onlinePlayers[socket.userId].stats.total = {};
    onlinePlayers[socket.userId].currentHp = onlinePlayers[socket.userId].stats.total.hp;

    const chatHistory = await ChatMessage.find().sort({ timestamp: -1 }).limit(50).lean();
    socket.emit('chatHistory', chatHistory.reverse());

    io.emit('chatMessage', { isSystem: true, message: `[알림] ${socket.username}님이 입장하셨습니다.` });

    socket.emit('initialGlobalRecords', globalRecordsCache);
    sendState(socket, onlinePlayers[socket.userId], calcMonsterStats(onlinePlayers[socket.userId]));

    socket
        .on('upgradeStat', data => upgradeStat(onlinePlayers[socket.userId], data))
        .on('equipItem', uid => equipItem(onlinePlayers[socket.userId], uid))
        .on('unequipItem', slot => unequipItem(onlinePlayers[socket.userId], slot))
        .on('attemptEnhancement', uid => attemptEnhancement(onlinePlayers[socket.userId], uid, socket))
        .on('sellItem', ({ uid, sellAll }) => sellItem(onlinePlayers[socket.userId], uid, sellAll)) // [수정] 아이템 판매 이벤트 리스너
        .on('requestRanking', async () => { try { const topLevel = await GameData.find({ maxLevel: { $gt: 1 } }).sort({ maxLevel: -1 }).limit(10).lean(); const topGold = await GameData.find({ gold: { $gt: 0 } }).sort({ gold: -1 }).limit(10).lean(); const topWeapon = await GameData.find({ maxWeaponEnhancement: { $gt: 0 } }).sort({ maxWeaponEnhancement: -1 }).limit(10).lean(); const topArmor = await GameData.find({ maxArmorEnhancement: { $gt: 0 } }).sort({ maxArmorEnhancement: -1 }).limit(10).lean(); socket.emit('rankingData', { topLevel, topGold, topWeapon, topArmor }); } catch (error) { console.error("랭킹 데이터 조회 오류:", error); } })
        .on('requestOnlineUsers', () => { const playersList = Object.values(onlinePlayers).map(p => ({ username: p.username, level: p.level, weapon: p.equipment.weapon ? { name: p.equipment.weapon.name, grade: p.equipment.weapon.grade } : null, armor: p.equipment.armor ? { name: p.equipment.armor.name, grade: p.equipment.armor.grade } : null, })).sort((a, b) => b.level - a.level); socket.emit('onlineUsersData', playersList); })
        .on('chatMessage', async (msg) => {
            if (typeof msg !== 'string' || msg.trim().length === 0) return;
            const trimmedMsg = msg.slice(0, 200);

            let messageData = {
                username: socket.username,
                role: socket.role,
                message: trimmedMsg,
            };

            if (socket.role === 'admin' && trimmedMsg.startsWith('/공지 ')) {
                const notice = trimmedMsg.substring(4).trim();
                if (notice) {
                    messageData.type = 'announcement';
                    messageData.message = notice;
                    console.log(`[전체 공지] ${socket.username}: ${notice}`);
                    io.emit('globalAnnouncement', notice);
                } else { return; }
            } else {
                console.log(`[채팅] ${socket.username}: ${trimmedMsg}`);
            }

            const newChatMessage = new ChatMessage(messageData);
            await newChatMessage.save();
            io.emit('chatMessage', newChatMessage);
        })
        .on('disconnect', () => {
            console.log(`[연결 해제] 유저: ${socket.username}`);
            io.emit('chatMessage', {
                isSystem: true,
                message: `[알림] ${socket.username}님이 퇴장하셨습니다.`
            });
            savePlayerData(socket.userId);
            delete onlinePlayers[socket.userId];
        });
});

// --- [신규] 보스 몬스터/아이템 판매 로직 ---

/**
 * 현재 층이 보스 층인지 확인합니다.
 * @param {number} level - 확인할 층 레벨
 * @returns {boolean} 보스 층이면 true, 아니면 false
 */
const isBossFloor = (level) => level > 0 && level % BOSS_INTERVAL === 0;

/**
 * 아이템을 판매하여 골드를 획득합니다.
 * @param {object} player - 플레이어 객체
 * @param {string} uid - 판매할 아이템의 고유 ID
 * @param {boolean} sellAll - 동일한 아이템을 모두 판매할지 여부
 */
function sellItem(player, uid, sellAll) {
    if (!player) return;

    // 장착 중인 아이템은 판매 불가
    if ((player.equipment.weapon && player.equipment.weapon.uid === uid) || 
        (player.equipment.armor && player.equipment.armor.uid === uid)) {
        pushLog(player, '[판매] 장착 중인 아이템은 판매할 수 없습니다.');
        return;
    }

    const itemIndex = player.inventory.findIndex(i => i.uid === uid);
    if (itemIndex === -1) {
        pushLog(player, '[판매] 인벤토리에서 아이템을 찾을 수 없습니다.');
        return;
    }

    const item = player.inventory[itemIndex];
    const price = SELL_PRICES[item.grade];

    if (typeof price !== 'number') {
        pushLog(player, `[판매] ${item.name} 등급의 아이템은 판매할 수 없습니다.`);
        return;
    }

    // 강화된 아이템 (스택 불가) 또는 1개만 판매
    if (item.enhancement > 0 || !sellAll) {
        if (item.quantity > 1) {
            item.quantity--;
        } else {
            player.inventory.splice(itemIndex, 1);
        }
        player.gold += price;
        pushLog(player, `[판매] ${item.name} 1개를 ${price.toLocaleString()} G에 판매했습니다.`);
    } 
    // 강화되지 않은 아이템 모두 판매
    else {
        const quantityToSell = item.quantity;
        const totalPrice = price * quantityToSell;
        player.inventory.splice(itemIndex, 1);
        player.gold += totalPrice;
        pushLog(player, `[판매] ${item.name} ${quantityToSell}개를 ${totalPrice.toLocaleString()} G에 판매했습니다.`);
    }
}

// ------------------------------------

function gameTick(player) {
    if (!player || !player.socket) return;
    calculateTotalStats(player);
    const m = calcMonsterStats(player);
    const pDmg = Math.max(0, player.stats.total.attack - m.defense);
    
    // [수정] 보스는 방어력을 무시하고 데미지를 입힘
    const mDmg = m.isBoss ? Math.max(0, m.attack) : Math.max(0, m.attack - player.stats.total.defense);

    if (pDmg > 0 || mDmg > 0) {
        player.currentHp -= mDmg;
        player.monster.currentHp -= pDmg;
        player.socket.emit('combatResult', { playerTook: mDmg, monsterTook: pDmg });
    }
    if (player.currentHp <= 0) {
        const deathMessage = m.isBoss ?
            `[${player.level}층 보스]에게 패배하여 1층으로 귀환합니다.` :
            `[${player.level}층] 몬스터에게 패배하여 1층으로 귀환합니다.`;
        resetPlayer(player, deathMessage);
    } else if (player.monster.currentHp <= 0) {
        player.level++;
        player.maxLevel = Math.max(player.maxLevel, player.level);
        onClearFloor(player);
        calculateTotalStats(player);
        player.currentHp = player.stats.total.hp;
        player.monster.currentHp = calcMonsterStats(player).hp;
    }
    sendState(player.socket, player, m);
}
setInterval(() => { for (const userId in onlinePlayers) { gameTick(onlinePlayers[userId]); } }, TICK_RATE);

async function savePlayerData(userId) { const p = onlinePlayers[userId]; if (!p) return; try { await GameData.updateOne({ user: userId }, { $set: { gold: p.gold, level: p.level, maxLevel: p.maxLevel, maxWeaponEnhancement: p.maxWeaponEnhancement, maxWeaponName: p.maxWeaponName, maxArmorEnhancement: p.maxArmorEnhancement, maxArmorName: p.maxArmorName, stats: p.stats, inventory: p.inventory, equipment: p.equipment, log: p.log } }); console.log(`[저장 완료] 유저: ${p.username}의 데이터를 DB에 저장했습니다.`); } catch (error) { console.error(`[저장 실패] 유저: ${p.username} 데이터 저장 중 오류 발생:`, error); } }
function sendState(socket, player, monsterStats) { if (!socket || !player) return; const { socket: _, ...playerStateForClient } = player; socket.emit('gameState', { player: playerStateForClient, monster: { ...monsterStats, currentHp: player.monster.currentHp } }); }
function upgradeStat(player, { stat, amount }) { if (!player) return; const hpBefore = player.stats.total.hp; if (amount === 'MAX') { let base = player.stats.base[stat]; let gold = player.gold; let inc = 0; let sum = 0; while (true) { const next = base + inc; if (sum + next > gold) break; sum += next; inc += 1; } if (inc > 0) { player.stats.base[stat] += inc; player.gold -= sum; } } else { const n = Number(amount); let cost = 0; for (let i = 0; i < n; i++) cost += player.stats.base[stat] + i; if (player.gold >= cost) { player.gold -= cost; player.stats.base[stat] += n; } } calculateTotalStats(player); if (stat === 'hp') { const hpAfter = player.stats.total.hp; player.currentHp = hpBefore > 0 ? player.currentHp * (hpAfter / hpBefore) : hpAfter; } }
function equipItem(player, uid) { if (!player) return; const hpBefore = player.stats.total.hp; const idx = player.inventory.findIndex(i => i.uid === uid); if (idx === -1) return; const item = player.inventory[idx]; const slot = item.type; if (player.equipment[slot]) { handleItemStacking(player, player.equipment[slot]); } if (item.quantity > 1) { item.quantity--; player.equipment[slot] = { ...item, quantity: 1, uid: Date.now() + Math.random().toString(36).slice(2, 11) }; } else { player.equipment[slot] = item; player.inventory.splice(idx, 1); } calculateTotalStats(player); const hpAfter = player.stats.total.hp; player.currentHp = hpBefore > 0 ? player.currentHp * (hpAfter / hpAfter) : hpAfter; if (player.currentHp > hpAfter) player.currentHp = hpAfter; }
function unequipItem(player, slot) { if (!player || !player.equipment[slot]) return; const hpBefore = player.stats.total.hp; handleItemStacking(player, player.equipment[slot]); player.equipment[slot] = null; calculateTotalStats(player); const hpAfter = player.stats.total.hp; player.currentHp = hpBefore > 0 && hpAfter > 0 ? player.currentHp * (hpAfter / hpBefore) : hpAfter; if (player.currentHp > hpAfter) player.currentHp = hpAfter; }
function attemptEnhancement(p, uid, socket) { if (!p) return; let item; let isEquipped = false; let idx = p.inventory.findIndex(i => i.uid === uid); if (idx !== -1) { item = p.inventory[idx]; } else { const equipmentKeys = Object.keys(p.equipment); for (const key of equipmentKeys) { if (p.equipment[key] && p.equipment[key].uid === uid) { item = p.equipment[key]; isEquipped = true; break; } } } if (!item) return; if (!isEquipped && item.quantity > 1) { item.quantity--; item = { ...item, quantity: 1, uid: Date.now() + Math.random().toString(36).slice(2, 11) }; p.inventory.push(item); } const cur = item.enhancement; const cost = Math.floor(1000 * Math.pow(2.1, cur)); if (p.gold < cost) { pushLog(p, '[강화] 골드가 부족합니다.'); return; } p.gold -= cost; const rates = enhancementTable[cur + 1] || highEnhancementRate; const r = Math.random(); let result = ''; let msg = ''; const hpBefore = p.stats.total.hp; if (r < rates.success) { result = 'success'; item.enhancement++; msg = `[+${cur} ${item.name}] 강화 성공! → [+${item.enhancement}]`; if (item.type === 'weapon') { if (item.enhancement > (p.maxWeaponEnhancement || 0)) { p.maxWeaponEnhancement = item.enhancement; p.maxWeaponName = item.name; } } else if (item.type === 'armor') { if (item.enhancement > (p.maxArmorEnhancement || 0)) { p.maxArmorEnhancement = item.enhancement; p.maxArmorName = item.name; } } const currentTopEnh = globalRecordsCache.topEnhancement || { enhancementLevel: 0 }; if (item.enhancement >= currentTopEnh.enhancementLevel) { updateGlobalRecord('topEnhancement', { username: p.username, itemName: item.name, itemGrade: item.grade, enhancementLevel: item.enhancement }); } } else if (r < rates.success + rates.maintain) { result = 'maintain'; msg = `[+${cur} ${item.name}] 강화 유지!`; } else if (r < rates.success + rates.maintain + rates.fail) { result = 'fail'; const newLevel = Math.max(0, item.enhancement - 1); msg = `[+${cur} ${item.name}] 강화 실패... → [+${newLevel}]`; item.enhancement = newLevel; } else { result = 'destroy'; msg = `[+${cur} ${item.name}] 아이템이 파괴되었습니다...`; if (isEquipped) { const equipmentKeys = Object.keys(p.equipment); for (const key of equipmentKeys) { if (p.equipment[key] && p.equipment[key].uid === uid) { p.equipment[key] = null; break; } } } else { const itemToRemoveIndex = p.inventory.findIndex(i => i.uid === item.uid); if (itemToRemoveIndex > -1) p.inventory.splice(itemToRemoveIndex, 1); } } calculateTotalStats(p); const hpAfter = p.stats.total.hp; p.currentHp = hpBefore > 0 && hpAfter > 0 ? p.currentHp * (hpAfter / hpBefore) : hpAfter; if (p.currentHp > hpAfter) p.currentHp = hpAfter; pushLog(p, msg); socket.emit('enhancementResult', { result, newItem: (result !== 'destroy' ? item : null), destroyed: result === 'destroy' }); }
function pushLog(p, text) { p.log.unshift(text); if (p.log.length > 15) p.log.pop(); }
function onClearFloor(p) { 
    const isBoss = isBossFloor(p.level - 1);
    const clearedFloor = p.level -1;
    const goldEarned = isBoss ? clearedFloor * 10 : clearedFloor; // 보스 클리어 시 골드 10배
    p.gold += goldEarned;
    
    const logMessage = isBoss ?
        `[${clearedFloor}층 보스] 클리어! (+${goldEarned.toLocaleString()} G)`:
        `[${clearedFloor}층] 클리어! (+${goldEarned.toLocaleString()} G)`;
    pushLog(p, logMessage);

    // [수정] 아이템 드랍률: 보스는 일반 몬스터보다 5배 높은 드랍률
    const dropChance = isBoss ? 0.10 : 0.02; 
    if (Math.random() < dropChance) { 
        const zone = p.level <= 500 ? 1 : p.level <= 3000 ? 2 : p.level <= 15000 ? 3 : 4; 
        const tbl = dropTable[zone]; 
        let grade, acc = 0, r = Math.random(); 
        for (const g in tbl.rates) { acc += tbl.rates[g]; if (r < acc) { grade = g; break; } } 
        if (grade) { 
            const pool = tbl.itemsByGrade[grade] || []; 
            if (pool.length) { 
                const id = pool[Math.floor(Math.random() * pool.length)]; 
                const droppedItem = createItemInstance(id); 
                handleItemStacking(p, droppedItem); 
                const logMsg = isBoss ?
                    `[${clearedFloor}층 보스]에게서 ${itemData[id].name} 획득!` :
                    `[${clearedFloor}층]에서 ${itemData[id].name} 획득!`;
                pushLog(p, logMsg); 
                if (['Legendary', 'Epic', 'Mystic'].includes(droppedItem.grade)) { 
                    updateGlobalRecord(`topLoot_${droppedItem.grade}`, { username: p.username, itemName: droppedItem.name, itemGrade: droppedItem.grade }); 
                } 
            } 
        } 
    } 
}

function calcMonsterStats(p) {
    const level = p.level;
    // [수정] 보스 몬스터 스탯 계산
    if (isBossFloor(level)) {
        const prevLevelMonsterAttack = Math.max(1, (level - 1) / 2); // 이전 층 공격력
        return {
            level: level,
            hp: level * 10, 
            attack: prevLevelMonsterAttack * 2.2, 
            defense: level / 3, 
            isBoss: true
        };
    }
    // 일반 몬스터 스탯
    return {
        level: level,
        hp: level,
        attack: level / 2,
        defense: level / 5,
        isBoss: false
    };
}
function resetPlayer(p, msg) { p.level = 1; calculateTotalStats(p); p.currentHp = p.stats.total.hp; p.monster.currentHp = 1; pushLog(p, msg); }

const AUTO_SAVE_INTERVAL = 10000;
setInterval(() => { const userIds = Object.keys(onlinePlayers); if (userIds.length > 0) { console.log(`[자동 저장] 현재 접속 중인 ${userIds.length}명의 유저 데이터를 저장합니다...`); for (const userId of userIds) { savePlayerData(userId); } } }, AUTO_SAVE_INTERVAL);

server.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));