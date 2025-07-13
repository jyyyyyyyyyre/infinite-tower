const sanitizeHtml = require('sanitize-html');
const path = require('path');
const sanitizeOptions = {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
        'img', 'h1', 'h2', 'h3', 'span', 'div',
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'col', 'colgroup'
    ]),
    allowedAttributes: {
        ...sanitizeHtml.defaults.allowedAttributes,
        '*': ['style', 'class', 'id'], 
        'img': ['src', 'alt', 'width', 'height'],
        'table': ['width', 'border', 'align', 'valign'],
        'td': ['colspan', 'rowspan', 'align', 'valign'],
        'th': ['colspan', 'rowspan', 'align', 'valign'],
    },
    allowedStyles: {
        '*': {
            'color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/],
            'background-color': [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/],
            'font-size': [/^\d+(?:px|em|%)$/],
            'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
            'width': [/^\d+(?:px|em|%)$/],
            'height': [/^\d+(?:px|em|%)$/],
            'border': [/^\d+px\s(solid|dotted|dashed)\s(#[0-9a-f]{3,6}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\))$/],
            'padding': [/^\d+px$/],
            'margin': [/^\d+px$/]
        }
    },
    stripRemainingTags: true
};

const express = require('express');
const compression = require('compression');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const researchConfig = require('./researchConfig');

const appVersion = Date.now();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname));

const io = new Server(server, {
    transports: ['websocket'],   
    pingInterval: 25000,       
    pingTimeout : 70000,
    perMessageDeflate: true
});

const PORT = 3000;
const TICK_RATE = 1000; 
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_OBJECT_ID = '6873333f38f1aa40c838b668';
const BOSS_INTERVAL = 200;


const RIFT_ENCHANT_COST = {
    GOLD: 100000000,
    SHARDS: 100
};

const WORLD_BOSS_CONFIG = {
    SPAWN_INTERVAL: 720 * 60 * 1000, HP: 30000000, ATTACK: 0, DEFENSE: 0,
    REWARDS: { GOLD: 800000000, PREVENTION_TICKETS: 2, ITEM_DROP_RATES: { Rare: 0.10, Legendary: 0.10, Epic: 0.69, Mystic: 0.101 } }
};

const MailSchema = new mongoose.Schema({
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    senderUsername: { type: String, default: 'System' }, 
    item: { type: Object, default: null },
    gold: { type: Number, default: 0 },
    description: { type: String, required: true, maxLength: 100 },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now, expires: '30d' } 
});

const Mail = mongoose.model('Mail', MailSchema);

const SELL_PRICES = { Common: 3000, Rare: 50000, Legendary: 400000, Epic: 2000000, Mystic: 100000000 };

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    kakaoId: { type: String, index: true, sparse: true },
    isKakaoVerified: { type: Boolean, default: false },
    ban: {
        isBanned: { type: Boolean, default: false },
        expiresAt: { type: Date, default: null },
        reason: { type: String, default: '' }
    },
    mute: {
        isMuted: { type: Boolean, default: false },
        expiresAt: { type: Date, default: null },
        reason: { type: String, default: '' }
    }
});

const GameDataSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    gold: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    maxLevel: { type: Number, default: 1 },
    maxWeaponEnhancement: { type: Number, default: 0 },
    maxWeaponName: { type: String, default: '' },
    maxArmorEnhancement: { type: Number, default: 0 },
    maxArmorName: { type: String, default: '' },
    inventory: { type: [Object], default: [] },
    equipment: { 
        weapon: { type: Object, default: null }, 
        armor: { type: Object, default: null },
        necklace: { type: Object, default: null }, 
        earring: { type: Object, default: null },    
        wristwatch: { type: Object, default: null } 
    },
    log: { type: [String], default: ["'무한의 탑'에 오신 것을 환영합니다!"] },
    destructionPreventionTickets: { type: Number, default: 0 },
    worldBossContribution: { damageDealt: { type: Number, default: 0 }, bossId: { type: String, default: null } },
    
    isExploring: { type: Boolean, default: false },
    levelBeforeExploration: { type: Number, default: 1 },
    unlockedArtifacts: { type: [Object], default: [null, null, null] },
    petInventory: { type: [Object], default: [] },
    equippedPet: { type: Object, default: null },
    incubator: {
        egg: { type: Object, default: null },
        hatchCompleteTime: { type: Date, default: null },
        hatchDuration: {type: Number, default: 0}
    },
    hammerBuff: { type: Boolean, default: false },
    petReviveCooldown: { type: Date, default: null },
    discoveredItems: { type: [String], default: [] },
    codexBonusActive: { type: Boolean, default: false },
    stats: {
        base: {
            hp: { type: Number, default: 100 },
            attack: { type: Number, default: 1 },
            defense: { type: Number, default: 1 }
        },
        critChance: { type: Number, default: 0 }, 
        critResistance: { type: Number, default: 0 }, 
    },
    fameScore: { type: Number, default: 0 }, 
    petFusion: {
        slot1: { type: Object, default: null },
        slot2: { type: Object, default: null },
        fuseEndTime: { type: Date, default: null }
    },
    riftShards: { type: Number, default: 0 },
    focus: { type: Number, default: 0 },
    penetration: { type: Number, default: 0 },
    tenacity: { type: Number, default: 0 },
    safeZoneCooldownUntil: { type: Date, default: null },
 unlockedTitles: { type: [String], default: [] },
    equippedTitle: { type: String, default: null },
    titleCodexCompleted: { type: Boolean, default: false },

bloodthirst: { type: Number, default: 0 },
personalRaid: {
    entries: { type: Number, default: 2 },
    lastReset: { type: Date, default: () => new Date(0) }
},

raidState: {
    isActive: { type: Boolean, default: false },
    floor: { type: Number, default: 1 }
},

    titleCounters: {
        destroyCount: { type: Number, default: 0 },
        enhancementFailCount: { type: Number, default: 0 },
        enchantCount: { type: Number, default: 0 },
        hatchCount: { type: Number, default: 0 },
        pouchUseCount: { type: Number, default: 0 },
        sellCount: { type: Number, default: 0 },
        ahBuyCount: { type: Number, default: 0 },
        scrollUseCount: { type: Number, default: 0 },
        deathCount: { type: Number, default: 0 },
        wbLastHitCount: { type: Number, default: 0 },
        wbParticipateCount: { type: Number, default: 0 }
    },

    researchEssence: { type: Number, default: 0 },
    research: {
        warlord: { type: Map, of: Number, default: {} },
        guardian: { type: Map, of: Number, default: {} },
        berserker: { type: Map, of: Number, default: {} },
        pioneer: { type: Map, of: Number, default: {} }
    }

});



const GlobalRecordSchema = new mongoose.Schema({ recordType: { type: String, required: true, unique: true }, username: { type: String }, itemName: { type: String }, itemGrade: { type: String }, enhancementLevel: { type: Number }, updatedAt: { type: Date, default: Date.now } });
const ChatMessageSchema = new mongoose.Schema({
    type: { type: String, default: 'user' },
    username: { type: String, required: true },
    role: { type: String, default: 'user' },
    fameScore: { type: Number, default: 0 },
    message: { type: String }, 
    itemData: { type: Object, default: null },
    title: { type: String, default: null },
    itemName: { type: String, default: null }, 
    itemGrade: { type: String, default: null },
    timestamp: { type: Date, default: Date.now }
});
const AuctionItemSchema = new mongoose.Schema({ sellerId: { type: mongoose.Schema.Types.ObjectId, required: true }, sellerUsername: { type: String, required: true }, item: { type: Object, required: true }, price: { type: Number, required: true }, listedAt: { type: Date, default: Date.now } });
const WorldBossStateSchema = new mongoose.Schema({
    uniqueId: { type: String, default: 'singleton' }, bossId: { type: String }, name: String, maxHp: Number, currentHp: Number, attack: Number, defense: Number, isActive: Boolean, spawnedAt: Date, participants: { type: Map, of: { username: String, damageDealt: Number } }
});

