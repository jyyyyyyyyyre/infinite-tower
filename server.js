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
const ADMIN_OBJECT_ID = '68744e5af8cc7f29f0f2d114'; //6880fadcf8e2a547bc132953,68744e5af8cc7f29f0f2d114
const BOSS_INTERVAL = 200;


const RIFT_ENCHANT_COST = {
    GOLD: 100000000,
    SHARDS: 100
};

const WORLD_BOSS_CONFIG = {
    SPAWN_INTERVAL: 720 * 60 * 1000, HP: 33150000000000, ATTACK: 0, DEFENSE: 0,
    REWARDS: { GOLD: 2960000000000, PREVENTION_TICKETS: 2, ITEM_DROP_RATES: { Rare: 0.10, Legendary: 0.10, Epic: 0.69, Mystic: 0.101 } }
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
isHelper: { type: Boolean, default: false }, 
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
    refinementExpMigrated: { type: Boolean, default: false },
    refinementLevelRecalculated: { type: Boolean, default: false }, 
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
incubators: { type: [Object], default: () => Array(6).fill(null).map(() => ({ egg: null, hatchCompleteTime: null, hatchDuration: 0 })) },
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

isInFoundryOfTime: { type: Boolean, default: false },

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
        wbParticipateCount: { type: Number, default: 0 },
    },
autoSellList: { type: [String], default: [] },

    researchEssence: { type: Number, default: 0 },
    research: {
        warlord: { type: Map, of: Number, default: {} },
        guardian: { type: Map, of: Number, default: {} },
        berserker: { type: Map, of: Number, default: {} },
        pioneer: { type: Map, of: Number, default: {} }
    },

 spiritInventory: { type: [Object], default: [] },
    logoutTime: { type: Date, default: null },
    lastLevel: { type: Number, default: 1 },

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
isHelper: { type: Boolean, default: false },
    timestamp: { type: Date, default: Date.now }
});
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
            'delete_equipped_item' ,'delete_equipped_item', 'toggle_helper'
        ] 
    },
    targetUsername: { type: String },
    details: { type: Object },
}, { timestamps: true });


const DpsRecordSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    username: { type: String, required: true },
    totalDamage: { type: Number, required: true, index: true },
    dps: { type: Number, required: true },
    duration: { type: Number, default: 180 },
    details: {
        damageBreakdown: Object, 
        skillMetrics: Object,    
        combatStats: Object      
    },

    snapshot: {
        equipment: Object,
        equippedPet: Object,
        stats: Object,
        title: String,
        research: Object,
        fameScore: Number
    },
}, { timestamps: true });


const DpsLeaderboardSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    username: String,
    totalDamage: Number,
    dps: Number,
    snapshot: Object, 
    recordId: { type: mongoose.Schema.Types.ObjectId, ref: 'DpsRecord' },
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
const WorldBossState = mongoose.model('WorldBossState', WorldBossStateSchema);
const Post = mongoose.model('Post', PostSchema);
const Comment = mongoose.model('Comment', CommentSchema);
const GameSettings = mongoose.model('GameSettings', GameSettingsSchema);
const AdminLog = mongoose.model('AdminLog', AdminLogSchema);
const DpsRecord = mongoose.model('DpsRecord', DpsRecordSchema);
const DpsLeaderboard = mongoose.model('DpsLeaderboard', DpsLeaderboardSchema);


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
'파편': 'rift_shard_abyss',
'바하정수': 'bahamut_essence',
'소울스톤공': 'soulstone_attack',
'소울스톤체': 'soulstone_hp',
'소울스톤방': 'soulstone_defense',
    '달100퍼': 'moon_scroll_100',
    '달70퍼': 'moon_scroll_70',
    '달30퍼': 'moon_scroll_30',
    '달10퍼': 'moon_scroll_10',
'100퍼': 'star_scroll_100',
'70퍼': 'star_scroll_70',
'30퍼': 'star_scroll_30',
'10퍼': 'star_scroll_10',
'황금망치': 'golden_hammer',
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
    '악세6': 'primal_acc_wristwatch_01',
    '정령': 'spirit_essence',
    '제네시스': 'spirit_primal',
'신비스크롤': 'prefix_reroll_scroll'
};

const itemData = {
soulstone_faint: { name: '희미한 영혼석', type: 'Special', category: 'RefinementMaterial', grade: 'Rare', description: '영혼 제련 경험치를 100 부여합니다.', image: 'soulstone_faint.png', tradable: false },
    soulstone_glowing: { name: '빛나는 영혼석', type: 'Special', category: 'RefinementMaterial', grade: 'Epic', description: '영혼 제련 경험치를 1,000 부여합니다.', image: 'soulstone_glowing.png', tradable: false },
    soulstone_radiant: { name: '찬란한 영혼석', type: 'Special', category: 'RefinementMaterial', grade: 'Mystic', description: '영혼 제련 경험치를 10,000 부여합니다.', image: 'soulstone_radiant.png', tradable: false },
    condensed_soul_essence: { name: '응축된 영혼의 정수', type: 'Special', category: 'Essence', grade: 'Primal', description: '장비의 영혼 제련 경험치가 담겨있습니다.', image: 'condensed_soul_essence.png', tradable: true },
'abyssal_box': { name: '심연의 상자', type: 'Special', category: 'Consumable', grade: 'Mystic', description: '사용 시 심연 상점에서 판매하는 아이템 중 하나를 획득합니다.', image: 'box100.png', tradable: true },
'rift_shard_abyss': { name: '심연의 파편', type: 'Special', category: 'Material', grade: 'Primal', description: '100만 층 이상의 심연에서만 발견되는 순수한 에너지의 결정체.', image: 'rift_shard_abyss.png', tradable: true },
'bahamut_essence': { name: '바하무트의 정수', type: 'Special', category: 'Material', grade: 'Primal', description: '바하무트의 잠재력을 최대로 끌어올릴 수 있는 신화적인 재료.', image: 'pure_blood_crystal.png', tradable: true },
'soulstone_attack': { name: '파괴자의 소울스톤', type: 'Special', category: 'Soulstone', grade: 'Primal', description: '아포칼립스에 흡수시켜 공격력을 영구적으로 1% 증폭시킵니다. (최종 곱연산)', image: 'power_stone.png', tradable: true },
'soulstone_hp': { name: '선구자의 소울스톤', type: 'Special', category: 'Soulstone', grade: 'Primal', description: '아포칼립스에 흡수시켜 체력을 영구적으로 1% 증폭시킵니다. (최종 곱연산)', image: 'hp_stone.png', tradable: true },
'soulstone_defense': { name: '통찰자의 소울스톤', type: 'Special', category: 'Soulstone', grade: 'Primal', description: '아포칼립스에 흡수시켜 방어력을 영구적으로 1% 증폭시킵니다. (최종 곱연산)', image: 'def_stone.png', tradable: true },
'moon_scroll_100': { name: '100% 달의 주문서', type: 'Special', category: 'Scroll', scrollType: 'moon', grade: 'Rare', description: '장비에 달의 힘을 불어넣어 특수 능력치(집중,관통,강인함)를 +1% 상승시킵니다.', image: 'prefix_scroll.png', tradable: false, specialStats: 1 },
'moon_scroll_70': { name: '70% 달의 주문서', type: 'Special', category: 'Scroll', scrollType: 'moon', grade: 'Legendary', description: '장비에 달의 힘을 불어넣어 특수 능력치(집중,관통,강인함)를 +2% 상승시킵니다.', image: 'prefix_scroll.png', tradable: false, specialStats: 2 },
'moon_scroll_30': { name: '30% 달의 주문서', type: 'Special', category: 'Scroll', scrollType: 'moon', grade: 'Epic', description: '장비에 달의 힘을 불어넣어 특수 능력치(집중,관통,강인함)를 +5% 상승시킵니다.', image: 'prefix_scroll.png', tradable: false, specialStats: 5 },
'moon_scroll_10': { name: '10% 달의 주문서', type: 'Special', category: 'Scroll', scrollType: 'moon', grade: 'Mystic', description: '장비에 달의 힘을 불어넣어 특수 능력치(집중,관통,강인함)를 +10% 상승시킵니다.', image: 'prefix_scroll.png', tradable: false, specialStats: 10 },
'star_scroll_100': { name: '100% 별의 주문서', type: 'Special', category: 'Scroll', scrollType: 'star', grade: 'Rare', description: '장비에 별의 힘을 불어넣어 기본 능력치를 +100,000 상승시킵니다.', image: 'return_scroll.png', tradable: false, stats: 100000 },
'star_scroll_70': { name: '70% 별의 주문서', type: 'Special', category: 'Scroll', scrollType: 'star', grade: 'Legendary', description: '장비에 별의 힘을 불어넣어 기본 능력치를 +300,000 상승시킵니다.', image: 'return_scroll.png', tradable: false, stats: 300000 },
'star_scroll_30': { name: '30% 별의 주문서', type: 'Special', category: 'Scroll', scrollType: 'star', grade: 'Epic', description: '장비에 별의 힘을 불어넣어 기본 능력치를 +600,000 상승시킵니다.', image: 'return_scroll.png', tradable: false, stats: 600000 },
'star_scroll_10': { name: '10% 별의 주문서', type: 'Special', category: 'Scroll', scrollType: 'star', grade: 'Mystic', description: '장비에 별의 힘을 불어넣어 기본 능력치를 +1,000,000 상승시킵니다.', image: 'return_scroll.png', tradable: false, stats: 1000000 },
'golden_hammer': { name: '헤파이스토스의 황금 망치', type: 'Special', category: 'Hammer', grade: 'Mystic', description: '주문서 강화 실패 횟수를 1회 복구합니다.', image: 'goldenhammer.png', tradable: false },
'spirit_essence': { name: '정령의 형상', type: 'Special', category: 'Material', grade: 'Mystic', description: '응축된 정령의 힘. 펫의 영혼을 변환하여 얻을 수 있으며, 뭉쳐지면 새로운 생명이 깃듭니다', image: 'spirit_essence.png', tradable: true },
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
 primal_w01: { name: '데미우르고스', type: 'weapon', grade: 'Primal', baseEffect: 25.00, image: 'primal_sword.png', tradable: true },
primal_a01: { name: '망각의 지평선', type: 'armor', grade: 'Primal', baseEffect: 25.00, image: 'primal_armor.png', tradable: true },
'prefix_reroll_scroll': { name: '신비스크롤', type: 'Special', category: 'Consumable', grade: 'Epic', description: '미스틱, 프라이멀 등급 장비의 세트를 현재와 다른 세트로 무작위 변경합니다.', image: 'prefix_scroll.png', tradable: true },
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
'apocalypse': { 
    name: '아포칼립스', 
    type: 'pet', 
    grade: 'Primal', 
    attribute: '심연', 
    image: 'apocalypse.png', 
    description: '방관70%/치명타확률30%/치명타저항10%/추가등반35%', 
    effects: { defPenetration: 0.70, critChance: 0.30, critResistance: 0.10, extraClimbChance: 0.35 }, 
    enchantable: true,
    scrollable: true
},
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
    '[회귀자]': { effect: { scrollBuffDuration: 0.5 }, hint: "과거의 영광을 되찾기 위해 몇 번이고 시간을 되돌리세요." },
    '[오뚝이]': { effect: { goldOnDeath: 100000 }, hint: "넘어지고, 또 넘어져도, 계속해서 일어서는 자에게 주어집니다." },
    '[용사]': { effect: { bossDamage: 0.03 }, hint: "강력한 적의 숨통을 직접 끊어 영웅이 되세요." },
    '[토벌대원]': { effect: { worldBossContribution: 0.01 }, hint: "세계를 위협하는 존재에 맞서 꾸준히 당신의 힘을 보태세요." },
    '[날먹최강자]': { effect: { worldBossDamage: 0.01 }, hint: "가장 보잘것없는 무기로, 가장 위대한 존재에게 당신의 실력을 증명하세요." }
};

const spiritData = {
    spirit_rare: { id: 'spirit_rare', name: '정령: 움브라', type: 'Spirit', grade: 'Rare', description: '오프라인 시, 초당 마지막 층 골드의 40%를 획득합니다.', image: 'spirit_umbra.png', offlineBonus: { type: 'gold', multiplier: 0.4 } },
    spirit_legendary: { id: 'spirit_legendary', name: '정령: 드리아드', type: 'Spirit', grade: 'Legendary', description: '오프라인 시, 초당 마지막 층 골드의 50%를 획득합니다.', image: 'spirit_dryad.png', offlineBonus: { type: 'gold', multiplier: 0.5 } },
    spirit_mystic: { id: 'spirit_mystic', name: '정령: 에테리우스', type: 'Spirit', grade: 'Mystic', description: '오프라인 시, 초당 마지막 층 골드의 60%를 획득합니다.', image: 'spirit_aetherius.png', offlineBonus: { type: 'gold', multiplier: 0.6 } },
    spirit_primal: { id: 'spirit_primal', name: '정령: 제네시스', type: 'Spirit', grade: 'Primal', description: '오프라인 시, 골드와 아이템을 70% 효율로 획득합니다.', image: 'spirit_genesis.png', offlineBonus: { type: 'gold_and_items', multiplier: 0.7 } }
};

function grantTitle(player, titleName) {
    if (player && titleName && !player.unlockedTitles.includes(titleName)) {
        player.unlockedTitles.push(titleName);
        const message = `📜 칭호 ${titleName}을(를) 획득했습니다!`;
        pushLog(player, message);

        if (player.unlockedTitles.length >= Math.floor(Object.keys(titleData).length * 0.75) && !player.titleCodexCompleted) {
            player.titleCodexCompleted = true;
            const completionMessage = `[칭호 도감] 모든 칭호의 75%를 수집하여 마스터 보너스가 활성화되었습니다! (모든 능력치 +5%)`;
            pushLog(player, completionMessage);
        }

    }
}


const DPS_DURATION_MS = 180 * 1000; // 3분 (요구사항 1)


function addBuff(player, buff) {
    if (!player || !buff) return;
    player.buffs = player.buffs || [];

    const existingBuffIndex = player.buffs.findIndex(b => b.id === buff.id);
    const endTime = new Date(Date.now() + buff.duration);

    if (existingBuffIndex > -1) {

        if (endTime > new Date(player.buffs[existingBuffIndex].endTime)) {
            player.buffs[existingBuffIndex].endTime = endTime;
        }
    } else {

        player.buffs.push({
            id: buff.id,
            name: buff.name,
            endTime: endTime,
            effects: buff.effects || {}
        });
    }

}

function updateBuffs(player) {
    if (!player || !player.buffs) return;
    const now = Date.now();
    const initialBuffCount = player.buffs.length;

    player.buffs = player.buffs.filter(buff => new Date(buff.endTime) > now);
    
    if (player.buffs.length !== initialBuffCount) {

        calculateTotalStats(player);
    }
}

async function startDpsSession(player) {
    if (!player) return;

    if (player.dpsSession) {
        pushLog(player, '[수련장] 이미 DPS 측정이 진행 중이거나 처리 중입니다.');
        return;
    }
    if ((player.raidState && player.raidState.isActive) || player.isInFoundryOfTime) {
        pushLog(player, '[수련장] 현재 콘텐츠 진행 중에는 입장할 수 없습니다.');
        return;
    }

    const stateBeforeDps = player.isExploring ? 'exploring' : 'climbing';
    player.isExploring = false;

    player.buffs = []; 
    calculateTotalStats(player);
    player.currentHp = player.stats.total.hp;
	player.shield = player.stats.shield || 0;

    const snapshot = {
        equipment: JSON.parse(JSON.stringify(player.equipment)),
        equippedPet: JSON.parse(JSON.stringify(player.equippedPet)),
        stats: JSON.parse(JSON.stringify(player.stats)),
        title: player.equippedTitle,
        research: JSON.parse(JSON.stringify(player.research, (key, value) => {
            if (value instanceof Map) {
                return Object.fromEntries(value);
            }
            return value;
        })),
        fameScore: player.fameScore
    };

    player.dpsSession = {
        isActive: true,
        startTime: Date.now(),
        endTime: Date.now() + DPS_DURATION_MS,
        totalDamage: 0,
        stateBeforeDps: stateBeforeDps,
        snapshot: snapshot,
        aborted: false,
        details: {
            damageBreakdown: { basic: 0, critBonus: 0, predator: 0, doom: 0, refinement: 0 },
            skillMetrics: { bloodthirstCount: 0, awakeningDuration: 0, rageDuration: 0, predatorBuffDuration: 0, revelationDuration: 0 },
            combatStats: { totalHits: 0, critHits: 0 }
        }
    };

    pushLog(player, `[수련장] DPS 측정을 시작합니다. (3분간 진행)`);
    
    if (player.socket) {
        player.socket.emit('dps:started', { duration: DPS_DURATION_MS });
        sendPlayerState(player);
        player.stateSentThisTick = true; 
    }

    setTimeout(() => {
        if (player && player.dpsSession && player.dpsSession.isActive && !player.dpsSession.aborted) {
            endDpsSession(player);
        }
    }, DPS_DURATION_MS + 5000);
}