const CommentSchema = new mongoose.Schema({
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorUsername: { type: String, required: true },
    content: { type: String, required: true, maxLength: 500 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

const GameSettingsSchema = new mongoose.Schema({
    settingId: { type: String, default: 'main_settings', unique: true },
    dropTable: { type: Object, required: true },
    globalLootTable: { type: Array, required: true }, 
    enhancementTable: { type: Object, required: true },
    highEnhancementRate: { type: Object, required: true },
});

const AdminLogSchema = new mongoose.Schema({
    adminUsername: { type: String, required: true },
    actionType: { 
        type: String, 
        required: true, 
        enum: [
            'grant_item', 'kick', 'mute', 'ban', 'update_user', 'update_settings', 
            'remove_sanction', 'delete_inventory_item', 'delete_auction_listing',
            'delete_equipped_item' 
        ] 
    },
    targetUsername: { type: String },
    details: { type: Object },
}, { timestamps: true });



const PostSchema = new mongoose.Schema({
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorUsername: { type: String, required: true },
    category: { type: String, required: true, enum: ['공지', '자유', '공략'] },
    title: { type: String, required: true, maxLength: 100 },
    content: { type: String, required: true, maxLength: 5000 },
    views: { type: Number, default: 0 },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    comments: [CommentSchema]
}, { timestamps: true });

UserSchema.pre('save', async function(next) { if (!this.isModified('password')) return next(); this.password = await bcrypt.hash(this.password, 10); next(); });
UserSchema.methods.comparePassword = function(plainPassword) { return bcrypt.compare(plainPassword, this.password); };

const User = mongoose.model('User', UserSchema);
const GameData = mongoose.model('GameData', GameDataSchema);
const GlobalRecord = mongoose.model('GlobalRecord', GlobalRecordSchema);
const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema);
const AuctionItem = mongoose.model('AuctionItem', AuctionItemSchema);
const WorldBossState = mongoose.model('WorldBossState', WorldBossStateSchema);
const Post = mongoose.model('Post', PostSchema);
const Comment = mongoose.model('Comment', CommentSchema);
const GameSettings = mongoose.model('GameSettings', GameSettingsSchema);
const AdminLog = mongoose.model('AdminLog', AdminLogSchema);


mongoose.connect(MONGO_URI).then(() => {
    console.log('MongoDB 성공적으로 연결되었습니다.');
    loadGlobalRecords();
loadGameSettings();
    loadWorldBossState(); 
    setInterval(checkAndSpawnBoss, 60000); 
    console.log('월드보스 스폰 스케줄러가 활성화되었습니다. (매일 19시, 22시)');
}).catch(err => console.error('MongoDB 연결 오류:', err));

app.use(compression());
app.use(express.json());
app.use(express.static('public', {
  maxAge: '30d', 
  etag: false   
}));

app.get('/researchConfig.js', (req, res) => {
    res.sendFile(__dirname + '/researchConfig.js');
});

const axios = require('axios');

app.get('/api/kakao/login', (req, res) => {
    const kakaoAuthURL = `https://kauth.kakao.com/oauth/authorize?client_id=${process.env.KAKAO_REST_API_KEY}&redirect_uri=${process.env.KAKAO_REDIRECT_URI}&response_type=code`;
    res.redirect(kakaoAuthURL);
});

app.get('/api/kakao/callback', async (req, res) => {
    const { code } = req.query;
    if (!code) {
        return res.redirect('/?error=카카오 인증에 실패했습니다.');
    }
    try {
        const tokenResponse = await axios.post('https://kauth.kakao.com/oauth/token', null, {
            headers: { 'Content-type': 'application/x-www-form-urlencoded;charset=utf-8' },
            params: { grant_type: 'authorization_code', client_id: process.env.KAKAO_REST_API_KEY, redirect_uri: process.env.KAKAO_REDIRECT_URI, code, }
        });
        const { access_token } = tokenResponse.data;
        const userResponse = await axios.get('https://kapi.kakao.com/v2/user/me', {
            headers: { 'Authorization': `Bearer ${access_token}`, 'Content-type': 'application/x-www-form-urlencoded;charset=utf-8' }
        });
        const kakaoId = userResponse.data.id.toString();
        
        const linkedAccounts = await User.find({ kakaoId: kakaoId });
        if (linkedAccounts.length >= 1) {
            return res.redirect('/?error=하나의 카카오 계정으로는 1개의 게임 계정만 생성할 수 있습니다.');
        }
      
        const tempToken = jwt.sign({ kakaoId, accountCount: linkedAccounts.length }, JWT_SECRET, { expiresIn: '10m' });
        
        res.redirect(`/?action=kakao_finalize&token=${tempToken}`);
    } catch (error) {
        console.error('카카오 콜백 오류:', error);
        res.redirect('/?error=카카오 인증 중 오류가 발생했습니다.');
    }
});

app.use('/image', express.static('image', { maxAge: '30d', etag: false }));
app.use('/image', express.static('image'));
app.get('/', (req, res) => {
    res.render('index', { version: appVersion });
});

const adminItemAlias = {
    '무기1': 'w001', '무기2': 'w002', '무기3': 'w003', '무기4': 'w004', '무기5': 'w005', '무기6': 'primal_w01',
    '방어구1': 'a001', '방어구2': 'a002', '방어구3': 'a003', '방어구4': 'a004', '방어구5': 'a005', '방어구6': 'primal_a01',
    '차원파편': 'rift_shard',
    '고정석': 'form_locking_stone',
    '파방권': 'prevention_ticket',
'피의결정': 'pure_blood_crystal',
    '망치': 'hammer_hephaestus',
    '알1': 'pet_egg_normal',
    '알2': 'pet_egg_ancient',
    '알3': 'pet_egg_mythic',
    '소켓1': 'tome_socket1',
    '소켓2': 'tome_socket2',
    '소켓3': 'tome_socket3',
    '골드주머니': 'gold_pouch',
    '복귀스크롤': 'return_scroll',
    '불1': 'ifrit', 
    '물1': 'undine',
    '바람1': 'sylphid',
    '불2': 'phoenix',
    '물2': 'leviathan',
    '바람2': 'griffin', 
    '신화1': 'bahamut',
    '융합1': 'ignis_aqua',
    '융합2': 'tempest',
    '융합3': 'thunderbird',
    '참여상자': 'boss_participation_box',
    '권능상자': 'box_power',
    '악세1': 'acc_necklace_01',
    '악세2': 'acc_earring_01',
    '악세3': 'acc_wristwatch_01',
 '악세4': 'primal_acc_necklace_01',
    '악세5': 'primal_acc_earring_01',
    '악세6': 'primal_acc_wristwatch_01'
};

const itemData = {
   'primal_acc_necklace_01': { name: '찬란한 윤회의 성물', type: 'accessory', accessoryType: 'necklace', grade: 'Primal', description: '사망 시 2/3 지점 부활, 추가로 30% 확률로 현재 층에서 부활합니다.', image: 'primal_necklace.png', tradable: true, enchantable: true },
    'primal_acc_earring_01': { name: '시공의 각성 이어링', type: 'accessory', accessoryType: 'earring', grade: 'Primal', description: '공격 시 3% 확률로 15초간 각성 상태에 돌입합니다.', image: 'primal_earring.png', tradable: true, enchantable: true },
    'primal_acc_wristwatch_01': { name: '계시자의 크로노그래프', type: 'accessory', accessoryType: 'wristwatch', grade: 'Primal', description: '치명타 확률 30% 증가', image: 'primal_wristwatch.png', tradable: true, enchantable: true },
    'acc_necklace_01': { name: '윤회의 목걸이', type: 'accessory', accessoryType: 'necklace', grade: 'Mystic', description: '사망 시 1층이 아닌, 현재 층수의 2/3 지점에서 다시 시작합니다.', image: 'necklace_01.png', tradable: true },
    'acc_earring_01': { name: '찰나의 각성 이어링', type: 'accessory', accessoryType: 'earring', grade: 'Mystic', description: '공격시 3% 확률로 10초간 각성돌입(공/방/체 10배)', image: 'earring_01.png', tradable: true },
    'acc_wristwatch_01': { name: '통찰자의 크로노그래프', type: 'accessory', accessoryType: 'wristwatch', grade: 'Mystic', description: '치명타 확률 20% 증가', image: 'wristwatch_01.png', tradable: true },
    box_power: { name: '권능의 상자', type: 'Special', category: 'Consumable', grade: 'Mystic', description: '고대 신의 권능이 깃든 상자. 평범한 방법으로는 얻을 수 없다', image: 'box_power.png', tradable: true },
    w001: { name: '낡은 단검', type: 'weapon', grade: 'Common', baseEffect: 0.05, image: 'sword1.png', tradable: true },
    a001: { name: '가죽 갑옷', type: 'armor', grade: 'Common', baseEffect: 0.05, image: 'armor1.png', tradable: true },
    w002: { name: '강철 검', type: 'weapon', grade: 'Rare', baseEffect: 0.12, image: 'sword2.png', tradable: true },
    a002: { name: '판금 갑옷', type: 'armor', grade: 'Rare', baseEffect: 0.12, image: 'armor2.png', tradable: true },
    w003: { name: '용살자 대검', type: 'weapon', grade: 'Legendary', baseEffect: 0.25, image: 'sword3.png', tradable: true },
    a003: { name: '수호자의 갑주', type: 'armor', grade: 'Legendary', baseEffect: 0.25, image: 'armor3.png', tradable: true },
    w004: { name: '지배자의 롱소드', type: 'weapon', grade: 'Epic', baseEffect: 0.50, image: 'sword4.png', tradable: true },
    a004: { name: '영겁의 흉갑', type: 'armor', grade: 'Epic', baseEffect: 0.50, image: 'armor4.png', tradable: true },
    w005: { name: '태초의 파편', type: 'weapon', grade: 'Mystic', baseEffect: 2.50, image: 'sword5.png', tradable: true },
    a005: { name: '세계수의 심장', type: 'armor', grade: 'Mystic', baseEffect: 2.50, image: 'armor5.png', tradable: true },
    primal_w01: { name: '데미우르고스', type: 'weapon', grade: 'Primal', baseEffect: 3.00, randomStat: { type: 'attack_power_percent', min: 1460, max: 2200 }, image: 'primal_sword.png', tradable: true },
    primal_a01: { name: '망각의 지평선', type: 'armor', grade: 'Primal', baseEffect: 3.00, randomStat: { type: 'hp_def_percent', min: 1460, max: 2200 }, image: 'primal_armor.png', tradable: true },
    rift_shard: { name: '균열의 파편', type: 'Special', category: 'Material', grade: 'Legendary', description: '심연의 균열에서 흘러나온 파편. 불안정한 힘을 안정시키기 위해 대량의 골드가 필요합니다.', image: 'rift_shard.png', tradable: true },
    form_locking_stone: { name: '형상의 고정석', type: 'Special', category: 'Material', grade: 'Mystic', description: '장비에 부여된 균열의 힘 하나를 완벽하게 고정시킵니다. 극도로 희귀하여 부르는 게 값입니다.', image: 'form_locking_stone.png', tradable: true },
    boss_participation_box: { name: '월드보스 참여 상자', type: 'Special', category: 'Consumable', grade: 'Rare', description: '월드보스 토벌에 참여한 등반자에게 주어지는 상자. 사용 시 골드나 아이템을 얻을 수 있다.', image: 'box.png', tradable: false },
    return_scroll: { name: '복귀 스크롤', type: 'Special', category: 'Consumable', grade: 'Rare', description: '사용 시 가장 높은 층으로 이동하며, 10초간 각성 상태에 돌입하여 능력치가 대폭 상승합니다.', image: 'return_scroll.png', tradable: true },
    gold_pouch: { name: '수수께끼 골드 주머니', type: 'Special', category: 'Consumable', grade: 'Common', description: '사용 시 랜덤한 골드를 획득합니다.', image: 'gold_pouch.png', tradable: true },
    pet_egg_normal: { name: '일반종 알', type: 'Special', category: 'Egg', grade: 'Rare', description: '부화시키면 일반 등급의 펫을 얻습니다.', image: 'egg_normal.png', tradable: true, hatchDuration: 30 * 60 * 1000 },
    pet_egg_ancient: { name: '고대종 알', type: 'Special', category: 'Egg', grade: 'Epic', description: '부화시키면 고대 등급의 펫을 얻습니다.', image: 'pet_egg_ancient.png', tradable: true, hatchDuration: 60 * 60 * 1000 },
    pet_egg_mythic: { name: '신화종 알', type: 'Special', category: 'Egg', grade: 'Mystic', description: '부화시키면 신화 등급의 펫을 얻습니다.', image: 'pet_egg_mythic.png', tradable: true, hatchDuration: 24 * 60 * 60 * 1000 },
    prevention_ticket: { name: '파괴 방지권', type: 'Special', category: 'Ticket', grade: 'Epic', description: '10강 이상 강화 시 파괴를 1회 방지합니다.', image: 'ticket.png', tradable: true },
    hammer_hephaestus: { name: '헤파이스토스의 망치', type: 'Special', category: 'Buff', grade: 'Epic', description: '강화 시 체크하여 사용하면 성공 확률이 15%p 증가합니다.', image: 'hammer_hephaestus.png', tradable: true },
'pure_blood_crystal': { name: '순수한 피의 결정', type: 'Special', category: 'Material', grade: 'Mystic', description: '흡수 시 20% 확률로 \'피의 갈망\' 스탯을 영구적으로 +0.1%p 증가시킵니다.', image: 'pure_blood_crystal.png', tradable: true },    
tome_socket1: { name: '모래시계 소켓', type: 'Special', category: 'Tome', grade: 'Legendary', description: '사용 시 1번 유물 소켓을 영구히 해금합니다.', image: 'tome_socket1.png', tradable: true },
    tome_socket2: { name: '거인 학살자 소켓', type: 'Special', category: 'Tome', grade: 'Legendary', description: '사용 시 2번 유물 소켓을 영구히 해금합니다.', image: 'tome_socket2.png', tradable: true },
    tome_socket3: { name: '황금 나침반 소켓', type: 'Special', category: 'Tome', grade: 'Legendary', description: '사용 시 3번 유물 소켓을 영구히 해금합니다.', image: 'tome_socket3.png', tradable: true },
};

const riftEnchantOptions = [

    { type: 'all_stats_percent', min: 1, max: 10, grade: 'supreme' },
    { type: 'focus', min: 1, max: 10, grade: 'supreme' },
    { type: 'penetration', min: 1, max: 25, grade: 'supreme' },
    { type: 'tenacity', min: 1, max: 2, grade: 'supreme' },

    { type: 'attack_percent', min: 1, max: 10, grade: 'rare_enchant' },
    { type: 'defense_percent', min: 1, max: 10, grade: 'rare_enchant' },
    { type: 'hp_percent', min: 1, max: 10, grade: 'rare_enchant' },

    { type: 'gold_gain', min: 1, max: 10, grade: 'common_enchant' },
    { type: 'extra_climb_chance', min: 1, max: 10, grade: 'common_enchant' },
    { type: 'def_penetration', min: 1, max: 10, grade: 'common_enchant' }
];

const petData = {
    ifrit: { name: '이프리', type: 'pet', grade: 'Rare', attribute: '불', image: 'ifrit.png', description: '방어력 관통 +10%', effects: { defPenetration: 0.10 } },
    undine: { name: '운디네', type: 'pet', grade: 'Rare', attribute: '물', image: 'undine.png', description: '치명타 저항 +2%', effects: { critResistance: 0.02 } },
    sylphid: { name: '실피드', type: 'pet', grade: 'Rare', attribute: '바람', image: 'sylphid.png', description: '추가 등반 확률 +5%', effects: { extraClimbChance: 0.05 } },
    phoenix: { name: '피닉스', type: 'pet', grade: 'Epic', attribute: '불', image: 'phoenix.png', description: '방어력 관통 +30%', effects: { defPenetration: 0.30 } },
    leviathan: { name: '리바이어던', type: 'pet', grade: 'Epic', attribute: '물', image: 'leviathan.png', description: '치명타 저항 +3.9%, 치명타 확률 +4%', effects: { critResistance: 0.039, critChance: 0.04 } },
    griffin: { name: '그리핀', type: 'pet', grade: 'Epic', attribute: '바람', image: 'griffin.png', description: '추가 등반 확률 +15%', effects: { extraClimbChance: 0.15 } },
    bahamut: { name: '바하무트', type: 'pet', grade: 'Mystic', attribute: '모든 속성', image: 'bahamut.png', description: '방관+50%, 치명타확률+10%, 치명타저항+6%, 추가등반+25%', effects: { defPenetration: 0.50, critChance: 0.10, critResistance: 0.06, extraClimbChance: 0.25 } },
    ignis_aqua: { name: '이그니스 아쿠아', type: 'pet', grade: 'Epic', attribute: '불/물', image: 'ignis_aqua.png', description: '방관+30%, 치명저항+3.9%, 치명확률+4%', effects: { defPenetration: 0.30, critResistance: 0.039, critChance: 0.04 }, fused: true },
    tempest: { name: '템페스트', type: 'pet', grade: 'Epic', attribute: '물/바람', image: 'tempest.png', description: '치명저항+3.9%, 치명확률+4%, 추가등반+15%', effects: { critResistance: 0.039, critChance: 0.04, extraClimbChance: 0.15 }, fused: true },
    thunderbird: { name: '썬더버드', type: 'pet', grade: 'Epic', attribute: '불/바람', image: 'thunderbird.png', description: '방관+30%, 추가등반+15%', effects: { defPenetration: 0.30, extraClimbChance: 0.15 }, fused: true }
};

const titleData = {
    '[대체왜?]': { effect: { enhancementSuccessRate: 0.005 }, hint: "세상에서 가장 약한 무기의 가능성을 최대로 끌어내보세요." },
    '[펑..]': { effect: { enhancementCostReduction: 0.01 }, hint: "당신의 손에서 사라져간 장비들의 명복을 빕니다..." },
    '[키리]': { effect: { enhancementMaintainChance: 0.01 }, hint: "그녀는 실패를 먹고 자랍니다. 그녀에게 수많은 제물을 바치세요." },
    '[유리대포]': { effect: { critChance: 0.01 }, hint: "최고의 창과 가장 약한 방패, 극단적인 조합을 시도해 보세요." },
    '[마부장인]': { effect: { enchantCostReduction: 0.01 }, hint: "무기와 방어구 모두에 균열의 힘을 불어넣어 보세요." },
    '[로포비아]': { effect: { bossDamage: 0.01 }, hint: "신화 속 용을 당신의 동반자로 맞이하세요." },
    '[원소술사]': { effect: { petStatBonus: 0.001 }, hint: "세 가지 원소의 정수를 모두 하나로 합쳐 그 힘을 증명하세요." },
    '[전당포]': { effect: { goldGain: 0.015 }, hint: "세상에서 가장 반짝이는 것들을 모두 손에 넣으세요." },
    '[인과율의 밖]': { effect: { attack: 0.03 }, hint: "세상의 이치를 벗어난 태초의 장비를 모두 갖추세요." },
    '[랭커]': { effect: { attack: 0.02 }, hint: "랭커의 품격에 어울리는 신화적인 무구로 자신을 증명하세요." },
    '[균열석]': { effect: { riftShardDropRate: 0.02 }, hint: "차원을 넘나들 정도의 파편을 모아보세요." },
    '[생명의 은인]': { effect: { hatchTimeReduction: 0.01 }, hint: "수많은 알을 당신의 손으로 부화시켜 보세요." },
    '[탐욕]': { effect: { goldPouchMinBonus: 0.05 }, hint: "주머니 속의 행운을 끊임없이 갈망하세요." },
    '[대장간]': { effect: { sellPriceBonus: 0.015 }, hint: "더 강한 장비를 위해, 낡은 장비들을 정리하는 것도 지혜입니다." },
    '[큰손]': { effect: { maxHp: 0.01 }, hint: "거래소의 경제를 움직이는 보이지 않는 손이 되어보세요." },
    '[회귀자]': { effect: { scrollBuffDuration: 0.5 }, hint: "과거의 영광을 되찾기 위해 몇 번이고 시간을 되돌리세요." },
    '[오뚝이]': { effect: { goldOnDeath: 100000 }, hint: "넘어지고, 또 넘어져도, 계속해서 일어서는 자에게 주어집니다." },
    '[용사]': { effect: { bossDamage: 0.03 }, hint: "강력한 적의 숨통을 직접 끊어 영웅이 되세요." },
    '[토벌대원]': { effect: { worldBossContribution: 0.01 }, hint: "세계를 위협하는 존재에 맞서 꾸준히 당신의 힘을 보태세요." },
    '[날먹최강자]': { effect: { worldBossDamage: 0.01 }, hint: "가장 보잘것없는 무기로, 가장 위대한 존재에게 당신의 실력을 증명하세요." }
};

function grantTitle(player, titleName) {
    if (player && titleName && !player.unlockedTitles.includes(titleName)) {
        player.unlockedTitles.push(titleName);
        const message = `📜 칭호 ${titleName}을(를) 획득했습니다!`;
        pushLog(player, message);

        if (player.unlockedTitles.length >= Object.keys(titleData).length && !player.titleCodexCompleted) {
            player.titleCodexCompleted = true;
            const completionMessage = `[칭호 도감] 모든 칭호를 수집하여 마스터 보너스가 활성화되었습니다! (모든 능력치 +5%)`;
            pushLog(player, completionMessage);
        }

    }
}

function checkStateBasedTitles(player) {
    if (!player) return;

    // [유리대포]
    if (player.equipment.weapon?.grade === 'Mystic' && player.equipment.armor?.grade === 'Common') {
        grantTitle(player, '[유리대포]');
    }
    // [마부장인]
    if (player.equipment.weapon?.enchantments?.length > 0 && player.equipment.armor?.enchantments?.length > 0) {
        grantTitle(player, '[마부장인]');
    }
    // [로포비아]
    if (player.equippedPet?.id === 'bahamut' || player.petInventory.some(p => p.id === 'bahamut')) {
        grantTitle(player, '[로포비아]');
    }
    // [원소술사]
    const fusionPets = ['ignis_aqua', 'tempest', 'thunderbird'];
    const hasAllFusionPets = fusionPets.every(petId => player.petInventory.some(p => p.id === petId));
    if (hasAllFusionPets) {
        grantTitle(player, '[원소술사]');
    }
    // [전당포]
    const mysticAcc = ['acc_necklace_01', 'acc_earring_01', 'acc_wristwatch_01'];
    const hasAllMysticAcc = mysticAcc.every(accId => player.inventory.some(i => i.id === accId) || Object.values(player.equipment).some(e => e?.id === accId));
    if (hasAllMysticAcc) {
        grantTitle(player, '[전당포]');
    }
    // [인과율의 밖]
    if (player.equipment.weapon?.grade === 'Primal' && player.equipment.armor?.grade === 'Primal') {
        grantTitle(player, '[인과율의 밖]');
    }
    // [랭커]
    if (player.equipment.weapon?.grade === 'Mystic' && player.equipment.armor?.grade === 'Mystic') {
        grantTitle(player, '[랭커]');
    }
    // [균열석]
    const riftShards = player.inventory.find(i => i.id === 'rift_shard');
    if (riftShards && riftShards.quantity >= 10000) {
        grantTitle(player, '[균열석]');
    }
}
let gameSettings = {};
const powerBoxLootTable = [

 { id: 'primal_w01', chance: 0.000005 },
    { id: 'primal_a01', chance: 0.000005 }, 

    { id: 'w005', chance: 0.0016 },
    { id: 'a005', chance: 0.0016 },
    { id: 'acc_necklace_01', chance: 0.0016 },
    { id: 'acc_earring_01', chance: 0.0016 },
    { id: 'acc_wristwatch_01', chance: 0.0016 },
    { id: 'pet_egg_mythic', chance: 0.0020 },
    { id: 'hammer_hephaestus', quantity: [1, 5], chance: 0.40 },
    { id: 'prevention_ticket', quantity: [1, 5], chance: 0.40 },

    { id: 'return_scroll', quantity: 1, chance: 0.18999 }
];
const artifactData = {
    tome_socket1: { id: 'tome_socket1', name: "가속의 모래시계", description: "10층마다 추가등반", image: "tome_socket1.png" },
    tome_socket2: { id: 'tome_socket2', name: "거인 학살자의 룬", description: "보스층 공/방 +50%", image: "tome_socket2.png" },
    tome_socket3: { id: 'tome_socket3', name: "황금 나침반", description: "골드 획득량 +25%", image: "tome_socket3.png" },
};

const monsterCritRateTable = [
    { maxLevel: 10000, normal: 0.1, boss: 0.01 },
    { maxLevel: 100000, normal: 0.02, boss: 0.03 },
    { maxLevel: 300000, normal: 0.04, boss: 0.05 },
    { maxLevel: 500000, normal: 0.06, boss: 0.07 },
    { maxLevel: Infinity, normal: 0.07, boss: 0.08 }
];

const goldPouchRewardTable = [
    { range: [1, 1000], chance: 0.50 },
    { range: [10000, 100000], chance: 0.40 },
    { range: [10000, 1000000], chance: 0.099 },
    { range: [3000000, 10000000], chance: 0.0009 },
    { range: [100000000, 100000000], chance: 0.0001 }
];

let onlinePlayers = {};
let globalRecordsCache = {};
let worldBossState = null;
let worldBossTimer = null;
let isBossSpawning = false;


async function loadWorldBossState() {
    const savedState = await WorldBossState.findOne({ uniqueId: 'singleton' });
    if (savedState && savedState.isActive) {
        const plainObject = savedState.toObject();
        worldBossState = {
            ...plainObject,
            participants: new Map(Object.entries(plainObject.participants || {}))
        };
        console.log('활성화된 월드보스 정보를 DB에서 로드했습니다.');
    } 
}

async function loadGameSettings() {
    try {
        const defaultSettings = {
            settingId: 'main_settings',
           dropTable: {
                1: { itemsByGrade: { Common: ['w001', 'a001'] }, rates: { Common: 0.979, Rare: 0.02 }, specialDrops: { 'rift_shard': { chance: 0.0005 } } },
                2: { itemsByGrade: { Common: ['w001', 'a001'], Rare: ['w002', 'a002'], Legendary: ['w003', 'a003'] }, rates: { Common: 0.899, Rare: 0.09, Legendary: 0.01 }, specialDrops: { 'rift_shard': { chance: 0.001 } } },
                3: { itemsByGrade: { Common: ['w001', 'a001'], Rare: ['w002', 'a002'], Legendary: ['w003', 'a003'], Epic: ['w004', 'a004'] }, rates: { Common: 0.779, Rare: 0.16, Legendary: 0.055, Epic: 0.005 }, specialDrops: { 'rift_shard': { chance: 0.001 } } },
                4: { itemsByGrade: { Common: ['w001', 'a001'], Rare: ['w002', 'a002'], Legendary: ['w003', 'a003'], Epic: ['w004', 'a004'], Mystic: ['w005', 'a005'] }, rates: { Common: 0.649, Rare: 0.25, Legendary: 0.09, Epic: 0.0098, Mystic: 0.0002 }, specialDrops: { 'rift_shard': { chance: 0.001 } } },
                5: {
                    itemsByGrade: { Common: ['w001', 'a001'], Rare: ['w002', 'a002'], Legendary: ['w003', 'a003'], Epic: ['w004', 'a004'], Mystic: ['w005', 'a005'], Primal: ['primal_w01', 'primal_a01'] },
                    rates: { Common: 0.5994995, Rare: 0.28, Legendary: 0.11, Epic: 0.0098, Mystic: 0.0002, Primal: 0.0000005 },
                    specialDrops: { 'rift_shard': { chance: 0.001 } }
                },
                6: {
                    itemsByGrade: { Common: ['w001', 'a001'], Rare: ['w002', 'a002'], Legendary: ['w003', 'a003'], Epic: ['w004', 'a004'], Mystic: ['w005', 'a005'], Primal: ['primal_w01', 'primal_a01', 'primal_acc_necklace_01', 'primal_acc_earring_01', 'primal_acc_wristwatch_01'] },
                    rates: { Common: 0.5491995, Rare: 0.30, Legendary: 0.13, Epic: 0.019, Mystic: 0.0008, Primal: 0.0000005 },
                    specialDrops: { 'rift_shard': { chance: 0.002 } }
                }
            },
            globalLootTable: [
                { id: 'gold_pouch', chance: (0.002) }, { id: 'pet_egg_normal', chance: (0.0016) }, { id: 'prevention_ticket', chance: (0.00018) }, { id: 'pet_egg_ancient', chance: (0.00005) }, { id: 'hammer_hephaestus', chance: (0.00006) }, { id: 'tome_socket1', chance: (0.000008) }, { id: 'tome_socket2', chance: (0.0000065) }, { id: 'tome_socket3', chance: (0.000005) }, { id: 'return_scroll', chance: (0.000009 *1.5) }, { id: 'acc_necklace_01', chance: (0.000004) }, { id: 'acc_earring_01', chance: (0.000004) }, { id: 'acc_wristwatch_01', chance: (0.000004) }, { id: 'pet_egg_mythic', chance: (0.0000005) }, { id: 'form_locking_stone', chance: (0.0001 / 2) }
            ],
            enhancementTable: { 1: { success: 1.00, maintain: 0.00, fail: 0.00, destroy: 0.00 }, 2: { success: 1.00, maintain: 0.00, fail: 0.00, destroy: 0.00 }, 3: { success: 1.00, maintain: 0.00, fail: 0.00, destroy: 0.00 }, 4: { success: 1.00, maintain: 0.00, fail: 0.00, destroy: 0.00 }, 5: { success: 0.90, maintain: 0.10, fail: 0.00, destroy: 0.00 }, 6: { success: 0.80, maintain: 0.20, fail: 0.00, destroy: 0.00 }, 7: { success: 0.70, maintain: 0.25, fail: 0.05, destroy: 0.00 }, 8: { success: 0.50, maintain: 0.30, fail: 0.20, destroy: 0.00 }, 9: { success: 0.40, maintain: 0.40, fail: 0.20, destroy: 0.00 }, 10: { success: 0.30, maintain: 0.45, fail: 0.25, destroy: 0.00 }, 11: { success: 0.20, maintain: 0.00, fail: 0.00, destroy: 0.80 }, 12: { success: 0.15, maintain: 0.00, fail: 0.00, destroy: 0.85 }, 13: { success: 0.15, maintain: 0.00, fail: 0.00, destroy: 0.85 }, 14: { success: 0.15, maintain: 0.00, fail: 0.00, destroy: 0.85 }, 15: { success: 0.15, maintain: 0.00, fail: 0.00, destroy: 0.85 } },
            highEnhancementRate: { success: 0.10, maintain: 0.90, fail: 0.00, destroy: 0.00 }
        };

const settings = await GameSettings.findOneAndUpdate(
    { settingId: 'main_settings' },
    { $set: defaultSettings }, 
    { new: true, upsert: true, setDefaultsOnInsert: true }
);

        gameSettings = settings.toObject();
        console.log('게임 설정을 DB에서 성공적으로 초기화 및 로드했습니다.');

    } catch (error) {
        console.error('게임 설정 로드 중 심각한 오류 발생:', error);
        process.exit(1);
    }
}

app.post('/api/finalize-registration', async (req, res) => {
    try {
        const { tempToken, username, password } = req.body;
        if (!tempToken || !username || !password) {
            return res.status(400).json({ message: '필수 정보가 누락되었습니다.' });
        }
        const decoded = jwt.verify(tempToken, JWT_SECRET);
        const { kakaoId } = decoded;
        const linkedAccounts = await User.find({ kakaoId });
        if (linkedAccounts.length >= 1) {
            return res.status(409).json({ message: '하나의 카카오 계정으로는 1개의 게임 계정만 생성할 수 있습니다.' });
        }
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ message: '이미 사용중인 닉네임입니다.' });
        }
        
        const newUser = new User({
            username,
            password,
            kakaoId: kakaoId,
            isKakaoVerified: true
        });
        await newUser.save();
        const newGameData = new GameData({ user: newUser._id, username: newUser.username });
        await newGameData.save();
        const remainingSlots = 2 - (linkedAccounts.length + 1);
        res.status(201).json({ message: `회원가입에 성공했습니다! (해당 카카오 계정으로 ${remainingSlots}개 더 가입 가능)` });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: '인증 시간이 만료되었습니다. 다시 시도해주세요.' });
        }
        console.error('최종 회원가입 오류:', error);
        res.status(500).json({ message: '서버 내부 오류가 발생했습니다.' });
    }
});

app.post('/api/finalize-linking', async (req, res) => {
    try {
        const { linkToken, kakaoTempToken, newUsername } = req.body;
        if (!linkToken || !kakaoTempToken || !newUsername) {
             return res.status(400).json({ message: '필수 정보가 누락되었습니다.' });
        }
        const userPayload = jwt.verify(linkToken, JWT_SECRET);
        const kakaoPayload = jwt.verify(kakaoTempToken, JWT_SECRET);
        const { userId } = userPayload;
        const { kakaoId } = kakaoPayload;
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: '기존 유저 정보를 찾을 수 없습니다.' });
        }
        const existingUsername = await User.findOne({ username: newUsername });
        if (existingUsername) {
            return res.status(409).json({ message: '이미 사용중인 닉네임입니다.' });
        }
        const linkedAccounts = await User.find({ kakaoId });
        if (linkedAccounts.length >= 1) {
             return res.status(409).json({ message: '하나의 카카오 계정으로는 1개의 게임 계정만 생성할 수 있습니다.' });
        }

        const oldUsername = user.username;
        user.username = newUsername;
        user.kakaoId = kakaoId;
        user.isKakaoVerified = true;
        await user.save();
       
        await GameData.updateOne({ user: userId }, { $set: { username: newUsername } });
        const payload = { userId: user._id, username: user.username };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '3h' });
        res.json({ message: `계정 연동 및 닉네임 변경 완료! 앞으로 '${newUsername}'으로 로그인하세요.`, token });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: '인증 시간이 만료되었습니다. 다시 시도해주세요.' });
        }
        console.error('계정 연동 오류:', error);
        res.status(500).json({ message: '서버 내부 오류가 발생했습니다.' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ message: '아이디와 비밀번호를 모두 입력해주세요.' });
        const user = await User.findOne({ username });
        if (!user) return res.status(401).json({ message: '아이디 또는 비밀번호가 일치하지 않습니다.' });
        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ message: '아이디 또는 비밀번호가 일치하지 않습니다.' });

        if (!user.isKakaoVerified) {
            const linkToken = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '10m' });
            return res.json({ needsKakaoLink: true, linkToken: linkToken });
        }
if (user.ban && user.ban.isBanned) {
    if (!user.ban.expiresAt || new Date(user.ban.expiresAt) > new Date()) {
        const expirationMsg = user.ban.expiresAt 
            ? `${new Date(user.ban.expiresAt).toLocaleString('ko-KR')}까지` 
            : '영구적으로';
        const reasonMsg = user.ban.reason ? `(사유: ${user.ban.reason})` : '';
        return res.status(403).json({ message: `이 계정은 ${expirationMsg} 접속이 제한되었습니다. ${reasonMsg}` });
    }
}
        const payload = { userId: user._id, username: user.username };
        if (user._id.toString() === ADMIN_OBJECT_ID) { payload.role = 'admin'; }
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '3h' });
        res.json({ message: '로그인 성공!', token });
    } catch (error) {
        console.error('로그인 오류:', error);
        res.status(500).json({ message: '서버 내부 오류가 발생했습니다.' });
    }
});

function createItemInstance(id, quantity = 1, enhancement = 0) {
    const d = itemData[id]; 
    if (!d) return null;

    const item = { 
        uid: new mongoose.Types.ObjectId().toString(), 
        id, 
        name: d.name, 
        type: d.type, 
        grade: d.grade,
        category: d.category,
        image: d.image, 
        accessoryType: d.accessoryType,
        description: d.description,
        tradable: d.tradable,
        quantity: quantity 
    };

    if (d.type === 'weapon' || d.type === 'armor') {
        item.baseEffect = d.baseEffect;
        item.enhancement = enhancement;
        item.enchantments = [];
    }
if (d.type === 'accessory' && d.enchantable) {
        item.enchantments = [];
    }

    if (d.grade === 'Primal' && d.randomStat) {
        const { min, max } = d.randomStat;
        const randomValue = Math.floor(Math.random() * (max - min + 1)) + min;
        item.randomizedValue = randomValue;

        const percentage = (randomValue - min) / (max - min);
        let quality;
        if (percentage >= 0.9) quality = '최상급';
        else if (percentage >= 0.7) quality = '상급';
        else if (percentage >= 0.4) quality = '중급';
        else quality = '최하급';
        
        item.quality = quality;
        item.name = `[${quality}] ${d.name}`;
    }

    return item;
}

function createPetInstance(id) {
    const d = petData[id];
    if (!d) return null;
    return { 
        uid: new mongoose.Types.ObjectId().toString(), 
        id, 
        name: d.name, 
        type: d.type, 
        grade: d.grade,
        attribute: d.attribute,
        image: d.image, 
        description: d.description,
        effects: d.effects,
        fused: d.fused,
        quantity: 1
    }; 
}

function getNormalizedIp(socket) {
    const forwardedFor = socket.handshake.headers['x-forwarded-for'];
    if (forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }
    let ip = socket.handshake.address;
    if (!ip) return 'unknown';
    if (ip === '::1') {
        return '127.0.0.1';
    }
    if (ip.startsWith('::ffff:')) {
        return ip.substring(7);
    }
    return ip;
}

async function sendMail(recipientId, sender, { item = null, gold = 0, description = '' }) {
    if (!recipientId || !description) {
        console.error('[sendMail] 오류: 필수 정보 누락', { recipientId, description });
        return;
    }
    try {
        const mail = new Mail({
            recipientId: recipientId,
            senderUsername: sender,
            item: item,
            gold: gold,
            description: description
        });
        await mail.save();
    
        const onlineRecipient = Object.values(onlinePlayers).find(p => p.user && p.user.toString() === recipientId.toString());
        if (onlineRecipient) {
            onlineRecipient.hasUnreadMail = true; 
            
            if (onlineRecipient.socket) {
                onlineRecipient.socket.emit('newMailNotification');
            }
        }
    } catch (error) {
        console.error(`[sendMail] 심각한 오류: 메일 저장 실패. 받는사람ID: ${recipientId}`, error);
    }
}

const getTotalCodexItemCount = () => {
    return (Object.keys(itemData).length - 3) + Object.keys(petData).length + Object.keys(artifactData).length;
};

function addDiscoveredItem(player, itemId) {
    if (player && itemId && !player.discoveredItems.includes(itemId)) {
        player.discoveredItems.push(itemId);
        
        const totalCount = getTotalCodexItemCount();
        if (!player.codexBonusActive && player.discoveredItems.length >= totalCount) {
            player.codexBonusActive = true;
            const message = `[도감] 모든 아이템을 수집하여 마스터 보너스가 활성화되었습니다! (체/공/방/골드/치명타 +5%)`;
            pushLog(player, message);
            io.emit('chatMessage', { isSystem: true, message: `🎉 ${player.username}님이 아이템 도감을 100% 완성했습니다! 🎉` });
            calculateTotalStats(player);
        }
    }
}

function handleItemStacking(player, item) {
    if (!item) {
        console.error("handleItemStacking 함수에 비정상적인 null 아이템이 전달되었습니다.");
        return;
    }
    addDiscoveredItem(player, item.id);
    if (item.type === 'pet') {
        player.petInventory.push(item);
    } else if (!item.tradable || item.enhancement > 0 || item.grade === 'Primal') {
        player.inventory.push(item);
    } else {
        const stackableItem = player.inventory.find(i => i.id === item.id && (!i.enhancement || i.enhancement === 0));
        if (stackableItem) {
            stackableItem.quantity += item.quantity;
        } else {
            player.inventory.push(item);
        }
    }
    checkStateBasedTitles(player);
}
function calculateTotalStats(player) {
    if (!player || !player.stats) return;

    // --- 1단계: 연구를 제외한 모든 소스에서 스탯 합산 ---
    const base = player.stats.base;
    let weaponBonus = 0;
    let armorBonus = 0;
    let buffAttackMultiplier = 1;
    let buffDefenseMultiplier = 1;
    let buffHpMultiplier = 1;
    let artifactAttackMultiplier = 1;
    let artifactDefenseMultiplier = 1;

    let titleEffects = player.equippedTitle ? titleData[player.equippedTitle]?.effect : null;
    let titleAttackBonus = 1;
    let titleHpBonus = 1;
    let titleCritBonus = 0;
    let titlePetStatBonus = 1;

    if (titleEffects) {
        if (titleEffects.attack) titleAttackBonus += titleEffects.attack;
        if (titleEffects.maxHp) titleHpBonus += titleEffects.maxHp;
        if (titleEffects.critChance) titleCritBonus += titleEffects.critChance;
        if (titleEffects.petStatBonus) titlePetStatBonus += titleEffects.petStatBonus;
    }

    // 스탯 초기화
    player.stats.critChance = 0;
    player.stats.critResistance = 0;
    player.focus = 0;
    player.penetration = 0;
    player.tenacity = 0;
    
    let petDefPenetration = 0;
    let enchantAttackPercent = 1;
    let enchantDefensePercent = 1;
    let enchantHpPercent = 1;
    let enchantAllStatsPercent = 1;
    let enchantDefPenetration = 0;

    if (player.equippedPet && player.equippedPet.effects) {
        const effects = player.equippedPet.effects;
        player.stats.critChance += (effects.critChance || 0) * titlePetStatBonus;
        player.stats.critResistance += (effects.critResistance || 0) * titlePetStatBonus;
        petDefPenetration = (effects.defPenetration || 0) * titlePetStatBonus;
    }

    if (player.equipment.wristwatch?.id === 'acc_wristwatch_01') player.stats.critChance += 0.20;
    if (player.equipment.wristwatch?.id === 'primal_acc_wristwatch_01') player.stats.critChance += 0.30;


    if (player.buffs && player.buffs.length > 0) {
        player.buffs.forEach(buff => {
            if (buff.effects.attackMultiplier) buffAttackMultiplier *= buff.effects.attackMultiplier;
            if (buff.effects.defenseMultiplier) buffDefenseMultiplier *= buff.effects.defenseMultiplier;
            if (buff.effects.hpMultiplier) buffHpMultiplier *= buff.effects.hpMultiplier;
        });
    }

    if (player.equipment.weapon) {
        weaponBonus = computeEnhanceBonus(player.equipment.weapon);
        if (titleEffects && titleEffects.commonWeaponAttackBonus && player.equipment.weapon.grade === 'Common') {
            weaponBonus += titleEffects.commonWeaponAttackBonus;
        }
    }
    if (player.equipment.armor) armorBonus = computeEnhanceBonus(player.equipment.armor);

    if (player.unlockedArtifacts[1] && isBossFloor(player.level)) {
        artifactAttackMultiplier += 0.50;
        artifactDefenseMultiplier += 0.50;
    }

    const allEquipment = [...Object.values(player.equipment), player.equippedPet];
    for (const item of allEquipment) {
        if (item && item.enchantments) {
            for (const enchant of item.enchantments) {
                switch (enchant.type) {
                    case 'focus': player.focus += enchant.value; break;
                    case 'penetration': player.penetration += enchant.value; break;
                    case 'tenacity': player.tenacity += enchant.value; break;
                    case 'attack_percent': enchantAttackPercent += (enchant.value / 100); break;
                    case 'defense_percent': enchantDefensePercent += (enchant.value / 100); break;
                    case 'hp_percent': enchantHpPercent += (enchant.value / 100); break;
                    case 'all_stats_percent': enchantAllStatsPercent += (enchant.value / 100); break;
                    case 'def_penetration': enchantDefPenetration += (enchant.value / 100); break;
                }
            }
        }
    }

    // --- 2단계: 연구 보너스 수치 집계 ---
    let researchBonuses = {
        attackPercent: 0, hpPercent: 0, defensePercent: 0, critChance: 0, critDamage: 0,
        penetration: 0, focus: 0, critResistance: 0, tenacity: 0, bloodthirst: 0,
        lowHpAttackPercent: 0,
    };
    if (player.research) {
        for (const specializationId in player.research) {
            const specialization = researchConfig[specializationId];
            if (!specialization) continue;

            const playerResearchLevels = player.research[specializationId] instanceof Map ? Object.fromEntries(player.research[specializationId]) : player.research[specializationId];

            for (const techId in playerResearchLevels) {
                const level = playerResearchLevels[techId];
                const tech = specialization.researches.find(t => t.id === techId);
                if (tech && level > 0) {
                    const bonus = tech.getBonus(level);
                    for (const key in bonus) {
                        researchBonuses[key] = (researchBonuses[key] || 0) + bonus[key];
                    }
                }
            }
        }
    }
    
    // --- 3단계: 최종 스탯 계산 및 연구 보너스(곱연산) 적용 ---
    
    // 기본 + 장비 + 버프 + 기타 보너스로 중간 합산
    let totalHp = (base.hp * (1 + armorBonus)) * buffHpMultiplier * enchantHpPercent * enchantAllStatsPercent * titleHpBonus;
    let totalAttack = (base.attack * (1 + weaponBonus)) * artifactAttackMultiplier * buffAttackMultiplier * enchantAttackPercent * enchantAllStatsPercent * titleAttackBonus;
    let totalDefense = (base.defense * (1 + armorBonus)) * artifactDefenseMultiplier * buffDefenseMultiplier * enchantDefensePercent * enchantAllStatsPercent;

    // 도감 보너스
    if (player.codexBonusActive) {
        totalHp *= 1.05;
        totalAttack *= 1.05;
        totalDefense *= 1.05;
        player.stats.critChance += 0.05;
    }
    if (player.titleCodexCompleted) {
        totalHp *= 1.05;
        totalAttack *= 1.05;
        totalDefense *= 1.05;
    }

    // 혈석 적용 (합산)
    player.bloodthirst += (researchBonuses.bloodthirst || 0);

    // 연구 보너스를 최종적으로 곱연산 적용
    totalHp *= (1 + researchBonuses.hpPercent);
    totalAttack *= (1 + researchBonuses.attackPercent);
    totalDefense *= (1 + researchBonuses.defensePercent);

    player.stats.critChance = (player.stats.critChance + titleCritBonus) * (1 + researchBonuses.critChance);
    player.stats.critResistance *= (1 + researchBonuses.critResistance);
    player.focus = player.focus * (1 + researchBonuses.focus);
    player.penetration = player.penetration * (1 + researchBonuses.penetration);
    player.tenacity = player.tenacity * (1 + researchBonuses.tenacity);
    
    // 최종 스탯 저장
    player.stats.total = {
        hp: totalHp,
        attack: totalAttack,
        defense: totalDefense,
        defPenetration: petDefPenetration + enchantDefPenetration,
        critDamage: researchBonuses.critDamage, // 치명타 피해는 합연산이 유리하므로 유지
        lowHpAttackPercent: researchBonuses.lowHpAttackPercent, 
    };
}


function computeEnhanceBonus(item) {
    if(!item) return 0;
    let bonus = item.baseEffect; 
    if (item.grade === 'Primal' && item.randomizedValue) {
        bonus += (item.randomizedValue / 100);
    }
    for (let i = 1; i <= item.enhancement; i++) { 
        bonus += item.baseEffect * (i <= 10 ? 0.1 : 0.5); 
    } 
    return bonus; 
}

async function loadGlobalRecords() { try { const records = await GlobalRecord.find({}); records.forEach(record => { globalRecordsCache[record.recordType] = record; }); console.log('전역 최고 기록을 DB에서 로드했습니다.'); } catch (error) { console.error('전역 기록 로드 중 오류 발생:', error); } }
async function updateGlobalRecord(recordType, data) { try { const updatedRecord = await GlobalRecord.findOneAndUpdate({ recordType }, { $set: { ...data, updatedAt: new Date() } }, { new: true, upsert: true }); globalRecordsCache[recordType] = updatedRecord; io.emit('globalRecordsUpdate', globalRecordsCache); console.log(`[기록 갱신] ${recordType}:`, data.username, data.itemName || `+${data.enhancementLevel}강`); } catch (error) { console.error(`${recordType} 기록 업데이트 중 오류 발생:`, error); } }

io.use(async (socket, next) => { const token = socket.handshake.auth.token; if (!token) { return next(new Error('인증 오류: 토큰이 제공되지 않았습니다.')); } try { const decoded = jwt.verify(token, JWT_SECRET); socket.userId = decoded.userId; socket.username = decoded.username; socket.role = decoded.role || 'user'; next(); } catch (error) { return next(new Error('인증 오류: 유효하지 않은 토큰입니다.')); } });