function runDpsSimulation(player) {
    if (!player || !player.dpsSession || !player.dpsSession.isActive) return;

    const session = player.dpsSession;
    const now = Date.now();

    if (now >= session.endTime) {
        endDpsSession(player);
        return;
    }
    

    calculateTotalStats(player); 

    const stats = player.stats.total;
    const weapon = player.equipment.weapon;
    const armor = player.equipment.armor;
    const m = { 
        defense: 0, 
        isBoss: true,
    }; 
    let titleEffects = player.equippedTitle ? titleData[player.equippedTitle]?.effect : null;
    let titleBossDamageBonus = (titleEffects && titleEffects.bossDamage) ? (1 + titleEffects.bossDamage) : 1;

    let pDmg = 0;
    let finalAttack = stats.attack;

    let trackPredator = 0;
    let trackBaseAndCrit = 0;
    let trackRefinement = 0;
    let trackDoom = 0;
    let isCrit = false;


    if (hasBuff(player, 'awakening') || hasBuff(player, 'awakening_earring')) session.details.skillMetrics.awakeningDuration = (session.details.skillMetrics.awakeningDuration || 0) + 1;
    if (hasBuff(player, 'predator_state')) session.details.skillMetrics.predatorBuffDuration = (session.details.skillMetrics.predatorBuffDuration || 0) + 1;

    if (hasBuff(player, 'fury_attack')) {
        session.details.skillMetrics.rageDuration = (session.details.skillMetrics.rageDuration || 0) + 1;
        finalAttack *= 1.5; 
    }


    if (hasBuff(player, 'predator_state')) {
        trackPredator = finalAttack * 2.0;
        pDmg += trackPredator;
    }

    session.details.combatStats.totalHits += 1;

    if (Math.random() < player.stats.critChance) {
        isCrit = true;
        session.details.combatStats.critHits += 1;
        const critMultiplier = 1.5 + (stats.critDamage || 0);
        trackBaseAndCrit = finalAttack * critMultiplier;
    } else {
        const effectiveDefense = m.defense * (1 - (stats.defPenetration || 0));
        trackBaseAndCrit = Math.max(0, finalAttack - effectiveDefense);
    }
    pDmg += trackBaseAndCrit;
    if (player.stats.additiveDamage > 0) {
        trackRefinement = pDmg * (player.stats.additiveDamage / 100);
        pDmg += trackRefinement;
    }
    
    if (m.isBoss) { 
        pDmg *= titleBossDamageBonus; 
    }

    if (stats.lowHpAttackPercent > 0 && player.currentHp < stats.hp) {
        const missingHpPercent = (stats.hp - player.currentHp) / stats.hp;
        const damageMultiplier = 1 + (missingHpPercent * 100 * stats.lowHpAttackPercent);
        pDmg *= damageMultiplier;
    }


    if (stats.bloodthirst > 0 && Math.random() < stats.bloodthirst / 100) {
        session.details.skillMetrics.bloodthirstCount = (session.details.skillMetrics.bloodthirstCount || 0) + 1;
        player.currentHp = stats.hp;
        if (weapon?.prefix === '포식자') {
            const duration = (armor?.prefix === '포식자') ? 5000 : 3000;
            addBuff(player, 'predator_state', '포식', duration, {});
        }
        if (armor?.prefix === '포식자') {
            addBuff(player, 'predator_endurance', '광전사의 인내', 10000, {});
        }
    }

    if (weapon) {

        if (weapon.prefix === '격노' && Math.random() < 0.05) {
            const duration = (armor?.prefix === '격노') ? 7000 : 5000;
            addBuff(player, 'fury_attack', '격노(공)', duration, {});
        }
        if (weapon.prefix === '파멸' && Math.random() < 0.02) {
            const bonusDamageMultiplier = (armor?.prefix === '파멸') ? 3.0 : 2.0;
            trackDoom = stats.attack * bonusDamageMultiplier;
            pDmg += trackDoom;
        }
        if (weapon.prefix === '계시' && Math.random() < 0.002) {
            const duration = (armor?.prefix === '계시') ? 7000 : 5000;
            applyAwakeningBuff(player, duration);
        }
    }

    if (pDmg > 0) {
        if (player.equipment.earring?.id === 'acc_earring_01' && Math.random() < 0.03) {
            applyEarringAwakeningBuff(player, 10000);
        }
        if (player.equipment.earring?.id === 'primal_acc_earring_01' && Math.random() < 0.03) {
            applyEarringAwakeningBuff(player, 15000);
        }
    }

    session.totalDamage += pDmg;

    const totalBeforeMultipliers = trackPredator + trackBaseAndCrit + trackRefinement;
    const damageExcludingDoom = pDmg - trackDoom;

    const multiplier = (totalBeforeMultipliers > 0) ? damageExcludingDoom / totalBeforeMultipliers : 1;

    session.details.damageBreakdown.predator = (session.details.damageBreakdown.predator || 0) + (trackPredator * multiplier);
    session.details.damageBreakdown.refinement = (session.details.damageBreakdown.refinement || 0) + (trackRefinement * multiplier);
    session.details.damageBreakdown.doom = (session.details.damageBreakdown.doom || 0) + trackDoom;

    const finalBaseAndCrit = trackBaseAndCrit * multiplier;
    if (isCrit) {
        const critMultiplier = 1.5 + (stats.critDamage || 0);
        const basicPortion = finalBaseAndCrit / critMultiplier;
        const critBonusPortion = finalBaseAndCrit - basicPortion;
        session.details.damageBreakdown.basic = (session.details.damageBreakdown.basic || 0) + basicPortion;
        session.details.damageBreakdown.critBonus = (session.details.damageBreakdown.critBonus || 0) + critBonusPortion;
    } else {
        session.details.damageBreakdown.basic = (session.details.damageBreakdown.basic || 0) + finalBaseAndCrit;
    }

    if (player.buffs && player.buffs.length > 0) {
        const initialBuffCount = player.buffs.length;
        player.buffs = player.buffs.filter(buff => new Date(buff.endTime) > now);
        if (player.buffs.length < initialBuffCount) {

            const hpBefore = player.stats.total.hp || 1;
            const originalCurrentHp = player.currentHp;
            calculateTotalStats(player); 
            const newMaxHp = player.stats.total.hp;
            player.currentHp = Math.min(originalCurrentHp, newMaxHp);
			const healthPercent = originalCurrentHp / hpBefore;

            player.shield = (player.stats.shield || 0) * healthPercent;
        }
    }
}

async function endDpsSession(player, aborted = false) {

    if (!player || !player.dpsSession || (!player.dpsSession.isActive && !aborted)) return;

    const session = player.dpsSession;
    session.isActive = false;

    session.aborted = aborted || session.aborted; 


    if (session.stateBeforeDps === 'exploring') {
        player.isExploring = true;
    }


    player.buffs = [];
    calculateTotalStats(player);
    
    if (session.aborted) {
        pushLog(player, '[수련장] DPS 측정을 중단했습니다. 기록은 저장되지 않습니다.');
        if (player.socket) {
            player.socket.emit('dps:aborted');
            sendPlayerState(player);
        }
        player.dpsSession = null;
        return;
    }

    const durationSeconds = DPS_DURATION_MS / 1000;
    const finalDps = session.totalDamage / durationSeconds;
    
    const resultData = {
        totalDamage: session.totalDamage,
        dps: finalDps,
        duration: durationSeconds,
        details: session.details,
        snapshot: session.snapshot
    };

    const { isNewBest, recordId, isTop3 } = await updateDpsRecordsAndLeaderboard(player, resultData);

    pushLog(player, `[수련장] DPS 측정 종료. 총 피해량: ${Math.floor(session.totalDamage).toLocaleString()}, 평균 DPS: ${Math.floor(finalDps).toLocaleString()}`);

    if (player.socket) {
        player.socket.emit('dps:result', { record: { ...resultData, _id: recordId, username: player.username }, isNewBest, isTop3 });
        sendPlayerState(player);
    }

    player.dpsSession = null; 
}

async function updateDpsRecordsAndLeaderboard(player, resultData) {
    let isNewBest = false;
    let isTop3 = false;

    const newRecord = new DpsRecord({
        userId: player.user,
        username: player.username,
        ...resultData
    });
    await newRecord.save();
    const userRecords = await DpsRecord.find({ userId: player.user }).sort({ totalDamage: -1 }).limit(4);
    
    if (userRecords.length <= 3) {
        isTop3 = true;
    } else if (userRecords.some(r => r._id.equals(newRecord._id))) {
        isTop3 = true;
        await DpsRecord.findByIdAndDelete(userRecords[3]._id);
    }

    const currentBest = await DpsLeaderboard.findOne({ userId: player.user });

    if (!currentBest || resultData.totalDamage > currentBest.totalDamage) {
        isNewBest = true;
        await DpsLeaderboard.findOneAndUpdate(
            { userId: player.user },
            {
                username: player.username,
                totalDamage: resultData.totalDamage,
                dps: resultData.dps,
                snapshot: resultData.snapshot,
                recordId: newRecord._id 
            },
            { upsert: true, new: true }
        );
        if (!currentBest) {
            pushLog(player, '[수련장] 첫 DPS 기록을 축하합니다!');
        } else {
            pushLog(player, '[수련장] 🎉 개인 최고 기록을 갱신했습니다! 🎉');
        }
    }

    return { isNewBest, recordId: newRecord._id.toString(), isTop3 };
}