async function updateFameScore(socket, gameData) {
    if (!gameData || !gameData.equipment) return;
    const FAME_BY_GRADE = { Common: 10, Rare: 50, Legendary: 150, Epic: 400, Mystic: 1000, Primal: 3000 };
    const FAME_BONUS_PER_ENHANCEMENT = { Common: 1, Rare: 2, Legendary: 5, Epic: 10, Mystic: 25, Primal: 50 };
    const FAME_PER_1000_LEVELS = 10;
    let newFameScore = 0;
    const equipmentSlots = ['weapon', 'armor', 'necklace', 'earring', 'wristwatch'];
    for (const slot of equipmentSlots) {
        const item = gameData.equipment[slot];
        if (item && item.grade && FAME_BY_GRADE[item.grade]) {
            newFameScore += FAME_BY_GRADE[item.grade];
            if (item.enhancement > 0) {
                newFameScore += item.enhancement * FAME_BONUS_PER_ENHANCEMENT[item.grade];
            }
        }
    }
    
    if (gameData.maxLevel > 0) {
        newFameScore += Math.floor(gameData.maxLevel / 1000) * FAME_PER_1000_LEVELS;
    }
    if (newFameScore !== gameData.fameScore) {
        gameData.fameScore = newFameScore;
        await GameData.updateOne({ user: socket.userId }, { $set: { fameScore: newFameScore } });
        socket.emit('fameScoreUpdated', newFameScore);
        console.log(`[명성 업데이트] ${socket.username}님의 명성이 ${newFameScore}(으)로 변경되었습니다.`);
    }
}
io.on('connection', async (socket) => {
    const user = await User.findById(socket.userId).select('kakaoId isKakaoVerified').lean();
    if (!user || !user.isKakaoVerified || !user.kakaoId) {
        socket.emit('forceDisconnect', { message: '카카오 계정과 연동된 계정만 접속할 수 있습니다.' });
        socket.disconnect(true);
        return;
    }
    const newPlayerKakaoId = user.kakaoId;
    const clientIp = getNormalizedIp(socket);
    const existingPlayerWithSameIP = Object.values(onlinePlayers).find(p => getNormalizedIp(p.socket) === clientIp);
    if (existingPlayerWithSameIP) {
        if (existingPlayerWithSameIP.kakaoId !== newPlayerKakaoId) {
            console.log(`[연결 거부] 중복 IP 접속 시도 (다른 카카오 계정): ${socket.username} (${clientIp})`);
            socket.emit('forceDisconnect', { message: '해당 IP 주소에서는 다른 카카오 계정이 이미 접속 중입니다.' });
            socket.disconnect(true);
            return;
        }
    }
    
    if (onlinePlayers[socket.userId]) {
        const oldSocket = onlinePlayers[socket.userId].socket;
        oldSocket.emit('forceDisconnect', { message: '다른 기기 또는 탭에서 접속하여 연결을 종료합니다.' });
        oldSocket.disconnect(true);
    }
    
    console.log(`[연결] 유저: ${socket.username} (Role: ${socket.role})`);
    let gameData = await GameData.findOne({ user: socket.userId }).lean();
    if (!gameData) { 
        console.error(`[오류] ${socket.username}의 게임 데이터를 찾을 수 없습니다.`);
        return socket.disconnect(); 
    }

  if (gameData.research) {
        for (const specId in gameData.research) {
            if (typeof gameData.research[specId] === 'object' && gameData.research[specId] !== null) {
                gameData.research[specId] = new Map(Object.entries(gameData.research[specId]));
            }
        }
    }
    
    gameData.kakaoId = newPlayerKakaoId;




    if (gameData) {

gameData.isExploring = false;
        const foundItemIds = new Set(gameData.discoveredItems || []);
        (gameData.inventory || []).forEach(item => foundItemIds.add(item.id));
        Object.values(gameData.equipment || {}).forEach(item => {
            if (item) foundItemIds.add(item.id);
        });
        (gameData.petInventory || []).forEach(pet => foundItemIds.add(pet.id));
        if (gameData.equippedPet) {
            foundItemIds.add(gameData.equippedPet.id);
        }
        if (gameData.incubator && gameData.incubator.egg) {
            foundItemIds.add(gameData.incubator.egg.id);
        }
        (gameData.unlockedArtifacts || []).forEach(artifact => {
            if (artifact) foundItemIds.add(artifact.id);
        });
        gameData.discoveredItems = Array.from(foundItemIds);
    }
    if (!gameData) { 
        console.error(`[오류] ${socket.username}의 게임 데이터를 찾을 수 없습니다.`);
        return socket.disconnect(); 
    }
    if (user) {
        gameData.kakaoId = user.kakaoId;
    }
    if (!gameData.equipment) {
        gameData.equipment = {}; 
    }
    const requiredSlots = ['weapon', 'armor', 'necklace', 'earring', 'wristwatch'];
    requiredSlots.forEach(slotName => {
        if (typeof gameData.equipment[slotName] === 'undefined') {
            gameData.equipment[slotName] = null; 
        }
    });

    if (typeof gameData.isExploring === 'undefined') gameData.isExploring = false;
    if (typeof gameData.levelBeforeExploration === 'undefined') gameData.levelBeforeExploration = gameData.level;
    if (!gameData.unlockedArtifacts) gameData.unlockedArtifacts = [null, null, null];
    if (!gameData.petInventory) gameData.petInventory = [];
    if (typeof gameData.equippedPet === 'undefined') gameData.equippedPet = null;
    if (!gameData.incubator) gameData.incubator = { egg: null, hatchCompleteTime: null, hatchDuration: 0 };
    if (typeof gameData.hammerBuff === 'undefined') gameData.hammerBuff = false;
    if (typeof gameData.petReviveCooldown === 'undefined') gameData.petReviveCooldown = null;
    if (!gameData.fameScore) gameData.fameScore = 0;
    if (!gameData.petFusion) gameData.petFusion = { slot1: null, slot2: null, fuseEndTime: null };
    if (!gameData.stats.critChance) gameData.stats.critChance = 0;
    if (!gameData.stats.critResistance) gameData.stats.critResistance = 0;
    if (typeof gameData.riftShards === 'undefined') gameData.riftShards = 0;
    if (typeof gameData.focus === 'undefined') gameData.focus = 0;
    if (typeof gameData.penetration === 'undefined') gameData.penetration = 0;
    if (typeof gameData.tenacity === 'undefined') gameData.tenacity = 0;
    if (typeof gameData.safeZoneCooldownUntil === 'undefined') gameData.safeZoneCooldownUntil = null;
  if (!gameData.unlockedTitles) gameData.unlockedTitles = [];
    if (typeof gameData.equippedTitle === 'undefined') gameData.equippedTitle = null;
    if (typeof gameData.titleCodexCompleted === 'undefined') gameData.titleCodexCompleted = false;
if (!gameData.bloodthirst) gameData.bloodthirst = 0;
if (!gameData.personalRaid) {
    gameData.personalRaid = { entries: 2, lastReset: new Date(0) };
}   

 if (!gameData.titleCounters) {
        gameData.titleCounters = {
            destroyCount: 0, enhancementFailCount: 0, enchantCount: 0, hatchCount: 0,
            pouchUseCount: 0, sellCount: 0, ahBuyCount: 0, scrollUseCount: 0,
            deathCount: 0, wbLastHitCount: 0, wbParticipateCount: 0
        };
    }

if (typeof gameData.researchEssence === 'undefined') {
        gameData.researchEssence = 0;
    }
    if (!gameData.research) {
        gameData.research = {
            warlord: new Map(),
            guardian: new Map(),
            berserker: new Map(),
            pioneer: new Map()
        };
    }

    gameData.attackTarget = 'monster';
    
    const initialMonster = calcMonsterStats(gameData);
    onlinePlayers[socket.userId] = { 
        ...gameData, 
        monster: { 
            currentHp: initialMonster.hp,
            currentBarrier: initialMonster.barrier,
            lastCalculatedLevel: gameData.level
        }, 
        socket: socket, 
        buffs: [] ,
isStorageTransacting: false
    };

if (gameData.raidState && gameData.raidState.isActive) {
    const player = onlinePlayers[socket.userId];
 const userAccount = await User.findById(socket.userId).select('mute').lean();
        if (userAccount.mute && userAccount.mute.isMuted) {
            if (!userAccount.mute.expiresAt || new Date(userAccount.mute.expiresAt) > new Date()) {
                const expirationMsg = userAccount.mute.expiresAt
                    ? `${new Date(userAccount.mute.expiresAt).toLocaleString('ko-KR')}까지`
                    : '영구적으로';
                const reasonMsg = userAccount.mute.reason ? `(사유: ${userAccount.mute.reason})` : '';
                pushLog(player, `[시스템] 현재 채팅이 금지된 상태입니다. (${expirationMsg}) ${reasonMsg}`);
                return; 
            }
        }
    const floor = gameData.raidState.floor;
    player.raidState = {
        isActive: true,
        floor: floor,
        monster: calcPersonalRaidBossStats(floor)
    };
    player.raidState.monster.currentHp = player.raidState.monster.hp; 
    player.raidState.monster.currentBarrier = player.raidState.monster.barrier;
    console.log(`[레이드 복원] ${player.username}님이 ${floor}층에서 레이드를 재개합니다.`);
}
    
    await updateFameScore(socket, onlinePlayers[socket.userId]);
    calculateTotalStats(onlinePlayers[socket.userId]);
checkStateBasedTitles(onlinePlayers[socket.userId]);
    if (!onlinePlayers[socket.userId].stats.total) onlinePlayers[socket.userId].stats.total = {};
    onlinePlayers[socket.userId].currentHp = onlinePlayers[socket.userId].stats.total.hp;
    
    const chatHistory = await ChatMessage.find().sort({ timestamp: -1 }).limit(50).lean();
    socket.emit('chatHistory', chatHistory.reverse());
    socket.emit('initialGlobalRecords', globalRecordsCache);
    
socket.emit('enhancementData', { 
    enhancementTable: gameSettings.enhancementTable, 
    highEnhancementRate: gameSettings.highEnhancementRate 
});

    if (worldBossState && worldBossState.isActive) {
        const serializableState = { ...worldBossState, participants: Object.fromEntries(worldBossState.participants) };
        socket.emit('worldBossUpdate', serializableState);
    }
    sendState(socket, onlinePlayers[socket.userId], calcMonsterStats(onlinePlayers[socket.userId]));
    const player = onlinePlayers[socket.userId];
    const unreadMailCount = await Mail.countDocuments({ recipientId: player.user, isRead: false });
    player.hasUnreadMail = unreadMailCount > 0;
    const { socket: _, ...playerForClient } = player;
    socket.emit('initialState', {
        player: playerForClient, 
        monster: calcMonsterStats(player)
    });

    socket
        .on('upgradeStat', data => upgradeStat(onlinePlayers[socket.userId], data))
.on('personalRaid:start', () => startPersonalRaid(onlinePlayers[socket.userId]))
.on('personalRaid:leave', () => endPersonalRaid(onlinePlayers[socket.userId], false))
        .on('equipItem', uid => equipItem(onlinePlayers[socket.userId], uid))
        .on('unequipItem', slot => unequipItem(onlinePlayers[socket.userId], slot))
        .on('attemptEnhancement', ({ uid, useTicket, useHammer }) => attemptEnhancement(onlinePlayers[socket.userId], { uid, useTicket, useHammer }, socket))
        .on('sellItem', ({ uid, sellAll }) => sellItem(onlinePlayers[socket.userId], uid, sellAll))
        .on('setAttackTarget', (target) => {
            const player = onlinePlayers[socket.userId];
            if (!player) return;
            if (target === 'worldBoss') {
                if (player.attackTarget !== 'worldBoss') {
                    player.stateBeforeBossAttack = player.isExploring ? 'exploring' : 'climbing';
                    player.isExploring = false;
                }
                player.attackTarget = 'worldBoss';
            } else { 
                if (player.stateBeforeBossAttack === 'exploring') {
                    player.isExploring = true;
                } else {
                    player.isExploring = false;
                }
                player.attackTarget = 'monster';
            }
            socket.emit('attackTargetChanged', target);
        })
        .on('requestRanking', async () => { try { const topLevel = await GameData.find({ maxLevel: { $gt: 1 } }).sort({ maxLevel: -1 }).limit(10).lean(); const topGold = await GameData.find({ gold: { $gt: 0 } }).sort({ gold: -1 }).limit(10).lean(); const topWeapon = await GameData.find({ maxWeaponEnhancement: { $gt: 0 } }).sort({ maxWeaponEnhancement: -1 }).limit(10).lean(); const topArmor = await GameData.find({ maxArmorEnhancement: { $gt: 0 } }).sort({ maxArmorEnhancement: -1 }).limit(10).lean(); socket.emit('rankingData', { topLevel, topGold, topWeapon, topArmor }); } catch (error) { console.error("랭킹 데이터 조회 오류:", error); } })
        .on('requestOnlineUsers', () => {
            const totalUsers = Object.keys(onlinePlayers).length;
            const kakaoIdCounts = {};
            Object.values(onlinePlayers).forEach(p => {
                if (p.kakaoId) {
                    kakaoIdCounts[p.kakaoId] = (kakaoIdCounts[p.kakaoId] || 0) + 1;
                }
            });
            let subAccountCount = 0;
            Object.values(kakaoIdCounts).forEach(count => {
                if (count > 1) {
                    subAccountCount += (count - 1);
                }
            });
            const playersList = Object.values(onlinePlayers).map(p => ({
                username: p.username,
                level: p.level,
                weapon: p.equipment.weapon ? { name: p.equipment.weapon.name, grade: p.equipment.weapon.grade } : null,
                armor: p.equipment.armor ? { name: p.equipment.armor.name, grade: p.equipment.armor.grade } : null,
                fameScore: p.fameScore
            })).sort((a, b) => b.level - a.level);
            
            socket.emit('onlineUsersData', { playersList, totalUsers, subAccountCount });
        })

.on('chatMessage', async (msg) => {
    try {
        if (typeof msg !== 'string' || msg.trim().length === 0) return;
        const trimmedMsg = msg.slice(0, 200);
        const player = onlinePlayers[socket.userId];

const userAccount = await User.findById(socket.userId).select('mute').lean();
        if (userAccount.mute && userAccount.mute.isMuted) {
            if (!userAccount.mute.expiresAt || new Date(userAccount.mute.expiresAt) > new Date()) {
                const expirationMsg = userAccount.mute.expiresAt ? `${new Date(userAccount.mute.expiresAt).toLocaleString('ko-KR')}까지` : '영구적으로';
                const reasonMsg = userAccount.mute.reason ? `(사유: ${userAccount.mute.reason})` : '';
                pushLog(player, `[시스템] 현재 채팅이 금지된 상태입니다. (${expirationMsg}) ${reasonMsg}`);
                return;
            }
        }

        if (socket.role === 'admin' && trimmedMsg.startsWith('/')) {
            const args = trimmedMsg.substring(1).split(' ').filter(arg => arg.length > 0);
            const commandOrTarget = args.shift().toLowerCase();
            const adminUsername = socket.username;

            if (commandOrTarget === '추방') {
                const targetUsername = args.shift();
                const reason = args.join(' ') || '특별한 사유 없음';
                if (!targetUsername) {
                    return pushLog(player, '[관리자] 추방할 유저의 닉네임을 입력하세요. (예: /추방 유저명 [사유])');
                }
                const targetPlayer = Object.values(onlinePlayers).find(p => p.username.toLowerCase() === targetUsername.toLowerCase());
                if (targetPlayer) {
                    targetPlayer.socket.emit('forceDisconnect', { message: `관리자에 의해 서버와의 연결이 종료되었습니다. (사유: ${reason})` });
                    targetPlayer.socket.disconnect(true);
                    const announcement = `[관리자] ${adminUsername}님이 ${targetUsername}님을 추방했습니다. (사유: ${reason})`;
                    io.emit('chatMessage', { isSystem: true, message: announcement });
                    pushLog(player, announcement);
                } else {
                    pushLog(player, `[관리자] 현재 접속 중인 유저 중에서 '${targetUsername}'을(를) 찾을 수 없습니다.`);
                }
                return;
            }

          if (commandOrTarget === '레이드리셋') {
                try {

                    await GameData.updateMany(
                        {}, 
                        { $set: { "personalRaid.entries": 2 } }
                    );

                    Object.values(onlinePlayers).forEach(p => {
                        if (p && p.personalRaid) {
                            p.personalRaid.entries = 2;
                            pushLog(p, '[관리자]에 의해 개인 레이드 입장 횟수가 2회로 초기화되었습니다.');
                            sendPlayerState(p); 
                        }
                    });

                    const announcement = `[관리자] 서버 '전체 유저'의 개인 레이드 횟수가 초기화되었습니다.`;
                    io.emit('chatMessage', { isSystem: true, message: announcement });
                    pushLog(player, '[관리자] 서버 전체 유저의 개인 레이드 입장 횟수를 초기화했습니다.');

                } catch (error) {
                    console.error('[관리자] /레이드리셋 명령어 처리 중 DB 오류 발생:', error);
                    pushLog(player, '[오류] 전체 유저 레이드 횟수 초기화 중 문제가 발생했습니다.');
                }
                return;
            }


            if (commandOrTarget === '공지' || commandOrTarget === '보스소환') {
                if (commandOrTarget === '공지') {
                    const noticeMessage = args.join(' ');
                    io.emit('globalAnnouncement', noticeMessage);
                    io.emit('chatMessage', { type: 'announcement', username: adminUsername, role: 'admin', message: noticeMessage, title: player.equippedTitle });
                }
                if (commandOrTarget === '보스소환') spawnWorldBoss();
                return;
            }

 if (commandOrTarget === '보스제거') {
                if (!worldBossState || !worldBossState.isActive) {
                    return pushLog(player, '[관리자] 제거할 월드보스가 없습니다.');
                }

                const bossName = worldBossState.name;
               
                await WorldBossState.updateOne({ uniqueId: 'singleton' }, { $set: { isActive: false, currentHp: 0 } });
                
                worldBossState = null;

                io.emit('worldBossDefeated');

                const announcement = `[관리자] ${adminUsername}님이 월드보스(${bossName})를 제거했습니다.`;
                io.emit('chatMessage', { isSystem: true, message: announcement });
                pushLog(player, announcement);
                
                return; 
            }

            const target = commandOrTarget;
            const subject = args.shift();
            const param3 = args.shift();
            const description = args.join(' ') || '관리자가 지급한 선물입니다.';
            
            if (!target || !subject) {
                return pushLog(player, `[관리자] 명령어 형식이 잘못되었습니다. (예: /유저명 아이템명 [수량/강화] [내용])`);
            }

            let targets = [];
            let targetName = '';
            if (target === '온라인') {
                targetName = '온라인 전체 유저';
                targets = Object.values(onlinePlayers);
            } else if (target === '오프라인') {
                targetName = '오프라인 전체 유저';
                targets = await GameData.find({}).lean();
            } else {
                targetName = target;
                const onlineTarget = Object.values(onlinePlayers).find(p => p.username.toLowerCase() === target.toLowerCase());
                if (onlineTarget) { 
                    targets.push(onlineTarget); 
                } else { 
                    const offlineTarget = await GameData.findOne({ username: target }).lean(); 
                    if (offlineTarget) targets.push(offlineTarget);
                }
            }

            if (targets.length === 0) {
                return pushLog(player, `[관리자] 대상 유저 '${target}'을(를) 찾을 수 없습니다.`);
            }

            for (const t of targets) {
                const recipientId = t.user; 
                if (!recipientId) continue;
                const sender = `관리자(${adminUsername})`;

                if (subject.toLowerCase() === '골드') {
                    await sendMail(recipientId, sender, { gold: parseInt(param3 || '0', 10), description });
                } else {
                    const id = adminItemAlias[subject];
                    if (!id) {
                        pushLog(player, `[관리자] 아이템 단축어 '${subject}'를 찾을 수 없습니다.`);
                        continue;
                    }
                    
                    const d = itemData[id] || petData[id];
                    let item;

                    if (d.type === 'weapon' || d.type === 'armor') {
                        const enhancement = parseInt(param3 || '0', 10);
                        item = createItemInstance(id, 1, enhancement);
                    } else {
                        const quantity = parseInt(param3 || '1', 10);
                        item = petData[id] ? createPetInstance(id) : createItemInstance(id, quantity, 0);
                    }

                    if (item) await sendMail(recipientId, sender, { item: item, description });
                }
            }
            
            const isGold = subject.toLowerCase() === '골드';
            const itemInfo = isGold ? null : (itemData[adminItemAlias[subject]] || petData[adminItemAlias[subject]]);
            const givenItemName = isGold ? `${parseInt(param3 || '0', 10).toLocaleString()} 골드` : itemInfo?.name || subject;
            const givenItemGrade = isGold ? 'gold-text' : itemInfo?.grade || 'Common';
            const reasonText = description ? ` (${description})` : '';
            const chatAnnounceMsg = `[관리자] ${targetName}에게 <span class="${givenItemGrade}">${givenItemName}</span> 아이템을 우편으로 발송했습니다.${reasonText}`;
            io.emit('chatMessage', { type: 'announcement', username: adminUsername, role: 'admin', message: chatAnnounceMsg, title: player.equippedTitle });
            return;
        }

        const newChatMessage = new ChatMessage({ 
            username: socket.username, 
            role: socket.role, 
            fameScore: player ? player.fameScore : 0, 
            message: trimmedMsg,
            title: player ? player.equippedTitle : null 
        });
        await newChatMessage.save();
        const payload = { ...newChatMessage.toObject(), title: player ? player.equippedTitle : null };
        io.emit('chatMessage', payload);

    } catch (error) {
        console.error('채팅 메시지 처리 중 오류 발생:', error);
    }
})


  
       .on('showOffItem', ({ uid }) => {
    const player = onlinePlayers[socket.userId];
    if (!player || !uid) return;

    let itemToShow = null;
    for (const slot in player.equipment) {
        if (player.equipment[slot] && player.equipment[slot].uid === uid) {
            itemToShow = player.equipment[slot];
            break;
        }
    }

    if (!itemToShow && player.equippedPet && player.equippedPet.uid === uid) {
        itemToShow = player.equippedPet;
    }

    if (!itemToShow) {
        itemToShow = player.inventory.find(i => i.uid === uid);
    }

    if (!itemToShow) {
        itemToShow = player.petInventory.find(i => i.uid === uid);
    }

    if (itemToShow) {
        const chatMessage = {
            type: 'item_show_off',
            username: player.username,
            role: player.role,
            fameScore: player.fameScore,
            message: `[${itemToShow.name}] 아이템을 자랑합니다!`,
            itemData: itemToShow,
title: player.equippedTitle
        };
        io.emit('chatMessage', chatMessage);
    }
})
        .on('getAuctionListings', async (callback) => {
            try {
                const allListings = await AuctionItem.find({}).sort({ listedAt: 'asc' }).lean();
                const groupedItems = allListings.reduce((acc, listing) => {
                    const item = listing.item;
                    const groupKey = `${item.id}_${item.enhancement || 0}`;
                    if (!acc[groupKey]) {
                        acc[groupKey] = {
                            key: groupKey,
                            itemData: { ...item, quantity: 0 }, 
                            listings: [],
                            lowestPrice: Infinity,
                            totalQuantity: 0,
                        };
                    }
                    const group = acc[groupKey];
                    group.listings.push(listing);
                    group.totalQuantity += item.quantity;
                    if (listing.price < group.lowestPrice) {
                        group.lowestPrice = listing.price;
                    }
                    return acc;
                }, {});
                
                const finalGroupedList = Object.values(groupedItems).map(group => ({
                    key: group.key,
                    item: group.itemData, 
                    lowestPrice: group.lowestPrice,
                    totalQuantity: group.totalQuantity
                }));
                finalGroupedList.sort((a, b) => a.item.name.localeCompare(b.item.name));
                
                callback({
                    groupedList: finalGroupedList,
                    allListings: allListings
                });
            } catch (e) {
                console.error('거래소 목록 조회 오류:', e);
                callback({ groupedList: [], allListings: [] });
            }
        })
        .on('slotPetForFusion', ({ uid }) => {
            const player = onlinePlayers[socket.userId];
            if (!player || !uid) return;
            if (player.petFusion.fuseEndTime) return pushLog(player, '[융합] 현재 융합이 진행 중입니다.');
            const petIndex = player.petInventory.findIndex(p => p.uid === uid);
            if (petIndex === -1) return;
            const pet = player.petInventory[petIndex];
            if (pet.grade !== 'Epic' || pet.fused) {
                return pushLog(player, '[융합] 에픽 등급의 일반 펫만 재료로 사용할 수 있습니다.');
            }
            const { slot1, slot2 } = player.petFusion;
            if ((slot1 && slot1.uid === uid) || (slot2 && slot2.uid === uid)) {
                return pushLog(player, '[융합] 이미 등록된 펫입니다.');
            }
            const targetSlot = !slot1 ? 'slot1' : !slot2 ? 'slot2' : null;
            if (!targetSlot) return pushLog(player, '[융합] 재료 슬롯이 모두 가득 찼습니다.');
            const otherPet = targetSlot === 'slot1' ? slot2 : slot1;
            if (otherPet && otherPet.attribute === pet.attribute) {
                return pushLog(player, '[융합] 재료로 사용할 두 펫은 서로 속성이 달라야 합니다.');
            }
            player.petFusion[targetSlot] = player.petInventory.splice(petIndex, 1)[0];
            sendState(socket, player, calcMonsterStats(player));
        })
        .on('unslotPetFromFusion', ({ slotIndex }) => {
            const player = onlinePlayers[socket.userId];
            if (!player || !slotIndex) return;
            if (player.petFusion.fuseEndTime) return;
            const targetSlotKey = `slot${slotIndex}`;
            const petToUnslot = player.petFusion[targetSlotKey];
            if (petToUnslot) {
                player.petInventory.push(petToUnslot);
                player.petFusion[targetSlotKey] = null;
                sendState(socket, player, calcMonsterStats(player));
            }
        })
        .on('startPetFusion', () => {
            const player = onlinePlayers[socket.userId];
            if (!player) return;
            const { slot1, slot2 } = player.petFusion;
            if (!slot1 || !slot2) return pushLog(player, '[융합] 융합할 펫 2마리를 모두 등록해야 합니다.');
            if (player.gold < 100000000) return pushLog(player, '[융합] 비용이 부족합니다. (1억 골드 필요)');
            if (player.petFusion.fuseEndTime) return;
            player.gold -= 100000000;
            player.petFusion.fuseEndTime = new Date(Date.now() + 12 * 60 * 60 * 1000);
            
            pushLog(player, '[융합] 두 정령의 기운이 합쳐지기 시작합니다. (12시간 소요)');
            sendState(socket, player, calcMonsterStats(player));
        })
        .on('useItem', ({ uid, useAll }) => useItem(onlinePlayers[socket.userId], uid, useAll))
        .on('placeEggInIncubator', ({ uid }) => placeEggInIncubator(onlinePlayers[socket.userId], uid))
        .on('startHatching', () => startHatching(onlinePlayers[socket.userId]))
        .on('equipPet', (uid) => equipPet(onlinePlayers[socket.userId], uid))
        .on('unequipPet', () => unequipPet(onlinePlayers[socket.userId]))
        .on('removeEggFromIncubator', () => {
            const player = onlinePlayers[socket.userId];
            if (player && player.incubator.egg && !player.incubator.hatchCompleteTime) {
                const egg = player.incubator.egg;
                handleItemStacking(player, egg);
                player.incubator.egg = null;
                player.incubator.hatchDuration = 0;
                pushLog(player, `[부화기] ${egg.name}을(를) 인벤토리로 옮겼습니다.`);
                sendInventoryUpdate(player);
            }
        })
        .on('client-heartbeat', () => {})
        .on('board:getPosts', async ({ category, page }, callback) => {
            try {
                const perPage = 15;
                const currentPage = Math.max(1, page);
                let query = {};
                if (category === '공지') {
                    query = { category: '공지' };
                } else {
                    query = { $or: [{ category: category }, { category: '공지' }] };
                }
                const posts = await Post.aggregate([
                    { $match: query },
                    {
                        $addFields: {
                            sortOrder: {
                                $cond: [{ $eq: ['$category', '공지'] }, 1, 2]
                            }
                        }
                    },
                    { $sort: { sortOrder: 1, createdAt: -1 } },
                    { $skip: (currentPage - 1) * perPage },
                    { $limit: perPage }
                ]);
                const totalPosts = await Post.countDocuments(query);
                const totalPages = Math.ceil(totalPosts / perPage);
                for (const post of posts) {
                    const authorData = await GameData.findOne({ user: post.authorId }).select('fameScore').lean();
                    post.authorFameTier = authorData ? getFameTier(authorData.fameScore) : '';
                    post.likesCount = post.likes.length;
                    post.commentCount = post.comments ? post.comments.length : 0;
                }
                
                callback({ posts, totalPages });
            } catch (e) {
                console.error('Error getting posts:', e);
                callback({ posts: [], totalPages: 0 });
            }
        })
        .on('board:getPost', async ({ postId }, callback) => {
            try {
                const post = await Post.findById(postId).lean();
                if (!post) return callback(null);
                const authorData = await GameData.findOne({ user: post.authorId }).select('fameScore').lean();
                post.authorFameTier = authorData ? getFameTier(authorData.fameScore) : '';
                for (const comment of post.comments) {
                    const commentAuthorData = await GameData.findOne({ user: comment.authorId }).select('fameScore').lean();
                    comment.authorFameTier = commentAuthorData ? getFameTier(commentAuthorData.fameScore) : '';
                }
                callback(post);
            } catch (e) {
                console.error('Error getting post detail:', e);
                callback(null);
            }
        })
        .on('board:createPost', async (data, callback) => {
            try {
                if (data.category === '공지' && socket.role !== 'admin') {
                    return callback(false);
                }
                const sanitizedContent = sanitizeHtml(data.content, sanitizeOptions);
                const post = new Post({
                    authorId: socket.userId,
                    authorUsername: socket.username,
                    category: data.category,
                    title: data.title,
                    content: sanitizedContent
                });
                await post.save();
                callback(true);
            } catch (e) {
                console.error('Error creating post:', e);
                callback(false);
            }
        })
        .on('board:updatePost', async (data, callback) => {
            try {
                const post = await Post.findById(data.postId);
                if (!post || post.authorId.toString() !== socket.userId) return callback(false);
                
                const sanitizedContent = sanitizeHtml(data.content, sanitizeOptions);
                
                post.category = data.category;
                post.title = data.title;
                post.content = sanitizedContent;
                await post.save();
                callback(true);
            } catch (e) {
                callback(false);
            }
        })
        .on('board:deletePost', async ({ postId }, callback) => {
            try {
                const post = await Post.findById(postId);
                if (!post || post.authorId.toString() !== socket.userId) return callback(false);
                await Post.findByIdAndDelete(postId);
                callback(true);
            } catch (e) {
                callback(false);
            }
        })
        .on('board:likePost', async ({ postId }, callback) => {
            try {
                const post = await Post.findById(postId);
                const likedIndex = post.likes.indexOf(socket.userId);
                if (likedIndex > -1) {
                    post.likes.splice(likedIndex, 1);
                } else {
                    post.likes.push(socket.userId); 
                }
                await post.save();
                callback({ likesCount: post.likes.length });
            } catch (e) {
                callback({ likesCount: null });
            }
        })
        .on('board:createComment', async ({ postId, content }, callback) => {
            try {
                const post = await Post.findById(postId);
                const player = onlinePlayers[socket.userId];
                const fameTier = player ? getFameTier(player.fameScore) : '';
                post.comments.push({
                    postId: postId,
                    authorId: socket.userId,
                    authorUsername: socket.username,
                    content: content,
                    fameTier: fameTier
                });
                await post.save();
                callback(true);
            } catch (e) {
                console.error('Error creating comment:', e); 
                callback(false);
            }
        })
        .on('board:deleteComment', async ({ postId, commentId }, callback) => {
            try {
                const post = await Post.findById(postId);
                const comment = post.comments.id(commentId);
                if (!comment || comment.authorId.toString() !== socket.userId) return callback(false);
                comment.remove();
                await post.save();
                callback(true);
            } catch (e) {
                callback(false);
            }
        })
        .on('board:likeComment', async ({ postId, commentId }, callback) => {
            try {
                const post = await Post.findById(postId);
                const comment = post.comments.id(commentId);
                const likedIndex = comment.likes.indexOf(socket.userId);
                if (likedIndex > -1) {
                    comment.likes.splice(likedIndex, 1);
                } else {
                    comment.likes.push(socket.userId);
                }
                await post.save();
                callback({ likesCount: comment.likes.length });
            } catch(e) {
                callback({ likesCount: null });
            }
        })
        .on('requestUserInfo', (username) => {
            const targetPlayer = Object.values(onlinePlayers).find(p => p.username === username);
            if (targetPlayer) {
                calculateTotalStats(targetPlayer);
                const { socket: _, ...playerData } = targetPlayer;
                socket.emit('userInfoResponse', playerData);
            } else {
                socket.emit('userInfoResponse', null);
            }
        })


     .on('mailbox:get', async (callback) => {
    try {
        const mails = await Mail.find({ recipientId: socket.userId }).sort({ createdAt: -1 }).lean();
        callback(mails);
    } catch (e) { callback([]); }
})
.on('mailbox:claim', async ({ mailId }, callback) => {
    const player = onlinePlayers[socket.userId];
    if (!player) return callback({ success: false, message: '플레이어 정보를 찾을 수 없습니다.' });
    if (player.isBusy) {
        return callback({ success: false, message: '이전 요청을 처리 중입니다.' });
    }
    player.isBusy = true;
    try {
        const mail = await Mail.findById(mailId);
        if (!mail || mail.recipientId.toString() !== socket.userId) {
            return callback({ success: false, message: '우편을 수령할 수 없습니다.' });
        }

        if (mail.item) handleItemStacking(player, mail.item);
        if (mail.gold > 0) player.gold += mail.gold;

        await Mail.findByIdAndDelete(mailId);
        pushLog(player, `[우편] '${mail.description}' 보상을 수령했습니다.`);

        const remainingMailCount = await Mail.countDocuments({ recipientId: socket.userId });
        if (remainingMailCount === 0) {
            player.hasUnreadMail = false;
        }

        sendState(socket, player, calcMonsterStats(player));
        sendInventoryUpdate(player);
        callback({ success: true });
    } catch (e) {
        callback({ success: false, message: '오류가 발생했습니다.' });
    } finally {
        if (player) player.isBusy = false;
    }
})
.on('mailbox:claimAll', async (callback) => {
    const player = onlinePlayers[socket.userId];
    if (!player) return callback({ success: false, message: '플레이어 정보를 찾을 수 없습니다.' });
    if (player.isBusy) {
        return callback({ success: false, message: '이전 요청을 처리 중입니다.' });
    }
    player.isBusy = true;
    try {
        const mails = await Mail.find({ recipientId: socket.userId });
        if (mails.length === 0) {
            player.hasUnreadMail = false;
            sendPlayerState(player);
            return callback({ success: true });
        }

        let totalGold = 0;
        for (const mail of mails) {
            if (mail.item) handleItemStacking(player, mail.item);
            if (mail.gold > 0) totalGold += mail.gold;
        }
        player.gold += totalGold;

        await Mail.deleteMany({ recipientId: socket.userId });
        player.hasUnreadMail = false;
        pushLog(player, `[우편] ${mails.length}개의 우편을 모두 수령했습니다.`);

        sendState(socket, player, calcMonsterStats(player));
        sendInventoryUpdate(player);
        callback({ success: true });
    } catch (e) {
        callback({ success: false, message: '오류가 발생했습니다.' });
    } finally {
        if (player) player.isBusy = false;
    }
})
        .on('listOnAuction', async ({ uid, price, quantity }, callback) => { 
            if (!onlinePlayers[socket.userId]) return;
            const result = await listOnAuction(onlinePlayers[socket.userId], { uid, price, quantity });
            if (callback) { 
                callback(result);
            }
        })
        .on('buyFromAuction', async ({ listingId, quantity }) => buyFromAuction(onlinePlayers[socket.userId], { listingId, quantity }))
        .on('cancelAuctionListing', async (listingId) => cancelAuctionListing(onlinePlayers[socket.userId], listingId))
        .on('codex:getData', (callback) => {
            try {
                const player = onlinePlayers[socket.userId];
                if (!player) return callback(null);
                const allItems = {
                    weapons: Object.entries(itemData).filter(([, d]) => d.type === 'weapon').map(([id, data]) => ({ id, ...data })),
                    armors: Object.entries(itemData).filter(([, d]) => d.type === 'armor').map(([id, data]) => ({ id, ...data })),
                    accessories: Object.entries(itemData).filter(([, d]) => d.type === 'accessory').map(([id, data]) => ({ id, ...data })),
                    etc: Object.entries(itemData).filter(([id, d]) => d.type !== 'weapon' && d.type !== 'armor' && d.type !== 'accessory' && !id.startsWith('tome_socket')).map(([id, data]) => ({ id, ...data })),
                    pets: Object.entries(petData).map(([id, data]) => ({ id, ...data })),
                    artifacts: Object.values(artifactData)
                };
                const totalItemCount = getTotalCodexItemCount();
                const discoveredCount = (player.discoveredItems || []).length;
                const completionPercentage = totalItemCount > 0 ? (discoveredCount / totalItemCount) * 100 : 0;
                callback({
                    allItems,
                    discovered: player.discoveredItems || [],
                    totalItemCount,
                    discoveredCount,
                    completionPercentage
                });
            } catch (e) {
                console.error('도감 데이터 전송 오류:', e);
                callback(null);
            }
        })

.on('titles:getData', (callback) => {
            const player = onlinePlayers[socket.userId];
            if (!player) return callback(null);
            checkStateBasedTitles(player);

            callback({
                allTitles: titleData,
                unlockedTitles: player.unlockedTitles,
                equippedTitle: player.equippedTitle
            });
        })
        .on('titles:equip', (titleName) => {
            const player = onlinePlayers[socket.userId];
            if (!player || !titleData[titleName] || !player.unlockedTitles.includes(titleName)) {
                return;
            }
            player.equippedTitle = titleName;
            calculateTotalStats(player);
            sendState(socket, player, calcMonsterStats(player));
            pushLog(player, `칭호 ${titleName}을(를) 장착했습니다.`);
        })

        .on('titles:unequip', () => {
            const player = onlinePlayers[socket.userId];
            if (!player || player.equippedTitle === null) return;
            
            const unequippedTitle = player.equippedTitle;
            player.equippedTitle = null;
            calculateTotalStats(player);
            sendState(socket, player, calcMonsterStats(player));
            pushLog(player, `칭호 ${unequippedTitle}을(를) 해제했습니다.`);
        })

   .on('enchantRiftItem', ({ uid, lockedIndices }, callback) => {
    const player = onlinePlayers[socket.userId];
    if (!player) return callback({ success: false });

    let item;
    let itemLocation = null;
    let itemIndex = -1;

    for (const slot of ['weapon', 'armor']) {
        if (player.equipment[slot] && player.equipment[slot].uid === uid) {
            item = player.equipment[slot];
            itemLocation = 'equipment';
            break;
        }
    }
    if (!item) {
        itemIndex = player.inventory.findIndex(i => i.uid === uid);
        if (itemIndex > -1) {
            item = player.inventory[itemIndex];
            itemLocation = 'inventory';
        }
    }

const isEnchantable = item && (item.type === 'weapon' || item.type === 'armor' || (item.type === 'accessory' && item.grade === 'Primal'));
    if (!isEnchantable) {
        pushLog(player, '[마법부여] 마법부여가 불가능한 아이템입니다.');
        return callback({ success: false });
    }

    const requiredStones = lockedIndices.length;
    if (requiredStones > 0) {
        const stoneItem = player.inventory.find(i => i.id === 'form_locking_stone');
        if (!stoneItem || stoneItem.quantity < requiredStones) {
            pushLog(player, `[마법부여] 형상의 고정석이 부족합니다. (필요: ${requiredStones}개)`);
            return callback({ success: false });
        }
    }

    const shardItem = player.inventory.find(i => i.id === 'rift_shard');
    if (!shardItem || shardItem.quantity < RIFT_ENCHANT_COST.SHARDS) {
        pushLog(player, `[마법부여] 균열의 파편이 부족합니다. (필요: ${RIFT_ENCHANT_COST.SHARDS}개)`);
        return callback({ success: false });
    }


    const titleEffects = player.equippedTitle ? titleData[player.equippedTitle]?.effect : null;
    let costReduction = 0;
    if (titleEffects && titleEffects.enchantCostReduction) {
        costReduction = titleEffects.enchantCostReduction;
    }
    const finalGoldCost = Math.floor(RIFT_ENCHANT_COST.GOLD * (1 - costReduction));

    if (player.gold < finalGoldCost) {
        pushLog(player, `[마법부여] 골드가 부족합니다. (필요: ${finalGoldCost.toLocaleString()} G)`);
        return callback({ success: false });
    }

    if (requiredStones > 0) {
        const stoneItem = player.inventory.find(i => i.id === 'form_locking_stone');
        stoneItem.quantity -= requiredStones;
        if (stoneItem.quantity <= 0) {
            player.inventory = player.inventory.filter(i => i.uid !== stoneItem.uid);
        }
    }
    const shardItemToConsume = player.inventory.find(i => i.id === 'rift_shard');
    shardItemToConsume.quantity -= RIFT_ENCHANT_COST.SHARDS;
    if (shardItemToConsume.quantity <= 0) {
        player.inventory = player.inventory.filter(i => i.uid !== shardItemToConsume.uid);
    }
    player.gold -= finalGoldCost;

    const newEnchantments = [];
    const existingEnchantments = item.enchantments || [];
    for (let i = 0; i < 4; i++) {
        if (lockedIndices.includes(i) && existingEnchantments[i]) {
            newEnchantments.push(existingEnchantments[i]);
        } else {
            const randomOptionInfo = riftEnchantOptions[Math.floor(Math.random() * riftEnchantOptions.length)];
            let value;
            if (randomOptionInfo.value) {
                value = randomOptionInfo.value;
            } else {
                value = Math.floor(Math.random() * (randomOptionInfo.max - randomOptionInfo.min + 1)) + randomOptionInfo.min;
            }
            newEnchantments.push({
                type: randomOptionInfo.type,
                value: value,
                grade: randomOptionInfo.grade
            });
        }
    }
    item.enchantments = newEnchantments;
    

    if (player.titleCounters) {
        player.titleCounters.enchantCount = (player.titleCounters.enchantCount || 0) + 1;

    }
    checkStateBasedTitles(player);

    calculateTotalStats(player);
    pushLog(player, `[마법부여] ${item.name}에 새로운 힘이 깃들었습니다.`);
    sendState(socket, player, calcMonsterStats(player));
    sendInventoryUpdate(player);
    if(callback) callback({ success: true, newItem: item });
})


        .on('moveToSafeZone', () => {
            const player = onlinePlayers[socket.userId];
            if (!player || player.level < 1000000) return;
            player.level = 500000;
            player.safeZoneCooldownUntil = new Date(Date.now() + 1800000); 
            const newMonster = calcMonsterStats(player);
            player.monster.currentHp = newMonster.hp;
            player.monster.currentBarrier = newMonster.barrier;
            player.monster.lastCalculatedLevel = player.level;
            pushLog(player, '[시스템] 50만 층 안전지대로 이동했습니다. 최전선 복귀는 30분 후에 가능합니다.');
            sendState(socket, player, newMonster);
        })
        .on('returnToFrontline', () => {
            const player = onlinePlayers[socket.userId];
            if (!player || player.maxLevel < 1000000) return;

            if (player.safeZoneCooldownUntil && new Date() < new Date(player.safeZoneCooldownUntil)) {
                const remaining = Math.ceil((new Date(player.safeZoneCooldownUntil) - new Date()) / 1000);
                pushLog(player, `[시스템] 아직 최전선으로 복귀할 수 없습니다. (${remaining}초 남음)`);
                return;
            }

            player.level = 1000000;
            const newMonster = calcMonsterStats(player);
            player.monster.currentHp = newMonster.hp;
            player.monster.currentBarrier = newMonster.barrier;
            player.monster.lastCalculatedLevel = player.level;
            pushLog(player, `[시스템] 최전선(100만층)으로 복귀합니다.`);
            sendState(socket, player, newMonster);
        })
.on('admin:getDashboardData', async (callback) => {
            if (socket.role !== 'admin') return;
            try {
                const totalUsers = await User.countDocuments();
                const onlineUsers = Object.values(onlinePlayers).map(p => ({
                    userId: p.user.toString(),
                    username: p.username,
                    level: p.level,
                    fameScore: p.fameScore
                })).sort((a,b) => b.level - a.level);

                const aggregation = await GameData.aggregate([ { $group: { _id: null, totalGold: { $sum: "$gold" } } } ]);
                const totalGold = aggregation.length > 0 ? aggregation[0].totalGold : 0;
                
                callback({ onlineUserCount: onlineUsers.length, totalUserCount: totalUsers, totalGold, onlineUsers });
            } catch (error) {
                console.error("어드민 대시보드 데이터 로드 오류:", error);
                callback(null);
            }
        })
      .on('admin:searchUser', async (username, callback) => {
            if (socket.role !== 'admin') return;
            try {
                const user = await User.findOne({ username }).lean();
                if (!user) return callback({ success: false, message: '유저를 찾을 수 없습니다.' });

                const gameData = await GameData.findOne({ user: user._id }).lean();
                const auctionListings = await AuctionItem.find({ sellerId: user._id }).sort({ listedAt: -1 }).lean();

                callback({ success: true, data: { user, gameData, auctionListings } });
            } catch (error) {
                 console.error('[관리자] 유저 검색 오류:', error);
                 callback({ success: false, message: '검색 중 오류가 발생했습니다.' });
            }
        })

.on('admin:deleteInventoryItem', async ({ userId, username, itemUid, inventoryType, quantity }, callback) => {
            if (socket.role !== 'admin') return;
            try {
                const inventoryPath = inventoryType === 'pet' ? 'petInventory' : 'inventory';
                const gameData = await GameData.findOne({ user: userId });
                if (!gameData) return callback({ success: false, message: '유저 데이터를 찾을 수 없습니다.' });

                const inventory = gameData[inventoryPath];
                const itemIndex = inventory.findIndex(i => i.uid === itemUid);
                if (itemIndex === -1) return callback({ success: false, message: '아이템을 찾을 수 없습니다.' });

                const item = inventory[itemIndex];
                

                if (quantity && quantity < item.quantity) {
                    item.quantity -= quantity;
                } else {
                    inventory.splice(itemIndex, 1);
                }
                
                await gameData.save();


                const onlinePlayer = onlinePlayers[userId];
                if (onlinePlayer) {
                    onlinePlayer[inventoryPath] = gameData[inventoryPath];
                    
                    sendInventoryUpdate(onlinePlayer);
                }

                new AdminLog({ adminUsername: socket.username, actionType: 'delete_inventory_item', targetUsername: username, details: { itemUid, inventoryType, quantity: quantity || 'all' } }).save();
                callback({ success: true });
            } catch (error) {
                console.error(`[관리자] 아이템 삭제 오류:`, error);
                callback({ success: false, message: '아이템 삭제 중 오류 발생' });
            }
        })
        .on('admin:deleteAuctionListing', async ({ listingId, username }, callback) => {
            if (socket.role !== 'admin') return;
            try {
                const listing = await AuctionItem.findByIdAndDelete(listingId);
                if (listing) {

                    await sendMail(listing.sellerId, '관리자', {
                        item: listing.item,
                        description: `관리자에 의해 경매 등록이 취소되어 아이템이 반환되었습니다.`
                    });

                    new AdminLog({ adminUsername: socket.username, actionType: 'delete_auction_listing', targetUsername: username, details: { listing } }).save();
                    io.emit('auctionUpdate'); 
                    callback({ success: true });
                } else {
                    callback({ success: false, message: '이미 처리되었거나 존재하지 않는 경매입니다.' });
                }
            } catch (error) {
                console.error(`[관리자] 경매 삭제 오류:`, error);
                callback({ success: false, message: '경매 삭제 중 오류 발생' });
            }
        })

.on('admin:deleteEquippedItem', async ({ userId, username, slotType }, callback) => {
            if (socket.role !== 'admin') return;
            try {

                const updatePath = slotType === 'pet' ? 'equippedPet' : `equipment.${slotType}`;
                await GameData.updateOne({ user: userId }, { $set: { [updatePath]: null } });


                const onlinePlayer = onlinePlayers[userId];
                if (onlinePlayer) {
                    if (slotType === 'pet') {
                        onlinePlayer.equippedPet = null;
                    } else {
                        onlinePlayer.equipment[slotType] = null;
                    }
                    calculateTotalStats(onlinePlayer); 
                    sendPlayerState(onlinePlayer);
                }

                new AdminLog({ adminUsername: socket.username, actionType: 'delete_equipped_item', targetUsername: username, details: { slotType } }).save();
                callback({ success: true });
            } catch (error) {
                console.error(`[관리자] 장착 아이템 삭제 오류:`, error);
                callback({ success: false, message: '장착 아이템 삭제 중 오류 발생' });
            }
        })




        .on('admin:updateUserData', async ({ userId, updates }) => {
            if (socket.role !== 'admin') return;
            try {
                const finalUpdates = {};
                Object.keys(updates).forEach(key => {
                    const value = (updates[key] !== '' && !isNaN(updates[key])) ? Number(updates[key]) : updates[key];
                    if (key !== 'username') { 
                        finalUpdates[key] = value;
                    }
                });

                await GameData.updateOne({ user: userId }, { $set: finalUpdates });

                const onlinePlayer = onlinePlayers[userId];
                if (onlinePlayer) {
            
                    Object.keys(finalUpdates).forEach(key => {
                        if (key.includes('.')) {
                            const keys = key.split('.');
                            let temp = onlinePlayer;
                            for (let i = 0; i < keys.length - 1; i++) {
                                temp = temp[keys[i]] = temp[keys[i]] || {};
                            }
                            temp[keys[keys.length - 1]] = finalUpdates[key];
                        } else {
                            onlinePlayer[key] = finalUpdates[key];
                        }
                    });
                    calculateTotalStats(onlinePlayer);
                    sendState(onlinePlayer.socket, onlinePlayer, calcMonsterStats(onlinePlayer));
                }
                new AdminLog({ adminUsername: socket.username, actionType: 'update_user', targetUsername: updates.username, details: { userId, updates } }).save();
            } catch (error) {
                console.error(`[관리자] 유저 데이터 업데이트 오류:`, error);
            }
        })
       .on('admin:grantItem', async ({ userId, username, itemAlias, quantity, enhancement, primalQuality }) => {
    if (socket.role !== 'admin') return;
    
    const itemId = adminItemAlias[itemAlias];
    if (!itemId) return;

    const itemBaseData = itemData[itemId] || petData[itemId];
    if (!itemBaseData) return;

    let newItem;
    if (itemBaseData.type === 'pet') {
        newItem = createPetInstance(itemId);
        newItem.quantity = quantity;
    } else {
        newItem = createItemInstance(itemId, quantity, enhancement);
    }
    
    if (newItem.grade === 'Primal' && primalQuality) {
        newItem.quality = primalQuality;
        newItem.name = `[${primalQuality}] ${itemBaseData.name}`;
    }

    const onlinePlayer = onlinePlayers[userId];
    if (onlinePlayer) {
        handleItemStacking(onlinePlayer, newItem);
        sendInventoryUpdate(onlinePlayer);

          const naturalDropLog = `[${onlinePlayer.level}층]에서 <span class="${newItem.grade}">${newItem.name}</span> ${newItem.quantity}개를 획득했습니다!`;
            pushLog(onlinePlayer, naturalDropLog);
        
announceMysticDrop(onlinePlayer, newItem); 

    } else { 
        const gameData = await GameData.findOne({ user: userId });
        if (gameData) {

            const stackableItem = gameData.inventory.find(i => i.id === newItem.id && (!i.enhancement || i.enhancement === 0) && newItem.tradable !== false);
            if (stackableItem) {
                stackableItem.quantity += newItem.quantity;
            } else {
                gameData.inventory.push(newItem);
            }
            await gameData.save();
           
        }
    }
    new AdminLog({ adminUsername: socket.username, actionType: 'grant_item', targetUsername: username, details: { item: newItem } }).save();
})
        .on('admin:kickUser', (targetUserId) => {
            if (socket.role !== 'admin') return;
            const targetPlayer = onlinePlayers[targetUserId];
            if (targetPlayer && targetPlayer.socket) {
                targetPlayer.socket.emit('forceDisconnect', { message: '관리자에 의해 서버와의 연결이 종료되었습니다.' });
                targetPlayer.socket.disconnect(true);
                new AdminLog({ adminUsername: socket.username, actionType: 'kick', targetUsername: targetPlayer.username }).save();
            }
        })
        .on('admin:sanctionUser', async ({ userId, username, type, duration, unit, reason }) => {
            if (socket.role !== 'admin') return;
            let expiresAt = null;
            if (type !== 'permaban' && duration > 0) {
                expiresAt = new Date();
                if (unit === 'minutes') expiresAt.setMinutes(expiresAt.getMinutes() + duration);
                else if (unit === 'hours') expiresAt.setHours(expiresAt.getHours() + duration);
                else if (unit === 'days') expiresAt.setDate(expiresAt.getDate() + duration);
            }
            try {
                if (type === 'ban' || type === 'permaban') {
                    await User.updateOne({ _id: userId }, { $set: { ban: { isBanned: true, expiresAt: type === 'permaban' ? null : expiresAt, reason } } });
                    const targetPlayer = onlinePlayers[userId];
                    if (targetPlayer && targetPlayer.socket) {
                        targetPlayer.socket.emit('forceDisconnect', { message: '관리자에 의해 접속이 제한되었습니다.' });
                        targetPlayer.socket.disconnect(true);
                    }
                } else if (type === 'mute') {
                     await User.updateOne({ _id: userId }, { $set: { mute: { isMuted: true, expiresAt, reason } } });
                     const targetPlayer = onlinePlayers[userId];
                     if(targetPlayer) pushLog(targetPlayer, `[시스템] 관리자에 의해 채팅이 금지되었습니다. (사유: ${reason})`);
                }
                new AdminLog({ adminUsername: socket.username, actionType: type, targetUsername: username, details: { duration, unit, reason } }).save();
            } catch(error) { console.error(`[관리자] 제재 적용 오류:`, error); }
        })
        .on('admin:removeSanction', async ({ userId, username }) => {
            if (socket.role !== 'admin') return;
            try {
                await User.updateOne({ _id: userId }, {
                    $set: { 'ban.isBanned': false, 'ban.reason': '제재 해제됨', 'mute.isMuted': false, 'mute.reason': '제재 해제됨' },
                    $unset: { 'ban.expiresAt': "", 'mute.expiresAt': "" }
                });
                new AdminLog({ adminUsername: socket.username, actionType: 'remove_sanction', targetUsername: username }).save();
            } catch(error) { console.error(`[관리자] 제재 해제 오류:`, error); }
        })

.on('admin:getGameSettings', async (callback) => {
            if (socket.role !== 'admin') return;

            callback(gameSettings);
        })
        .on('admin:updateGameSettings', async (newSettings, callback) => {
            if (socket.role !== 'admin') return;
            try {

                await GameSettings.updateOne({ settingId: 'main_settings' }, { $set: newSettings });
                callback({ success: true, message: '게임 설정이 DB에 저장되었습니다. "실시간 적용" 버튼을 눌러주세요.' });
            } catch (error) {
                console.error('[관리자] 게임 설정 저장 오류:', error);
                callback({ success: false, message: '설정 저장 중 오류가 발생했습니다.' });
            }
        })
        .on('admin:reloadGameSettings', async (callback) => {
            if (socket.role !== 'admin') return;

            await loadGameSettings();
            callback({ success: true, message: '게임 설정이 서버에 실시간으로 적용되었습니다.' });
        })



        .on('admin:getChatLog', async (callback) => {
            if (socket.role !== 'admin') return;
            try {
                const chatLog = await ChatMessage.find().sort({ timestamp: -1 }).limit(100).lean();
                callback(chatLog);
            } catch (error) { callback([]); }
        })
    
  
 .on('research:upgrade', ({ specializationId, techId }) => {
            const player = onlinePlayers[socket.userId];
            if (!player || !researchConfig[specializationId]) return;

            const specialization = researchConfig[specializationId];
            const tech = specialization.researches.find(t => t.id === techId);
            if (!tech) return;

            const playerResearchLevels = player.research[specializationId];
            const currentLevel = playerResearchLevels.get(techId) || 0;


            if (currentLevel >= tech.maxLevel) {
                pushLog(player, `[연구] 이미 최대 레벨에 도달했습니다.`);
                return;
            }


            let canUpgrade = false;
            if (!tech.requires) {
                canUpgrade = true;
            } else {
                const requiredLevel = playerResearchLevels.get(tech.requires.techId) || 0;
                if (requiredLevel >= tech.requires.level) {
                    canUpgrade = true;
                }
            }

            if (!canUpgrade) {
                const requiredTech = specialization.researches.find(t => t.id === tech.requires.techId);
                pushLog(player, `[연구] '${requiredTech.name}' 연구 ${tech.requires.level}레벨 달성이 필요합니다.`);
                return;
            }

  
            const cost = tech.cost(currentLevel + 1);
            if ((player.researchEssence || 0) < cost) {
                pushLog(player, `[연구] 무한의 정수가 부족합니다. (필요: ${cost.toLocaleString()})`);
                return;
            }

            player.researchEssence -= cost;
            playerResearchLevels.set(techId, currentLevel + 1);
            
            pushLog(player, `[연구] <span class="Legendary">${tech.name}</span> 연구를 완료했습니다. (Lv.${currentLevel + 1})`);

            calculateTotalStats(player);

            sendState(socket, player, calcMonsterStats(player));
        })


        .on('disconnect', () => {
            console.log(`[연결 해제] 유저: ${socket.username}`);
            const player = onlinePlayers[socket.userId];
            if(player) {
                const clientIp = getNormalizedIp(player.socket);
                savePlayerData(socket.userId);
            }
            delete onlinePlayers[socket.userId];
        });
});
function applyAwakeningBuff(player, duration = 10000) {
    player.buffs = player.buffs || [];
    const existingBuffIndex = player.buffs.findIndex(b => b.id === 'return_scroll_awakening');
    if (existingBuffIndex > -1) {
        player.buffs[existingBuffIndex].endTime = Date.now() + duration;
    } else {
        player.buffs.push({
            id: 'return_scroll_awakening',
            name: '각성',
            endTime: Date.now() + duration,
            effects: { attackMultiplier: 10, defenseMultiplier: 10, hpMultiplier: 10 }
        });
    }
    calculateTotalStats(player);
    player.currentHp = player.stats.total.hp; 
}
function gameTick(player) {
    if (!player || !player.socket) return;

    if (player.buffs && player.buffs.length > 0) {
        const now = Date.now();
        const initialBuffCount = player.buffs.length;
        player.buffs = player.buffs.filter(buff => buff.endTime > now);
        if (player.buffs.length < initialBuffCount) {
            const hpBefore = player.stats.total.hp;
            calculateTotalStats(player); 
            const hpAfter = player.stats.total.hp;
            const currentHpRatio = player.currentHp / hpBefore;
            player.currentHp = Math.min(hpAfter, hpAfter * currentHpRatio);
        }
    }
    if (player.petFusion && player.petFusion.fuseEndTime && new Date() >= new Date(player.petFusion.fuseEndTime)) onPetFusionComplete(player);
    if (player.incubator.hatchCompleteTime && new Date() >= new Date(player.incubator.hatchCompleteTime)) onHatchComplete(player);

    if (player.raidState && player.raidState.isActive) {
        const raidBoss = player.raidState.monster;
        let pDmg = 0;
        let mDmg = 0;
        
        // [수정됨] 집중(Focus) 스탯을 비율 감소로 적용
        const effectiveDistortion = raidBoss.distortion * (1 - (player.focus || 0) / 100);
        const hitChance = 1 - Math.max(0, effectiveDistortion) / 100;

        if (Math.random() <= hitChance) {
            const playerCritRoll = Math.random();
            if (playerCritRoll < player.stats.critChance) {
                const critMultiplier = 1.5 + (player.stats.total.critDamage || 0);
                pDmg += player.stats.total.attack * critMultiplier;
            } else {
                pDmg += Math.max(0, player.stats.total.attack - (raidBoss.defense * (1 - (player.stats.total.defPenetration || 0))));
            }
        }

        if (player.stats.total.lowHpAttackPercent > 0 && player.currentHp < player.stats.total.hp) {
            const missingHpPercent = (player.stats.total.hp - player.currentHp) / player.stats.total.hp;
            const damageMultiplier = 1 + (missingHpPercent * 100 * player.stats.total.lowHpAttackPercent);
            pDmg *= damageMultiplier;
        }

        const empoweredDamageReduction = 1 - ((player.tenacity || 0) / 100);
        const empoweredDamage = player.stats.total.hp * (raidBoss.empoweredAttack / 100) * empoweredDamageReduction;
        mDmg = Math.max(0, raidBoss.attack - player.stats.total.defense) + empoweredDamage;
        
        player.currentHp -= mDmg;

        if (player.bloodthirst > 0 && Math.random() < player.bloodthirst / 100) {
            const bloodthirstDamage = raidBoss.hp * 0.50;
            pDmg += bloodthirstDamage; 
            player.currentHp = player.stats.total.hp; 
            pushLog(player, `[피의 갈망] 효과가 발동하여 <span class="fail-color">${formatInt(bloodthirstDamage)}</span>의 추가 피해를 입히고 체력을 모두 회복합니다!`);
        }
        
        player.socket.emit('combatResult', { playerTook: mDmg, monsterTook: pDmg });

        if (player.currentHp <= 0) {
            return endPersonalRaid(player, true);
        }

        if (raidBoss.currentBarrier > 0) {
            const barrierDamage = pDmg * (1 + (player.penetration || 0) / 100);
            raidBoss.currentBarrier -= barrierDamage;
            if (raidBoss.currentBarrier < 0) {
                raidBoss.currentHp += raidBoss.currentBarrier;
                raidBoss.currentBarrier = 0;
            }
        } else {
            raidBoss.currentHp -= pDmg;
        }

        if (raidBoss.currentHp <= 0) {
            onPersonalRaidFloorClear(player);
        }

        const { socket: _, ...playerStateForClient } = player;
        player.socket.emit('stateUpdate', { player: playerStateForClient, monster: player.raidState.monster, isInRaid: true });
        return;
    }
    
    let titleEffects = player.equippedTitle ? titleData[player.equippedTitle]?.effect : null;
    let titleBossDamageBonus = (titleEffects && titleEffects.bossDamage) ? (1 + titleEffects.bossDamage) : 1;
    let titleWBBonus = (titleEffects && titleEffects.worldBossDamage) ? (1 + titleEffects.worldBossDamage) : 1;
    let titleWBContributionBonus = (titleEffects && titleEffects.worldBossContribution) ? (1 + titleEffects.worldBossContribution) : 1;

    if (worldBossState && worldBossState.isActive && player.attackTarget === 'worldBoss') {
        let pDmg = Math.max(1, (player.stats.total.attack || 0) - (worldBossState.defense || 0));
        
        if (player.bloodthirst > 0 && Math.random() < player.bloodthirst / 100) {
            const bloodthirstDamage = worldBossState.maxHp * 0.003;
            pDmg += bloodthirstDamage;
            player.currentHp = player.stats.total.hp;
            pushLog(player, `[피의 갈망] 효과가 발동하여 <span class="fail-color">${formatInt(bloodthirstDamage)}</span>의 추가 피해를 입히고 체력을 모두 회복합니다!`);
        }
        
        pDmg *= titleWBBonus;
        worldBossState.currentHp = Math.max(0, (worldBossState.currentHp || 0) - pDmg);

        if (player.equipment.earring?.id === 'acc_earring_01' && Math.random() < 0.03) applyAwakeningBuff(player, 10000);
        if (player.equipment.earring?.id === 'primal_acc_earring_01' && Math.random() < 0.03) applyAwakeningBuff(player, 15000);
        
        const userId = player.user.toString();
        const participant = worldBossState.participants.get(userId) || { username: player.username, damageDealt: 0 };
        const contributionDamage = pDmg * titleWBContributionBonus;
        participant.damageDealt = (participant.damageDealt || 0) + contributionDamage;
        worldBossState.participants.set(userId, participant);
        const totalDamage = Array.from(worldBossState.participants.values()).reduce((sum, p) => sum + (p.damageDealt || 0), 0);
        const myShare = totalDamage > 0 ? (participant.damageDealt / totalDamage) * 100 : 0;
        player.socket.emit('myBossContributionUpdate', { myContribution: participant.damageDealt, myShare: myShare });
        if (!player.worldBossContribution) player.worldBossContribution = { damageDealt: 0, bossId: null };
        player.worldBossContribution.damageDealt = participant.damageDealt;
        player.worldBossContribution.bossId = worldBossState.bossId;
        if (worldBossState.currentHp <= 0) { 
            worldBossState.lastHitter = player.user.toString();
            onWorldBossDefeated(); 
        }
        sendState(player.socket, player, calcMonsterStats(player));
        return;
    }
    
    calculateTotalStats(player);
    const m = calcMonsterStats(player);
    if (player.monster.lastCalculatedLevel !== player.level) {
        player.monster.currentHp = m.hp;
        player.monster.currentBarrier = m.barrier;
        player.monster.lastCalculatedLevel = player.level;
    }
    let pDmg = 0, mDmg = 0;
    
    // [수정됨] 집중(Focus) 스탯을 비율 감소로 적용
    const effectiveDistortion = (m.distortion || 0) * (1 - (player.focus || 0) / 100);
    const hitChance = 1 - Math.max(0, effectiveDistortion) / 100;

    if (Math.random() > hitChance) { pDmg += 0; } 
    else {
        const playerCritRoll = Math.random();

        if (playerCritRoll < player.stats.critChance) {
            const critMultiplier = 1.5 + (player.stats.total.critDamage || 0);
            pDmg += player.stats.total.attack * critMultiplier;
        } else {
            pDmg += Math.max(0, player.stats.total.attack - (m.defense * (1 - (player.stats.total.defPenetration || 0))));
        }
    }
    if (m.isBoss) { pDmg *= titleBossDamageBonus; }
    
    if (player.stats.total.lowHpAttackPercent > 0 && player.currentHp < player.stats.total.hp) {
        const missingHpPercent = (player.stats.total.hp - player.currentHp) / player.stats.total.hp;
        const damageMultiplier = 1 + (missingHpPercent * 100 * player.stats.total.lowHpAttackPercent);
        pDmg *= damageMultiplier;
    }

    const monsterCritConfig = monsterCritRateTable.find(r => m.level <= r.maxLevel);
    const monsterCritChance = m.isBoss ? monsterCritConfig.boss : monsterCritConfig.normal;
    const finalMonsterCritChance = Math.max(0, monsterCritChance - player.stats.critResistance);
    const monsterCritRoll = Math.random();
    if (monsterCritRoll < finalMonsterCritChance) { mDmg = m.attack; } 
    else { mDmg = Math.max(0, m.attack - (m.isBoss ? (player.stats.total.defense * 0.5) : player.stats.total.defense)); }
    if (m.empoweredAttack > 0) {
        const empoweredDamageReduction = 1 - ((player.tenacity || 0) / 100);
        const empoweredDamage = player.stats.total.hp * (m.empoweredAttack / 100) * empoweredDamageReduction;
        mDmg += empoweredDamage;
    }

    player.currentHp -= mDmg;
    if (player.bloodthirst > 0 && Math.random() < player.bloodthirst / 100) {
        const bloodthirstDamage = m.hp * 0.50;
        pDmg += bloodthirstDamage;
        player.currentHp = player.stats.total.hp;
        pushLog(player, `[피의 갈망] 효과가 발동하여 <span class="fail-color">${formatInt(bloodthirstDamage)}</span>의 추가 피해를 입히고 체력을 모두 회복합니다!`);
    }

    if (pDmg > 0 || mDmg > 0) { player.socket.emit('combatResult', { playerTook: mDmg, monsterTook: pDmg }); }
    if (pDmg > 0 && player.equipment.earring?.id === 'acc_earring_01' && Math.random() < 0.03) applyAwakeningBuff(player, 10000);
    if (pDmg > 0 && player.equipment.earring?.id === 'primal_acc_earring_01' && Math.random() < 0.03) applyAwakeningBuff(player, 15000);
    
    if (player.currentHp <= 0) {
        const reviveEffect = player.equippedPet?.effects?.revive;
        if (reviveEffect && (!player.petReviveCooldown || new Date() > new Date(player.petReviveCooldown))) {
            player.currentHp = player.stats.total.hp * reviveEffect.percent;
            player.petReviveCooldown = new Date(Date.now() + reviveEffect.cooldown);
            pushLog(player, `[${player.equippedPet.name}]의 힘으로 죽음의 문턱에서 돌아옵니다!`);
        } else {
            let deathMessage, returnFloor = 1;
            if (player.level >= 1000000) { deathMessage = `[${player.level}층] 심연의 균열에서 패배하여 100만층으로 귀환합니다.`; returnFloor = 1000000; } 
            else { deathMessage = m.isBoss ? `[${player.level}층 보스]에게 패배하여 1층으로 귀환합니다.` : `[${player.level}층] 몬스터에게 패배하여 1층으로 귀환합니다.`; }
            resetPlayer(player, deathMessage, returnFloor);
        }
    } else {
        if (player.monster.currentBarrier > 0) {
            const barrierDamage = pDmg * (1 + (player.penetration || 0) / 100);
            if (barrierDamage >= player.monster.currentBarrier) {
                const remainingDamage = barrierDamage - player.monster.currentBarrier;
                player.monster.currentBarrier = 0;
                player.monster.currentHp -= remainingDamage;
            } else { player.monster.currentBarrier -= barrierDamage; }
        } else { player.monster.currentHp -= pDmg; }
        if (player.monster.currentHp <= 0) {
            player.level++;
            player.maxLevel = Math.max(player.maxLevel, player.level);
            if (player.level > (player.previousMaxLevel || player.maxLevel -1)) updateFameScore(player.socket, player);
            player.previousMaxLevel = player.maxLevel;
            onClearFloor(player);
            calculateTotalStats(player);
            player.currentHp = player.stats.total.hp;
            const newMonster = calcMonsterStats(player);
            player.monster.currentHp = newMonster.hp;
            player.monster.currentBarrier = newMonster.barrier;
            player.monster.lastCalculatedLevel = player.level;
        }
    }
    sendState(player.socket, player, m);
}

setInterval(() => { for (const userId in onlinePlayers) { gameTick(onlinePlayers[userId]); } }, TICK_RATE);

setInterval(() => {
    if (worldBossState && worldBossState.isActive) {
        const lightWeightState = {
            name: worldBossState.name,
            currentHp: worldBossState.currentHp,
            maxHp: worldBossState.maxHp,
            isActive: worldBossState.isActive
        };
        io.emit('worldBossUpdate', lightWeightState);
    }
}, 2000);

function onClearFloor(p) {
    const titleEffects = p.equippedTitle ? titleData[p.equippedTitle]?.effect : null;
    let titleGoldGainBonus = 1;
    let titleItemDropRateBonus = 1;
    let titleRiftShardDropRateBonus = 1;

    if (titleEffects) {
        if (titleEffects.goldGain) titleGoldGainBonus += titleEffects.goldGain;
        if (titleEffects.itemDropRate) titleItemDropRateBonus += titleEffects.itemDropRate;
        if (titleEffects.riftShardDropRate) titleRiftShardDropRateBonus += titleEffects.riftShardDropRate;
    }

    let pioneerBonuses = {
        goldGainPercent: 0,
        itemDropRatePercent: 0,
        bonusClimbChance: 0
    };
    if (p.research && p.research.pioneer) {
        const pioneerResearchLevels = p.research.pioneer instanceof Map ? Object.fromEntries(p.research.pioneer) : p.research.pioneer;
        for (const techId in pioneerResearchLevels) {
            const level = pioneerResearchLevels[techId];
            const tech = researchConfig.pioneer.researches.find(t => t.id === techId);
            if (tech && level > 0) {
                const bonus = tech.getBonus(level);
                for (const key in bonus) {
                    pioneerBonuses[key] = (pioneerBonuses[key] || 0) + bonus[key];
                }
            }
        }
    }

    const clearedFloor = p.level - 1;
    const isBoss = isBossFloor(clearedFloor);
    
    let goldEarned = isBoss ? clearedFloor * 10 : clearedFloor;
    let goldBonusPercent = 1 + pioneerBonuses.goldGainPercent; 

    let extraClimbChanceFromEnchant = 0;
    for (const slot of ['weapon', 'armor']) {
        const item = p.equipment[slot];
        if (item && item.enchantments) {
            for (const enchant of item.enchantments) {
                if (enchant.type === 'gold_gain') {
                    goldBonusPercent += (enchant.value / 100);
                } else if (enchant.type === 'extra_climb_chance') {
                    extraClimbChanceFromEnchant += (enchant.value / 100);
                }
            }
        }
    }

    if (p.unlockedArtifacts[2]) goldEarned = Math.floor(goldEarned * 1.25);
    if (p.codexBonusActive) goldEarned = Math.floor(goldEarned * 1.05);
    goldEarned = Math.floor(goldEarned * goldBonusPercent);
    goldEarned = Math.floor(goldEarned * titleGoldGainBonus);

    p.gold += goldEarned;
    
  
    
    if (isBoss) { 
        pushLog(p, `[${clearedFloor}층 보스] 클리어! (+${goldEarned.toLocaleString()} G)`); 
    }
    
  let essenceGained = 0;
    if (isBoss) {
        essenceGained = 1; 
        p.researchEssence = (p.researchEssence || 0) + essenceGained;
        pushLog(p, `[보스] <span class="Mystic">무한의 정수</span> ${essenceGained}개를 획득했습니다!`);
    } 
    else if (clearedFloor >= 1000000) { 
        if (Math.random() < 0.001) {
            essenceGained = 1;
            p.researchEssence = (p.researchEssence || 0) + essenceGained;
            pushLog(p, `[심연] <span class="Mystic">무한의 정수</span> ${essenceGained}개를 획득했습니다!`);
        }
    }
  

    if (p.unlockedArtifacts[0] && clearedFloor > 0 && clearedFloor % 10 === 0) {
        const skippedFloor = p.level;
        p.level++;
        p.maxLevel = Math.max(p.maxLevel, p.level);
        
        let skippedGold = isBossFloor(skippedFloor) ? skippedFloor * 10 : skippedFloor;
        if (p.unlockedArtifacts[2]) skippedGold = Math.floor(skippedGold * 1.25);
        if (p.codexBonusActive) skippedGold = Math.floor(skippedGold * 1.05);
        skippedGold = Math.floor(skippedGold * goldBonusPercent);
        skippedGold = Math.floor(skippedGold * titleGoldGainBonus);
        p.gold += skippedGold;
    }
    
    const totalExtraClimbChance = (p.equippedPet?.effects?.extraClimbChance || 0) + extraClimbChanceFromEnchant + pioneerBonuses.bonusClimbChance;
    if (Math.random() < totalExtraClimbChance) {
        const skippedFloor = p.level;
        p.level++;
        p.maxLevel = Math.max(p.maxLevel, p.level);
        let skippedGold = isBossFloor(skippedFloor) ? skippedFloor * 10 : skippedFloor;
        if (p.unlockedArtifacts[2]) skippedGold = Math.floor(skippedGold * 1.25);
        if (p.codexBonusActive) skippedGold = Math.floor(skippedGold * 1.05);
        skippedGold = Math.floor(skippedGold * goldBonusPercent);
        skippedGold = Math.floor(skippedGold * titleGoldGainBonus); 
        p.gold += skippedGold;
    }
    
    let zone = 1;
    if (p.level >= 1000000) zone = 6;
    else if (p.level >= 500000) zone = 5;
    else if (p.level > 15000) zone = 4;
    else if (p.level > 3000) zone = 3;
    else if (p.level > 500) zone = 2;

    const tbl = gameSettings.dropTable[zone];
    if (!tbl) return;

    if (tbl.specialDrops) {
        for (const [itemId, dropInfo] of Object.entries(tbl.specialDrops)) {
            let finalChance = dropInfo.chance;
            if (itemId === 'rift_shard' && titleRiftShardDropRateBonus > 1) {
                finalChance *= titleRiftShardDropRateBonus;
            }
            if (Math.random() < finalChance) {
                const droppedItem = createItemInstance(itemId);
                if (droppedItem) {
                    handleItemStacking(p, droppedItem);
                    sendInventoryUpdate(p);
                    pushLog(p, `[${clearedFloor}층]에서 <span class="${droppedItem.grade}">${droppedItem.name}</span> 1개를 획득했습니다!`);
                    announceMysticDrop(p, droppedItem);
                }
            }
        }
    }
    
    const dropChance = (isBoss ? 0.10 : 0.02) * titleItemDropRateBonus * (1 + pioneerBonuses.itemDropRatePercent);
    if (Math.random() < dropChance) {
        let grade, acc = 0, r = Math.random();
        for (const g in tbl.rates) { acc += tbl.rates[g]; if (r < acc) { grade = g; break; } }
        if (grade) {
            const pool = tbl.itemsByGrade[grade] || [];
            if (pool.length) {
                const id = pool[Math.floor(Math.random() * pool.length)];
                const droppedItem = createItemInstance(id);
                if (droppedItem) {
                    handleItemStacking(p, droppedItem);
                    sendInventoryUpdate(p); 
                    if (['Legendary', 'Epic', 'Mystic', 'Primal'].includes(droppedItem.grade)) {
                        updateGlobalRecord(`topLoot_${droppedItem.grade}`, { username: p.username, itemName: droppedItem.name, itemGrade: droppedItem.grade });
                    }
                    announceMysticDrop(p, droppedItem);
                }
            }
        }
    }

    for (const itemInfo of gameSettings.globalLootTable) {
        let finalChance = itemInfo.chance;
        if (titleEffects && titleEffects.itemDropRate) {
            finalChance *= (1 + titleEffects.itemDropRate);
        }
        if (Math.random() < finalChance) {
            const droppedItem = createItemInstance(itemInfo.id);
            if (droppedItem) {
                handleItemStacking(p, droppedItem);
                sendInventoryUpdate(p);
                pushLog(p, `[${clearedFloor}층]에서 <span class="${droppedItem.grade}">${droppedItem.name}</span> 1개를 획득했습니다!`);
                announceMysticDrop(p, droppedItem);
            }
        }
    }
}
async function attemptEnhancement(p, { uid, useTicket, useHammer }, socket) {
    if (!p) return;
    if (p.isBusy) {
        return pushLog(p, '이전 요청을 처리 중입니다. 잠시 후 다시 시도해주세요.');
    }
    p.isBusy = true;
    try {
        let itemToEnhance;
        let isEquipped = false;

        for (const slot of ['weapon', 'armor']) {
            if (p.equipment[slot] && p.equipment[slot].uid === uid) {
                isEquipped = true;
                itemToEnhance = p.equipment[slot];
                p.equipment[slot] = null;
                await GameData.updateOne({ user: p.user }, { $set: { [`equipment.${slot}`]: null } });
                break;
            }
        }

        if (!itemToEnhance) {
            const itemIndex = p.inventory.findIndex(i => i.uid === uid);
            if (itemIndex > -1) {
                const itemStack = p.inventory[itemIndex];
                if (itemStack.quantity > 1) {
                    itemStack.quantity--;
                    itemToEnhance = { ...itemStack, quantity: 1 };
                    await GameData.updateOne({ user: p.user, "inventory.uid": uid }, { $inc: { "inventory.$.quantity": -1 } });
                } else {
                    itemToEnhance = p.inventory.splice(itemIndex, 1)[0];
                    await GameData.updateOne({ user: p.user }, { $pull: { inventory: { uid: uid } } });
                }
            }
        }

        if (!itemToEnhance) {
            pushLog(p, '[강화] 아이템을 처리하는 중 오류가 발생했거나, 이미 소모된 아이템입니다.');
            return;
        }

        const cur = itemToEnhance.enhancement;
        const isPrimal = itemToEnhance.grade === 'Primal';
        const titleEffects = p.equippedTitle ? titleData[p.equippedTitle]?.effect : null;
        let cost, riftShardCost = 0;

        if (isPrimal) {
            const nextLevel = cur + 1;
            cost = nextLevel * 1000000000;
            riftShardCost = nextLevel * 10;
            const shardItem = p.inventory.find(i => i.id === 'rift_shard');
            if (!shardItem || shardItem.quantity < riftShardCost) {
                pushLog(p, `[강화] 균열의 파편이 부족합니다. (필요: ${riftShardCost}개)`);
                handleItemStacking(p, itemToEnhance);
                sendInventoryUpdate(p);
                return;
            }
        } else {
            cost = Math.floor(1000 * Math.pow(2.1, cur));
        }
        if (titleEffects && titleEffects.enhancementCostReduction) {
            cost = Math.floor(cost * (1 - titleEffects.enhancementCostReduction));
        }
        if (p.gold < cost) {
            pushLog(p, '[강화] 골드가 부족합니다.');
            handleItemStacking(p, itemToEnhance);
            sendInventoryUpdate(p);
            return;
        }
        if (useTicket && cur >= 10 && !p.inventory.some(i => i.id === 'prevention_ticket')) {
            pushLog(p, '[강화] 파괴 방지권이 없습니다.');
            handleItemStacking(p, itemToEnhance);
            sendInventoryUpdate(p);
            return;
        }

        p.gold -= cost;
        if (isPrimal) p.inventory.find(i => i.id === 'rift_shard').quantity -= riftShardCost;

        let rates = { ...(gameSettings.enhancementTable[cur + 1] || gameSettings.highEnhancementRate) };
        if (isPrimal && cur >= 10) rates = { success: 0.10, maintain: 0.00, fail: 0.00, destroy: 0.90 };
        if (titleEffects?.enhancementSuccessRate) rates.success += titleEffects.enhancementSuccessRate;
        if (titleEffects?.enhancementMaintainChance && rates.fail > 0) {
            const shift = Math.min(rates.fail, titleEffects.enhancementMaintainChance);
            rates.fail -= shift;
            rates.maintain += shift;
        }
        if (useHammer && !isPrimal && p.inventory.some(i => i.id === 'hammer_hephaestus')) {
            const hammer = p.inventory.find(i => i.id === 'hammer_hephaestus');
            hammer.quantity--;
            let bonusToApply = 0.15;
            const fromDestroy = Math.min(bonusToApply, rates.destroy);
            rates.destroy -= fromDestroy;
            bonusToApply -= fromDestroy;
            if (bonusToApply > 0) {
                const fromFail = Math.min(bonusToApply, rates.fail);
                rates.fail -= fromFail;
                bonusToApply -= fromFail;
            }
            if (bonusToApply > 0) {
                const fromMaintain = Math.min(bonusToApply, rates.maintain);
                rates.maintain -= fromMaintain;
                bonusToApply -= fromMaintain;
            }
            rates.success += (0.15 - bonusToApply);
            rates.success = Math.min(1, rates.success);
        }

        const r = Math.random();
        let result = '', msg = '', finalItem = null;
        const hpBefore = p.stats.total.hp;

        if (r < rates.success) {
            result = 'success';
            itemToEnhance.enhancement++;
            finalItem = itemToEnhance;
            msg = `[+${cur} ${itemToEnhance.name}] 강화 성공! → [+${itemToEnhance.enhancement}]`;
            if (itemToEnhance.enhancement >= 12) {
                io.emit('globalAnnouncement', `🎉 ${p.username}님이 [+${itemToEnhance.enhancement} ${itemToEnhance.name}] 강화에 성공하였습니다!`);
            }
            if (itemToEnhance.type === 'weapon') {
                p.maxWeaponEnhancement = Math.max(p.maxWeaponEnhancement || 0, itemToEnhance.enhancement);
                p.maxWeaponName = itemToEnhance.name;
            } else {
                p.maxArmorEnhancement = Math.max(p.maxArmorEnhancement || 0, itemToEnhance.enhancement);
                p.maxArmorName = itemToEnhance.name;
            }
            if (itemToEnhance.enhancement > (globalRecordsCache.topEnhancement?.enhancementLevel || 0)) {
                updateGlobalRecord('topEnhancement', { username: p.username, itemName: itemToEnhance.name, itemGrade: itemToEnhance.grade, enhancementLevel: itemToEnhance.enhancement });
            }
            if (itemToEnhance.id === 'w001' && itemToEnhance.enhancement >= 15) grantTitle(p, '[대체왜?]');
        } else if (r < rates.success + rates.maintain) {
            result = 'maintain';
            finalItem = itemToEnhance;
            msg = `[+${cur} ${itemToEnhance.name}] 강화 유지!`;
            if (p.titleCounters) if (++p.titleCounters.enhancementFailCount >= 500) grantTitle(p, '[키리]');
        } else if (r < rates.success + rates.maintain + rates.fail) {
            result = 'fail';
            itemToEnhance.enhancement = Math.max(0, cur - 1);
            finalItem = itemToEnhance;
            msg = `[+${cur} ${itemToEnhance.name}] 강화 실패... → [+${itemToEnhance.enhancement}]`;
            if (p.titleCounters) if (++p.titleCounters.enhancementFailCount >= 500) grantTitle(p, '[키리]');
        } else {
            result = 'destroy';
            if (useTicket && cur >= 10) {
                const ticket = p.inventory.find(i => i.id === 'prevention_ticket');
                ticket.quantity--;
                result = 'maintain';
                finalItem = itemToEnhance;
                msg = `<span class="Epic">파괴 방지권</span>을 사용하여 파괴를 막았습니다!`;
            } else {
                finalItem = null;
                msg = `<span class="${itemToEnhance.grade}">${itemToEnhance.name}</span>이(가) 파괴되었습니다...`;
                if (p.titleCounters) if (++p.titleCounters.destroyCount >= 50) grantTitle(p, '[펑..]');
            }
        }

        if (finalItem) {
            finalItem.uid = new mongoose.Types.ObjectId().toString();
            if (result === 'success' && isEquipped) {
                p.equipment[finalItem.type] = finalItem;
            } else {
                handleItemStacking(p, finalItem);
            }
        }

        calculateTotalStats(p);
        const hpAfter = p.stats.total.hp;
        p.currentHp = hpBefore > 0 && hpAfter > 0 ? p.currentHp * (hpAfter / hpBefore) : hpAfter;
        if (p.currentHp > hpAfter) p.currentHp = hpAfter;

        p.inventory = p.inventory.filter(i => i.quantity > 0);

        pushLog(p, msg);
        socket.emit('enhancementResult', { result, newItem: finalItem, destroyed: result === 'destroy' });
        sendState(socket, p, calcMonsterStats(p));
        sendInventoryUpdate(p);
        updateFameScore(socket, p);
    } finally {
        if (p) p.isBusy = false;
    }
}