function checkStateBasedTitles(player) {
    if (!player) return;

    if (player.equipment.weapon?.grade === 'Mystic' && player.equipment.armor?.grade === 'Common') {
        grantTitle(player, '[유리대포]');
    }

    if (player.equipment.weapon?.enchantments?.length > 0 && player.equipment.armor?.enchantments?.length > 0) {
        grantTitle(player, '[마부장인]');
    }

    if (player.equippedPet?.id === 'bahamut' || player.petInventory.some(p => p.id === 'bahamut')) {
        grantTitle(player, '[로포비아]');
    }

    const fusionPets = ['ignis_aqua', 'tempest', 'thunderbird'];
    const hasAllFusionPets = fusionPets.every(petId => player.petInventory.some(p => p.id === petId));
    if (hasAllFusionPets) {
        grantTitle(player, '[원소술사]');
    }

    const mysticAcc = ['acc_necklace_01', 'acc_earring_01', 'acc_wristwatch_01'];
    const hasAllMysticAcc = mysticAcc.every(accId => player.inventory.some(i => i.id === accId) || Object.values(player.equipment).some(e => e?.id === accId));
    if (hasAllMysticAcc) {
        grantTitle(player, '[전당포]');
    }

    if (player.equipment.weapon?.grade === 'Primal' && player.equipment.armor?.grade === 'Primal') {
        grantTitle(player, '[인과율의 밖]');
    }

    if (player.equipment.weapon?.grade === 'Mystic' && player.equipment.armor?.grade === 'Mystic') {
        grantTitle(player, '[랭커]');
    }

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
let activeEvents = {}; 
let eventEndTimer = null; 


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
                4: { itemsByGrade: { Common: ['w001', 'a001'], Rare: ['w002', 'a002'], Legendary: ['w003', 'a003'], Epic: ['w004', 'a004'], Mystic: ['w005', 'a005'] }, rates: { Common: 0.649, Rare: 0.25, Legendary: 0.09, Epic: 0.0098, Mystic: 0.0003 }, specialDrops: { 'rift_shard': { chance: 0.001 } } },
                5: {
                    itemsByGrade: { Common: ['w001', 'a001'], Rare: ['w002', 'a002'], Legendary: ['w003', 'a003'], Epic: ['w004', 'a004'], Mystic: ['w005', 'a005'], Primal: ['primal_w01', 'primal_a01'] },
                    rates: { Common: 0.5994995, Rare: 0.28, Legendary: 0.11, Epic: 0.0098, Mystic: 0.0003, Primal: 0.000001 },
                    specialDrops: { 'rift_shard': { chance: 0.001 } }
                },
                6: {
                    itemsByGrade: { Common: ['w001', 'a001'], Rare: ['w002', 'a002'], Legendary: ['w003', 'a003'], Epic: ['w004', 'a004'], Mystic: ['w005', 'a005'], Primal: ['primal_w01', 'primal_a01', 'primal_acc_necklace_01', 'primal_acc_earring_01', 'primal_acc_wristwatch_01'] },
                    rates: { Common: 0.491995, Rare: 0.30, Legendary: 0.13, Epic: 0.019, Mystic: 0.0016, Primal: 0.000001 },
                    specialDrops: { 'rift_shard': { chance: 0.002 } }
                }
            },
            globalLootTable: [
                { id: 'gold_pouch', chance: (0.002) }, { id: 'pet_egg_normal', chance: (0.0016) }, { id: 'prevention_ticket', chance: (0.00018) }, { id: 'pet_egg_ancient', chance: (0.00005) }, { id: 'hammer_hephaestus', chance: (0.00006) }, { id: 'tome_socket1', chance: (0.000008) }, { id: 'tome_socket2', chance: (0.0000065) }, { id: 'tome_socket3', chance: (0.000005) }, { id: 'return_scroll', chance: (0.000009 *1.5) }, { id: 'acc_necklace_01', chance: (0.000004) }, { id: 'acc_earring_01', chance: (0.000004) }, { id: 'acc_wristwatch_01', chance: (0.000004) }, { id: 'pet_egg_mythic', chance: (0.0000005) }, { id: 'form_locking_stone', chance: (0.0001 / 2) },{ id: 'prefix_reroll_scroll', chance: (0.0001 / 2) } 
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

function createItemInstance(id, quantity = 1, enhancement = 0, specificPrefix = null) {
    const d = itemData[id] || spiritData[id]; 
    if (!d) return null;

    const item = {
        uid: new mongoose.Types.ObjectId().toString(),
        id,
        name: d.name,
        type: d.type,
        grade: d.grade,
        category: d.category,
        scrollType: d.scrollType, 
        image: d.image,
        accessoryType: d.accessoryType,
        description: d.description,
        tradable: d.tradable,
        quantity: quantity,
        prefix: null
    };

    if (d.offlineBonus) {
        item.offlineBonus = d.offlineBonus;
    }

    if (d.type === 'weapon' || d.type === 'armor') {
        item.baseEffect = d.baseEffect;
        item.enhancement = enhancement;
        item.enchantments = [];
    }
    if (d.type === 'accessory' && d.enchantable) {
        item.enchantments = [];
    }

    if ((item.grade === 'Mystic' || item.grade === 'Primal') && (item.type === 'weapon' || item.type === 'armor')) {
        if (specificPrefix && specificPrefix !== 'random') {
            item.prefix = specificPrefix;
        } else {
            const prefixes = ['완벽', '격노', '파멸', '포식자', '계시'];
            const randomPrefix = prefixes[Math.floor(Math.random() * prefixes.length)];
            item.prefix = randomPrefix;
        }
        item.name = `[${item.prefix}] ${d.name}`;
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
        quantity: 1,
 enchantable: d.enchantable, 
        scrollable: d.scrollable   
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
        if (!player.codexBonusActive && player.discoveredItems.length >= Math.floor(totalCount * 0.75)) {
            player.codexBonusActive = true;
            const message = `[도감] 모든 아이템의 75%를 수집하여 마스터 보너스가 활성화되었습니다! (체/공/방/골드/치명타 +5%)`;
            pushLog(player, message);
            io.emit('chatMessage', { isSystem: true, message: `🎉 ${player.username}님이 아이템 도감을 75% 완성했습니다! 🎉` });
            calculateTotalStats(player);
        }
    }
}


function handleItemStacking(player, item) {
    if (player.autoSellList && player.autoSellList.includes(item.id) && (item.enhancement === 0 || typeof item.enhancement === 'undefined')) {
        autoSellItemById(player, item);
        sendPlayerState(player);
        return;
    }
    if (!item) {
        console.error("handleItemStacking 함수에 비정상적인 null 아이템이 전달되었습니다.");
        return;
    }
    addDiscoveredItem(player, item.id);

    const isUniquePet = item.type === 'pet' && (item.enchantments?.length > 0 || item.scrollStats > 0 || item.moonScrollStats > 0 || item.soulstoneBonuses);
    const isStackableMaterial = item.category === 'Material';
    const isStackablePrimal = item.grade === 'Primal' && (isStackableMaterial || item.category === 'Soulstone');
    const nonStackableMysticIds = ['w005', 'a005', 'acc_necklace_01', 'acc_earring_01', 'acc_wristwatch_01'];


    if (item.type === 'pet' && !isUniquePet) {
        player.petInventory.push(item);
    } else if (isUniquePet) {
        player.petInventory.push(item);
    } else if (item.type === 'Spirit') {
        if(!player.spiritInventory) player.spiritInventory = [];
        player.spiritInventory.push(item);
    } 


    else if (
        nonStackableMysticIds.includes(item.id) ||
        item.enhancement > 0 || 
        (item.enchantments && item.enchantments.length > 0) || 
        item.scrollStats > 0 ||                               
        item.moonScrollStats > 0 ||                       
        (item.grade === 'Primal' && !isStackablePrimal)
    ) {
        if (isStackablePrimal) {
             const stackableItem = player.inventory.find(i => i.id === item.id);
             if (stackableItem) {
                stackableItem.quantity += item.quantity;
             } else {
                player.inventory.push(item);
             }
        } else {

            player.inventory.push(item);
        }
    } else {

        const stackableItem = player.inventory.find(i => 
            i.id === item.id && 
            (i.prefix || null) === (item.prefix || null) && 
            (!i.enhancement || i.enhancement === 0) &&
            (!i.enchantments || i.enchantments.length === 0) && 
            !i.scrollStats &&                                  
            !i.moonScrollStats                              
        );

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
    const base = player.stats.base;

    let scrollHp = 0, scrollAttack = 0, scrollDefense = 0;
    let moonScrollBonus = 0; 

    const equipmentForScrolls = [
        player.equipment.weapon,
        player.equipment.armor,
        player.equipment.necklace,
        player.equipment.earring,
        player.equipment.wristwatch,
        player.equippedPet && player.equippedPet.scrollable ? player.equippedPet : null
    ].filter(Boolean);

   equipmentForScrolls.forEach(item => {
        if (item && item.scrollStats) {
            scrollHp += item.scrollStats;
            scrollAttack += item.scrollStats;
            scrollDefense += item.scrollStats;
        }

        if (item && item.moonScrollStats) {
            moonScrollBonus += item.moonScrollStats;
        }
    });

    const finalBase = {
        hp: base.hp + scrollHp,
        attack: base.attack + scrollAttack,
        defense: base.defense + scrollDefense
    };

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

    player.stats.critChance = 0;
    player.stats.critResistance = 0;
    player.focus = 0;
    player.penetration = 0;
    player.tenacity = 0;

    player.stats.additiveDamage = 0;
    player.stats.shield = 0;
    player.stats.dodgeChance = 0;


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

    player.buffs = player.buffs || [];
    player.buffs.forEach(buff => {
        if (buff.id === 'awakening' || buff.id === 'awakening_earring') {
             buffAttackMultiplier *= 10;
             buffDefenseMultiplier *= 10;
             buffHpMultiplier *= 10;
        } else if (buff.id === 'return_scroll_awakening') {
             buffAttackMultiplier *= (buff.effects.attackMultiplier || 1);
             buffDefenseMultiplier *= (buff.effects.defenseMultiplier || 1);
             buffHpMultiplier *= (buff.effects.hpMultiplier || 1);
        }
    });

    if (player.equipment.weapon) {
        weaponBonus = computeEnhanceBonus(player.equipment.weapon);
        if (titleEffects && titleEffects.commonWeaponAttackBonus && player.equipment.weapon.grade === 'Common') {
            weaponBonus += titleEffects.commonWeaponAttackBonus;
        }
    }
    if (player.equipment.armor) armorBonus = computeEnhanceBonus(player.equipment.armor);

    if (player.equipment.weapon?.prefix === '완벽' && player.equipment.armor?.prefix === '완벽') {
        weaponBonus += (player.equipment.weapon.baseEffect * 0.05);
        armorBonus += (player.equipment.armor.baseEffect * 0.05);
    }

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

    if (player.equipment.weapon && player.equipment.weapon.refinement) {
        player.stats.additiveDamage = getRefinementBonus(player.equipment.weapon);
    }
    if (player.equipment.armor && player.equipment.armor.refinement) {

    }
    ['necklace', 'earring', 'wristwatch'].forEach(slot => {
        if (player.equipment[slot] && player.equipment[slot].refinement) {
            player.stats.dodgeChance += getRefinementBonus(player.equipment[slot]);
        }
    });


    player.focus += moonScrollBonus;
    player.penetration += moonScrollBonus;
    player.tenacity += moonScrollBonus;

    let researchBonuses = {
        attackPercent: 0, hpPercent: 0, defensePercent: 0, critChance: 0, critDamage: 0,
        penetration: 0, focus: 0, critResistance: 0, tenacity: 0, bloodthirst: 0,
        lowHpAttackPercent: 0, goldGainPercent: 0, itemDropRatePercent: 0, bonusClimbChance: 0
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

    let totalHp = (finalBase.hp * (1 + armorBonus)) * buffHpMultiplier * enchantHpPercent * enchantAllStatsPercent * titleHpBonus;
    let totalAttack = (finalBase.attack * (1 + weaponBonus)) * artifactAttackMultiplier * buffAttackMultiplier * enchantAttackPercent * enchantAllStatsPercent * titleAttackBonus;
    let totalDefense = (finalBase.defense * (1 + armorBonus)) * artifactDefenseMultiplier * buffDefenseMultiplier * enchantDefensePercent * enchantAllStatsPercent;

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

    totalHp *= (1 + researchBonuses.hpPercent);
    totalAttack *= (1 + researchBonuses.attackPercent);
    totalDefense *= (1 + researchBonuses.defensePercent);

    const weaponPrefix = player.equipment.weapon?.prefix;
    const armorPrefix = player.equipment.armor?.prefix;

    const penalties = {
        '격노': 0.90, '파멸': 0.99, '포식자': 0.82, '계시': 0.93
    };

    if (weaponPrefix && penalties[weaponPrefix]) {
        totalAttack *= penalties[weaponPrefix];
    }
    if (armorPrefix && penalties[armorPrefix]) {
        totalDefense *= penalties[armorPrefix];
        totalHp *= penalties[armorPrefix];
    }

    player.stats.critChance = (player.stats.critChance + titleCritBonus) * (1 + researchBonuses.critChance);
    player.stats.critResistance *= (1 + researchBonuses.critResistance);
    player.focus = player.focus * (1 + researchBonuses.focus);
    player.penetration = player.penetration * (1 + researchBonuses.penetration);
    player.tenacity = player.tenacity * (1 + researchBonuses.tenacity);

    if (player.equippedPet && player.equippedPet.soulstoneBonuses) {
        const petBonuses = player.equippedPet.soulstoneBonuses;
        if (petBonuses.attack > 0) totalAttack *= (1 + petBonuses.attack / 100);
        if (petBonuses.hp > 0) totalHp *= (1 + petBonuses.hp / 100);
        if (petBonuses.defense > 0) totalDefense *= (1 + petBonuses.defense / 100);
    }

    const fameBonusPercent = (player.fameScore || 0) / 300;
    player.stats.fameBonusPercent = fameBonusPercent; 

    const fameBonusMultiplier = 1 + (fameBonusPercent / 100);

    totalHp *= fameBonusMultiplier;
    totalAttack *= fameBonusMultiplier;
    totalDefense *= fameBonusMultiplier;
    

    if (player.equipment.armor && player.equipment.armor.refinement) {
        const armorRefinementBonus = getRefinementBonus(player.equipment.armor);
        player.stats.shield = totalHp * (armorRefinementBonus / 100);
    }


    player.stats.total = {
        hp: totalHp,
        attack: totalAttack,
        defense: totalDefense,
        defPenetration: petDefPenetration + enchantDefPenetration,
        critDamage: researchBonuses.critDamage,
        lowHpAttackPercent: researchBonuses.lowHpAttackPercent,
        bloodthirst: (player.bloodthirst || 0) + (researchBonuses.bloodthirst || 0)
    };
	
	
}


function computeEnhanceBonus(item) {
    if(!item) return 0;
    
    let bonus = item.baseEffect; 

    if (item.grade === 'Primal' && item.randomizedValue) {
        bonus += (item.randomizedValue / 100);
    }

    for (let i = 1; i <= item.enhancement; i++) { 
        if (item.grade === 'Primal') {
            bonus += item.baseEffect * (i <= 10 ? 0.05 : 0.10); 
        } else {
            bonus += item.baseEffect * (i <= 10 ? 0.1 : 0.5); 
        }
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
    const user = await User.findById(socket.userId).select('kakaoId isKakaoVerified isHelper').lean();
    if (!user || !user.isKakaoVerified || !user.kakaoId) {
        socket.emit('forceDisconnect', { message: '카카오 계정과 연동된 계정만 접속할 수 있습니다.' });
        socket.disconnect(true);
        return;
    }
    const newPlayerKakaoId = user.kakaoId;
    const clientIp = getNormalizedIp(socket);
    const existingPlayerWithSameIP = Object.values(onlinePlayers).find(p => getNormalizedIp(p.socket) === clientIp);
    if (existingPlayerWithSameIP && existingPlayerWithSameIP.kakaoId !== newPlayerKakaoId) {
        socket.emit('forceDisconnect', { message: '해당 IP 주소에서는 다른 카카오 계정이 이미 접속 중입니다.' });
        socket.disconnect(true);
        return;
    }
    
    if (onlinePlayers[socket.userId]) {
        console.log(`[중복 접속] ${socket.username}님이 새 위치에서 접속하여 이전 연결을 종료합니다.`);
        const oldSocket = onlinePlayers[socket.userId].socket;
        oldSocket.emit('forceDisconnect', { message: '다른 기기 또는 탭에서 접속하여 연결을 종료합니다.' });
        oldSocket.disconnect(true);
    }

    console.log(`[연결] 유저: ${socket.username} (Role: ${socket.role})`);
    let gameData = await GameData.findOne({ user: socket.userId }).lean();

    if (gameData && !gameData.refinementLevelRecalculated) {
        let wasModified = false;
        const recalculateLevel = (item) => {
            if (item && item.refinement && typeof item.refinement.exp === 'number') {
                const currentExp = item.refinement.exp;
                const correctLevel = getRefinementLevelFromExp(currentExp);
                if (item.refinement.level !== correctLevel) {
                    item.refinement.level = correctLevel;
                    wasModified = true;
                }
            }
        };
        Object.values(gameData.equipment).forEach(recalculateLevel);
        gameData.inventory.forEach(recalculateLevel);
        if (wasModified) {
            await GameData.updateOne({ user: socket.userId }, {
                $set: {
                    equipment: gameData.equipment,
                    inventory: gameData.inventory,
                    refinementLevelRecalculated: true
                }
            });
            console.log(`[데이터 보정] ${gameData.username}님의 제련 아이템 레벨을 재계산했습니다.`);
        }
    }

    if (gameData && gameData.inventory) {
        let wasUpdated = false;
        const soulstoneIds = ['soulstone_faint', 'soulstone_glowing', 'soulstone_radiant'];
        gameData.inventory.forEach(item => {
            if (item && soulstoneIds.includes(item.id) && item.category !== 'RefinementMaterial') {
                item.category = 'RefinementMaterial';
                wasUpdated = true;
            }
        });
        if (wasUpdated) {
            await GameData.updateOne({ user: socket.userId }, { $set: { inventory: gameData.inventory } });
        }
    }
	
    if (gameData) {
        let updatesToSave = {};
        const totalCodexItems = getTotalCodexItemCount();
        if (gameData.discoveredItems && gameData.discoveredItems.length >= Math.floor(totalCodexItems * 0.75) && !gameData.codexBonusActive) {
            gameData.codexBonusActive = true; 
            updatesToSave.codexBonusActive = true;
            gameData.log.unshift(`[도감] 모든 아이템의 75%를 수집하여 마스터 보너스가 활성화되었습니다! (체/공/방/골드/치명타 +5%)`);
            if (gameData.log.length > 15) gameData.log.pop();
            io.emit('chatMessage', { isSystem: true, message: `🎉 ${gameData.username}님이 아이템 도감을 75% 완성했습니다! 🎉` });
        }
        const totalTitles = Object.keys(titleData).length;
        if (gameData.unlockedTitles && gameData.unlockedTitles.length >= Math.floor(totalTitles * 0.75) && !gameData.titleCodexCompleted) {
            gameData.titleCodexCompleted = true; 
            updatesToSave.titleCodexCompleted = true;
            const completionMessage = `[칭호 도감] 모든 칭호의 75%를 수집하여 마스터 보너스가 활성화되었습니다! (모든 능력치 +5%)`;
            gameData.log.unshift(completionMessage);
            if (gameData.log.length > 15) gameData.log.pop();
        }
        if (Object.keys(updatesToSave).length > 0) {
            await GameData.updateOne({ user: socket.userId }, { $set: updatesToSave });
        }
    }

    if (gameData) {
        const wasModified = addDefaultPrefixToOldItems(gameData);
        if (wasModified) {
            await GameData.updateOne({ user: socket.userId }, { 
                $set: { 
                    equipment: gameData.equipment, 
                    inventory: gameData.inventory 
                } 
            });
        }
    }
	
    if (!gameData) { 
        console.error(`[오류] ${socket.username}의 게임 데이터를 찾을 수 없습니다.`);
        return socket.disconnect(); 
    }

    await calculateAndSendOfflineRewards(gameData);
    gameData = await GameData.findOne({ user: socket.userId }).lean();

    if (gameData.research) {
        for (const specId in gameData.research) {
            if (typeof gameData.research[specId] === 'object' && gameData.research[specId] !== null) {
                gameData.research[specId] = new Map(Object.entries(gameData.research[specId]));
            }
        }
    }
    
    gameData.kakaoId = newPlayerKakaoId;

    if (gameData) {
        if (gameData.incubator && !gameData.incubators) {
            gameData.incubators = Array(6).fill(null).map(() => ({ egg: null, hatchCompleteTime: null, hatchDuration: 0 }));
            if (gameData.incubator.egg) {
                gameData.incubators[0] = gameData.incubator;
            }
            delete gameData.incubator;
        } else if (!gameData.incubators || gameData.incubators.length < 6) {
            const existing = gameData.incubators || [];
            gameData.incubators = Array(6).fill(null).map((_, i) => existing[i] || ({ egg: null, hatchCompleteTime: null, hatchDuration: 0 }));
        }
        gameData.isExploring = false;
        const foundItemIds = new Set(gameData.discoveredItems || []);
        (gameData.inventory || []).forEach(item => foundItemIds.add(item.id));
        Object.values(gameData.equipment || {}).forEach(item => { if (item) foundItemIds.add(item.id); });
        (gameData.petInventory || []).forEach(pet => foundItemIds.add(pet.id));
        if (gameData.equippedPet) foundItemIds.add(gameData.equippedPet.id);
        if (gameData.incubator && gameData.incubator.egg) foundItemIds.add(gameData.incubator.egg.id);
        (gameData.unlockedArtifacts || []).forEach(artifact => { if (artifact) foundItemIds.add(artifact.id); });
        gameData.discoveredItems = Array.from(foundItemIds);
    }
    
    if (user) gameData.kakaoId = user.kakaoId;
    if (!gameData.equipment) gameData.equipment = {}; 
    
    const requiredSlots = ['weapon', 'armor', 'necklace', 'earring', 'wristwatch'];
    requiredSlots.forEach(slotName => { if (typeof gameData.equipment[slotName] === 'undefined') gameData.equipment[slotName] = null; });

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
    if (!gameData.personalRaid) gameData.personalRaid = { entries: 2, lastReset: new Date(0) };
    if (!gameData.titleCounters) gameData.titleCounters = { destroyCount: 0, enhancementFailCount: 0, enchantCount: 0, hatchCount: 0, pouchUseCount: 0, sellCount: 0, ahBuyCount: 0, scrollUseCount: 0, deathCount: 0, wbLastHitCount: 0, wbParticipateCount: 0 };
    if (typeof gameData.researchEssence === 'undefined') gameData.researchEssence = 0;
    if (!gameData.research) gameData.research = { warlord: new Map(), guardian: new Map(), berserker: new Map(), pioneer: new Map() };

    gameData.attackTarget = 'monster';
    
    const initialMonster = calcMonsterStats(gameData);
    onlinePlayers[socket.userId] = { 
        ...gameData, 
        isHelper: user.isHelper,
        monster: { 
            currentHp: initialMonster.hp,
            currentBarrier: initialMonster.barrier,
            lastCalculatedLevel: gameData.level
        }, 
        socket: socket, 
        buffs: [],
        isStorageTransacting: false,
        autoSellList: gameData.autoSellList || [],
        dpsSession: null 
    };
	
    if (!onlinePlayers[socket.userId].autoSellList) onlinePlayers[socket.userId].autoSellList = [];

    if (gameData.raidState && gameData.raidState.isActive) {
        const player = onlinePlayers[socket.userId];
        const userAccount = await User.findById(socket.userId).select('mute').lean();
        if (userAccount.mute && userAccount.mute.isMuted && (!userAccount.mute.expiresAt || new Date(userAccount.mute.expiresAt) > new Date())) {
            const expirationMsg = userAccount.mute.expiresAt ? `${new Date(userAccount.mute.expiresAt).toLocaleString('ko-KR')}까지` : '영구적으로';
            const reasonMsg = userAccount.mute.reason ? `(사유: ${userAccount.mute.reason})` : '';
            pushLog(player, `[시스템] 현재 채팅이 금지된 상태입니다. (${expirationMsg}) ${reasonMsg}`);
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
	onlinePlayers[socket.userId].shield = onlinePlayers[socket.userId].stats.shield;
    
    const player = onlinePlayers[socket.userId];
    
    const chatHistory = await ChatMessage.find().sort({ timestamp: -1 }).limit(50).lean();
    socket.emit('chatHistory', chatHistory.reverse());
    socket.emit('initialGlobalRecords', globalRecordsCache);
    socket.emit('gameConfig', { refinementExpTable: REFINEMENT_CONFIG.EXP_TABLE });
    
    socket.emit('enhancementData', { 
        enhancementTable: gameSettings.enhancementTable, 
        highEnhancementRate: gameSettings.highEnhancementRate 
    });

    if (worldBossState && worldBossState.isActive) {
        const serializableState = { ...worldBossState, participants: Object.fromEntries(worldBossState.participants) };
        socket.emit('worldBossUpdate', serializableState);
    }

    const unreadMailCount = await Mail.countDocuments({ recipientId: player.user, isRead: false });
    player.hasUnreadMail = unreadMailCount > 0;
    
    const playerForClient = { ...player };
    delete playerForClient.socket;
    
    socket.emit('initialState', {
        player: playerForClient, 
        monster: calcMonsterStats(player)
    });

    socket.emit('eventStatusUpdate', activeEvents);

    socket
        .on('dps:start', () => startDpsSession(onlinePlayers[socket.userId]))
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

                    if (commandOrTarget === 'dps초기화') {
                        try {
                            await DpsRecord.deleteMany({});
                            await DpsLeaderboard.deleteMany({});
                            pushLog(player, '[관리자] DPS 랭킹 데이터를 모두 삭제했습니다.');
                            const announcement = '[시스템] 관리자에 의해 DPS 랭킹이 초기화되었습니다.';
                            io.emit('globalAnnouncement', announcement);
                            io.emit('chatMessage', { isSystem: true, message: announcement });
                            console.log(`[관리자] ${adminUsername}님이 DPS 랭킹을 초기화했습니다.`);
                        } catch (error) {
                            console.error('[관리자] /dps초기화 명령어 처리 중 DB 오류 발생:', error);
                            pushLog(player, '[오류] DPS 랭킹 초기화 중 문제가 발생했습니다.');
                        }
                        return;
                    }
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
                            await GameData.updateMany({}, { $set: { "personalRaid.entries": 2 } });
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
                            
                            const d = itemData[id] || petData[id] || spiritData[id];
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
                    title: player ? player.equippedTitle : null ,
                    isHelper: player ? player.isHelper : false
                });
                await newChatMessage.save();
                const payload = { 
                    ...newChatMessage.toObject(), 
                    title: player ? player.equippedTitle : null,
                    isHelper: player ? player.isHelper : false
                };
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
            if (!itemToShow) {
                itemToShow = player.spiritInventory.find(i => i.uid === uid);
            }
            if (itemToShow) {
                const chatMessage = {
                    type: 'item_show_off',
                    username: player.username,
                    role: player.role,
                    fameScore: player.fameScore,
                    message: `[${itemToShow.name}] 을(를) 자랑합니다!`,
                    itemData: itemToShow,
                    title: player.equippedTitle
                };
                io.emit('chatMessage', chatMessage);
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
        .on('useItem', ({ uid, useAll, targetUid }) => useItem(onlinePlayers[socket.userId], uid, useAll, targetUid))
        .on('placeEggInIncubator', ({ uid, slotIndex }) => placeEggInIncubator(onlinePlayers[socket.userId], { uid, slotIndex }))
        .on('startHatching', ({ slotIndex }) => startHatching(onlinePlayers[socket.userId], { slotIndex }))
        .on('equipPet', (uid) => equipPet(onlinePlayers[socket.userId], uid))
        .on('unequipPet', () => unequipPet(onlinePlayers[socket.userId]))
        .on('removeEggFromIncubator', ({ slotIndex }) => {
            const player = onlinePlayers[socket.userId];
            if (player && player.incubators && player.incubators[slotIndex] && player.incubators[slotIndex].egg && !player.incubators[slotIndex].hatchCompleteTime) {
                const egg = player.incubators[slotIndex].egg;
                handleItemStacking(player, egg);
                player.incubators[slotIndex] = { egg: null, hatchCompleteTime: null, hatchDuration: 0 };
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
            if (player.equippedPet && player.equippedPet.uid === uid) {
                item = player.equippedPet;
                itemLocation = 'pet';
            } else {
                for (const slot of ['weapon', 'armor', 'necklace', 'earring', 'wristwatch']) {
                    if (player.equipment[slot] && player.equipment[slot].uid === uid) {
                        item = player.equipment[slot];
                        itemLocation = 'equipment';
                        break;
                    }
                }
            }
            if (!item) {
                itemIndex = player.inventory.findIndex(i => i.uid === uid);
                if (itemIndex > -1) {
                    item = player.inventory[itemIndex];
                    itemLocation = 'inventory';
                }
            }
            const isEnchantable = item && (item.id === 'apocalypse' || item.type === 'weapon' || item.type === 'armor' || ['primal_acc_necklace_01', 'primal_acc_earring_01', 'primal_acc_wristwatch_01'].includes(item.id));
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
        .on('dps:abort', () => {
            const player = onlinePlayers[socket.userId];
            if (player && player.dpsSession && player.dpsSession.isActive) {
                endDpsSession(player, true); 
            }
        })
        .on('dps:getRankingData', async (callback) => {
            try {
                const leaderboard = await DpsLeaderboard.find().sort({ totalDamage: -1 }).limit(50).lean();
                const personalTop3 = await DpsRecord.find({ userId: socket.userId }).sort({ totalDamage: -1 }).limit(3).lean();
                callback({ success: true, leaderboard, personalTop3 });
            } catch (error) {
                console.error('DPS 랭킹 데이터 조회 오류:', error);
                callback({ success: false, message: '데이터 조회 중 오류가 발생했습니다.' });
            }
        })
        .on('dps:getRecordDetail', async (recordId, callback) => {
            if (!recordId) return callback({ success: false });
            try {
                const record = await DpsRecord.findById(recordId).lean();
                if (record) {
                    callback({ success: true, record });
                } else {
                    callback({ success: false, message: '기록을 찾을 수 없습니다.' });
                }
            } catch (error) {
                console.error('DPS 기록 상세 조회 오류:', error);
                callback({ success: false, message: '서버 오류가 발생했습니다.' });
            }
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
                callback({ success: true, data: { user, gameData } }); 
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
        .on('admin:grantItem', async ({ userId, username, itemAlias, quantity, enhancement, prefix }) => {
            if (socket.role !== 'admin') return;
            const itemId = adminItemAlias[itemAlias];
            if (!itemId) return;
            const itemBaseData = itemData[itemId] || petData[itemId] || spiritData[itemId];
            if (!itemBaseData) return;
            let newItem;
            if (itemBaseData.type === 'pet') {
                newItem = createPetInstance(itemId);
            } else {
                newItem = createItemInstance(itemId, quantity, enhancement, prefix);
            }
            const onlinePlayer = onlinePlayers[userId];
            if (onlinePlayer) {
                handleItemStacking(onlinePlayer, newItem);
                sendInventoryUpdate(onlinePlayer);
                const naturalDropLog = `[${onlinePlayer.level}층]에서 <span class="${newItem.grade}">${newItem.name}</span> ${newItem.quantity > 1 ? newItem.quantity + '개' : ''}를 획득했습니다!`;
                pushLog(onlinePlayer, naturalDropLog);
                announceMysticDrop(onlinePlayer, newItem); 
            } else { 
                const gameData = await GameData.findOne({ user: userId });
                if (gameData) {
                    if (newItem.type === 'pet') {
                        gameData.petInventory.push(newItem);
                    } else if (newItem.type === 'Spirit') {
                        if(!gameData.spiritInventory) gameData.spiritInventory = [];
                        gameData.spiritInventory.push(newItem);
                    } else {
                        const stackableItem = gameData.inventory.find(i => i.id === newItem.id && i.prefix === newItem.prefix && (!i.enhancement || i.enhancement === 0) && newItem.tradable !== false);
                        if (stackableItem) {
                            stackableItem.quantity += newItem.quantity;
                        } else {
                            gameData.inventory.push(newItem);
                        }
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
        .on('admin:toggleHelper', async ({ userId, username, isHelper }) => {
            if (socket.role !== 'admin') return;
            try {
                await User.updateOne({ _id: userId }, { $set: { isHelper: isHelper } });
                const targetPlayer = onlinePlayers[userId];
                if (targetPlayer) {
                    targetPlayer.isHelper = isHelper;
                    const message = isHelper ? '서버 도우미로 설정되었습니다.' : '도우미가 해제되었습니다.';
                    pushLog(targetPlayer, `[관리자] ${message}`);
                    pushLog(onlinePlayers[socket.userId], `[관리자] ${username}님을 ${message}`);
                }
                new AdminLog({ adminUsername: socket.username, actionType: 'toggle_helper', targetUsername: username, details: { isHelper } }).save();
            } catch(error) {
                console.error(`[관리자] 도우미 설정 오류:`, error);
                pushLog(onlinePlayers[socket.userId], `[오류] ${username}님의 도우미 설정 중 오류가 발생했습니다.`);
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
        .on('admin:startEvent', (eventData) => {
            if (socket.role !== 'admin') return;
            const { type, multiplier, duration, unit, description } = eventData;
            const durationInMs = (duration || 1) * (unit === 'hours' ? 3600000 : 60000);
            activeEvents[type] = {
                type,
                multiplier: parseFloat(multiplier) || 1,
                endTime: new Date(Date.now() + durationInMs),
                description
            };
            console.log('[이벤트 시작/갱신]', activeEvents[type]);
            io.emit('eventStarted', activeEvents[type]);
            io.emit('chatMessage', { 
                isSystem: true, 
                message: `[이벤트] ${description}` 
            });
            io.emit('eventStatusUpdate', activeEvents);
        })
        .on('admin:endEvent', (eventType) => {
            if (socket.role !== 'admin' || !activeEvents[eventType]) return;
            console.log(`[이벤트 강제 종료] 관리자(${socket.username})가 ${eventType} 이벤트를 종료했습니다.`);
            delete activeEvents[eventType];
            io.emit('eventStatusUpdate', activeEvents);
        })
        .on('admin:joinRoom', () => {
            if (socket.role !== 'admin') return;
            socket.join('admin_room');
            socket.emit('eventStatusUpdate', activeEvents);
        })
        .on('rerollPrefix', ({ uid }) => rerollItemPrefix(onlinePlayers[socket.userId], uid))
        .on('spirit:create', async () => {
            const player = onlinePlayers[socket.userId];
            if (!player) return;
            const essenceItemIndex = player.inventory.findIndex(i => i.id === 'spirit_essence');
            if (essenceItemIndex === -1 || player.inventory[essenceItemIndex].quantity < 100) {
                return player.socket.emit('serverAlert', '정령의 형상이 부족합니다. (100개 필요)');
            }
            player.inventory[essenceItemIndex].quantity -= 100;
            if (player.inventory[essenceItemIndex].quantity <= 0) {
                player.inventory.splice(essenceItemIndex, 1);
            }
            let spiritId;
            const rand = Math.random();
            if (rand < 0.7) { 
                spiritId = 'spirit_rare';
            } else if (rand < 0.9) { 
                spiritId = 'spirit_legendary';
            } else { 
                spiritId = 'spirit_mystic';
            }
            const newSpirit = createItemInstance(spiritId);
            if (newSpirit) {
                handleItemStacking(player, newSpirit);
                player.socket.emit('spirit:created', { newSpirit });
                pushLog(player, `형상의 힘이 응축되어 <span class="${newSpirit.grade}">${newSpirit.name}</span>이(가) 당신을 따릅니다!`);
            }
            sendInventoryUpdate(player);
        })
        .on('autoSell:get', (callback) => {
            const player = onlinePlayers[socket.userId];
            if (player && player.autoSellList) {
                const autoSellItems = player.autoSellList.map(id => {
                    const fullItemData = itemData[id] || petData[id] || spiritData[id] || null;
                    if (fullItemData) {
                        return { ...fullItemData, id: id };
                    }
                    return null;
                }).filter(Boolean);
                callback(autoSellItems);
            } else {
                callback([]);
            }
        })
        .on('useStarScroll', ({ itemUid, scrollUid }) => useStarScroll(onlinePlayers[socket.userId], { itemUid, scrollUid }))
        .on('useMoonScroll', ({ itemUid, scrollUid }) => useMoonScroll(onlinePlayers[socket.userId], { itemUid, scrollUid }))
        .on('useGoldenHammer', ({ itemUid, hammerUid, typeToRestore }) => useGoldenHammer(onlinePlayers[socket.userId], { itemUid, hammerUid, typeToRestore }))
        .on('autoSell:toggle', async ({ itemId }) => {
            const player = onlinePlayers[socket.userId];
            if (!player) return;
            if (!player.autoSellList) {
                player.autoSellList = [];
            }
            const itemIndex = player.autoSellList.indexOf(itemId);
            const itemInfo = itemData[itemId] || petData[itemId] || spiritData[itemId];
            if (itemIndex > -1) {
                player.autoSellList.splice(itemIndex, 1);
                if (itemInfo) pushLog(player, `[자동판매] '${itemInfo.name}' 아이템을 목록에서 제거했습니다.`);
            } else {
                player.autoSellList.push(itemId);
                if (itemInfo) pushLog(player, `[자동판매] '${itemInfo.name}' 아이템을 목록에 추가했습니다.`);
                await sellExistingItemsFromAutoSellList(player, itemId);
            }
            GameData.updateOne({ user: player.user }, { $set: { autoSellList: player.autoSellList } }).catch(err => console.error('자동판매 목록 저장 오류:', err));
        })
        .on('abyssalShop:buyItem', async ({ itemId, quantity }) => {
            const player = onlinePlayers[socket.userId];
            if (!player) return;
            const shopItems = {
                'bahamut_essence': { price: 2000 },
                'pet_egg_mythic': { price: 2000 },
                'soulstone_attack': { price: 50 },
                'soulstone_hp': { price: 50 },
                'soulstone_defense': { price: 50 },
                'w005': { price: 100 },
                'a005': { price: 100 },
                'acc_necklace_01': { price: 100 },
                'acc_earring_01': { price: 100 },
                'acc_wristwatch_01': { price: 100 },
                'golden_hammer': { price: 100 },
                'star_scroll_10': { price: 50 },
                'star_scroll_30': { price: 40 },
                'star_scroll_70': { price: 30 },
                'star_scroll_100': { price: 20 },
                'moon_scroll_10': { price: 50 },
                'moon_scroll_30': { price: 40 },
                'moon_scroll_70': { price: 30 },
                'moon_scroll_100': { price: 20 },
                'abyssal_box': { price: 100 }
            };
            const itemToBuy = shopItems[itemId];
            if (!itemToBuy) return;
            const purchaseQuantity = (typeof quantity === 'number' && quantity > 0) ? Math.floor(quantity) : 1;
            const totalPrice = itemToBuy.price * purchaseQuantity;
            const shardItem = player.inventory.find(i => i.id === 'rift_shard_abyss');
            if (!shardItem || shardItem.quantity < totalPrice) {
                return pushLog(player, `[심연] 심연의 파편이 부족합니다. (필요: ${totalPrice.toLocaleString()}개)`);
            }
            shardItem.quantity -= totalPrice;
            if (shardItem.quantity <= 0) {
                player.inventory = player.inventory.filter(i => i.uid !== shardItem.uid);
            }
            const purchasedItem = createItemInstance(itemId, purchaseQuantity);
            if (purchasedItem) {
                handleItemStacking(player, purchasedItem);
                pushLog(player, `[심연] <span class="${purchasedItem.grade}">${purchasedItem.name}</span> ${purchaseQuantity}개를 구매했습니다.`);
                sendInventoryUpdate(player);
                sendPlayerState(player);
            }
        })
        .on('pet:upgradeWithEssence', () => {
            const player = onlinePlayers[socket.userId];
            if (!player) return;
            if (!player.equippedPet || player.equippedPet.id !== 'bahamut') {
                return pushLog(player, '[오류] 바하무트 펫을 장착해야 합니다.');
            }
            const essenceIndex = player.inventory.findIndex(i => i.id === 'bahamut_essence');
            if (essenceIndex === -1) {
                return pushLog(player, '[오류] 바하무트의 정수가 없습니다.');
            }
            const essence = player.inventory[essenceIndex];
            essence.quantity--;
            if (essence.quantity <= 0) {
                player.inventory.splice(essenceIndex, 1);
            }
            const newPet = createPetInstance('apocalypse');
            player.equippedPet = newPet;
            pushLog(player, `[진화] 바하무트가 심연의 힘을 흡수하여 <span class="${newPet.grade}">${newPet.name}</span>(으)로 다시 태어났습니다!`);
            calculateTotalStats(player);
            sendInventoryUpdate(player);
            sendPlayerState(player);
        })
        .on('foundry:toggle', () => {
            const player = onlinePlayers[socket.userId];
            if (!player) return;
            player.isInFoundryOfTime = !player.isInFoundryOfTime;
            const message = player.isInFoundryOfTime ? '시간의 제련소에 입장합니다.' : '일반 필드로 복귀합니다.';
            pushLog(player, `[시스템] ${message}`);
            if (player.isInFoundryOfTime) {
                player.foundryMonster = { name: '시간의 잔상', hp: 1, maxHp: 1, isBoss: false };
                socket.emit('foundry:enter', player.foundryMonster);
            } else {
                sendState(socket, player, calcMonsterStats(player));
            }
        })
        .on('refinement:infuse', ({ targetUid, materialUids }, callback) => {
            const player = onlinePlayers[socket.userId];
            if (!player) return;
            if (player.isBusy) {
                return; 
            }
            player.isBusy = true; 
            try {
                let targetItem = null;
                Object.values(player.equipment).forEach(item => {
                    if (item && item.uid === targetUid) targetItem = item;
                });
                if (player.equippedPet && player.equippedPet.uid === targetUid) targetItem = player.equippedPet;
                if (!targetItem) {
                    targetItem = player.inventory.find(i => i.uid === targetUid);
                }
                if (!targetItem || !['weapon', 'armor', 'accessory'].includes(targetItem.type)) {
                    if (typeof callback === 'function') callback({ success: false, message: "제련할 수 없는 아이템입니다." });
                    return pushLog(player, "[영혼 제련] 제련할 수 없는 아이템입니다.");
                }
                initializeRefinement(targetItem);
                if (targetItem.refinement.level >= REFINEMENT_CONFIG.MAX_LEVEL) {
                    if (typeof callback === 'function') callback({ success: false, message: "이미 최대 레벨입니다." });
                    return pushLog(player, "[영혼 제련] 이미 최대 레벨입니다.");
                }
                const materialCounts = {};
                materialUids.forEach(uid => {
                    materialCounts[uid] = (materialCounts[uid] || 0) + 1;
                });
                let totalExpGained = 0;
                for (const uid in materialCounts) {
                    const requiredCount = materialCounts[uid];
                    const materialStack = player.inventory.find(i => i.uid === uid);
                    if (!materialStack || materialStack.quantity < requiredCount) {
                        if (typeof callback === 'function') callback({ success: false, message: "재료가 부족합니다." });
                        return pushLog(player, `[영혼 제련] 재료(${materialStack ? materialStack.name : '알수없음'})가 부족합니다.`);
                    }
                }
                for (const uid in materialCounts) {
                    const requiredCount = materialCounts[uid];
                    const materialStack = player.inventory.find(i => i.uid === uid);
                    let itemsSuccessfullyUsed = 0;
                    for (let i = 0; i < requiredCount; i++) {
                        let wasUsedThisIteration = false;
                        if (materialStack.category === 'RefinementMaterial') {
                            let exp = REFINEMENT_CONFIG.SOULSTONE_EXP[materialStack.id] || 0;
                            if (Math.random() < REFINEMENT_CONFIG.RESONANCE_CHANCE) {
                                exp *= REFINEMENT_CONFIG.RESONANCE_MULTIPLIER;
                                pushLog(player, `[영혼의 공명] <span class="Mystic">대성공!</span> ${materialStack.name}의 기운이 증폭됩니다!`);
                                const successMessage = `✨ [영혼 제련] ${player.username}님이 대성공하여 엄청난 힘을 얻었습니다! ✨`;
                                io.emit('globalAnnouncement', successMessage, { style: 'great-success' });
                                player.socket.emit('refinement:greatSuccess');
                            }
                            totalExpGained += exp;
                            wasUsedThisIteration = true;
                        } else if (materialStack.category === 'Essence' && materialStack.refinementData) {
                            const targetPart = targetItem.accessoryType ? 'accessory' : targetItem.type;
                            if (materialStack.refinementData.part === targetPart) {
                                totalExpGained += materialStack.refinementData.exp;
                                wasUsedThisIteration = true; 
                            }
                        }
                        if (wasUsedThisIteration) {
                            itemsSuccessfullyUsed++;
                        }
                    }
                    materialStack.quantity -= itemsSuccessfullyUsed;
                }
                player.inventory = player.inventory.filter(i => i.quantity > 0);
                if (totalExpGained > 0) {
                    targetItem.refinement.exp += totalExpGained;
                    const oldLevel = targetItem.refinement.level;
                    targetItem.refinement.level = getRefinementLevelFromExp(targetItem.refinement.exp);
                    if (targetItem.refinement.level > oldLevel) {
                        pushLog(player, `[영혼 제련] <span class="Primal">${targetItem.name}</span>의 제련 레벨이 ${targetItem.refinement.level}로 상승했습니다!`);
                    }
                    pushLog(player, `[영혼 제련] 총 ${totalExpGained.toLocaleString()}의 경험치를 주입했습니다.`);
                }
                calculateTotalStats(player);
                socket.emit('refinement:itemUpdated', { updatedItem: targetItem });
                if (player.isInFoundryOfTime) {
                    socket.emit('playerStatsOnlyUpdate', {
                        stats: player.stats,
                        currentHp: player.currentHp,
                        shield: player.shield
                    });
                } else {
                    sendState(socket, player, calcMonsterStats(player));
                }
                sendInventoryUpdate(player);
                if (typeof callback === 'function') {
                    callback({
                        success: true,
                        updatedItem: targetItem
                    });
                }
            } finally {
                if (player) player.isBusy = false; 
            }
        })
        .on('refinement:extract', (targetUid) => {
            const player = onlinePlayers[socket.userId];
            if (!player) return;
            if (player.isBusy) {
                return;
            }
            player.isBusy = true;
            try {
                let targetItem = null;
                let itemLocation = null;
                let itemIndex = -1;
                Object.keys(player.equipment).forEach(slot => {
                    if (player.equipment[slot] && player.equipment[slot].uid === targetUid) {
                        targetItem = player.equipment[slot];
                        itemLocation = 'equipment';
                    }
                });
                if (!targetItem) {
                     itemIndex = player.inventory.findIndex(i => i.uid === targetUid);
                     if (itemIndex !== -1) {
                         targetItem = player.inventory[itemIndex];
                         itemLocation = 'inventory';
                     }
                }
                if (!targetItem || !targetItem.refinement || targetItem.refinement.exp === 0) {
                    return pushLog(player, "[영혼 추출] 추출할 경험치가 없는 아이템입니다.");
                }
                const essence = createCondensedSoulEssence(targetItem);
                handleItemStacking(player, essence);
                pushLog(player, `[영혼 추출] ${targetItem.name}의 영혼을 추출하여 <span class="Primal">${essence.name}</span>을 획득했습니다.`);
                targetItem.refinement = { level: 0, exp: 0 };
                socket.emit('refinement:itemUpdated', { updatedItem: targetItem });
                calculateTotalStats(player);
                if (player.isInFoundryOfTime) {
                    socket.emit('playerStatsOnlyUpdate', {
                        stats: player.stats,
                        currentHp: player.currentHp,
                        shield: player.shield
                    });
                } else {
                    sendState(socket, player, calcMonsterStats(player));
                }
                sendInventoryUpdate(player);
            } finally {
                if (player) player.isBusy = false;
            }
        })






      .on('disconnect', async () => { 
            console.log(`[연결 해제] 유저: ${socket.username}`);
            const player = onlinePlayers[socket.userId];
            if(player) {
                try {
                    const saveData = { ...player };
                    delete saveData.socket;
                    delete saveData.attackTarget;
                    await GameData.updateOne({ user: socket.userId }, { $set: saveData });
                } catch (error) {
                    console.error(`[저장 실패] 유저: ${player.username} 데이터 저장 중 오류 발생:`, error);
                }

            }
            delete onlinePlayers[socket.userId];
        });
});


function applyAwakeningBuff(player, duration = 10000) {
    player.buffs = player.buffs || [];
    const existingBuff = player.buffs.find(b => b.id === 'awakening');
    
    if (existingBuff) {

        const remainingTime = Math.max(0, new Date(existingBuff.endTime) - Date.now());
        existingBuff.endTime = new Date(Date.now() + remainingTime + duration);
    } else {
        player.buffs.push({
            id: 'awakening',
            name: '각성',
            endTime: new Date(Date.now() + duration),
            effects: {} 
        });
    }
    calculateTotalStats(player);
    player.currentHp = player.stats.total.hp;
}


function applyEarringAwakeningBuff(player, duration = 10000) {
    player.buffs = player.buffs || [];
    const existingBuff = player.buffs.find(b => b.id === 'awakening_earring');
    
    if (existingBuff) {

        const remainingTime = Math.max(0, new Date(existingBuff.endTime) - Date.now());
        existingBuff.endTime = new Date(Date.now() + remainingTime + duration);
    } else {
        player.buffs.push({
            id: 'awakening_earring', 
            name: '각성(이어링)',
            endTime: new Date(Date.now() + duration),
            effects: {}
        });
    }
    calculateTotalStats(player);
    player.currentHp = player.stats.total.hp;
}

function addBuff(player, buffId, name, duration, effects) {
    player.buffs = player.buffs || [];
    const existingBuff = player.buffs.find(b => b.id === buffId);
    if (existingBuff) {
        existingBuff.endTime = new Date(Date.now() + duration);
    } else {
        player.buffs.push({
            id: buffId,
            name: name,
            endTime: new Date(Date.now() + duration),
            effects: effects
        });
    }
}

function hasBuff(player, buffId) {
    if (!player.buffs) return false;
    return player.buffs.some(b => b.id === buffId && new Date(b.endTime) > Date.now());
}

function gameTick(player) {
   if (!player || !player.socket) return;
    player.stateSentThisTick = false;

    if (player.dpsSession && player.dpsSession.isActive) {
        runDpsSimulation(player);
        sendState(player.socket, player, calcMonsterStats(player));
        return;
    }

    if (player.isInFoundryOfTime) {
         if (!player.foundryMonster || player.foundryMonster.hp <= 0) {
             if (Math.random() < 0.01) { 
                 player.foundryMonster = { name: '시간의 균열 감시자', hp: 50, maxHp: 50, isBoss: true };
             } else {
                 player.foundryMonster = { name: '시간의 잔상', hp: 1, maxHp: 1, isBoss: false };
             }
             player.socket.emit('foundry:monsterUpdate', player.foundryMonster);
         }
         
         player.foundryMonster.hp -= 1;
         

         player.socket.emit('combatResult', { playerTook: 0, monsterTook: 1 });
         player.socket.emit('foundry:tick', { 
             currentHp: player.foundryMonster.hp, 
             maxHp: player.foundryMonster.maxHp 
         });


         if (player.foundryMonster.hp <= 0) {
             if (player.foundryMonster.isBoss) {
                 handleItemStacking(player, createItemInstance('soulstone_glowing'));
                 if (Math.random() < 0.10) {
                     handleItemStacking(player, createItemInstance('soulstone_radiant'));
                 }
             } else {
                 if (Math.random() < 0.01) {
                     handleItemStacking(player, createItemInstance('soulstone_faint'));
                 }
                 if (Math.random() < 0.001) {
                     handleItemStacking(player, createItemInstance('soulstone_glowing'));
                 }
             }
             sendInventoryUpdate(player);
         }
         return; 
     }
     
     const weapon = player.equipment.weapon;
     const armor = player.equipment.armor;

    if (player.buffs && player.buffs.length > 0) {
         const now = Date.now();
         const initialBuffCount = player.buffs.length;
         player.buffs = player.buffs.filter(buff => new Date(buff.endTime) > now);
         if (player.buffs.length < initialBuffCount) {
			const hpBefore = player.stats.total.hp || 1;
             const originalCurrentHp = player.currentHp;
             calculateTotalStats(player); 
             const newMaxHp = player.stats.total.hp;
             player.currentHp = Math.min(originalCurrentHp, newMaxHp);
			const healthPercent = originalCurrentHp / hpBefore;
             player.shield = player.stats.shield * healthPercent;
         }
     }
     if (player.petFusion && player.petFusion.fuseEndTime && new Date() >= new Date(player.petFusion.fuseEndTime)) onPetFusionComplete(player);
     if (player.incubators && player.incubators.length > 0) {
         for (let i = 0; i < player.incubators.length; i++) {
             const slot = player.incubators[i];
             if (slot && slot.hatchCompleteTime && new Date() >= new Date(slot.hatchCompleteTime)) {
                 onHatchComplete(player, i);
             }
         }
     }
     if (player.raidState && player.raidState.isActive) {
        // ========== FIX STARTS HERE ==========
        const raidBoss = player.raidState.monster;
        if (!raidBoss) {
            console.error(`[CRITICAL] Player ${player.username} is in an active raid (floor ${player.raidState.floor}) but has no monster object. Forcing raid end to prevent crash.`);
            endPersonalRaid(player, true); // End the raid to fix the state
            return; // Exit the tick for this player
        }
        // ========== FIX ENDS HERE ==========

         let pDmg = 0;
         let mDmg = 0;

         const effectiveDistortion = raidBoss.distortion * (1 - (player.focus || 0) / 100);
         const hitChance = 1 - Math.max(0, effectiveDistortion) / 100;

         if (Math.random() <= hitChance) {
             let finalAttack = player.stats.total.attack;

             if (hasBuff(player, 'fury_attack')) {
                 finalAttack *= 1.5;
             }

             if (hasBuff(player, 'predator_state')) {
                 pDmg += finalAttack * 2.0;
             }
             const playerCritRoll = Math.random();
             if (playerCritRoll < player.stats.critChance) {
                 const critMultiplier = 1.5 + (player.stats.total.critDamage || 0);
                 pDmg += finalAttack * critMultiplier;
             } else {
                 pDmg += Math.max(0, finalAttack - (raidBoss.defense * (1 - (player.stats.total.defPenetration || 0))));
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
         
         if (hasBuff(player, 'fury_defense')) {
             mDmg = Math.max(0, raidBoss.attack - (player.stats.total.defense * 2.0)) + empoweredDamage;
         }
         if (hasBuff(player, 'predator_endurance')) {
             mDmg *= 0.7; 
         }

         player.currentHp -= mDmg;

         if (player.stats.total.bloodthirst > 0 && Math.random() < player.stats.total.bloodthirst / 100) {
             const bloodthirstDamage = raidBoss.hp * 0.50;
             pDmg += bloodthirstDamage; 
             player.currentHp = player.stats.total.hp; 
             pushLog(player, `[피의 갈망] 효과가 발동하여 <span class="fail-color">${formatInt(bloodthirstDamage)}</span>의 추가 피해를 입히고 체력을 모두 회복합니다!`);

             if (weapon?.prefix === '포식자') {
                 const duration = (armor?.prefix === '포식자') ? 5000 : 3000;
                 addBuff(player, 'predator_state', '포식', duration, {});
             }
             if (armor?.prefix === '포식자') {
                 addBuff(player, 'predator_endurance', '광전사의 인내', 10000, {});
             }
         }
         

         if (weapon) {
             if (weapon.prefix === '격노' && Math.random() < 0.05) {
                 const duration = (armor?.prefix === '격노') ? 7000 : 5000;
                 addBuff(player, 'fury_attack', '격노(공)', duration, {});
             }
             if (weapon.prefix === '파멸' && Math.random() < 0.02) {
                 const bonusDamageMultiplier = (armor?.prefix === '파멸') ? 3.0 : 2.0;
                 pDmg += player.stats.total.attack * bonusDamageMultiplier;
             }
             if (weapon.prefix === '계시' && Math.random() < 0.002) {
                 const duration = (armor?.prefix === '계시') ? 7000 : 5000;
                 applyAwakeningBuff(player, duration);
             }
         }
         if (armor) {
             if (armor.prefix === '격노' && mDmg > 0 && Math.random() < 0.05) {
                 const duration = (weapon?.prefix === '격노' && armor.prefix === '격노') ? 7000 : 5000;
                 addBuff(player, 'fury_defense', '격노(방)', duration, {});
             }
             if (armor.prefix === '계시' && mDmg > 0 && Math.random() < 0.002) {
                 const duration = (weapon?.prefix === '계시' && armor.prefix === '계시') ? 7000 : 5000;
                 applyAwakeningBuff(player, duration);
             }
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
         
         if (player.stats.total.bloodthirst > 0 && Math.random() < player.stats.total.bloodthirst / 100) {
             const bloodthirstDamage = worldBossState.maxHp * 0.003;
             pDmg += bloodthirstDamage;
             player.currentHp = player.stats.total.hp;
             pushLog(player, `[피의 갈망] 효과가 발동하여 <span class="fail-color">${formatInt(bloodthirstDamage)}</span>의 추가 피해를 입히고 체력을 모두 회복합니다!`);
          
             if (weapon?.prefix === '포식자') {
                 const duration = (armor?.prefix === '포식자') ? 5000 : 3000;
                 addBuff(player, 'predator_state', '포식', duration, {});
             }
             if (armor?.prefix === '포식자') {
                 addBuff(player, 'predator_endurance', '광전사의 인내', 10000, {});
             }
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
     
     const effectiveDistortion = (m.distortion || 0) * (1 - (player.focus || 0) / 100);
     const hitChance = 1 - Math.max(0, effectiveDistortion) / 100;

     if (Math.random() > hitChance) { pDmg += 0; } 
     else {
         let finalAttack = player.stats.total.attack;

         if (hasBuff(player, 'fury_attack')) {
             finalAttack *= 1.5;
         }

         if (hasBuff(player, 'predator_state')) {
             pDmg += finalAttack * 2.0;
         }

         const playerCritRoll = Math.random();
         if (playerCritRoll < player.stats.critChance) {
             const critMultiplier = 1.5 + (player.stats.total.critDamage || 0);
             pDmg += finalAttack * critMultiplier;
         } else {
             pDmg += Math.max(0, finalAttack - (m.defense * (1 - (player.stats.total.defPenetration || 0))));
         }
     }
     
     if (player.stats.additiveDamage > 0) {
         pDmg = pDmg + (pDmg * (player.stats.additiveDamage / 100));
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
     
     let finalDefense = m.isBoss ? (player.stats.total.defense * 0.5) : player.stats.total.defense;
     if (hasBuff(player, 'fury_defense')) {
         finalDefense *= 2.0;
     }

     if (monsterCritRoll < finalMonsterCritChance) { mDmg = m.attack; } 
     else { mDmg = Math.max(0, m.attack - finalDefense); }

     if (m.empoweredAttack > 0) {
         const empoweredDamageReduction = 1 - ((player.tenacity || 0) / 100);
         const empoweredDamage = player.stats.total.hp * (m.empoweredAttack / 100) * empoweredDamageReduction;
         mDmg += empoweredDamage;
     }
     
     if (hasBuff(player, 'predator_endurance')) {
         mDmg *= 0.7;
     }

     if (player.stats.dodgeChance > 0 && Math.random() < (player.stats.dodgeChance / 100)) {
         mDmg = 0;
     }

     if (player.shield > 0) {
         if (mDmg <= player.shield) {
             player.shield -= mDmg;
             mDmg = 0;
         } else {
             mDmg -= player.shield;
             player.shield = 0;
         }
     }
     player.currentHp -= mDmg;

     if (player.stats.total.bloodthirst > 0 && Math.random() < player.stats.total.bloodthirst / 100) {
         const bloodthirstDamage = m.hp * 0.50;
         pDmg += bloodthirstDamage;
         player.currentHp = player.stats.total.hp;

         if (weapon?.prefix === '포식자') {
             const duration = (armor?.prefix === '포식자') ? 5000 : 3000;
             addBuff(player, 'predator_state', '포식', duration, {});
         }
         if (armor?.prefix === '포식자') {
             addBuff(player, 'predator_endurance', '광전사의 인내', 10000, {});
         }
     }

     if (weapon) {
         if (weapon.prefix === '격노' && Math.random() < 0.05) {
             const duration = (armor?.prefix === '격노') ? 7000 : 5000;
             addBuff(player, 'fury_attack', '격노(공)', duration, {});
         }
         if (weapon.prefix === '파멸' && Math.random() < 0.02) {
             const bonusDamageMultiplier = (armor?.prefix === '파멸') ? 3.0 : 2.0;
             pDmg += player.stats.total.attack * bonusDamageMultiplier;
         }
         if (weapon.prefix === '계시' && Math.random() < 0.002) {
             const duration = (armor?.prefix === '계시') ? 7000 : 5000;
             applyAwakeningBuff(player, duration);
         }
     }
     if (armor) {
         if (armor.prefix === '격노' && mDmg > 0 && Math.random() < 0.05) {
             const duration = (weapon?.prefix === '격노' && armor.prefix === '격노') ? 7000 : 5000;
             addBuff(player, 'fury_defense', '격노(방)', duration, {});
         }
         if (armor.prefix === '계시' && mDmg > 0 && Math.random() < 0.002) {
             const duration = (weapon?.prefix === '계시' && armor.prefix === '계시') ? 7000 : 5000;
             applyAwakeningBuff(player, duration);
         }
     }

     if (pDmg > 0 || mDmg > 0) { player.socket.emit('combatResult', { playerTook: mDmg, monsterTook: pDmg }); }

     if (pDmg > 0 && player.equipment.earring?.id === 'acc_earring_01' && Math.random() < 0.03) {
         applyEarringAwakeningBuff(player, 10000);
     }
     if (pDmg > 0 && player.equipment.earring?.id === 'primal_acc_earring_01' && Math.random() < 0.03) {
         applyEarringAwakeningBuff(player, 15000);
     }
     
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

    let eventGoldMultiplier = 1;
    let eventDropMultiplier = 1;
    let isPrimalEventActive = false;

    for (const eventType in activeEvents) {
        const event = activeEvents[eventType];
        if (event.type === 'gold') {
            eventGoldMultiplier *= event.multiplier;
        }
        if (event.type === 'drop') {
            eventDropMultiplier *= event.multiplier;
        }
        if (event.type === 'primal') {
            isPrimalEventActive = true;
        }
    }

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
if (clearedFloor >= 1000000 && Math.random() < 0.001) {
    const dropQuantity = Math.floor(Math.random() * 5) + 1; 
    const shardItem = createItemInstance('rift_shard_abyss', dropQuantity);
    if (shardItem) {
        handleItemStacking(p, shardItem);
        sendInventoryUpdate(p);
        pushLog(p, `[심연] <span class="${shardItem.grade}">심연의 파편</span> ${dropQuantity}개를 획득했습니다!`);
    }
}
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
    
    goldEarned = Math.floor(goldEarned * eventGoldMultiplier);

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
        const essenceGained = Math.floor(Math.random() * 5) + 1; 
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
        skippedGold = Math.floor(skippedGold * eventGoldMultiplier);
        p.gold += skippedGold;
        
        if (isBossFloor(skippedFloor)) {
            p.researchEssence = (p.researchEssence || 0) + 1;
            pushLog(p, `[추가 등반] 보스 층(${skippedFloor}층)을 건너뛰어 <span class="Mystic">무한의 정수</span> 1개를 획득했습니다!`);
        }
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
        skippedGold = Math.floor(skippedGold * eventGoldMultiplier);
        p.gold += skippedGold;

        if (isBossFloor(skippedFloor)) {
            p.researchEssence = (p.researchEssence || 0) + 1;
            pushLog(p, `[추가 등반] 보스 층(${skippedFloor}층)을 건너뛰어 <span class="Mystic">무한의 정수</span> 1개를 획득했습니다!`);
        }
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
            if (Math.random() < finalChance * eventDropMultiplier) {
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

    const dropChance = (isBoss ? 0.10 : 0.02) * titleItemDropRateBonus * (1 + pioneerBonuses.itemDropRatePercent) * eventDropMultiplier;

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

    let effectiveGlobalLootTable = [...gameSettings.globalLootTable];
    if (isPrimalEventActive) {

        const primalWeaponsArmors = ['primal_w01', 'primal_a01'];
        const primalAccessories = ['primal_acc_necklace_01', 'primal_acc_earring_01', 'primal_acc_wristwatch_01'];
        

        const primalWeaponArmorChance = gameSettings.dropTable[5].rates.Primal || 0.0000005;
        const primalAccessoryChance = (gameSettings.dropTable[6].rates.Primal - gameSettings.dropTable[5].rates.Primal) / 3 || 0.0000005;

        primalWeaponsArmors.forEach(id => effectiveGlobalLootTable.push({ id, chance: primalWeaponArmorChance }));
        primalAccessories.forEach(id => effectiveGlobalLootTable.push({ id, chance: primalAccessoryChance }));
    }

    for (const itemInfo of effectiveGlobalLootTable) {
        let finalChance = itemInfo.chance;
        if (titleEffects && titleEffects.itemDropRate) {
            finalChance *= (1 + titleEffects.itemDropRate);
        }
		

        if (Math.random() < finalChance * eventDropMultiplier) {
            const droppedItem = createItemInstance(itemInfo.id);
            if (droppedItem) {
                handleItemStacking(p, droppedItem);
                sendInventoryUpdate(p);
                pushLog(p, `[${clearedFloor}층]에서 <span class="${droppedItem.grade}">${droppedItem.name}</span> 1개를 획득했습니다!`);
                announceMysticDrop(p, droppedItem);
            }
        }
    }
	
	 if (p.stats.shield > 0) {
        p.shield = p.stats.shield; 
    }
	
	if (p.level >= 1000000) {
    const scrollDropTable = [
        { id: 'star_scroll_100', chance: 0.0007 }, 
        { id: 'star_scroll_70', chance: 0.0002 },
        { id: 'star_scroll_30', chance: 0.0001 },
        { id: 'star_scroll_10', chance: 0.00005 },
        { id: 'golden_hammer', chance: 0.00003 }, // 고정석 확률정도? 어짜피 잘안붙으니.
        { id: 'moon_scroll_100', chance: 0.0007 }, 
        { id: 'moon_scroll_70', chance: 0.0002 },
        { id: 'moon_scroll_30', chance: 0.0001 },
        { id: 'moon_scroll_10', chance: 0.00005 }
    ];

    for (const drop of scrollDropTable) {
        if (Math.random() < drop.chance) {
            const droppedItem = createItemInstance(drop.id);
            if (droppedItem) {
                handleItemStacking(p, droppedItem);
                sendInventoryUpdate(p);
                pushLog(p, `[${clearedFloor}층]에서 <span class="${droppedItem.grade}">${droppedItem.name}</span> 1개를 획득했습니다!`);
                announceMysticDrop(p, droppedItem);
            }
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
            if (isEquipped) { 
                p.equipment[finalItem.type] = finalItem;
            } else {
                handleItemStacking(p, finalItem);
            }
        }

const originalCurrentHp = p.currentHp;
calculateTotalStats(p);
const hpAfter = p.stats.total.hp;
p.currentHp = Math.min(originalCurrentHp, hpAfter);

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

    if (!player || !['Mystic', 'Primal'].includes(item.grade) || item.id === 'form_locking_stone' || item.id === 'moon_scroll_10' || item.id === 'star_scroll_10' || item.id === 'golden_hammer') return;

    const bannerMessage = `🎉 ★★★ 축하합니다! ${player.username}님이 <span class="${item.grade}">${item.name}</span> 아이템을 획득했습니다! ★★★ 🎉`;
    
    if (item.grade === 'Primal') {
        
        const excludedPrimalIds = [
            'rift_shard_abyss', 
            'soulstone_attack',   
            'soulstone_hp',      
            'soulstone_defense'  
        ];

        if (excludedPrimalIds.includes(item.id)) {
            return;
        }

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
incubators: player.incubators,
spiritInventory: player.spiritInventory
        });
    }
}

const isBossFloor = (level) => level > 0 && level % BOSS_INTERVAL === 0 && level !== 1000000;

function calcMonsterStats(p) {
    const level = p.level;
    let hp, attack, defense;

    if (level >= 1030000) { 

        const tier1BaseLevel = 1000001;
        const tier1EndLevel = 1029999;
        const tier1Multiplier = Math.pow(1.0002, tier1EndLevel - tier1BaseLevel);

        const hpAtTier1End = tier1BaseLevel * tier1Multiplier;
        const attackAtTier1End = (tier1BaseLevel / 2) * tier1Multiplier;
        const defenseAtTier1End = (tier1BaseLevel / 5) * tier1Multiplier;

        const tier2Multiplier = Math.pow(1.00001, level - tier1EndLevel);
        hp = hpAtTier1End * tier2Multiplier;
        attack = attackAtTier1End * tier2Multiplier;
        defense = defenseAtTier1End * tier2Multiplier;

    } else if (level >= 1000002) { 
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
        if (level >= 1000000) {
            const prevLevel = level - 1;
            let prevHp, prevAttack, prevDefense;

            if (prevLevel >= 1030000) {
                const tier1BaseLevel = 1000001;
                const tier1EndLevel = 1029999;
                const tier1Multiplier = Math.pow(1.0002, tier1EndLevel - tier1BaseLevel);
                const hpAtTier1End = tier1BaseLevel * tier1Multiplier;
                const attackAtTier1End = (tier1BaseLevel / 2) * tier1Multiplier;
                const defenseAtTier1End = (tier1BaseLevel / 5) * tier1Multiplier;
                const tier2Multiplier = Math.pow(1.00001, prevLevel - tier1EndLevel);
                prevHp = hpAtTier1End * tier2Multiplier;
                prevAttack = attackAtTier1End * tier2Multiplier;
                prevDefense = defenseAtTier1End * tier2Multiplier;
            } else if (prevLevel >= 1000002) {
                const baseLevel = 1000001;
                const multiplier = Math.pow(1.0002, prevLevel - baseLevel);
                prevHp = baseLevel * multiplier;
                prevAttack = (baseLevel / 2) * multiplier;
                prevDefense = (baseLevel / 5) * multiplier;
            }

            monster.hp = prevHp * 10;
            monster.attack = prevAttack * 10;
            monster.defense = prevDefense * 10;

        } else {

            const prevLevelMonsterAttack = Math.max(1, (level - 1) / 2);
            monster.hp = level * 10;
            monster.attack = prevLevelMonsterAttack * 2;
            monster.defense = level / 3;
        }
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
	 if (p.stats.shield > 0) {
        p.shield = p.stats.shield; 
    }
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
        
       const originalCurrentHp = player.currentHp;
calculateTotalStats(player);
const newMaxHp = player.stats.total.hp;
player.currentHp = Math.min(originalCurrentHp, newMaxHp);
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
        const originalCurrentHp = player.currentHp;

handleItemStacking(player, player.equipment[slot]);
player.equipment[slot] = null;

calculateTotalStats(player);

const newMaxHp = player.stats.total.hp;
player.currentHp = Math.min(originalCurrentHp, newMaxHp);
        
        sendPlayerState(player);
        sendInventoryUpdate(player);
        updateFameScore(player.socket, player);
        checkStateBasedTitles(player);
    } finally {
        if (player) player.isBusy = false;
    }
}

async function sellItem(player, uid, sellAll) {
    if (!player) return;
    if (player.isBusy) {
        return pushLog(player, '이전 요청을 처리 중입니다. 잠시 후 다시 시도해주세요.');
    }
    player.isBusy = true;
    try {
        let item = null;
        let itemLocation = '';
        let itemIndex = -1;

       itemIndex = player.inventory.findIndex(i => i && i.uid === uid);
        if (itemIndex > -1) {
            item = player.inventory[itemIndex];
            itemLocation = 'inventory';
        } else {
            itemIndex = player.petInventory.findIndex(i => i && i.uid === uid);
            if (itemIndex > -1) {
                item = player.petInventory[itemIndex];
                itemLocation = 'petInventory';
            } else {
                itemIndex = player.spiritInventory.findIndex(i => i && i.uid === uid);
                if (itemIndex > -1) {
                    item = player.spiritInventory[itemIndex];
                    itemLocation = 'spiritInventory';
                }
            }
        }

        if (!item) {
            pushLog(player, '[판매] 아이템을 찾을 수 없습니다.');
            return;
        }

        let goldReward = 0;
        let shardReward = 0;
        let essenceReward = 0;
        let isSellable = false;


        if (item.type === 'weapon' || item.type === 'armor') {
            const prices = { Common: 3000, Rare: 50000, Legendary: 400000, Epic: 2000000, Mystic: 3000000000, Primal: 120000000000 };
            const shards = { Common: 1, Rare: 2, Legendary: 5, Epic: 50, Mystic: 1000, Primal: 10000 };
            goldReward = prices[item.grade] || 0;
            shardReward = shards[item.grade] || 0;
            isSellable = true;
        } else if (item.type === 'accessory') {
            const prices = { Primal: 120000000000 };
            const shards = { Mystic: 500, Primal: 10000 };
            goldReward = prices[item.grade] || 0;
            shardReward = shards[item.grade] || 0;
            if (goldReward > 0 || shardReward > 0) isSellable = true;
        } else if (item.type === 'pet') {
            if (item.id === 'bahamut') { goldReward = 50000000000; essenceReward = 100; } 
            else if (item.fused) { goldReward = 100000000; essenceReward = 20; } 
            else if (item.grade === 'Epic') { goldReward = 50000000; essenceReward = 10; } 
            else if (item.grade === 'Rare') { goldReward = 3000000; essenceReward = 3; }
            if (goldReward > 0 || essenceReward > 0) isSellable = true;
        } else if (item.type === 'Spirit') {
            essenceReward = 20;
            isSellable = true;
        }

else if (item.category === 'Tome') {
            goldReward = 100000000;
            shardReward = 20;
            isSellable = true;
        }
		
		else if (item.category === 'Egg') {
            switch (item.id) {
                case 'pet_egg_normal':
                    goldReward = 2000000;
                    break;
                case 'pet_egg_ancient':
                    goldReward = 35000000;
                    break;
                case 'pet_egg_mythic':
                    goldReward = 40000000000;
                    break;
            }
            if (goldReward > 0) isSellable = true;
        }

        if (!isSellable) {
            pushLog(player, '[판매] 해당 아이템은 판매할 수 없습니다.');
            return;
        }
        
        const titleEffects = player.equippedTitle ? titleData[player.equippedTitle]?.effect : null;
        const sellBonus = (titleEffects && titleEffects.sellPriceBonus) ? (1 + titleEffects.sellPriceBonus) : 1;
        const itemName = item.enhancement > 0 ? `+${item.enhancement} ${item.name}` : item.name;


        if (item.enhancement > 0 || !sellAll || itemLocation !== 'inventory') {

            let finalGold = goldReward;
            if (item.enhancement > 0) { 
                const enhancementCost = getEnhancementCost(item.enhancement);
                const priceWithEnhancement = goldReward + enhancementCost;
                if (item.enhancement <= 8) {
                    finalGold = priceWithEnhancement;
                } else if (item.enhancement <= 10) {
                    finalGold = priceWithEnhancement + 10000;
                } else {
                    finalGold = Math.floor(priceWithEnhancement * 1.5);
                }
            }
            finalGold = Math.floor(finalGold * sellBonus);

            player.gold += finalGold;
            if (shardReward > 0) handleItemStacking(player, createItemInstance('rift_shard', shardReward));
            if (essenceReward > 0) handleItemStacking(player, createItemInstance('spirit_essence', essenceReward));

            if (item.quantity > 1) {
                item.quantity--;
            } else {
                if (itemLocation === 'inventory') player.inventory.splice(itemIndex, 1);
                else if (itemLocation === 'petInventory') player.petInventory.splice(itemIndex, 1);
                else if (itemLocation === 'spiritInventory') player.spiritInventory.splice(itemIndex, 1);
            }
            
            const rewardsLog = [];
            if (finalGold > 0) rewardsLog.push(`${finalGold.toLocaleString()} G`);
            if (shardReward > 0) rewardsLog.push(`균열 파편 ${shardReward.toLocaleString()}개`);
            if (essenceReward > 0) rewardsLog.push(`정령의 형상 ${essenceReward.toLocaleString()}개`);
            pushLog(player, `[판매] ${itemName} 1개를 판매하여 ${rewardsLog.join(', ')}를 획득했습니다.`);
        } else {

            const quantityToSell = item.quantity;
            const totalGold = Math.floor((goldReward * quantityToSell) * sellBonus);
            const totalShards = shardReward * quantityToSell;

            player.gold += totalGold;
            if (totalShards > 0) handleItemStacking(player, createItemInstance('rift_shard', totalShards));
            
            player.inventory.splice(itemIndex, 1);
            
            const rewardsLog = [];
            if (totalGold > 0) rewardsLog.push(`${totalGold.toLocaleString()} G`);
            if (totalShards > 0) rewardsLog.push(`균열 파편 ${totalShards.toLocaleString()}개`);
            pushLog(player, `[판매] ${itemName} ${quantityToSell}개를 판매하여 ${rewardsLog.join(', ')}를 획득했습니다.`);
        }

        if (player.titleCounters) player.titleCounters.sellCount = (player.titleCounters.sellCount || 0) + 1;
        sendState(player.socket, player, calcMonsterStats(player));
        sendInventoryUpdate(player);

    } catch (e) {
        console.error(`[sellItem] 심각한 오류 발생:`, e);
        pushLog(player, '[판매] 아이템 판매 중 오류가 발생했습니다.');
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



function autoSellItemById(player, itemToSell) {
    if (!player || !itemToSell) return;

    let goldReward = 0;
    let shardReward = 0;
    let essenceReward = 0;
    let isSellable = false;

    const itemDataDefinition = itemData[itemToSell.id];

    if (itemDataDefinition) {
        if (itemToSell.type === 'weapon' || itemToSell.type === 'armor') {
            const prices = { Common: 3000, Rare: 50000, Legendary: 400000, Epic: 2000000, Mystic: 3000000000, Primal: 120000000000 };
            const shards = { Common: 1, Rare: 2, Legendary: 5, Epic: 50, Mystic: 1000, Primal: 10000 };
            goldReward = prices[itemToSell.grade] || 0;
            shardReward = shards[itemToSell.grade] || 0;
            isSellable = true;
        } else if (itemToSell.type === 'accessory') {
            const prices = { Primal: 120000000000 };
            const shards = { Mystic: 500, Primal: 10000 };
            goldReward = prices[itemToSell.grade] || 0;
            shardReward = shards[itemToSell.grade] || 0;
            if (goldReward > 0 || shardReward > 0) isSellable = true;
        } else if (itemToSell.category === 'Tome') {
             goldReward = 100000000;
             shardReward = 20;
             isSellable = true;
        }
		
		 else if (itemToSell.category === 'Egg') {
                switch (itemToSell.id) {
                    case 'pet_egg_normal':
                        goldReward = 2000000;
                        break;
                    case 'pet_egg_ancient':
                        goldReward = 35000000;
                        break;
                    case 'pet_egg_mythic':
                        goldReward = 40000000000;
                        break;
                }
                if (goldReward > 0) isSellable = true;
            }
		
		
		
		
    } else {
         const petDataDefinition = petData[itemToSell.id];
         if (petDataDefinition) {
             if (itemToSell.id === 'bahamut') { goldReward = 50000000000; essenceReward = 100; }
             else if (itemToSell.fused) { goldReward = 100000000; essenceReward = 20; }
             else if (itemToSell.grade === 'Epic') { goldReward = 50000000; essenceReward = 10; }
             else if (itemToSell.grade === 'Rare') { goldReward = 3000000; essenceReward = 3; }
             if (goldReward > 0 || essenceReward > 0) isSellable = true;
         } else {
            const spiritDataDefinition = spiritData[itemToSell.id];
            if(spiritDataDefinition) {
                essenceReward = 20;
                isSellable = true;
            }
         }
    }

    if (!isSellable) return;

    const quantity = itemToSell.quantity || 1;
    const titleEffects = player.equippedTitle ? titleData[player.equippedTitle]?.effect : null;
    const sellBonus = (titleEffects && titleEffects.sellPriceBonus) ? (1 + titleEffects.sellPriceBonus) : 1;

    const totalGold = Math.floor((goldReward * quantity) * sellBonus);
    const totalShards = shardReward * quantity;
    const totalEssence = essenceReward * quantity;

    if (totalGold > 0) player.gold += totalGold;
    if (totalShards > 0) handleItemStacking(player, createItemInstance('rift_shard', totalShards));
    if (totalEssence > 0) handleItemStacking(player, createItemInstance('spirit_essence', totalEssence));

    const rewardsLog = [];
    if (totalGold > 0) rewardsLog.push(`${totalGold.toLocaleString()} G`);
    if (totalShards > 0) rewardsLog.push(`균열 파편 ${totalShards.toLocaleString()}개`);
    if (totalEssence > 0) rewardsLog.push(`정령의 형상 ${totalEssence.toLocaleString()}개`);

    if (rewardsLog.length > 0) {
        pushLog(player, `[자동판매] ${itemToSell.name} ${quantity}개를 판매하여 ${rewardsLog.join(', ')}를 획득했습니다.`);
    }
}
async function sellExistingItemsFromAutoSellList(player, itemId) {
    if (!player || !itemId) return;

    let soldSomething = false;

    const generalItemsToSell = player.inventory.filter(item => item.id === itemId && (item.enhancement === 0 || typeof item.enhancement === 'undefined'));
    if (generalItemsToSell.length > 0) {
        for (const item of generalItemsToSell) {
            autoSellItemById(player, item);
        }
        player.inventory = player.inventory.filter(item => !(item.id === itemId && (item.enhancement === 0 || typeof item.enhancement === 'undefined')));
        soldSomething = true;
    }

    const petsToSell = player.petInventory.filter(pet => pet.id === itemId);
    if (petsToSell.length > 0) {
        for (const pet of petsToSell) {
            autoSellItemById(player, pet);
        }
        player.petInventory = player.petInventory.filter(pet => pet.id !== itemId);
        soldSomething = true;
    }
    
    if (player.spiritInventory) {
        const spiritsToSell = player.spiritInventory.filter(spirit => spirit.id === itemId);
        if (spiritsToSell.length > 0) {
             for (const spirit of spiritsToSell) {
                autoSellItemById(player, spirit);
            }
            player.spiritInventory = player.spiritInventory.filter(spirit => spirit.id !== itemId);
            soldSomething = true;
        }
    }

    if (soldSomething) {
        sendInventoryUpdate(player);
        sendPlayerState(player);
    }
}

function addDefaultPrefixToOldItems(gameData) {
    let wasModified = false;
    const itemsToUpdate = [
        ...Object.values(gameData.equipment),
        ...gameData.inventory
    ].filter(Boolean); 

    for (const item of itemsToUpdate) {
     
        const isTargetItem = (item.grade === 'Mystic' || item.grade === 'Primal') &&
                             (item.type === 'weapon' || item.type === 'armor');
		 if (isTargetItem && !item.prefix) {
            item.prefix = '완벽';
            const baseItemName = itemData[item.id]?.name || item.name.replace(/\[.*?\]\s*/, '');
            item.name = `[완벽] ${baseItemName}`;

            if (item.grade === 'Mystic') {
                item.baseEffect = 2.50; 
            } else if (item.grade === 'Primal') {
                item.baseEffect = 25.00; 
                
                delete item.randomizedValue;
                delete item.quality;
            }
            wasModified = true;
        }
    }
    return wasModified;
}



function getFameTier(score) {
    if (score >= 40000) return 'fame-diamond';
    if (score >= 15000) return 'fame-gold';
    if (score >= 5000) return 'fame-silver';
    if (score >= 1000) return 'fame-bronze';
    return '';
}

async function savePlayerData(userId) { const p = onlinePlayers[userId]; if (!p) return; try { const { socket: _, attackTarget: __, ...playerDataToSave } = p; await GameData.updateOne({ user: userId }, { $set: playerDataToSave }); } catch (error) { console.error(`[저장 실패] 유저: ${p.username} 데이터 저장 중 오류 발생:`, error); } }


async function saveAutoSellList(userId) {
    const player = onlinePlayers[userId];
    if (!player || !player.autoSellList) return; 

    try {
        await GameData.updateOne(
            { user: userId },
            { $set: { autoSellList: player.autoSellList } }
        );
        console.log(`[자판기 전용 저장] ${player.username}의 목록 저장 완료:`, player.autoSellList);
    } catch (error) {
        console.error(`[자판기 전용 저장 실패]`, error);
    }
}

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
spiritInventory: player.spiritInventory,
        petFusion: player.petFusion,
        inventory: player.inventory,
        petInventory: player.petInventory,
incubators: player.incubators,
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
        researchEssence: player.researchEssence || 0 ,
		shield: player.shield ,
		dpsSession: player.dpsSession
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


function useItem(player, uid, useAll = false, targetUid = null) {
    if (!player) return;
    const itemIndex = player.inventory.findIndex(i => i.uid === uid);
    if (itemIndex === -1) return;
    const item = player.inventory[itemIndex];

    if (item.category === 'Soulstone') {
        if (!targetUid || !player.equippedPet || player.equippedPet.uid !== targetUid || player.equippedPet.id !== 'apocalypse') {
            player.socket.emit('useItemResult', { messages: ['[소울스톤] 아포칼립스 펫을 장착한 상태에서만 사용할 수 있습니다.'] });
            return;
        }

        const pet = player.equippedPet;
        if (!pet.soulstoneBonuses) {
            pet.soulstoneBonuses = { attack: 0, hp: 0, defense: 0 };
        }

        let statToUpgrade = '';
        let statName = '';
        if (item.id === 'soulstone_attack') {
            statToUpgrade = 'attack';
            statName = '공격력';
        } else if (item.id === 'soulstone_hp') {
            statToUpgrade = 'hp';
            statName = '체력';
        } else if (item.id === 'soulstone_defense') {
            statToUpgrade = 'defense';
            statName = '방어력';
        }

        if (statToUpgrade) {
            pet.soulstoneBonuses[statToUpgrade]++;
            pushLog(player, `[소울스톤] <span class="Primal">${pet.name}</span>의 ${statName}이(가) 영구적으로 1% 증폭되었습니다!`);

            item.quantity--;
            if (item.quantity <= 0) {
                player.inventory.splice(itemIndex, 1);
            }

            calculateTotalStats(player);
            sendState(player.socket, player, calcMonsterStats(player));
            sendInventoryUpdate(player);
        }
        return;
    }

    const quantityToUse = useAll ? item.quantity : 1;
    let messages = [];
    
    const titleEffects = player.equippedTitle ? titleData[player.equippedTitle]?.effect : null;
    
    switch (item.id) {

case 'abyssal_box':
        const lootTable = [
            { id: 'bahamut_essence', chance: 0.02 }, // 2%
            { id: 'golden_hammer', chance: 0.04 }, // 4%
            { id: 'w005', chance: 0.03 }, // 3%
            { id: 'a005', chance: 0.03 }, // 3%
            { id: 'acc_necklace_01', chance: 0.03 }, // 3%
            { id: 'acc_earring_01', chance: 0.03 }, // 3%
            { id: 'acc_wristwatch_01', chance: 0.03 }, // 3%
            { id: 'star_scroll_10', chance: 0.05 }, // 5%
            { id: 'moon_scroll_10', chance: 0.05 }, // 5%
            { id: 'star_scroll_30', chance: 0.05 }, // 5%
            { id: 'moon_scroll_30', chance: 0.05 }, // 5%
            { id: 'star_scroll_70', chance: 0.05 }, // 5%
            { id: 'moon_scroll_70', chance: 0.05 }, // 5%
            { id: 'star_scroll_100', chance: 0.098 }, // 9.8%
            { id: 'moon_scroll_100', chance: 0.098 }, // 9.8%
            { id: 'soulstone_attack', chance: 0.098 }, // 9.8%
            { id: 'soulstone_hp', chance: 0.098 }, // 9.8%
            { id: 'soulstone_defense', chance: 0.098 }  // 9.8%
        ];
        
        let wonItem = null;
        const rand = Math.random();
        let cumulativeChance = 0;

        for (const loot of lootTable) {
            cumulativeChance += loot.chance;
            if (rand < cumulativeChance) {
                wonItem = createItemInstance(loot.id);
                break;
            }
        }

        if (wonItem) {
            handleItemStacking(player, wonItem);
messages.push(`[심연의 상자] 상자에서 [${wonItem.grade}] ${wonItem.name} 아이템을 획득했습니다!`);
            announceMysticDrop(player, wonItem);
        } else {
            const fallbackItem = createItemInstance('star_scroll_100');
            handleItemStacking(player, fallbackItem);
messages.push(`[심연의 상자] 상자에서 [${fallbackItem.grade}] ${fallbackItem.name} 아이템을 획득했습니다!`);
        }
        break;

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
            if (player.maxLevel >= 1000000) {
                const shardAmount = Math.floor(Math.random() * 30) + 1;
                const shardItem = createItemInstance('rift_shard_abyss', shardAmount);
                if (shardItem) {
                    handleItemStacking(player, shardItem);
                    messages.push(`[참여 상자] 상자에서 ${shardItem.name} ${shardAmount}개를 획득했습니다!`);
                }
            } else {
                const goldGained = 3000000;
                player.gold += goldGained;
                messages.push(`[참여 상자] 상자에서 ${goldGained.toLocaleString()} G를 획득했습니다!`);
            }

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
    
function placeEggInIncubator(player, { uid, slotIndex }) {
    if (!player || slotIndex < 0 || slotIndex >= 6) return;

    const incubatorSlot = player.incubators[slotIndex];
    if (incubatorSlot && incubatorSlot.egg) {
        pushLog(player, '[부화기] 해당 슬롯은 이미 사용 중입니다.');
        return;
    }

    const itemIndex = player.inventory.findIndex(i => i.uid === uid && (i.category === 'Egg' || i.type === 'egg'));
    if (itemIndex === -1) {
        pushLog(player, '[부화기] 인벤토리에서 해당 알을 찾을 수 없습니다.');
        return;
    }

    const newEgg = player.inventory[itemIndex];
	
if (!player.incubators[slotIndex]) {
    player.incubators[slotIndex] = { egg: null, hatchCompleteTime: null, hatchDuration: 0 };
}
	
    if (newEgg.quantity > 1) {
        newEgg.quantity--; 
        player.incubators[slotIndex].egg = { ...newEgg, quantity: 1 }; 
    } else {
        player.incubators[slotIndex].egg = player.inventory.splice(itemIndex, 1)[0];
    }
    pushLog(player, `[부화기] ${player.incubators[slotIndex].egg.name}을(를) ${slotIndex + 1}번 부화기에 넣었습니다.`);

    sendInventoryUpdate(player);
}

function onHatchComplete(player, slotIndex) {
    if (!player || !player.incubators || !player.incubators[slotIndex] || !player.incubators[slotIndex].egg) return;

    const incubatorSlot = player.incubators[slotIndex];
    const eggName = incubatorSlot.egg.name;
    const eggGrade = incubatorSlot.egg.grade;
    pushLog(player, `[부화기] ${eggName}에서 생명의 기운이 느껴집니다!`);

    const possiblePets = Object.keys(petData).filter(id => petData[id].grade === eggGrade && !petData[id].fused);
   if (possiblePets.length > 0) {
    const randomPetId = possiblePets[Math.floor(Math.random() * possiblePets.length)];
    const newPet = createPetInstance(randomPetId);
    if(newPet) {
        pushLog(player, `[펫] <span class="${newPet.grade}">${newPet.name}</span>이(가) 태어났습니다!`);


        if (player.autoSellList && player.autoSellList.includes(newPet.id)) {
            autoSellItemById(player, newPet); 
            sendPlayerState(player);
        } else {
            player.petInventory.push(newPet); 
        }
    }
}

    player.incubators[slotIndex] = { egg: null, hatchCompleteTime: null, hatchDuration: 0 };
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

const goldReward = Math.floor(WORLD_BOSS_CONFIG.REWARDS.GOLD * (participant.damageDealt / totalDamage));
        if (goldReward > 0) userRewards.gold += goldReward;

        if (contributionPercent >= 0) userRewards.items.push(createItemInstance('boss_participation_box'));

        if (contributionPercent >= 1) userRewards.items.push(createItemInstance('rift_shard_abyss', 5));
        if (contributionPercent >= 5) userRewards.items.push(createItemInstance('rift_shard_abyss', 20));
        
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


function startHatching(player, { slotIndex }) {
    if (!player || !player.incubators || !player.incubators[slotIndex] || !player.incubators[slotIndex].egg || player.incubators[slotIndex].hatchCompleteTime) return;

    const incubatorSlot = player.incubators[slotIndex];
    const eggId = incubatorSlot.egg.id;
    let hatchDuration = itemData[eggId]?.hatchDuration;
    if (!hatchDuration) return;

    const titleEffects = player.equippedTitle ? titleData[player.equippedTitle]?.effect : null;
    if(titleEffects && titleEffects.hatchTimeReduction) {
        hatchDuration *= (1 - titleEffects.hatchTimeReduction);
    }

    incubatorSlot.hatchDuration = hatchDuration;
    incubatorSlot.hatchCompleteTime = new Date(Date.now() + hatchDuration);

    pushLog(player, `[부화기] ${incubatorSlot.egg.name} 부화를 시작합니다!`);
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


async function endPersonalRaid(player, died = false) { // async 추가
    if (!player || !player.raidState || !player.raidState.isActive) return;

    const message = died 
        ? `[개인 레이드] ${player.raidState.floor}층에서 패배하여 일반 등반으로 복귀합니다.`
        : "[개인 레이드] 레이드를 종료하고 일반 등반으로 복귀합니다.";
    
    resetPlayer(player, message, player.level); 
    try {
        await GameData.updateOne(
            { user: player.user }, 
            { $set: { "raidState.isActive": false } }
        );
    } catch (error) {
        console.error(`[DB 저장 오류] endPersonalRaid에서 ${player.username}의 레이드 상태 저장 실패:`, error);
    }

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
	 if (player.stats.shield > 0) {
        player.shield = player.stats.shield;
    }
}

scheduleDailyReset(io); 
async function calculateAndSendOfflineRewards(player) {
    if (!player || !player.logoutTime) return;
    await GameData.updateOne({ user: player.user }, { $set: { logoutTime: null, lastLevel: 1 } });
    
    const offlineSeconds = Math.floor((new Date() - new Date(player.logoutTime)) / 1000);
 
    if (offlineSeconds < 60) {
        return;
    }

    const bestSpirit = (player.spiritInventory || []).sort((a, b) => {
        const gradeOrder = { 'Rare': 1, 'Legendary': 2, 'Mystic': 3, 'Primal': 4 };
        return (gradeOrder[b.grade] || 0) - (gradeOrder[a.grade] || 0);
    })[0];

   
    if (!bestSpirit) {
        return;
    }

    let researchBonuses = { offlineRewardPercent: 0 };
    if (player.research && player.research.pioneer) {
        const pioneerResearchLevels = player.research.pioneer instanceof Map ? Object.fromEntries(player.research.pioneer) : player.research.pioneer;
        const offlineTech = researchConfig.pioneer.researches.find(t => t.id === 'pioneer_offline_1');
        const level = (pioneerResearchLevels ? pioneerResearchLevels['pioneer_offline_1'] : 0) || 0;
        if (offlineTech && level > 0) {
            researchBonuses.offlineRewardPercent = offlineTech.getBonus(level).offlineRewardPercent || 0;
        }
    }
    const researchMultiplier = 1 + researchBonuses.offlineRewardPercent;

    const baseGoldPerSec = player.lastLevel;
    const totalGoldReward = Math.floor(baseGoldPerSec * bestSpirit.offlineBonus.multiplier * offlineSeconds * researchMultiplier);

    const collectedItems = new Map();
    if (bestSpirit.offlineBonus.type === 'gold_and_items') {
        const killsToSimulate = Math.floor(offlineSeconds * 0.7 * researchMultiplier);
        let zone = 1;
        const currentLevel = player.lastLevel || 1;
        if (currentLevel >= 1000000) zone = 6;
        else if (currentLevel >= 500000) zone = 5;
        else if (currentLevel > 15000) zone = 4;
        else if (currentLevel > 3000) zone = 3;
        else if (currentLevel > 500) zone = 2;
        
        const dropTable = gameSettings.dropTable[zone];
        if (dropTable) {
            for (let i = 0; i < killsToSimulate; i++) {

                if (Math.random() < 0.02) {
                    let grade, acc = 0, r = Math.random();
                    for (const g in dropTable.rates) { acc += dropTable.rates[g]; if (r < acc) { grade = g; break; } }

if (grade && grade !== 'Primal') { 
    const pool = dropTable.itemsByGrade[grade] || [];
    if (pool.length) {
        const id = pool[Math.floor(Math.random() * pool.length)];
        collectedItems.set(id, (collectedItems.get(id) || 0) + 1);
    }
}
                }

                for (const itemInfo of gameSettings.globalLootTable) {
                    if (Math.random() < itemInfo.chance) {
                         collectedItems.set(itemInfo.id, (collectedItems.get(itemInfo.id) || 0) + 1);
                    }
                }
            }
        }
    }


    if (totalGoldReward > 0) {
        await sendMail(player.user, bestSpirit.name, { gold: totalGoldReward, description: "오프라인 보상" });
    }
    if (collectedItems.size > 0) {
        for(const [itemId, quantity] of collectedItems.entries()) {
            const itemInstance = createItemInstance(itemId, quantity);
            if (itemInstance) {
                await sendMail(player.user, bestSpirit.name, { item: itemInstance, description: "오프라인 보상" });
            }
        }
    }
    
    if (totalGoldReward > 0 || collectedItems.size > 0) {
        pushLog(player, `[${bestSpirit.name}]이(가) 오프라인 동안 모아온 보상을 우편으로 보냈습니다!`);
    }

}


function startEventCheckInterval() {
    if (eventEndTimer) clearInterval(eventEndTimer);

    eventEndTimer = setInterval(() => {
        let eventsChanged = false;
        const now = new Date();

        for (const eventType in activeEvents) {
            if (now >= new Date(activeEvents[eventType].endTime)) {
                console.log(`[이벤트 종료] ${eventType} 이벤트가 종료되었습니다.`);
                delete activeEvents[eventType];
                eventsChanged = true;
            }
        }

        if (eventsChanged) {

            io.emit('eventStatusUpdate', activeEvents);
        }
    }, 1000);
}

startEventCheckInterval();

function triggerEventAnnouncement(eventDescription) {
   
    io.emit('globalAnnouncement', eventDescription, { style: 'event' });

    const eventChatMessage = { 
        isSystem: true, 
        message: `[이벤트] ${eventDescription}` 
    };
    io.emit('chatMessage', eventChatMessage);

}

const CHECK_OFFLINE_INTERVAL = 30000; 

async function checkOfflinePlayers() {
    try {
        const allGameData = await GameData.find({}, 'user level logoutTime').lean();
        
        const updates = [];

        for (const data of allGameData) {
            const userIdString = data.user.toString();

            const isOnline = onlinePlayers.hasOwnProperty(userIdString);
            const hasLogoutTime = data.logoutTime != null;

            if (!isOnline && !hasLogoutTime) {

                updates.push({
                    updateOne: {
                        filter: { user: data.user },
                        update: { $set: { logoutTime: new Date(), lastLevel: data.level } }
                    }
                });
            } else if (isOnline && hasLogoutTime) {

                updates.push({
                    updateOne: {
                        filter: { user: data.user },
                        update: { $set: { logoutTime: null } }
                    }
                });
            }
        }

        if (updates.length > 0) {
            await GameData.bulkWrite(updates);
        }

    } catch (error) {
        console.error('[오프라인 감지 시스템 오류]', error);
    }
}

setInterval(checkOfflinePlayers, CHECK_OFFLINE_INTERVAL);

async function rerollItemPrefix(player, itemUid) {
    if (!player || !itemUid) return;

    const scrollIndex = player.inventory.findIndex(i => i.id === 'prefix_reroll_scroll');
    if (scrollIndex === -1) {
        return pushLog(player, '[세트 변경] 신비스크롤이 없습니다.');
    }


    let itemToReroll = null;
    let itemLocation = null; 
    
    for (const slot in player.equipment) {
        if (player.equipment[slot] && player.equipment[slot].uid === itemUid) {
            itemToReroll = player.equipment[slot];
            itemLocation = 'equipment';
            break;
        }
    }
    if (!itemToReroll) {
        const invIndex = player.inventory.findIndex(i => i.uid === itemUid);
        if (invIndex > -1) {
            itemToReroll = player.inventory[invIndex];
            itemLocation = 'inventory';
        }
    }

    if (!itemToReroll || !['Mystic', 'Primal'].includes(itemToReroll.grade) || !['weapon', 'armor'].includes(itemToReroll.type)) {
        return pushLog(player, '[세트 변경] 미스틱 또는 프라이멀 등급의 무기/방어구에만 사용할 수 있습니다.');
    }

    const scroll = player.inventory[scrollIndex];
    scroll.quantity--;
    if (scroll.quantity <= 0) {
        player.inventory.splice(scrollIndex, 1);
    }

    const allPrefixes = ['완벽', '격노', '파멸', '포식자', '계시'];
    const oldPrefix = itemToReroll.prefix;
    
    const availablePrefixes = allPrefixes.filter(p => p !== oldPrefix);
    const newPrefix = availablePrefixes[Math.floor(Math.random() * availablePrefixes.length)];
    
    const baseItemName = itemData[itemToReroll.id]?.name || itemToReroll.name.replace(/\[.*?\]\s*/, '');
    itemToReroll.prefix = newPrefix;
    itemToReroll.name = `[${newPrefix}] ${baseItemName}`;


    pushLog(player, `[세트 변경] <span class="${itemToReroll.grade}">${itemToReroll.name}</span>의 세트가 [${oldPrefix}] -> [${newPrefix}](으)로 변경되었습니다.`);
    
    calculateTotalStats(player);
    sendState(player.socket, player, calcMonsterStats(player));
    sendInventoryUpdate(player);
}

function useStarScroll(player, { itemUid, scrollUid }) {
    if (!player || !itemUid || !scrollUid) return;

    const scroll = player.inventory.find(i => i.uid === scrollUid);
    if (!scroll) {
        return pushLog(player, '[오류] 사용할 주문서를 찾을 수 없습니다.');
    }

    const scrollInfo = itemData[scroll.id];
    if (!scrollInfo || scroll.scrollType !== 'star') {
        return pushLog(player, '[오류] 유효하지 않은 별의 주문서입니다.');
    }

    let targetItem = null;
    if (player.equippedPet && player.equippedPet.uid === itemUid) {
        targetItem = player.equippedPet;
    } else {
        const targetItemSlot = Object.keys(player.equipment).find(slot => player.equipment[slot] && player.equipment[slot].uid === itemUid);
        if (targetItemSlot) {
            targetItem = player.equipment[targetItemSlot];
        }
    }

    if (!targetItem) {
        return pushLog(player, '[오류] 강화할 장착 아이템 또는 펫을 찾을 수 없습니다.');
    }

    if (targetItem.scrollSuccesses === undefined) targetItem.scrollSuccesses = 0;
    if (targetItem.scrollFails === undefined) targetItem.scrollFails = 0;

    const maxAttempts = 9;
    const totalAttempts = targetItem.scrollSuccesses + targetItem.scrollFails;

    if (totalAttempts >= maxAttempts) {
        return pushLog(player, '[주문서] 이 아이템은 더 이상 별의 주문서 강화를 할 수 없습니다.');
    }

    const scrollIndex = player.inventory.findIndex(i => i.uid === scrollUid);
    player.inventory[scrollIndex].quantity--;
    if (player.inventory[scrollIndex].quantity <= 0) {
        player.inventory.splice(scrollIndex, 1);
    }

    const scrollChanceMap = {
        'star_scroll_100': 1.0, 'star_scroll_70': 0.7,
        'star_scroll_30': 0.3, 'star_scroll_10': 0.1
    };
    const successChance = scrollChanceMap[scroll.id];
    const statGain = scrollInfo.stats;

    let result = '';
    if (Math.random() < successChance) {
        result = 'success';
        targetItem.scrollStats = (targetItem.scrollStats || 0) + statGain;
        targetItem.scrollSuccesses++;
        pushLog(player, `[주문서] <span class="success-color">${scroll.name} 강화에 성공했습니다!</span> (능력치 +${statGain.toLocaleString()})`);
    } else {
        result = 'fail';
        targetItem.scrollFails++;
        pushLog(player, `[주문서] <span class="fail-color">${scroll.name} 강화에 실패했습니다...</span>`);
    }

    calculateTotalStats(player);
    player.socket.emit('scrollEnhancementResult', { result, item: targetItem });
    sendPlayerState(player);
    sendInventoryUpdate(player);
}
function useMoonScroll(player, { itemUid, scrollUid }) {
    if (!player || !itemUid || !scrollUid) return;

    const scroll = player.inventory.find(i => i.uid === scrollUid);
    if (!scroll) {
        return pushLog(player, '[오류] 사용할 주문서를 찾을 수 없습니다.');
    }

    const scrollInfo = itemData[scroll.id];
    if (!scrollInfo || scroll.scrollType !== 'moon') {
        return pushLog(player, '[오류] 유효하지 않은 달의 주문서입니다.');
    }

    let targetItem = null;
    if (player.equippedPet && player.equippedPet.uid === itemUid) {
        targetItem = player.equippedPet;
    } else {
        const targetItemSlot = Object.keys(player.equipment).find(slot => player.equipment[slot] && player.equipment[slot].uid === itemUid);
        if (targetItemSlot) {
            targetItem = player.equipment[targetItemSlot];
        }
    }

    if (!targetItem) {
        return pushLog(player, '[오류] 강화할 장착 아이템 또는 펫을 찾을 수 없습니다.');
    }

    if (targetItem.moonScrollSuccesses === undefined) targetItem.moonScrollSuccesses = 0;
    if (targetItem.moonScrollFails === undefined) targetItem.moonScrollFails = 0;

    const maxAttempts = 2;
    const totalAttempts = targetItem.moonScrollSuccesses + targetItem.moonScrollFails;

    if (totalAttempts >= maxAttempts) {
        return pushLog(player, '[주문서] 이 아이템은 더 이상 달의 주문서 강화를 할 수 없습니다.');
    }

    const scrollIndex = player.inventory.findIndex(i => i.uid === scrollUid);
    player.inventory[scrollIndex].quantity--;
    if (player.inventory[scrollIndex].quantity <= 0) {
        player.inventory.splice(scrollIndex, 1);
    }

    const scrollChanceMap = {
        'moon_scroll_100': 1.0, 'moon_scroll_70': 0.7,
        'moon_scroll_30': 0.3, 'moon_scroll_10': 0.1
    };
    const successChance = scrollChanceMap[scroll.id];
    const statGain = scrollInfo.specialStats;

    let result = '';
    if (Math.random() < successChance) {
        result = 'success';
        targetItem.moonScrollStats = (targetItem.moonScrollStats || 0) + statGain;
        targetItem.moonScrollSuccesses++;
        pushLog(player, `[주문서] <span class="success-color">${scroll.name} 강화에 성공했습니다!</span> (특수 능력치 +${statGain}%)`);
    } else {
        result = 'fail';
        targetItem.moonScrollFails++;
        pushLog(player, `[주문서] <span class="fail-color">${scroll.name} 강화에 실패했습니다...</span>`);
    }

    calculateTotalStats(player);
    player.socket.emit('scrollEnhancementResult', { result, item: targetItem });
    sendPlayerState(player);
    sendInventoryUpdate(player);
}
function useGoldenHammer(player, { itemUid, hammerUid, typeToRestore }) { 
    if (!player || !itemUid || !hammerUid || !typeToRestore) return;

    const hammer = player.inventory.find(i => i.uid === hammerUid);
    if (!hammer) {
        return pushLog(player, '[오류] 사용할 망치를 찾을 수 없습니다.');
    }

    let targetItem = null;

    if (player.equippedPet && player.equippedPet.uid === itemUid) {
        targetItem = player.equippedPet;
    } else {

        const targetItemSlot = Object.keys(player.equipment).find(slot => player.equipment[slot] && player.equipment[slot].uid === itemUid);
        if (targetItemSlot) {
            targetItem = player.equipment[targetItemSlot];
        }
    }
    
    if (!targetItem) {
        return pushLog(player, '[오류] 복구할 장착 아이템 또는 펫을 찾을 수 없습니다.');
    }

    if (typeToRestore === 'star') {
        if (!targetItem.scrollFails || targetItem.scrollFails <= 0) {
            return pushLog(player, '[망치] 이 아이템은 복구할 별의 기운 실패 기록이 없습니다.');
        }
        targetItem.scrollFails--;
    } else if (typeToRestore === 'moon') {
        if (!targetItem.moonScrollFails || targetItem.moonScrollFails <= 0) {
            return pushLog(player, '[망치] 이 아이템은 복구할 달의 기운 실패 기록이 없습니다.');
        }
        targetItem.moonScrollFails--;
    } else {
        return pushLog(player, '[오류] 유효하지 않은 복구 타입입니다.');
    }

    const hammerIndex = player.inventory.findIndex(i => i.uid === hammerUid);
    player.inventory[hammerIndex].quantity--;
    if (player.inventory[hammerIndex].quantity <= 0) {
        player.inventory.splice(hammerIndex, 1);
    }
    
    const restoreTypeName = typeToRestore === 'star' ? '별의 기운' : '달의 기운';
    pushLog(player, `[망치] <span class="legendary-color">${targetItem.name}</span>의 ${restoreTypeName} 실패 횟수를 1회 복구했습니다.`);

    player.socket.emit('scrollEnhancementResult', { result: 'restored', item: targetItem });
    sendPlayerState(player);
    sendInventoryUpdate(player);
}

const REFINEMENT_CONFIG = {
    MAX_LEVEL: 50,
    EXP_TABLE: [
        0, 15000, 32625, 53231, 77207, 104978, 137000, 173775, 215877, 263945, 318685,
        380885, 451405, 531181, 621218, 722616, 836574, 964375, 1107440, 1267264,
        1445473, 1643853, 1864327, 2109014, 2380191, 2680325, 3012114, 3378454,
        3782534, 4227815, 4718038, 5257255, 5850027, 6501282, 7216333, 8000962,
        8861455, 9804635, 10837830, 11968940, 13206580, 14559980, 16039076,
        17654519, 19417858, 21341483, 23438692, 25723883, 28212513, 30921003, 43000000
    ],
    WEAPON_BONUS_PER_LEVEL: 2,    // 추가 데미지 +2% per level
    ARMOR_BONUS_PER_LEVEL: 2,     // 보호막 +2% per level
    ACCESSORY_BONUS_PER_LEVEL: 0.2, // 왜곡 +0.2% per level
    SOULSTONE_EXP: {
        soulstone_faint: 100,
        soulstone_glowing: 1000,
        soulstone_radiant: 10000,
    },
    RESONANCE_CHANCE: 0.05, // 대성공 확률 5%
    RESONANCE_MULTIPLIER: 5,  // 대성공 시 경험치 5배
};


function getRefinementLevelFromExp(exp) {
    if (exp >= REFINEMENT_CONFIG.EXP_TABLE[50]) return 50;
    for (let i = 0; i < REFINEMENT_CONFIG.EXP_TABLE.length -1; i++) {
        if (exp < REFINEMENT_CONFIG.EXP_TABLE[i + 1]) {
            return i;
        }
    }
    return 50;
}


function getExpForNextLevel(level, currentExp) {
    if (level >= REFINEMENT_CONFIG.MAX_LEVEL) {
        return { needed: 0, progress: 1 };
    }
    const requiredForNext = REFINEMENT_CONFIG.EXP_TABLE[level + 1];
    const requiredForCurrent = REFINEMENT_CONFIG.EXP_TABLE[level];
    const expInCurrentLevel = currentExp - requiredForCurrent;
    const totalExpForLevel = requiredForNext - requiredForCurrent;
    return {
        needed: totalExpForLevel - expInCurrentLevel,
        progress: expInCurrentLevel / totalExpForLevel
    };
}

function initializeRefinement(item) {
    if (!item.refinement) {
        item.refinement = { level: 0, exp: 0 };
    }
}

function getRefinementBonus(item) {
    if (!item || !item.refinement) return 0;
    const level = item.refinement.level;
    switch (item.type) {
        case 'weapon':
            return level * REFINEMENT_CONFIG.WEAPON_BONUS_PER_LEVEL;
        case 'armor':
            return level * REFINEMENT_CONFIG.ARMOR_BONUS_PER_LEVEL;
        case 'accessory':
            return level * REFINEMENT_CONFIG.ACCESSORY_BONUS_PER_LEVEL;
        default:
            return 0;
    }
}


function createCondensedSoulEssence(item) {
    const essence = createItemInstance('condensed_soul_essence');
    essence.refinementData = {
        exp: item.refinement.exp,
        part: item.accessoryType ? 'accessory' : item.type
    };
    
    let partName = '';
    if (essence.refinementData.part === 'weapon') partName = '무기';
    else if (essence.refinementData.part === 'armor') partName = '방어구';
    else if (essence.refinementData.part === 'accessory') partName = '악세사리';

    essence.name = `응축된 영혼의 정수 [${partName}]`;
    essence.description = `${item.refinement.exp.toLocaleString()} EXP가 저장된 플레이어의 정수입니다.`;
    return essence;
}

server.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));