const formatInt = n => Math.floor(n).toLocaleString();
const formatFloat = n => n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function pushLog(p, text) { 
    p.log.unshift(text); 
    if (p.log.length > 15) p.log.pop(); 
    if (p.socket) {
        p.socket.emit('logUpdate', p.log);
    }
}
async function announceMysticDrop(player, item) {

    if (!player || !['Mystic', 'Primal'].includes(item.grade) || item.id === 'form_locking_stone') return;

    const bannerMessage = `🎉 ★★★ 축하합니다! ${player.username}님이 <span class="${item.grade}">${item.name}</span> 아이템을 획득했습니다! ★★★ 🎉`;
    
    if (item.grade === 'Primal') {

        io.emit('globalAnnouncement', bannerMessage, { style: 'primal' });
        

        const primalDropMessage = {
            type: 'primal_drop',
            username: player.username,   
            fameScore: player.fameScore, 
            itemName: item.name,
            itemGrade: item.grade
        };


        io.emit('chatMessage', primalDropMessage);
        
        try {
            await new ChatMessage(primalDropMessage).save();
            console.log(`[DB 저장] 태초 드랍 메시지 저장 완료: ${player.username}`);
        } catch (error) {
            console.error('[DB 저장] 태초 드랍 메시지 저장 중 오류 발생:', error);
        }

    } else {
        

        io.emit('globalAnnouncement', bannerMessage);
        

        const mysticAnnounce = { 
            type: 'announcement', 
            username: 'SYSTEM', 
            role: 'admin', 
            message: bannerMessage 
        };

        io.emit('chatMessage', mysticAnnounce);
    }
}

function sendInventoryUpdate(player) {
    if (player && player.socket) {
        player.socket.emit('inventoryUpdate', {
            inventory: player.inventory,
            petInventory: player.petInventory,
            incubator: player.incubator 
        });
    }
}

const isBossFloor = (level) => level > 0 && level % BOSS_INTERVAL === 0;

function calcMonsterStats(p) { 
    const level = p.level; 
    let hp, attack, defense;
    if (level >= 1000002) {
        const baseLevel = 1000001;
        const multiplier = Math.pow(1.0002, level - baseLevel);
        hp = (baseLevel) * multiplier;
        attack = (baseLevel / 2) * multiplier;
        defense = (baseLevel / 5) * multiplier;
    } else {
        hp = level;
        attack = level / 2;
        defense = level / 5;
    }

    const monster = {
        level: level,
        hp: hp,
        attack: attack,
        defense: defense,
        isBoss: isBossFloor(level),
        distortion: 0,
        barrier: 0,
        empoweredAttack: 0
    };

    if (monster.isBoss) {
        const prevLevelMonsterAttack = Math.max(1, (level - 1) / 2);
        monster.hp = level * 10;
        monster.attack = prevLevelMonsterAttack * 2;
        monster.defense = level / 3;
    }

    if (level >= 1000001) {
        monster.distortion = 50;
        monster.barrier = monster.hp * 5;
        monster.empoweredAttack = 10;
    }
    return monster;
}

function resetPlayer(p, msg, returnFloor = 1) {
if (p.raidState && p.raidState.isActive) {
    p.raidState.isActive = false;
    p.socket.emit('personalRaid:ended');
}
    const titleEffects = p.equippedTitle ? titleData[p.equippedTitle]?.effect : null;
    if (titleEffects && titleEffects.goldOnDeath) {
        p.gold += titleEffects.goldOnDeath;
    }

  if (p.equipment.necklace && returnFloor === 1) {
        if (p.equipment.necklace.id === 'primal_acc_necklace_01') {
            if (Math.random() < 0.30) {
                returnFloor = p.level;
                msg = `[${p.level}층] <span class="Primal">${p.equipment.necklace.name}</span>의 힘으로 죽음을 극복하고 현재 층에서 부활합니다!`;
            } else {
                returnFloor = Math.floor(p.level * 2 / 3);
                if (returnFloor > 1) {
                   msg = `[${p.level}층] <span class="Primal">${p.equipment.necklace.name}</span>의 가호로 ${returnFloor}층에서 부활합니다.`;
                }
            }
        } else if (p.equipment.necklace.id === 'acc_necklace_01') {
            returnFloor = Math.floor(p.level * 2 / 3);
            if (returnFloor > 1) {
                msg = `[${p.level}층] <span class="Mystic">${p.equipment.necklace.name}</span>의 가호로 ${returnFloor}층에서 부활합니다.`;
            }
        }
        if (returnFloor < 1) returnFloor = 1;
    }
    p.level = returnFloor;
    calculateTotalStats(p);
    p.currentHp = p.stats.total.hp;
    const newMonster = calcMonsterStats(p);
    p.monster.currentHp = newMonster.hp;
    p.monster.currentBarrier = newMonster.barrier;
    p.monster.lastCalculatedLevel = p.level;
    pushLog(p, msg);


    if (p.titleCounters) {
        p.titleCounters.deathCount = (p.titleCounters.deathCount || 0) + 1;
        if (p.titleCounters.deathCount >= 500) {
            grantTitle(p, '[오뚝이]');
        }
    }
}

function upgradeStat(player, { stat, amount }) {
    if (!player) return;
    const nAmount = (amount === 'MAX') ? Infinity : parseInt(amount, 10);
    if (isNaN(nAmount) || nAmount <= 0) return;
    let cost = 0;
    let upgradedCount = 0;
    for (let i = 0; i < nAmount; i++) {
        const nextLevelCost = player.stats.base[stat];
        if (player.gold >= nextLevelCost) {
            player.gold -= nextLevelCost;
            player.stats.base[stat]++;
            cost += nextLevelCost;
            upgradedCount++;
        } else {
            if (amount !== 'MAX') {
                pushLog(player, '[스탯] 골드가 부족합니다.');
            }
            break; 
        }
    }
    if (upgradedCount > 0) {
          calculateTotalStats(player);
    }
    sendPlayerState(player);
}
function equipItem(player, uid) {
    if (!player) return;
    if (player.isBusy) {
        return pushLog(player, '이전 요청을 처리 중입니다. 잠시 후 다시 시도해주세요.');
    }
    player.isBusy = true;
    try {
        const idx = player.inventory.findIndex(i => i.uid === uid && (i.type === 'weapon' || i.type === 'armor' || i.type === 'accessory'));
        if (idx === -1) return;
        
        const item = player.inventory[idx];
        let slot = (item.type === 'accessory') ? item.accessoryType : item.type;
        if (!slot || typeof player.equipment[slot] === 'undefined') return;

        if (player.equipment[slot]) {
            handleItemStacking(player, player.equipment[slot]);
        }
        if (item.quantity > 1) {
            item.quantity--;
            player.equipment[slot] = { ...item, quantity: 1, uid: new mongoose.Types.ObjectId().toString() };
        } else {
            player.equipment[slot] = player.inventory.splice(idx, 1)[0];
        }
        pushLog(player, `[장비] ${player.equipment[slot].name} 을(를) 장착했습니다.`);
        
        calculateTotalStats(player);
        player.currentHp = player.stats.total.hp;
        sendPlayerState(player);
        sendInventoryUpdate(player);
        updateFameScore(player.socket, player);
        checkStateBasedTitles(player);
    } finally {
        if (player) player.isBusy = false;
    }
}
function unequipItem(player, slot) {
    if (!player) return;
    if (player.isBusy) {
        return pushLog(player, '이전 요청을 처리 중입니다. 잠시 후 다시 시도해주세요.');
    }
    player.isBusy = true;
    try {
        if (!player.equipment[slot]) return;
        const hpBefore = player.stats.total.hp;
        
        handleItemStacking(player, player.equipment[slot]);
        player.equipment[slot] = null;
        
        calculateTotalStats(player);
        
        const hpAfter = player.stats.total.hp;
        player.currentHp = hpBefore > 0 && hpAfter > 0 ? player.currentHp * (hpAfter / hpBefore) : hpAfter;
        if (player.currentHp > hpAfter) player.currentHp = hpAfter;
        
        sendPlayerState(player);
        sendInventoryUpdate(player);
        updateFameScore(player.socket, player);
        checkStateBasedTitles(player);
    } finally {
        if (player) player.isBusy = false;
    }
}
function sellItem(player, uid, sellAll) {
    if (!player) return;
    if (player.isBusy) {
        return pushLog(player, '이전 요청을 처리 중입니다. 잠시 후 다시 시도해주세요.');
    }
    player.isBusy = true;
    try {
        const itemIndex = player.inventory.findIndex(i => i.uid === uid);
        if (itemIndex === -1) {
            pushLog(player, '[판매] 인벤토리에서 아이템을 찾을 수 없습니다.');
            return;
        }
        const item = player.inventory[itemIndex];

        if (item.tradable === false) {
            pushLog(player, '[판매] 해당 아이템은 상점에 판매할 수 없습니다.');
            return;
        }

        const titleEffects = player.equippedTitle ? titleData[player.equippedTitle]?.effect : null;
        let sellBonus = 1;
        if (titleEffects && titleEffects.sellPriceBonus) {
            sellBonus += titleEffects.sellPriceBonus;
        }

        const basePrice = SELL_PRICES[item.grade] || 0;
        let quantitySold = 0;

        if (item.enhancement > 0 || !sellAll) {
            let finalPrice = basePrice;
            if (item.enhancement > 0) {
                const enhancementCost = getEnhancementCost(item.enhancement);
                const priceWithEnhancement = basePrice + enhancementCost;
                if (item.enhancement <= 8) {
                    finalPrice = priceWithEnhancement;
                } else if (item.enhancement <= 10) {
                    finalPrice = priceWithEnhancement + 10000;
                } else {
                    finalPrice = Math.floor(priceWithEnhancement * 1.5);
                }
            }
            finalPrice = Math.floor(finalPrice * sellBonus);
            if (item.quantity > 1) {
                item.quantity--;
            } else {
                player.inventory.splice(itemIndex, 1);
            }
            player.gold += finalPrice;
            quantitySold = 1;
            const itemName = item.enhancement > 0 ? `+${item.enhancement} ${item.name}` : item.name;
            pushLog(player, `[판매] ${itemName} 1개를 ${finalPrice.toLocaleString()} G에 판매했습니다.`);
        } else {
            const quantityToSell = item.quantity;
            const totalPrice = Math.floor((basePrice * quantityToSell) * sellBonus);
            player.inventory.splice(itemIndex, 1);
            player.gold += totalPrice;
            quantitySold = quantityToSell;
            pushLog(player, `[판매] ${item.name} ${quantityToSell}개를 ${totalPrice.toLocaleString()} G에 판매했습니다.`);
        }

        if (player.titleCounters) {
            player.titleCounters.sellCount = (player.titleCounters.sellCount || 0) + quantitySold;
            if (player.titleCounters.sellCount >= 1000) {
                grantTitle(player, '[대장간]');
            }
        }

        sendState(player.socket, player, calcMonsterStats(player));
        sendInventoryUpdate(player);
    } finally {
        if (player) player.isBusy = false;
    }
}

function getEnhancementCost(level) { let totalCost = 0; for (let i = 0; i < level; i++) { totalCost += Math.floor(1000 * Math.pow(2.1, i)); } return totalCost; }

function onPetFusionComplete(player) {
    if (!player || !player.petFusion || !player.petFusion.slot1 || !player.petFusion.slot2) {
        return;
    }
    const pet1 = player.petFusion.slot1;
    const pet2 = player.petFusion.slot2;
    const attributes = [pet1.attribute, pet2.attribute].sort();
    
    let resultPetId = null;
    if (attributes.includes('물') && attributes.includes('불')) resultPetId = 'ignis_aqua';
    else if (attributes.includes('물') && attributes.includes('바람')) resultPetId = 'tempest';
    else if (attributes.includes('불') && attributes.includes('바람')) resultPetId = 'thunderbird';

    if (resultPetId) {
        const newPet = createPetInstance(resultPetId);
        if(newPet) {
            player.petInventory.push(newPet);
            pushLog(player, `[융합] 융합이 완료되어 강력한 <span class="${newPet.grade}">${newPet.name}</span>이(가) 탄생했습니다!`);
        }
    } else {
        player.petInventory.push(pet1, pet2);
        player.gold += 100000000; 
        pushLog(player, '[융합] 알 수 없는 오류로 융합에 실패하여 재료와 비용이 반환되었습니다.');
        console.error(`[Fusion Error] User: ${player.username}, Pets: ${pet1.name}, ${pet2.name}`);
    }

    player.petFusion = { slot1: null, slot2: null, fuseEndTime: null };

    checkStateBasedTitles(player);
}
function getFameTier(score) {
    if (score >= 40000) return 'fame-diamond';
    if (score >= 15000) return 'fame-gold';
    if (score >= 5000) return 'fame-silver';
    if (score >= 1000) return 'fame-bronze';
    return '';
}

async function savePlayerData(userId) { const p = onlinePlayers[userId]; if (!p) return; try { const { socket: _, attackTarget: __, ...playerDataToSave } = p; await GameData.updateOne({ user: userId }, { $set: playerDataToSave }); } catch (error) { console.error(`[저장 실패] 유저: ${p.username} 데이터 저장 중 오류 발생:`, error); } }


async function sendState(socket, player, monsterStats) {
    if (!socket || !player) return;

const serializableResearch = {};
    if (player.research) {
        for (const specializationId in player.research) {
            if (player.research[specializationId] instanceof Map) {
                serializableResearch[specializationId] = Object.fromEntries(player.research[specializationId]);
            } else {

                serializableResearch[specializationId] = player.research[specializationId];
            }
        }
    }

const playerStateForClient = {
        username: player.username,
        gold: player.gold,
        level: player.level,
        maxLevel: player.maxLevel,
        stats: player.stats,
        currentHp: player.currentHp,
        fameScore: player.fameScore,
        hasUnreadMail: player.hasUnreadMail,
        buffs: player.buffs || [],
        equipment: player.equipment,
        equippedPet: player.equippedPet,
        unlockedArtifacts: player.unlockedArtifacts,
        petFusion: player.petFusion,
        inventory: player.inventory,
        petInventory: player.petInventory,
        incubator: player.incubator,
        log: player.log,
        focus: player.focus,
        penetration: player.penetration,
        tenacity: player.tenacity,
        bloodthirst: player.bloodthirst, 
        riftShards: player.inventory.find(i => i.id === 'rift_shard')?.quantity || 0,
        safeZoneCooldownUntil: player.safeZoneCooldownUntil,
        personalRaid: player.personalRaid,
 kakaoId: player.kakaoId,
        research: serializableResearch, 
        researchEssence: player.researchEssence || 0 
    };

    const monsterStateForClient = {
        ...monsterStats,
        currentHp: player.monster.currentHp,
        currentBarrier: player.monster.currentBarrier
    };

    const isInRaid = player.raidState && player.raidState.isActive;

    socket.emit('stateUpdate', {
        player: playerStateForClient,
        monster: isInRaid ? player.raidState.monster : monsterStateForClient,
        isInRaid: isInRaid
    });
}

function sendPlayerState(player) {
    if (!player || !player.socket) return;
    const monsterStats = calcMonsterStats(player); 
    sendState(player.socket, player, monsterStats);
}



function useItem(player, uid, useAll = false) {
    if (!player) return;
    const itemIndex = player.inventory.findIndex(i => i.uid === uid);
    if (itemIndex === -1) return;
    const item = player.inventory[itemIndex];
    const quantityToUse = useAll ? item.quantity : 1;
    let messages = [];
    
    const titleEffects = player.equippedTitle ? titleData[player.equippedTitle]?.effect : null;
    
    switch (item.id) {
    case 'pure_blood_crystal':
        if (player.bloodthirst >= 10) {
            messages.push("[피의 갈망] 이미 최대치(10%)에 도달했습니다.");
            break;
        }
        let successCount = 0;
        for (let i = 0; i < quantityToUse; i++) {
            if (Math.random() < 0.20) { 
                player.bloodthirst = parseFloat((player.bloodthirst + 0.1).toFixed(1));
                successCount++;
            }
        }
        if (successCount > 0) {
            messages.push(`[피의 갈망] 순수한 피의 결정 ${quantityToUse}개 중 ${successCount}개 흡수에 성공했습니다! (현재: ${player.bloodthirst}%)`);
            calculateTotalStats(player);
        } else {
            messages.push(`[피의 갈망] 결정 ${quantityToUse}개가 사용자의 피에 스며들지 못했습니다...`);
        }
        break;

    case 'box_power':
        for (let i = 0; i < quantityToUse; i++) {
            const guaranteedGold = 500000000;
            player.gold += guaranteedGold;
            messages.push(`[권능의 상자] 확정 보상으로 ${guaranteedGold.toLocaleString()} G를 획득했습니다!`);
            const rand = Math.random();
            let cumulativeChance = 0;
            let wonItem = null;
            for (const itemInfo of powerBoxLootTable) {
                cumulativeChance += itemInfo.chance;
                if (rand < cumulativeChance) {
                    const quantity = Array.isArray(itemInfo.quantity) 
                        ? Math.floor(Math.random() * (itemInfo.quantity[1] - itemInfo.quantity[0] + 1)) + itemInfo.quantity[0] 
                        : (itemInfo.quantity || 1);
                    
                    wonItem = createItemInstance(itemInfo.id, quantity);
                    break; 
                }
            }
            if (wonItem) {
                handleItemStacking(player, wonItem);
                messages.push(`[권능의 상자] 추가 보상으로 <span class="${wonItem.grade}">${wonItem.name}</span> (${wonItem.quantity}개) 아이템을 획득했습니다!`);
                announceMysticDrop(player, wonItem); 
            } else {
                messages.push('[권능의 상자] 아쉽지만, 추가 보상은 없었습니다.');
            }
        }
        break;

    case 'boss_participation_box':
        for (let i = 0; i < quantityToUse; i++) {
            const goldGained = 3000000;
            player.gold += goldGained;
            messages.push(`[참여 상자] 상자에서 ${goldGained.toLocaleString()} G를 획득했습니다!`);
            const bonusItems = [
                { id: 'hammer_hephaestus', chance: 0.01 },
                { id: 'prevention_ticket', chance: 0.01 },
                { id: 'return_scroll', chance: 0.01 },
                { id: 'pet_egg_ancient', chance: 0.01 },
                { id: 'acc_necklace_01', chance: 0.005 },
                { id: 'acc_earring_01', chance: 0.005 },
                { id: 'acc_wristwatch_01', chance: 0.005 }
            ];
            bonusItems.forEach(itemInfo => {
               if (Math.random() < itemInfo.chance) {
                    const wonItem = createItemInstance(itemInfo.id);
                    if (wonItem) {
                        handleItemStacking(player, wonItem);
                        announceMysticDrop(player, wonItem); 
                        messages.push(`[참여 상자] ✨ 상자에서 추가 아이템 <span class="${wonItem.grade}">${wonItem.name}</span>이 나왔습니다!!!`);
                    }
                }
            });
        }
        break;

    case 'return_scroll':
        if (player.isExploring) {
            messages.push('[복귀 스크롤] 탐험 중에는 사용할 수 없습니다.');
            if (player.socket) player.socket.emit('useItemResult', { messages });
            return;
        }
        if (player.level >= player.maxLevel) {
            messages.push('[복귀 스크롤] 이미 최고 등반 층에 있거나 더 높은 곳에 있어 사용할 수 없습니다.');
            if (player.socket) player.socket.emit('useItemResult', { messages });
            return;
        }
        player.level = player.maxLevel;
        player.buffs = player.buffs || [];
        player.buffs = player.buffs.filter(b => b.id !== 'return_scroll_awakening');

        const durationBonus = (titleEffects && titleEffects.scrollBuffDuration) || 0;
        const buffDuration = 10000 + (durationBonus * 1000);

        player.buffs.push({
            id: 'return_scroll_awakening',
            name: '각성',
            endTime: Date.now() + buffDuration,
            effects: { attackMultiplier: 10, defenseMultiplier: 10, hpMultiplier: 10 }
        });
        calculateTotalStats(player);
        player.currentHp = player.stats.total.hp;
        player.monster.currentHp = calcMonsterStats(player).hp;
        messages.push(`[복귀 스크롤] 스크롤의 힘으로 ${player.level}층으로 이동하며 ${buffDuration / 1000}초간 각성합니다!`);
        
        if (player.titleCounters) {
            player.titleCounters.scrollUseCount = (player.titleCounters.scrollUseCount || 0) + 1;
            if (player.titleCounters.scrollUseCount >= 50) {
                grantTitle(player, '[회귀자]');
            }
        }
        break;

    case 'gold_pouch':
        let totalGoldGained = 0;
        const minBonus = (titleEffects && titleEffects.goldPouchMinBonus) || 0;

        for (let i = 0; i < quantityToUse; i++) {
            const rand = Math.random();
            let cumulativeChance = 0;
            for (const reward of goldPouchRewardTable) {
                cumulativeChance += reward.chance;
                if (rand < cumulativeChance) {
                    const modifiedMin = Math.floor(reward.range[0] * (1 + minBonus));
                    const goldGained = Math.floor(Math.random() * (reward.range[1] - modifiedMin + 1)) + modifiedMin;
                    totalGoldGained += goldGained;
                    break;
                }
            }
        }
        player.gold += totalGoldGained;
        messages.push(`[수수께끼 골드 주머니] ${quantityToUse}개를 사용하여 ${totalGoldGained.toLocaleString()} G를 획득했습니다!`);

        if (player.titleCounters) {
            player.titleCounters.pouchUseCount = (player.titleCounters.pouchUseCount || 0) + quantityToUse;
            if (player.titleCounters.pouchUseCount >= 100) {
                grantTitle(player, '[탐욕]');
            }
        }
        break;

    case 'hammer_hephaestus':
    case 'prevention_ticket':
        messages.push('이 아이템은 강화 시 체크하여 사용합니다.');
        if (player.socket) player.socket.emit('useItemResult', { messages });
        return;

    case 'tome_socket1':
    case 'tome_socket2':
    case 'tome_socket3':
        const socketIndex = parseInt(item.id.slice(-1)) - 1;
        if (player.unlockedArtifacts[socketIndex]) {
            messages.push('이미 해금된 유물 소켓입니다.');
            if (player.socket) player.socket.emit('useItemResult', { messages });
            return;
        } else {
            player.unlockedArtifacts[socketIndex] = artifactData[item.id];
            addDiscoveredItem(player, item.id);
            messages.push(`[${artifactData[item.id].name}]의 지혜를 흡수하여 유물 소켓을 영구히 해금했습니다!`);
            updateFameScore(player.socket, player);
        }
        break;

    default:
        messages.push('사용할 수 없는 아이템입니다.');
        if (player.socket) player.socket.emit('useItemResult', { messages });
        return;
    }
    
    item.quantity -= quantityToUse;
    if (item.quantity <= 0) {
        player.inventory.splice(itemIndex, 1);
    }
    if (player.socket) {
        player.socket.emit('useItemResult', { messages: messages.slice(0, 5) }); 
    }
    sendState(player.socket, player, calcMonsterStats(player));
    sendInventoryUpdate(player);
}
    

function placeEggInIncubator(player, uid) {
    if (!player) return;
    if (player.incubator.hatchCompleteTime) {
        pushLog(player, '[부화기] 현재 다른 알이 부화 중이라 교체할 수 없습니다.');
        sendInventoryUpdate(player); 
        return;
    }
    const itemIndex = player.inventory.findIndex(i => i.uid === uid && (i.category === 'Egg' || i.type === 'egg'));
    if (itemIndex === -1) {
        pushLog(player, '[부화기] 인벤토리에서 해당 알을 찾을 수 없습니다.');
        return;
    }
    
    if (player.incubator.egg) {
        const oldEgg = player.incubator.egg;
        handleItemStacking(player, oldEgg);
        pushLog(player, `[부화기] ${oldEgg.name}을(를) 인벤토리로 돌려보냈습니다.`);
    }
    const newEgg = player.inventory[itemIndex];
    if (newEgg.quantity > 1) {
        newEgg.quantity--; 
        player.incubator.egg = { ...newEgg, quantity: 1 }; 
    } else {
        player.incubator.egg = player.inventory.splice(itemIndex, 1)[0];
    }
    pushLog(player, `[부화기] ${player.incubator.egg.name}을(를) 부화기에 넣었습니다.`);
    
    sendInventoryUpdate(player);
}

function onHatchComplete(player) {
    if (!player || !player.incubator.egg) return;
    const eggName = player.incubator.egg.name;
    const eggGrade = player.incubator.egg.grade;
    pushLog(player, `[부화기] ${eggName}에서 생명의 기운이 느껴집니다!`);
    const possiblePets = Object.keys(petData).filter(id => petData[id].grade === eggGrade && !petData[id].fused);
    if (possiblePets.length > 0) {
        const randomPetId = possiblePets[Math.floor(Math.random() * possiblePets.length)];
        const newPet = createPetInstance(randomPetId);
        if(newPet) {
            player.petInventory.push(newPet);
            pushLog(player, `[펫] <span class="${newPet.grade}">${newPet.name}</span>이(가) 태어났습니다!`);
        }
    }
    player.incubator = { egg: null, hatchCompleteTime: null, hatchDuration: 0 };
    updateFameScore(player.socket, player); 

    if (player.titleCounters) {
        player.titleCounters.hatchCount = (player.titleCounters.hatchCount || 0) + 1;
        if (player.titleCounters.hatchCount >= 30) {
            grantTitle(player, '[생명의 은인]');
        }
    }
    checkStateBasedTitles(player);

    sendInventoryUpdate(player);
}

function equipPet(player, uid) {
    if (!player) return;
    const petIndex = player.petInventory.findIndex(p => p.uid === uid);
    if (petIndex === -1) return;
    if (player.equippedPet) {
        player.petInventory.push(player.equippedPet);
    }
    player.equippedPet = player.petInventory.splice(petIndex, 1)[0];
    calculateTotalStats(player);
    sendState(player.socket, player, calcMonsterStats(player));
    sendInventoryUpdate(player);
    updateFameScore(player.socket, player);
checkStateBasedTitles(player);
}

function unequipPet(player) {
    if (!player || !player.equippedPet) return;
    player.petInventory.push(player.equippedPet);
    player.equippedPet = null;
    calculateTotalStats(player);
    sendState(player.socket, player, calcMonsterStats(player));
    sendInventoryUpdate(player);
    updateFameScore(player.socket, player);
checkStateBasedTitles(player);
}

async function onWorldBossDefeated() {
    if (!worldBossState || !worldBossState.isActive) return;

    console.log('[월드보스] 처치 완료! 보상 분배를 시작합니다.');
    worldBossState.isActive = false;
    await WorldBossState.updateOne({ uniqueId: 'singleton' }, { $set: { isActive: false, currentHp: 0 } });

    const totalDamage = Array.from(worldBossState.participants.values()).reduce((sum, p) => sum + p.damageDealt, 0);
    if (totalDamage <= 0) {
        io.emit('worldBossDefeated');
        worldBossState = null;
        return;
    }

    const defeatedMessage = `[월드보스] 🔥 ${worldBossState.name} 🔥 처치 완료! 보상 분배를 시작합니다.`;
    io.emit('globalAnnouncement', defeatedMessage);
    io.emit('chatMessage', { isSystem: true, message: defeatedMessage });

    const sortedParticipants = Array.from(worldBossState.participants.entries()).sort((a, b) => b[1].damageDealt - a[1].damageDealt);
    const rewardLedger = new Map();

    for (const [userIdString, participant] of sortedParticipants) {
        if (!rewardLedger.has(userIdString)) {
            rewardLedger.set(userIdString, { gold: 0, items: [], username: participant.username });
        }
        const userRewards = rewardLedger.get(userIdString);
        const contributionPercent = (participant.damageDealt / totalDamage) * 100;

        const goldReward = Math.floor(10000000000 * (participant.damageDealt / totalDamage));
        if (goldReward > 0) userRewards.gold += goldReward;

        if (contributionPercent >= 0) userRewards.items.push(createItemInstance('boss_participation_box'));
        if (contributionPercent >= 1) userRewards.items.push(createItemInstance('rift_shard', 5));
        if (contributionPercent >= 5) userRewards.items.push(createItemInstance('rift_shard', 20));
        if (contributionPercent >= 10) {
            if (Math.random() < 0.10) {
                const mysticPool = ['w005', 'a005', 'acc_necklace_01', 'acc_earring_01', 'acc_wristwatch_01'];
                const randomMysticId = mysticPool[Math.floor(Math.random() * mysticPool.length)];
                const mysticItem = createItemInstance(randomMysticId);
                userRewards.items.push(mysticItem);
                
                const itemNameHTML = `<span class="${mysticItem.grade}">${mysticItem.name}</span>`;
                const winMessage = `${participant.username}님이 기여도 ${contributionPercent.toFixed(2)}% 달성으로 미스틱 아이템 ${itemNameHTML}를 획득하였습니다!!`;
                io.emit('chatMessage', { isSystem: true, message: `🎉 ${winMessage}` });
            }
        }
    }
    

    if (sortedParticipants.length > 0) {
        const [winnerIdString, winnerParticipant] = sortedParticipants[0];
        let primalWinMessage = '';
        if (Math.random() < 0.01) {
            const primalPool = ['primal_w01', 'primal_a01'];
            const randomPrimalId = primalPool[Math.floor(Math.random() * primalPool.length)];
            const primalItem = createItemInstance(randomPrimalId);
            rewardLedger.get(winnerIdString).items.push(primalItem);
            
            const itemNameHTML = `<span class="Primal">${primalItem.name}</span>`;
            const bannerMessage = `★★★★★ ${winnerParticipant.username}님이 1등 보상으로 태초 아이템 [${primalItem.name}] 획득에 성공했습니다! ★★★★★`;
            io.emit('globalAnnouncement', bannerMessage, { style: 'primal' });
            primalWinMessage = `1등: ${winnerParticipant.username}님!!! <span class="Primal">Primal 등급 획득에 성공했습니다!!!</span>`;
        } else {
            primalWinMessage = `1등: ${winnerParticipant.username}님!!! 아쉽지만 Primal 등급 획득에 실패했습니다.`;
        }
        io.emit('chatMessage', { isSystem: true, message: primalWinMessage });
    }


    for (const [userIdString, finalRewards] of rewardLedger.entries()) {
        const recipientObjectId = new mongoose.Types.ObjectId(userIdString);

        if (finalRewards.gold > 0) {
            await sendMail(recipientObjectId, '월드보스', { gold: finalRewards.gold, description: "기여도 보상" });
        }
        for (const item of finalRewards.items) {
            await sendMail(recipientObjectId, '월드보스', { item: item, description: "기여도 보상" });
        }
        
        const onlinePlayer = onlinePlayers[userIdString];
        if (onlinePlayer) {
            pushLog(onlinePlayer, "[월드보스] 보상이 우편함으로 모두 발송되었습니다! 확인해주세요.");
        }
    }
io.emit('chatMessage', { isSystem: true, message: "전원에게 기여도에 따른 보상이 지급되었습니다. 우편함을 확인하세요." });

    for (const [userIdString, participant] of worldBossState.participants.entries()) {
        if (participant.damageDealt > 0) {
            const onlinePlayer = onlinePlayers[userIdString];
            if (onlinePlayer) {
                if (onlinePlayer.titleCounters) onlinePlayer.titleCounters.wbParticipateCount = (onlinePlayer.titleCounters.wbParticipateCount || 0) + 1;
                if ((onlinePlayer.titleCounters?.wbParticipateCount || 0) >= 10) grantTitle(onlinePlayer, '[토벌대원]');
                if (onlinePlayer.equipment.weapon?.id === 'w001') grantTitle(onlinePlayer, '[날먹최강자]');
            }
        }
    }
    if (worldBossState.lastHitter) {
        const lastHitterId = worldBossState.lastHitter;
        const onlineLastHitter = onlinePlayers[lastHitterId];
        if (onlineLastHitter?.titleCounters) {
            onlineLastHitter.titleCounters.wbLastHitCount = (onlineLastHitter.titleCounters.wbLastHitCount || 0) + 1;
            if (onlineLastHitter.titleCounters.wbLastHitCount >= 5) grantTitle(onlineLastHitter, '[용사]');
        }
    }
    
    await GameData.updateMany(
        { "worldBossContribution.bossId": worldBossState.bossId },
        { $set: { worldBossContribution: { damageDealt: 0, bossId: null } } }
    );

    for (const player of Object.values(onlinePlayers)) {
        sendState(player.socket, player, calcMonsterStats(player));
    }

    io.emit('worldBossDefeated');
    worldBossState = null;
}
async function listOnAuction(player, { uid, price, quantity }) {
    if (player.isBusy) {
        return { success: false, message: '이전 요청을 처리 중입니다. 잠시 후 다시 시도해주세요.' };
    }
    if (!player || !uid || !price || !quantity) {
        return { success: false, message: '잘못된 요청입니다.' };
    }
    player.isBusy = true;
    try {
        const nPrice = parseInt(price, 10);
        const nQuantity = parseInt(quantity, 10);

        if (isNaN(nPrice) || nPrice <= 0 || isNaN(nQuantity) || nQuantity <= 0) {
            const message = '[거래소] 올바른 가격과 수량을 입력하세요.';
            pushLog(player, message);
            return { success: false, message: message };
        }

        const itemIndex = player.inventory.findIndex(i => i.uid === uid);
        if (itemIndex === -1) {
            const message = '[거래소] 인벤토리에 없는 아이템입니다.';
            pushLog(player, message);
            return { success: false, message: message };
        }

        const itemInInventory = player.inventory[itemIndex];
        if (itemInInventory.tradable === false) {
            const message = '[거래소] 해당 아이템은 거래소에 등록할 수 없습니다.';
            pushLog(player, message);
            return { success: false, message: message };
        }
        if (itemInInventory.quantity < nQuantity) {
            const message = '[거래소] 보유한 수량보다 많이 등록할 수 없습니다.';
            pushLog(player, message);
            return { success: false, message: message };
        }

        const itemForAuction = { ...itemInInventory, quantity: nQuantity };

        const auctionItem = new AuctionItem({
            sellerId: player.user,
            sellerUsername: player.username,
            item: itemForAuction,
            price: nPrice
        });

        await auctionItem.save();
        if (itemInInventory.quantity === nQuantity) {
            player.inventory.splice(itemIndex, 1);
        } else {
            itemInInventory.quantity -= nQuantity;
        }

        pushLog(player, `[거래소] ${itemForAuction.name} (${nQuantity}개) 을(를) 개당 ${nPrice.toLocaleString()} G에 등록했습니다.`);
        const itemNameHTML = `<span class="${itemForAuction.grade}">${itemForAuction.name}</span>`;
        const announcementMessage = `[거래소] ${player.username}님이 ${itemNameHTML} 아이템을 등록했습니다.`;
        io.emit('chatMessage', { isSystem: true, message: announcementMessage });
        io.emit('auctionUpdate');
        sendInventoryUpdate(player);
        return { success: true, message: '등록에 성공했습니다.' };

    } catch (e) {
        console.error('거래소 등록 오류:', e);
        const message = '[거래소] 아이템 등록에 실패했습니다. 아이템이 인벤토리로 반환됩니다.';
        pushLog(player, message);
        sendInventoryUpdate(player);
        return { success: false, message: '서버 오류로 등록에 실패했습니다.' };
    } finally {
        if (player) player.isBusy = false;
    }
}
async function buyFromAuction(player, { listingId, quantity }) {
    if (!player || !listingId || !quantity) return;
    if (player.isBusy) {
        return pushLog(player, '이전 요청을 처리 중입니다. 잠시 후 다시 시도해주세요.');
    }
    player.isBusy = true;
    try {
        const amountToBuy = parseInt(quantity, 10);
        if (isNaN(amountToBuy) || amountToBuy <= 0) {
            player.socket.emit('serverAlert', '유효한 구매 수량을 입력해주세요.');
            return;
        }

        const listing = await AuctionItem.findOneAndUpdate(
            { _id: listingId, "item.quantity": { $gte: amountToBuy } },
            { $inc: { "item.quantity": -amountToBuy } },
            { new: false }
        );

        if (!listing) {
            pushLog(player, '[거래소] 이미 판매되었거나 재고가 부족한 물품입니다.');
            io.emit('auctionUpdate');
            return;
        }

        if (listing.sellerId.toString() === player.user.toString()) {
            await AuctionItem.findByIdAndUpdate(listingId, { $inc: { "item.quantity": amountToBuy } });
            player.socket.emit('serverAlert', '자신이 등록한 물품은 구매할 수 없습니다.');
            return;
        }

        const totalPrice = listing.price * amountToBuy;
        if (player.gold < totalPrice) {
            await AuctionItem.findByIdAndUpdate(listingId, { $inc: { "item.quantity": amountToBuy } });
            const feedbackMsg = `골드가 부족하여 구매에 실패했습니다.\n\n필요 골드: ${totalPrice.toLocaleString()} G\n보유 골드: ${player.gold.toLocaleString()} G`;
            player.socket.emit('serverAlert', feedbackMsg);
            return;
        }

        player.gold -= totalPrice;
        await GameData.updateOne({ user: player.user }, { $inc: { gold: -totalPrice } });

        const itemForBuyer = { ...listing.item, quantity: amountToBuy };
        await sendMail(player.user, '거래소', {
            item: itemForBuyer,
            description: `'${listing.item.name}' ${amountToBuy}개를 구매했습니다.`
        });

        await sendMail(listing.sellerId, '거래소', {
            gold: totalPrice,
            description: `'${listing.item.name}' ${amountToBuy}개 판매 대금이 도착했습니다.`
        });

        const finalListingCheck = await AuctionItem.findById(listingId);
        if (finalListingCheck && finalListingCheck.item.quantity <= 0) {
            await AuctionItem.findByIdAndDelete(listingId);
        }

        const itemNameHTML = `<span class="${listing.item.grade}">${listing.item.name}</span>`;
        const announcementMessage = `[거래소] ${listing.sellerUsername}님이 등록한 ${itemNameHTML} 아이템을 ${player.username}님이 구매했습니다.`;
        io.emit('chatMessage', { isSystem: true, message: announcementMessage });
        pushLog(player, `[거래소] ${listing.item.name} ${amountToBuy}개를 ${totalPrice.toLocaleString()} G에 구매하여 우편으로 받았습니다.`);

        if (player.titleCounters) {
            player.titleCounters.ahBuyCount = (player.titleCounters.ahBuyCount || 0) + amountToBuy;
            if (player.titleCounters.ahBuyCount >= 100) {
                grantTitle(player, '[큰손]');
            }
        }

        sendState(player.socket, player, calcMonsterStats(player));
        io.emit('auctionUpdate');
    } catch (e) {
        console.error('거래소 구매 오류:', e);
        pushLog(player, '[거래소] 아이템 구매에 실패했습니다.');
    } finally {
        if (player) player.isBusy = false;
    }
}

async function spawnWorldBoss() {
    if (worldBossState && worldBossState.isActive) return;
    const newBossId = new mongoose.Types.ObjectId().toString();
    const newBossData = {
        uniqueId: 'singleton',
        bossId: newBossId,
        name: "영원한 흉몽",
        maxHp: WORLD_BOSS_CONFIG.HP,
        currentHp: WORLD_BOSS_CONFIG.HP,
        attack: WORLD_BOSS_CONFIG.ATTACK,
        defense: WORLD_BOSS_CONFIG.DEFENSE,
        isActive: true,
        participants: new Map(),
        spawnedAt: new Date()
    };
    const savedState = await WorldBossState.findOneAndUpdate({ uniqueId: 'singleton' }, newBossData, { upsert: true, new: true });
    worldBossState = savedState.toObject();
    worldBossState.participants = new Map();
    console.log(`[월드보스] ${worldBossState.name}가 출현했습니다! (ID: ${worldBossState.bossId})`);
    const serializableState = { ...worldBossState, participants: {} };
    io.emit('worldBossSpawned', serializableState);
    io.emit('chatMessage', { isSystem: true, message: `[월드보스] 거대한 악의 기운과 함께 파멸의 군주가 모습을 드러냈습니다!` });
    io.emit('globalAnnouncement', `[월드보스] ${worldBossState.name}가 출현했습니다!`);
}
async function cancelAuctionListing(player, listingId) {
    if (!player || !listingId) return;
    if (player.isBusy) {
        return pushLog(player, '이전 요청을 처리 중입니다. 잠시 후 다시 시도해주세요.');
    }
    player.isBusy = true;
    try {
        const listing = await AuctionItem.findById(listingId);

        if (!listing) {
            pushLog(player, '[거래소] 존재하지 않는 물품입니다.');
            io.emit('auctionUpdate');
            return;
        }

        if (listing.sellerId.toString() !== player.user.toString()) {
            pushLog(player, '[거래소] 자신이 등록한 물품만 취소할 수 있습니다.');
            return;
        }

        const removedListing = await AuctionItem.findByIdAndDelete(listingId);
        if (!removedListing) {
            pushLog(player, '[거래소] 등록 취소 중 문제가 발생했습니다. 아이템이 이미 처리되었을 수 있습니다.');
            return io.emit('auctionUpdate');
        }

        await sendMail(player.user, '거래소', {
            item: removedListing.item,
            description: `등록 취소한 '${removedListing.item.name}' 아이템이 반환되었습니다.`
        });

        pushLog(player, `[거래소] ${removedListing.item.name} 등록을 취소하고 아이템을 우편으로 회수했습니다.`);
        io.emit('auctionUpdate');
    } catch (e) {
        console.error(`[거래소 취소 심각한 오류] User: ${player.username}, ListingID: ${listingId}`, e);
        pushLog(player, '[거래소] 시스템 오류로 등록 취소에 실패했습니다. 운영자에게 문의해주세요.');
    } finally {
        if (player) player.isBusy = false;
    }
}

const AUTO_SAVE_INTERVAL = 10000;
setInterval(() => {
    for (const userId of Object.keys(onlinePlayers)) {
        savePlayerData(userId);
    }
    if (worldBossState && worldBossState.isActive) {
        const updatePayload = { $set: { 'currentHp': worldBossState.currentHp } };
        for (const [userId, participantData] of worldBossState.participants.entries()) {
            updatePayload.$set[`participants.${userId}`] = participantData;
        }
        WorldBossState.updateOne({ uniqueId: 'singleton' }, updatePayload).catch(err => console.error('월드보스 상태 저장 오류:', err));
    }
}, AUTO_SAVE_INTERVAL);

let lastRaidResetDate = null; 

function scheduleDailyReset(io) {
    console.log('⏰ 매일 아침 6시 개인 레이드 초기화 스케줄러가 활성화되었습니다.');

   setInterval(async () => {
        const now = new Date();
        const kstOffset = 9 * 60 * 60 * 1000;
        const kstNow = new Date(now.getTime() + kstOffset);

        const kstHour = kstNow.getUTCHours();
        const kstMinute = kstNow.getUTCMinutes();

        if (kstHour === 5 && kstMinute === 59) {
            const kstTodayStr = kstNow.toDateString();

            if (lastRaidResetDate !== kstTodayStr) {
                console.log('6:00 AM - 모든 유저의 개인 레이드 이용 횟수를 초기화합니다.');
                lastRaidResetDate = kstTodayStr;

                try {
                    const updateResult = await GameData.updateMany(
                        {}, 
                        { $set: { "personalRaid.entries": 2 } } 
                    );
                    console.log(`[DB] 총 ${updateResult.modifiedCount}명의 유저 데이터가 초기화되었습니다.`);

                    for (const player of Object.values(onlinePlayers)) {
                        if (player && player.socket) {
                            player.personalRaid.entries = 2;
                            pushLog(player, '☀️ 아침 6시가 되어 개인 레이드 입장 횟수가 초기화되었습니다.');
                            sendPlayerState(player);
                        }
                    }

                } catch (error) {
                    console.error('[오류] 개인 레이드 초기화 중 문제가 발생했습니다:', error);
                }
            }
        }
    }, 60000);
}

function checkAndSpawnBoss() {
    if ((worldBossState && worldBossState.isActive) || isBossSpawning) {
        return;
    }

    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstNow = new Date(now.getTime() + kstOffset);
    
    const kstHour = kstNow.getUTCHours();
    const kstMinutes = kstNow.getUTCMinutes();

    if ((kstHour === 19 && kstMinutes === 0) || (kstHour === 22 && kstMinutes === 0)) {
        isBossSpawning = true;
        console.log(`[스케줄러] 정해진 시간 (${kstHour}시)이 되어 월드보스를 소환합니다.`);
        spawnWorldBoss().finally(() => {
            setTimeout(() => { isBossSpawning = false; }, 60000);
        });
    }
}



function startHatching(player) {
    if (!player || !player.incubator.egg || player.incubator.hatchCompleteTime) return;
    
    const eggId = player.incubator.egg.id;
    let hatchDuration = itemData[eggId]?.hatchDuration;
    if (!hatchDuration) return;

    const titleEffects = player.equippedTitle ? titleData[player.equippedTitle]?.effect : null;
    if(titleEffects && titleEffects.hatchTimeReduction) {
        hatchDuration *= (1 - titleEffects.hatchTimeReduction);
    }
    
    player.incubator.hatchDuration = hatchDuration;
    player.incubator.hatchCompleteTime = new Date(Date.now() + hatchDuration);
    
    pushLog(player, `[부화기] ${player.incubator.egg.name} 부화를 시작합니다!`);
    sendInventoryUpdate(player); 
}


function calcPersonalRaidBossStats(floor) {
    const base = { hp: 100000, attack: 10000, defense: 10000 };
    const multiplier = Math.pow(1.05, floor - 1);
    
    return {
        name: '혈염의 감시자',
        floor: floor,
        hp: base.hp * multiplier,
        attack: base.attack * multiplier,
        defense: base.defense * multiplier,
        barrier: (base.hp * multiplier) * 5,
        distortion: 50,
        empoweredAttack: 10
    };
}
async function startPersonalRaid(player) {
    if (!player) return;
    if (player.raidState && player.raidState.isActive) {
        return pushLog(player, "[개인 레이드] 이미 레이드를 진행 중입니다.");
    }

    if (player.personalRaid.entries <= 0) {
        return pushLog(player, "[개인 레이드] 오늘의 입장 횟수를 모두 소모했습니다.");
    }
    player.personalRaid.entries--;

    await GameData.updateOne({ user: player.user }, { 
        $set: { "personalRaid.entries": player.personalRaid.entries } 
    });

    player.raidState = {
        isActive: true,
        floor: 1,
        monster: calcPersonalRaidBossStats(1)
    };
    player.raidState.monster.currentHp = player.raidState.monster.hp;
    player.raidState.monster.currentBarrier = player.raidState.monster.barrier;
    
    await GameData.updateOne({ user: player.user }, { $set: { raidState: { isActive: true, floor: 1 } } });

    pushLog(player, `[개인 레이드] 1층 '혈염의 감시자'와의 전투를 시작합니다! (남은 횟수: ${player.personalRaid.entries}회)`);
    player.socket.emit('personalRaid:started', player.raidState);
}


async function endPersonalRaid(player, died = false) {
    if (!player || !player.raidState || !player.raidState.isActive) return;

    const message = died 
        ? `[개인 레이드] ${player.raidState.floor}층에서 패배하여 일반 등반으로 복귀합니다.`
        : "[개인 레이드] 레이드를 종료하고 일반 등반으로 복귀합니다.";

    resetPlayer(player, message, player.level); 
}

function onPersonalRaidFloorClear(player) {
    if (!player || !player.raidState) return;

    const clearedFloor = player.raidState.floor;
    const goldReward = clearedFloor * 1000000;
    player.gold += goldReward;
    pushLog(player, `[개인 레이드] ${clearedFloor}층 클리어! (+${goldReward.toLocaleString()} G)`);


    if (Math.random() < 0.05) {
        const crystal = createItemInstance('pure_blood_crystal');
        handleItemStacking(player, crystal);
        pushLog(player, `[개인 레이드] <span class="Mystic">${crystal.name}</span> 1개를 획득했습니다!`);
        sendInventoryUpdate(player);
    }


    player.raidState.floor++;
    const nextBoss = calcPersonalRaidBossStats(player.raidState.floor);
    player.raidState.monster = nextBoss;
    player.raidState.monster.currentHp = nextBoss.hp;
    player.raidState.monster.currentBarrier = nextBoss.barrier;
    

    calculateTotalStats(player);
    player.currentHp = player.stats.total.hp;
}

scheduleDailyReset(io); 
server.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));
