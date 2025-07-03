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

const ADMIN_OBJECT_ID = '68617d506c3498183c9b367f';

const BOSS_INTERVAL = 200;



const WORLD_BOSS_CONFIG = {

    SPAWN_INTERVAL: 720 * 60 * 1000, HP: 1500000000, ATTACK: 0, DEFENSE: 0,

    REWARDS: { GOLD: 200000000, PREVENTION_TICKETS: 2, ITEM_DROP_RATES: { Rare: 0.10, Legendary: 0.10, Epic: 0.79, Mystic: 0.001 } }

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
    isKakaoVerified: { type: Boolean, default: false }  
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

    }



});

const GlobalRecordSchema = new mongoose.Schema({ recordType: { type: String, required: true, unique: true }, username: { type: String }, itemName: { type: String }, itemGrade: { type: String }, enhancementLevel: { type: Number }, updatedAt: { type: Date, default: Date.now } });

const ChatMessageSchema = new mongoose.Schema({

    type: { type: String, default: 'user' },

    username: { type: String, required: true },

    role: { type: String, default: 'user' },

    fameScore: { type: Number, default: 0 },

    message: { type: String, required: true },

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



mongoose.connect(MONGO_URI).then(() => {

    console.log('MongoDB 성공적으로 연결되었습니다.');



    loadGlobalRecords();

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
            headers: {
                'Content-type': 'application/x-www-form-urlencoded;charset=utf-8'
            },
            params: {
                grant_type: 'authorization_code',
                client_id: process.env.KAKAO_REST_API_KEY,
                redirect_uri: process.env.KAKAO_REDIRECT_URI,
                code,
            }
        });

        const { access_token } = tokenResponse.data;

        const userResponse = await axios.get('https://kapi.kakao.com/v2/user/me', {
            headers: {
                'Authorization': `Bearer ${access_token}`,
                'Content-type': 'application/x-www-form-urlencoded;charset=utf-8'
            }
        });

        const kakaoId = userResponse.data.id.toString();
        

        const linkedAccounts = await User.find({ kakaoId: kakaoId });

        if (linkedAccounts.length >= 2) {

            return res.redirect('/?error=하나의 카카오 계정으로는 2개의 게임 계정만 생성할 수 있습니다.');
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

    '무기1': 'w001', '무기2': 'w002', '무기3': 'w003', '무기4': 'w004', '무기5': 'w005',

    '방어구1': 'a001', '방어구2': 'a002', '방어구3': 'a003', '방어구4': 'a004', '방어구5': 'a005',

    '파방권': 'prevention_ticket',

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

    '융합1': 'ignis_aqua',   // 이그니스 아쿠아 (불/물)
    '융합2': 'tempest',      // 템페스트 (물/바람)
    '융합3': 'thunderbird',  // 썬더버드 (불/바람)

'참여상자': 'boss_participation_box',

'권능상자': 'box_power',

'악세1': 'acc_necklace_01',

'악세2': 'acc_earring_01',

'악세3': 'acc_wristwatch_01'

};




const itemData = {

 'acc_necklace_01': { 

        name: '윤회의 목걸이', 

        type: 'accessory', 

        accessoryType: 'necklace',

        grade: 'Mystic', 

        description: '사망 시 1층이 아닌, 현재 층수의 2/3 지점에서 다시 시작합니다.', 

        image: 'necklace_01.png', 

        tradable: true 

    },

    'acc_earring_01': { 

        name: '찰나의 각성 이어링', 

        type: 'accessory', 

        accessoryType: 'earring', 

        grade: 'Mystic', 

        description: '공격시 3% 확률로 10초간 각성돌입(공/방/체 10배)', 

        image: 'earring_01.png',

        tradable: true 

    },

    'acc_wristwatch_01': { 

        name: '통찰자의 크로노그래프', 

        type: 'accessory', 

        accessoryType: 'wristwatch',

        grade: 'Mystic', 

        description: '치명타 확률 20% 증가', 

        image: 'wristwatch_01.png', 

        tradable: true 

    },


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

boss_participation_box: { name: '월드보스 참여 상자', type: 'Special', category: 'Consumable', grade: 'Rare', description: '월드보스 토벌에 참여한 등반자에게 주어지는 상자. 사용 시 골드나 아이템을 얻을 수 있다.', image: 'box.png', tradable: false },

  return_scroll: { name: '복귀 스크롤', type: 'Special', category: 'Consumable', grade: 'Rare', description: '사용 시 가장 높은 층으로 이동하며, 10초간 각성 상태에 돌입하여 능력치가 대폭 상승합니다.', image: 'return_scroll.png', tradable: true },

  gold_pouch: { name: '수수께끼 골드 주머니', type: 'Special', category: 'Consumable', grade: 'Common', description: '사용 시 랜덤한 골드를 획득합니다.', image: 'gold_pouch.png', tradable: true },

    pet_egg_normal: { name: '일반종 알', type: 'Special', category: 'Egg', grade: 'Rare', description: '부화시키면 일반 등급의 펫을 얻습니다.', image: 'egg_normal.png', tradable: true, hatchDuration: 30 * 60 * 1000 },

    pet_egg_ancient: { name: '고대종 알', type: 'Special', category: 'Egg', grade: 'Epic', description: '부화시키면 고대 등급의 펫을 얻습니다.', image: 'pet_egg_ancient.png', tradable: true, hatchDuration: 60 * 60 * 1000 },

    pet_egg_mythic: { name: '신화종 알', type: 'Special', category: 'Egg', grade: 'Mystic', description: '부화시키면 신화 등급의 펫을 얻습니다.', image: 'pet_egg_mythic.png', tradable: true, hatchDuration: 24 * 60 * 60 * 1000 },

    prevention_ticket: { name: '파괴 방지권', type: 'Special', category: 'Ticket', grade: 'Epic', description: '10강 이상 강화 시 파괴를 1회 방지합니다.', image: 'ticket.png', tradable: true },

    hammer_hephaestus: { name: '헤파이스토스의 망치', type: 'Special', category: 'Buff', grade: 'Epic', description: '강화 시 체크하여 사용하면 성공 확률이 15%p 증가합니다.', image: 'hammer_hephaestus.png', tradable: true },

    tome_socket1: { name: '모래시계 소켓', type: 'Special', category: 'Tome', grade: 'Legendary', description: '사용 시 1번 유물 소켓을 영구히 해금합니다.', image: 'tome_socket1.png', tradable: true },

    tome_socket2: { name: '거인 학살자 소켓', type: 'Special', category: 'Tome', grade: 'Legendary', description: '사용 시 2번 유물 소켓을 영구히 해금합니다.', image: 'tome_socket2.png', tradable: true },

    tome_socket3: { name: '황금 나침반 소켓', type: 'Special', category: 'Tome', grade: 'Legendary', description: '사용 시 3번 유물 소켓을 영구히 해금합니다.', image: 'tome_socket3.png', tradable: true },

};



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



const powerBoxLootTable = [
    { id: 'w005', chance: 0.0016 },              // 태초의 파편
    { id: 'a005', chance: 0.0016 },              // 세계수의 심장
    { id: 'acc_necklace_01', chance: 0.0016 },   // 윤회의 목걸이
    { id: 'acc_earring_01', chance: 0.0016 },    // 찰나의 각성 이어링
    { id: 'acc_wristwatch_01', chance: 0.0016 }, // 통찰자의 크로노그래프
    { id: 'pet_egg_mythic', chance: 0.0020 },    // 신화종 알

    { id: 'hammer_hephaestus', quantity: [1, 5], chance: 0.40 },
    { id: 'prevention_ticket', quantity: [1, 5], chance: 0.40 },
    { id: 'return_scroll', quantity: 1, chance: 0.19 }
];


const artifactData = {

    tome_socket1: { id: 'tome_socket1', name: "가속의 모래시계", description: "10층마다 추가등반", image: "tome_socket1.png" },

    tome_socket2: { id: 'tome_socket2', name: "거인 학살자의 룬", description: "보스층 공/방 +50%", image: "tome_socket2.png" },

    tome_socket3: { id: 'tome_socket3', name: "황금 나침반", description: "골드 획득량 +25%", image: "tome_socket3.png" },

};





const dropTable = { 1: { itemsByGrade: { Common: ['w001', 'a001'] }, rates: { Common: 0.98, Rare: 0.02 } }, 2: { itemsByGrade: { Common: ['w001', 'a001'], Rare: ['w002', 'a002'], Legendary: ['w003', 'a003'] }, rates: { Common: 0.90, Rare: 0.09, Legendary: 0.01 } }, 3: { itemsByGrade: { Common: ['w001', 'a001'], Rare: ['w002', 'a002'], Legendary: ['w003', 'a003'], Epic: ['w004', 'a004'] }, rates: { Common: 0.78, Rare: 0.16, Legendary: 0.055, Epic: 0.005 } }, 4: { itemsByGrade: { Common: ['w001', 'a001'], Rare: ['w002', 'a002'], Legendary: ['w003', 'a003'], Epic: ['w004', 'a004'], Mystic: ['w005', 'a005'] }, rates: { Common: 0.65, Rare: 0.25, Legendary: 0.09, Epic: 0.0098, Mystic: 0.0002 } }, };

const enhancementTable = { 1: { success: 1.00, maintain: 0.00, fail: 0.00, destroy: 0.00 }, 2: { success: 1.00, maintain: 0.00, fail: 0.00, destroy: 0.00 }, 3: { success: 1.00, maintain: 0.00, fail: 0.00, destroy: 0.00 }, 4: { success: 1.00, maintain: 0.00, fail: 0.00, destroy: 0.00 }, 5: { success: 0.90, maintain: 0.10, fail: 0.00, destroy: 0.00 }, 6: { success: 0.80, maintain: 0.20, fail: 0.00, destroy: 0.00 }, 7: { success: 0.70, maintain: 0.25, fail: 0.05, destroy: 0.00 }, 8: { success: 0.50, maintain: 0.30, fail: 0.20, destroy: 0.00 }, 9: { success: 0.40, maintain: 0.40, fail: 0.20, destroy: 0.00 }, 10: { success: 0.30, maintain: 0.45, fail: 0.25, destroy: 0.00 }, 11: { success: 0.20, maintain: 0.00, fail: 0.00, destroy: 0.80 }, 12: { success: 0.15, maintain: 0.00, fail: 0.00, destroy: 0.85 }, 13: { success: 0.15, maintain: 0.00, fail: 0.00, destroy: 0.85 }, 14: { success: 0.15, maintain: 0.00, fail: 0.00, destroy: 0.85 }, 15: { success: 0.15, maintain: 0.00, fail: 0.00, destroy: 0.85 } };

const highEnhancementRate = { success: 0.10, maintain: 0.90, fail: 0.00, destroy: 0.00 };



const monsterCritRateTable = [

    { maxLevel: 10000, normal: 0.1, boss: 0.01 },

    { maxLevel: 100000, normal: 0.02, boss: 0.03 },

    { maxLevel: 300000, normal: 0.04, boss: 0.05 },

    { maxLevel: 500000, normal: 0.06, boss: 0.07 },

    { maxLevel: Infinity, normal: 0.07, boss: 0.08 }

];



const explorationLootTable = [

  { id: 'gold_pouch', chance: 0.002 },

    { id: 'pet_egg_normal', chance: 0.0008 },

    { id: 'prevention_ticket', chance: 0.0001 },

    { id: 'pet_egg_ancient', chance: 0.00005 },

    { id: 'hammer_hephaestus', chance: 0.00003 },

    { id: 'tome_socket1', chance: 0.000008 },

    { id: 'tome_socket2', chance: 0.0000065 },

    { id: 'tome_socket3', chance: 0.000005 },

    { id: 'return_scroll', chance: 0.000009 },

    { id: 'acc_necklace_01', chance: 0.000003 },

    { id: 'acc_earring_01', chance: 0.000003 },

    { id: 'acc_wristwatch_01', chance: 0.000003 },

    { id: 'pet_egg_mythic', chance: 0.0000005 } 

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

let connectedIPs = new Set();



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



app.post('/api/finalize-registration', async (req, res) => {
    try {
        const { tempToken, username, password } = req.body;
        if (!tempToken || !username || !password) {
            return res.status(400).json({ message: '필수 정보가 누락되었습니다.' });
        }

        const decoded = jwt.verify(tempToken, JWT_SECRET);
        const { kakaoId } = decoded;

        const linkedAccounts = await User.find({ kakaoId });
        if (linkedAccounts.length >= 2) {
            return res.status(409).json({ message: '하나의 카카오 계정으로는 2개의 게임 계정만 생성할 수 있습니다.' });
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
        if (linkedAccounts.length >= 2) {
             return res.status(409).json({ message: '하나의 카카오 계정으로는 2개의 게임 계정만 생성할 수 있습니다.' });
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


        const payload = { userId: user._id, username: user.username };
        if (user._id.toString() === ADMIN_OBJECT_ID) { payload.role = 'admin'; }
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '3h' });
        res.json({ message: '로그인 성공!', token });

    } catch (error) {
        console.error('로그인 오류:', error);
        res.status(500).json({ message: '서버 내부 오류가 발생했습니다.' });
    }
});


function createItemInstance(id, quantity = 1) { 

    const d = itemData[id]; 

    if (!d) return null;

    return { 

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

        ...(d.baseEffect && { baseEffect: d.baseEffect, enhancement: 0 }),

        quantity: quantity 

    }; 

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
    // itemData에 포함된 유물 아이템 3개를 총 카운트에서 제외
    return (Object.keys(itemData).length - 3) + Object.keys(petData).length + Object.keys(artifactData).length;
};

function addDiscoveredItem(player, itemId) {
    if (player && itemId && !player.discoveredItems.includes(itemId)) {
        player.discoveredItems.push(itemId);
        
        // 100% 달성 체크
        const totalCount = getTotalCodexItemCount();
        if (!player.codexBonusActive && player.discoveredItems.length >= totalCount) {
            player.codexBonusActive = true;
            const message = `[도감] 모든 아이템을 수집하여 마스터 보너스가 활성화되었습니다! (체/공/방/골드/치명타 +5%)`;
            pushLog(player, message);
            io.emit('chatMessage', { isSystem: true, message: `🎉 ${player.username}님이 아이템 도감을 100% 완성했습니다! 🎉` });
            calculateTotalStats(player); // 보너스 적용을 위해 스탯 즉시 재계산
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
        return;
    }

    if (!item.tradable || item.enhancement > 0) {
        player.inventory.push(item);
        return;
    }

    const stackableItem = player.inventory.find(i => i.id === item.id && (!i.enhancement || i.enhancement === 0));
    if (stackableItem) {
        stackableItem.quantity += item.quantity;
    } else {
        player.inventory.push(item);
    }
}



function calculateTotalStats(player) {
    if (!player || !player.stats) return;

    const base = player.stats.base;
    let weaponBonus = 0;
    let armorBonus = 0;
    let buffAttackMultiplier = 1;
    let buffDefenseMultiplier = 1;
    let buffHpMultiplier = 1;
    let artifactAttackMultiplier = 1;
    let artifactDefenseMultiplier = 1;
    let petDefPenetration = 0;

    // 1. 모든 스탯을 0에서부터 새로 계산하도록 초기화
    player.stats.critChance = 0; 
    player.stats.critResistance = 0;

    // 2. 펫과 장비로 인한 보너스 합산
    if (player.equippedPet && player.equippedPet.effects) {
        const effects = player.equippedPet.effects;
        // 기존의 '='를 '+='로 수정하여 덮어쓰기 버그를 막습니다.
        player.stats.critChance += effects.critChance || 0;
        player.stats.critResistance += effects.critResistance || 0;
        petDefPenetration = effects.defPenetration || 0;
    }

    if (player.equipment.wristwatch && player.equipment.wristwatch.id === 'acc_wristwatch_01') {
        player.stats.critChance += 0.20;
    }
    
    // 3. 버프와 유물로 인한 보너스 합산
    if (player.buffs && player.buffs.length > 0) {
        player.buffs.forEach(buff => {
            if (buff.effects.attackMultiplier) buffAttackMultiplier *= buff.effects.attackMultiplier;
            if (buff.effects.defenseMultiplier) buffDefenseMultiplier *= buff.effects.defenseMultiplier;
            if (buff.effects.hpMultiplier) buffHpMultiplier *= buff.effects.hpMultiplier;
        });
    }

    if (player.equipment.weapon) weaponBonus = computeEnhanceBonus(player.equipment.weapon);
    if (player.equipment.armor) armorBonus = computeEnhanceBonus(player.equipment.armor);

    if (player.unlockedArtifacts[1] && isBossFloor(player.level)) {
        artifactAttackMultiplier += 0.50;
        artifactDefenseMultiplier += 0.50;
    }

    // 4. 기본 스탯에 모든 보너스를 곱하여 최종 스탯 계산
    let totalHp = (base.hp * (1 + armorBonus)) * buffHpMultiplier;
    let totalAttack = (base.attack * (1 + weaponBonus)) * artifactAttackMultiplier * buffAttackMultiplier;
    let totalDefense = (base.defense * (1 + armorBonus)) * artifactDefenseMultiplier * buffDefenseMultiplier;

    // 5. 도감 마스터 보너스를 최종 스탯에 적용
    if (player.codexBonusActive) {
        totalHp *= 1.05;
        totalAttack *= 1.05;
        totalDefense *= 1.05;
        player.stats.critChance += 0.05; // 치명타 확률은 곱연산이 아닌 합연산
    }

    // 6. 계산된 최종 스탯을 플레이어 정보에 저장
    player.stats.total = {
        hp: totalHp,
        attack: totalAttack,
        defense: totalDefense,
        defPenetration: petDefPenetration
    };
}



function computeEnhanceBonus(item) {

    if(!item) return 0;

    let bonus = item.baseEffect; 

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

    const FAME_BY_GRADE = { Common: 10, Rare: 50, Legendary: 150, Epic: 400, Mystic: 1000 };

    const FAME_BONUS_PER_ENHANCEMENT = { Common: 1, Rare: 2, Legendary: 5, Epic: 10, Mystic: 25 };

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

    const clientIp = getNormalizedIp(socket);

    if (connectedIPs.has(clientIp)) {

        console.log(`[연결 거부] 중복 IP 접속 시도: ${socket.username} (${clientIp})`);

        socket.emit('forceDisconnect', { message: '해당 IP 주소에서는 이미 다른 계정이 접속 중입니다.\n기존 연결을 종료한 후 다시 시도해 주세요.' });

        socket.disconnect(true);

        return;

    }



    if (onlinePlayers[socket.userId]) {

        const oldSocket = onlinePlayers[socket.userId].socket;

        const oldIp = getNormalizedIp(oldSocket);

        connectedIPs.delete(oldIp);

        oldSocket.emit('forceDisconnect', { message: '다른 기기 또는 탭에서 접속하여 연결을 종료합니다.' });

        oldSocket.disconnect(true);

    }

    

    console.log(`[연결] 유저: ${socket.username} (Role: ${socket.role})`);
 const user = await User.findById(socket.userId).select('kakaoId').lean(); 
    let gameData = await GameData.findOne({ user: socket.userId }).lean();

 if (gameData) {
        const foundItemIds = new Set(gameData.discoveredItems || []);

        // 1. 인벤토리 스캔
        (gameData.inventory || []).forEach(item => foundItemIds.add(item.id));
        
        // 2. 장비 스캔
        Object.values(gameData.equipment || {}).forEach(item => {
            if (item) foundItemIds.add(item.id);
        });

        // 3. 펫 인벤토리 및 장착 펫 스캔
        (gameData.petInventory || []).forEach(pet => foundItemIds.add(pet.id));
        if (gameData.equippedPet) {
            foundItemIds.add(gameData.equippedPet.id);
        }

        // 4. 부화기 알 스캔
        if (gameData.incubator && gameData.incubator.egg) {
            foundItemIds.add(gameData.incubator.egg.id);
        }
        
        // 5. 해금된 유물 스캔
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



    gameData.attackTarget = 'monster';

    connectedIPs.add(clientIp);

onlinePlayers[socket.userId] = { ...gameData, monster: { currentHp: 1 }, socket: socket, buffs: [] };

     await updateFameScore(socket, onlinePlayers[socket.userId]);

    calculateTotalStats(onlinePlayers[socket.userId]);

    if (!onlinePlayers[socket.userId].stats.total) onlinePlayers[socket.userId].stats.total = {};

    onlinePlayers[socket.userId].currentHp = onlinePlayers[socket.userId].stats.total.hp;

    

    const chatHistory = await ChatMessage.find().sort({ timestamp: -1 }).limit(50).lean();

    socket.emit('chatHistory', chatHistory.reverse());

    socket.emit('initialGlobalRecords', globalRecordsCache);

    

    socket.emit('enhancementData', { enhancementTable, highEnhancementRate });



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



        if (socket.role === 'admin' && trimmedMsg.startsWith('/')) {

            const args = trimmedMsg.substring(1).split(' ').filter(arg => arg.length > 0);

            const command = args.shift().toLowerCase();

            const adminUsername = socket.username;



            if (command === '공지' || command === '보스소환') {

                if (command === '공지') {

                    const noticeMessage = args.join(' ');

                    io.emit('globalAnnouncement', noticeMessage);

                    io.emit('chatMessage', { type: 'announcement', username: adminUsername, role: 'admin', message: noticeMessage });

                }

                if (command === '보스소환') spawnWorldBoss();

                return;

            }



            const target = command;

            const subject = args.shift();

            const amountStr = args.shift() || '1';

            const amount = parseInt(amountStr, 10);

            const description = args.join(' ') || '관리자가 지급한 선물입니다.';



            if (!target || !subject || isNaN(amount) || amount <= 0) {

                return pushLog(onlinePlayers[socket.userId], `[관리자] 명령어 형식이 잘못되었습니다.`);

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

                return pushLog(onlinePlayers[socket.userId], `[관리자] 대상 유저 '${target}'을(를) 찾을 수 없습니다.`);

            }



            for (const t of targets) {

                const recipientId = t.user; 

                if (!recipientId) continue;



                const sender = `관리자(${adminUsername})`;

                if (subject.toLowerCase() === '골드') {

                    await sendMail(recipientId, sender, { gold: amount, description });

                } else {

                    const id = adminItemAlias[subject];

                    if (!id) continue;

                    const item = petData[id] ? createPetInstance(id) : createItemInstance(id, amount);

                    if (item) await sendMail(recipientId, sender, { item: item, description });

                }

            }



            const isGold = subject.toLowerCase() === '골드';

            const itemInfo = isGold ? null : (itemData[adminItemAlias[subject]] || petData[adminItemAlias[subject]]);

            const givenItemName = isGold ? `${amount.toLocaleString()} 골드` : itemInfo?.name || subject;

            const givenItemGrade = isGold ? 'gold-text' : itemInfo?.grade || 'Common';



         const reasonText = description ? ` (${description})` : '';
const chatAnnounceMsg = `[관리자] ${targetName}에게 <span class="${givenItemGrade}">${givenItemName}</span> 아이템을 우편으로 발송했습니다.${reasonText}`;
const bannerAnnounceMsg = `[관리자] ${targetName}에게 ${givenItemName} 아이템을 우편으로 발송했습니다.${reasonText}`;



            io.emit('globalAnnouncement', bannerAnnounceMsg);

            io.emit('chatMessage', { type: 'announcement', username: adminUsername, role: 'admin', message: chatAnnounceMsg });



            return;

        }



        const player = onlinePlayers[socket.userId];

        const newChatMessage = new ChatMessage({ username: socket.username, role: socket.role, fameScore: player ? player.fameScore : 0, message: trimmedMsg });

        await newChatMessage.save();

        io.emit('chatMessage', newChatMessage.toObject());



    } catch (error) {

        console.error('채팅 메시지 처리 중 오류 발생:', error);

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

        .on('toggleExploration', () => toggleExploration(onlinePlayers[socket.userId]))

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



.on('client-heartbeat', () => {
        })





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
    try {
        const player = onlinePlayers[socket.userId];
        if (!player) return callback({ success: false, message: '플레이어 정보를 찾을 수 없습니다.' });

        const mail = await Mail.findById(mailId);
        if (!mail || mail.recipientId.toString() !== socket.userId) {
            return callback({ success: false, message: '우편을 수령할 수 없습니다.' });
        }

        if (mail.item) handleItemStacking(player, mail.item);
        if (mail.gold > 0) player.gold += mail.gold;

        await Mail.findByIdAndDelete(mailId);

        pushLog(player, `[우편] '${mail.description}' 보상을 수령했습니다.`);
        
        sendState(socket, player, calcMonsterStats(player));
        sendInventoryUpdate(player);

        callback({ success: true });
    } catch (e) {
        callback({ success: false, message: '오류가 발생했습니다.' });
    }
})


.on('mailbox:claimAll', async (callback) => {
    try {
        const player = onlinePlayers[socket.userId];
        if (!player) return callback({ success: false, message: '플레이어 정보를 찾을 수 없습니다.' });

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


  .on('disconnect', () => {

            console.log(`[연결 해제] 유저: ${socket.username}`);

            const player = onlinePlayers[socket.userId];

            if(player) {

                const clientIp = getNormalizedIp(player.socket);

                connectedIPs.delete(clientIp);

                savePlayerData(socket.userId);

            }

            delete onlinePlayers[socket.userId];

        });

});



function applyAwakeningBuff(player) {

    player.buffs = player.buffs || [];

    const existingBuffIndex = player.buffs.findIndex(b => b.id === 'return_scroll_awakening');

    if (existingBuffIndex > -1) {

        player.buffs[existingBuffIndex].endTime = Date.now() + 10000;

    } else {

        player.buffs.push({

            id: 'return_scroll_awakening',

            name: '각성',

            endTime: Date.now() + 10000,

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



  if (player.petFusion && player.petFusion.fuseEndTime && new Date() >= new Date(player.petFusion.fuseEndTime)) {

        onPetFusionComplete(player);

    }

    if (player.incubator.hatchCompleteTime && new Date() >= new Date(player.incubator.hatchCompleteTime)) {

        onHatchComplete(player);

    }



 if (worldBossState && worldBossState.isActive && player.attackTarget === 'worldBoss') {

        const pDmg = Math.max(1, (player.stats.total.attack || 0) - (worldBossState.defense || 0));

        worldBossState.currentHp = Math.max(0, (worldBossState.currentHp || 0) - pDmg);



 if (player.equipment.earring && player.equipment.earring.id === 'acc_earring_01' && Math.random() < 0.03) {

        applyAwakeningBuff(player);

    }        



        const userId = player.user.toString();

        const participant = worldBossState.participants.get(userId) || { username: player.username, damageDealt: 0 };

        participant.damageDealt = (participant.damageDealt || 0) + pDmg;

        worldBossState.participants.set(userId, participant);

        

        if (!player.worldBossContribution) {

            player.worldBossContribution = { damageDealt: 0, bossId: null };

        }

        player.worldBossContribution.damageDealt = participant.damageDealt;

        player.worldBossContribution.bossId = worldBossState.bossId;



        if (worldBossState.currentHp <= 0) { onWorldBossDefeated(); }

        sendState(player.socket, player, calcMonsterStats(player));

        return;

    }



    if (player.isExploring) {

        player.socket.emit('combatResult', { playerTook: 0, monsterTook: 1 });

        runExploration(player);

        sendState(player.socket, player, { level: player.level, hp: 1, attack: 0, defense: 0, isBoss: false });

        return;

    }

    

    

    calculateTotalStats(player);

 const m = calcMonsterStats(player);



    let pDmg = 0;

    let mDmg = 0;



    const playerCritRoll = Math.random();

    if (playerCritRoll < player.stats.critChance) {

        pDmg = player.stats.total.attack;

    } else {

        const monsterEffectiveDefense = m.defense * (1 - (player.stats.total.defPenetration || 0));

        pDmg = Math.max(0, player.stats.total.attack - monsterEffectiveDefense);

    }

    const monsterCritConfig = monsterCritRateTable.find(r => m.level <= r.maxLevel);

    const monsterCritChance = m.isBoss ? monsterCritConfig.boss : monsterCritConfig.normal;

    const finalMonsterCritChance = Math.max(0, monsterCritChance - player.stats.critResistance);

    const monsterCritRoll = Math.random();



    if (monsterCritRoll < finalMonsterCritChance) {

        mDmg = m.attack;

    } else {

        const playerEffectiveDefense = m.isBoss ? (player.stats.total.defense * 0.5) : player.stats.total.defense;

        mDmg = Math.max(0, m.attack - playerEffectiveDefense);

    }

    if (pDmg > 0 || mDmg > 0) {

        player.currentHp -= mDmg;

        player.socket.emit('combatResult', { playerTook: mDmg, monsterTook: pDmg });

}

if (pDmg > 0 && player.equipment.earring && player.equipment.earring.id === 'acc_earring_01' && Math.random() < 0.03) {

    applyAwakeningBuff(player);

    }



    if (player.currentHp <= 0) {

        const reviveEffect = player.equippedPet?.effects?.revive;

        if (reviveEffect && (!player.petReviveCooldown || new Date() > new Date(player.petReviveCooldown))) {

            player.currentHp = player.stats.total.hp * reviveEffect.percent;

            player.petReviveCooldown = new Date(Date.now() + reviveEffect.cooldown);

            pushLog(player, `[${player.equippedPet.name}]의 힘으로 죽음의 문턱에서 돌아옵니다!`);

        } else {

            const deathMessage = m.isBoss ? `[${player.level}층 보스]에게 패배하여 1층으로 귀환합니다.` : `[${player.level}층] 몬스터에게 패배하여 1층으로 귀환합니다.`;

            resetPlayer(player, deathMessage);

        }

    } else if (player.monster.currentHp - pDmg <= 0) {

        player.level++;

        player.maxLevel = Math.max(player.maxLevel, player.level);



if (player.level > (player.previousMaxLevel || player.maxLevel -1) ) {
    updateFameScore(player.socket, player);
}
player.previousMaxLevel = player.maxLevel;

        onClearFloor(player);

        calculateTotalStats(player);

        player.currentHp = player.stats.total.hp;

        player.monster.currentHp = calcMonsterStats(player).hp;

    } else {

        player.monster.currentHp -= pDmg;

    }



    sendState(player.socket, player, m);

}

setInterval(() => { for (const userId in onlinePlayers) { gameTick(onlinePlayers[userId]); } }, TICK_RATE);



setInterval(() => {

    if (worldBossState && worldBossState.isActive) {

        const serializableState = {

            ...worldBossState,

            participants: Object.fromEntries(worldBossState.participants)

        };

        io.emit('worldBossUpdate', serializableState);

    }

}, 2000);

function onClearFloor(p) {

    const isBoss = isBossFloor(p.level - 1);

    const clearedFloor = p.level - 1;

    let goldEarned = isBoss ? clearedFloor * 10 : clearedFloor;

    

    if (p.unlockedArtifacts[2]) {

        goldEarned = Math.floor(goldEarned * 1.25);

    }
if (p.codexBonusActive) { // 추가된 코드
        goldEarned = Math.floor(goldEarned * 1.05);
    }



    p.gold += goldEarned;

    if (isBoss) { 

        pushLog(p, `[${clearedFloor}층 보스] 클리어! (+${goldEarned.toLocaleString()} G)`); 

    }

    

    let extraClimbChance = p.equippedPet?.effects?.extraClimbChance || 0;



    if (p.unlockedArtifacts[0] && clearedFloor > 0 && clearedFloor % 10 === 0) {

        const skippedFloor = p.level;

        p.level++;

        p.maxLevel = Math.max(p.maxLevel, p.level);

        

        let skippedGold = isBossFloor(skippedFloor) ? skippedFloor * 10 : skippedFloor;

        if (p.unlockedArtifacts[2]) {

            skippedGold = Math.floor(skippedGold * 1.25);

        }

 if (p.codexBonusActive) { // 추가된 코드
            skippedGold = Math.floor(skippedGold * 1.05);
        }

        p.gold += skippedGold;

   


    } else if (Math.random() < extraClimbChance) {

        const skippedFloor = p.level;

        p.level++;

        p.maxLevel = Math.max(p.maxLevel, p.level);

        

        let skippedGold = isBossFloor(skippedFloor) ? skippedFloor * 10 : skippedFloor;

        if (p.unlockedArtifacts[2]) {

            skippedGold = Math.floor(skippedGold * 1.25);

        }

        p.gold += skippedGold;

      
    }



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

                if (droppedItem) {

                    handleItemStacking(p, droppedItem);

                     if (['Epic', 'Mystic'].includes(droppedItem.grade)) {
                            pushLog(p, `[${clearedFloor}층]에서 ${itemData[id].name} 획득!`);
                    }
sendInventoryUpdate(p); 


                    if (['Legendary', 'Epic', 'Mystic'].includes(droppedItem.grade)) {

                        updateGlobalRecord(`topLoot_${droppedItem.grade}`, { username: p.username, itemName: droppedItem.name, itemGrade: droppedItem.grade });

                    }
announceMysticDrop(p.username, droppedItem);
                }

            }

        }

    }

}



async function attemptEnhancement(p, { uid, useTicket, useHammer }, socket) {
    if (!p) return;
    let item;
    let isEquipped = false;
    let itemIndex = p.inventory.findIndex(i => i.uid === uid);
    if (itemIndex !== -1) {
        item = p.inventory[itemIndex];
    } else {
        for (const key of Object.keys(p.equipment)) {
            if (p.equipment[key] && p.equipment[key].uid === uid) {
                item = p.equipment[key];
                isEquipped = true;
                break;
            }
        }
    }
    if (!item || (item.type !== 'weapon' && item.type !== 'armor')) return;
    if (!isEquipped && item.quantity > 1) {
        item.quantity--;
        const newItemForEnhance = { ...item, quantity: 1, uid: new mongoose.Types.ObjectId().toString() };
        p.inventory.push(newItemForEnhance);
        item = newItemForEnhance;
        uid = item.uid;
        itemIndex = p.inventory.length - 1;
    }
    const cur = item.enhancement;
    const cost = Math.floor(1000 * Math.pow(2.1, cur));
    if (p.gold < cost) {
        pushLog(p, '[강화] 골드가 부족합니다.');
        return;
    }



    if (useTicket && item.enhancement >= 10) {

        const ticketIndex = p.inventory.findIndex(i => i.id === 'prevention_ticket');

        if (ticketIndex === -1) {

            pushLog(p, '[강화] 파괴 방지권이 없어 사용할 수 없습니다.');

            return;

        }

    }



    p.gold -= cost;



    const rates = { ...(enhancementTable[cur + 1] || highEnhancementRate) };



    if (useHammer) {

        const hammerIndex = p.inventory.findIndex(i => i.id === 'hammer_hephaestus');

        if (hammerIndex > -1) {

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

            p.inventory[hammerIndex].quantity--;

            if (p.inventory[hammerIndex].quantity <= 0) {

                p.inventory.splice(hammerIndex, 1);

            }

            pushLog(p, '[강화] 헤파이스토스의 망치 효과로 성공 확률이 증가합니다!');


        }

    }



    const r = Math.random();

    let result = '';

    let msg = '';

    const hpBefore = p.stats.total.hp;



    if (r < rates.success) {

        result = 'success';

        item.enhancement++;

        msg = `[+${cur} ${item.name}] 강화 성공! → [+${item.enhancement}]`;

        if (item.enhancement >= 12) {

            const announcementMsg = `🎉 ${p.username}님이 [+${item.enhancement} ${item.name}] 강화에 성공하였습니다! 모두 축하해주세요! 🎉`;

            io.emit('globalAnnouncement', announcementMsg);

            io.emit('chatMessage', { type: 'announcement', username: 'SYSTEM', role: 'admin', message: announcementMsg });

        }

        if (item.type === 'weapon') {

            if (item.enhancement > (p.maxWeaponEnhancement || 0)) {

                p.maxWeaponEnhancement = item.enhancement;

                p.maxWeaponName = item.name;

            }

        } else if (item.type === 'armor') {

            if (item.enhancement > (p.maxArmorEnhancement || 0)) {

                p.maxArmorEnhancement = item.enhancement;

                p.maxArmorName = item.name;

            }

        }

        const currentTopEnh = globalRecordsCache.topEnhancement || { enhancementLevel: 0 };

        if (item.enhancement > currentTopEnh.enhancementLevel) {

            updateGlobalRecord('topEnhancement', { username: p.username, itemName: item.name, itemGrade: item.grade, enhancementLevel: item.enhancement });

updatePlayerFame(p);

        }

    } else if (r < rates.success + rates.maintain) {

        result = 'maintain';

        msg = `[+${cur} ${item.name}] 강화 유지!`;

    } else if (r < rates.success + rates.maintain + rates.fail) {

        result = 'fail';

        const newLevel = Math.max(0, item.enhancement - 1);

        msg = `[+${cur} ${item.name}] 강화 실패... → [+${newLevel}]`;

        item.enhancement = newLevel;

    } else { 

     

        if (useTicket && item.enhancement >= 10) {

            const ticketIndex = p.inventory.findIndex(i => i.id === 'prevention_ticket');

            if (ticketIndex !== -1) {

     

                p.inventory[ticketIndex].quantity--;

                if (p.inventory[ticketIndex].quantity <= 0) {

                    p.inventory.splice(ticketIndex, 1);

                }

                result = 'maintain'; 

                msg = `<span class="Epic">파괴 방지권</span>을 사용하여 <span class="${item.grade}">${item.name}</span>의 파괴를 막았습니다!`;

            } else {



                result = 'destroy';

                msg = `<span class="${item.grade}">${item.name}</span>이(가) 강화에 실패하여 파괴되었습니다...`;

                if (isEquipped) { p.equipment[item.type] = null; } 

                else {

                    const itemToRemoveIndex = p.inventory.findIndex(i => i.uid === uid);

                    if (itemToRemoveIndex > -1) p.inventory.splice(itemToRemoveIndex, 1);

                }

            }

        } else { 

            result = 'destroy';

            msg = `<span class="${item.grade}">${item.name}</span>이(가) 강화에 실패하여 파괴되었습니다...`;

            if (isEquipped) { p.equipment[item.type] = null; } 

            else {

                const itemToRemoveIndex = p.inventory.findIndex(i => i.uid === uid);

                if (itemToRemoveIndex > -1) p.inventory.splice(itemToRemoveIndex, 1);

            }

        }

    }

    

    calculateTotalStats(p);

    const hpAfter = p.stats.total.hp;

    p.currentHp = hpBefore > 0 && hpAfter > 0 ? p.currentHp * (hpAfter / hpBefore) : hpAfter;

    if (p.currentHp > hpAfter) p.currentHp = hpAfter;

    pushLog(p, msg);



    socket.emit('enhancementResult', { result, newItem: (result !== 'destroy' ? item : null), destroyed: result === 'destroy' });
    sendState(p.socket, p, calcMonsterStats(p));
    sendInventoryUpdate(p);
updateFameScore(socket, p);
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

function announceMysticDrop(username, item) {
    if (!item || item.grade !== 'Mystic') return;

    const itemNameHTML = `<span class="${item.grade}">${item.name}</span>`;
    const announcementMessage = `🎉 ★★★ 축하합니다! ${username}님이 ${itemNameHTML} 아이템을 획득했습니다!(미스틱) ★★★ 🎉`;

    io.emit('globalAnnouncement', announcementMessage);
    io.emit('chatMessage', { type: 'announcement', username: 'SYSTEM', role: 'admin', message: announcementMessage });
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

function calcMonsterStats(p) { const level = p.level; if (isBossFloor(level)) { const prevLevelMonsterAttack = Math.max(1, (level - 1) / 2); return { level: level, hp: level * 10, attack: prevLevelMonsterAttack * 2, defense: level / 3, isBoss: true }; } return { level: level, hp: level, attack: level / 2, defense: level / 5, isBoss: false }; }

function resetPlayer(p, msg) {

    let returnFloor = 1;

    if (p.equipment.necklace && p.equipment.necklace.id === 'acc_necklace_01') {

        returnFloor = Math.floor(p.level * 2 / 3);

        if (returnFloor < 1) returnFloor = 1;

    }

    p.level = returnFloor;

    calculateTotalStats(p);

    p.currentHp = p.stats.total.hp;

    p.monster.currentHp = calcMonsterStats(p).hp;

    pushLog(p, msg);

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
pushLog(player, `[장비] ${player.equipment[slot].name} 을(를) 장착했습니다.`);
    }
    
    calculateTotalStats(player);
    player.currentHp = player.stats.total.hp;
    sendPlayerState(player);
    sendInventoryUpdate(player);
updateFameScore(player.socket, player);
}




function unequipItem(player, slot) {
    if (!player || !player.equipment[slot]) return;
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
}

function sellItem(player, uid, sellAll) {
    if (!player) return;
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

    const basePrice = SELL_PRICES[item.grade] || 0;
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
        if (item.quantity > 1) {
            item.quantity--;
        } else {
            player.inventory.splice(itemIndex, 1);
        }
        player.gold += finalPrice;
        const itemName = item.enhancement > 0 ? `+${item.enhancement} ${item.name}` : item.name;
        pushLog(player, `[판매] ${itemName} 1개를 ${finalPrice.toLocaleString()} G에 판매했습니다.`);
    } else {
        const quantityToSell = item.quantity;
        const totalPrice = basePrice * quantityToSell;
        player.inventory.splice(itemIndex, 1);
        player.gold += totalPrice;
        pushLog(player, `[판매] ${item.name} ${quantityToSell}개를 ${totalPrice.toLocaleString()} G에 판매했습니다.`);
    }

    sendState(player.socket, player, calcMonsterStats(player));
    sendInventoryUpdate(player);
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

        player.petInventory.push(newPet);

        pushLog(player, `[융합] 융합이 완료되어 강력한 <span class="${newPet.grade}">${newPet.name}</span>이(가) 탄생했습니다!`);

    } else {

        player.petInventory.push(pet1, pet2);

        player.gold += 100000000; 

        pushLog(player, '[융합] 알 수 없는 오류로 융합에 실패하여 재료와 비용이 반환되었습니다.');

        console.error(`[Fusion Error] User: ${player.username}, Pets: ${pet1.name}, ${pet2.name}`);

    }



    player.petFusion = { slot1: null, slot2: null, fuseEndTime: null };


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

    const playerStateForClient = {
      gold: player.gold,
        level: player.level,
        maxLevel: player.maxLevel,
        stats: player.stats,
        currentHp: player.currentHp,
        isExploring: player.isExploring,
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
        log: player.log
    };

    const monsterStateForClient = {
        ...monsterStats,
        currentHp: player.monster.currentHp
    };

    socket.emit('stateUpdate', { player: playerStateForClient, monster: monsterStateForClient });
}

function sendPlayerState(player) {
    if (!player || !player.socket) return;

    const monsterStats = calcMonsterStats(player); 
    sendState(player.socket, player, monsterStats);
}

function runExploration(player) {
    const rand = Math.random();
    let cumulativeChance = 0;
    for (const item of explorationLootTable) {
        cumulativeChance += item.chance;
        if (rand < cumulativeChance) {
            const newItem = createItemInstance(item.id);
            if (newItem) {
                handleItemStacking(player, newItem);
                sendInventoryUpdate(player); 
                pushLog(player, `[탐험] <span class="${newItem.grade}">${newItem.name}</span>을(를) 발견했습니다!`);
                announceMysticDrop(player.username, newItem);
            }
            return;
        }
    }
}


function useItem(player, uid, useAll = false) {
    if (!player) return;
    const itemIndex = player.inventory.findIndex(i => i.uid === uid);
    if (itemIndex === -1) return;

    const item = player.inventory[itemIndex];
    const quantityToUse = useAll ? item.quantity : 1;
    let messages = [];

    switch (item.id) {
  case 'box_power':
            const guaranteedGold = 50000000;
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
                messages.push(`[권능의 상자] 추가 보상으로 (${wonItem.quantity}개) 아이템을 획득했습니다!`);
                announceMysticDrop(player.username, wonItem);
            } else {
                messages.push('[권능의 상자] 아쉽지만, 추가 보상은 없었습니다.');
            }
            break;

        case 'boss_participation_box':
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
                        announceMysticDrop(player.username, wonItem);
                        messages.push(`[참여 상자] ✨ 상자에서 추가 아이템이 나왔습니다!!! 인벤토리를 확인하세요`);
                    }
                }
            });
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
            player.buffs.push({
                id: 'return_scroll_awakening',
                name: '각성',
                endTime: Date.now() + 10000,
                effects: { attackMultiplier: 10, defenseMultiplier: 10, hpMultiplier: 10 }
            });
            calculateTotalStats(player);
            player.currentHp = player.stats.total.hp;
            player.monster.currentHp = calcMonsterStats(player).hp;
            messages.push(`[복귀 스크롤] 스크롤의 힘으로 ${player.level}층으로 이동하며 10초간 각성합니다!`);
            break;

        case 'gold_pouch':
            let totalGoldGained = 0;
            for (let i = 0; i < quantityToUse; i++) {
                const rand = Math.random();
                let cumulativeChance = 0;
                for (const reward of goldPouchRewardTable) {
                    cumulativeChance += reward.chance;
                    if (rand < cumulativeChance) {
                        const goldGained = Math.floor(Math.random() * (reward.range[1] - reward.range[0] + 1)) + reward.range[0];
                        totalGoldGained += goldGained;
                        break;
                    }
                }
            }
            player.gold += totalGoldGained;
            messages.push(`[수수께끼 골드 주머니] ${quantityToUse}개를 사용하여 ${totalGoldGained.toLocaleString()} G를 획득했습니다!`);
            break;

        case 'hammer_hephaestus':
            messages.push('이 아이템은 강화 시 체크하여 사용합니다.');
            if (player.socket) player.socket.emit('useItemResult', { messages });
            return; 

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
        player.socket.emit('useItemResult', { messages });
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
}


function unequipPet(player) {
    if (!player || !player.equippedPet) return;
    player.petInventory.push(player.equippedPet);
    player.equippedPet = null;
    calculateTotalStats(player);
    sendState(player.socket, player, calcMonsterStats(player));
    sendInventoryUpdate(player);
updateFameScore(player.socket, player);
}


async function onWorldBossDefeated() {
    if (!worldBossState || !worldBossState.isActive) return;

    console.log('[월드보스] 처치되어 보상 분배를 시작합니다.');
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

    const playersToUpdate = new Set();


    const participationBoxMessage = "[월드보스] 토벌에 참여한 모든 용사에게 '월드보스 참여 상자'가 지급됩니다!";
    io.emit('chatMessage', { isSystem: true, message: participationBoxMessage });

    for (const [userId, participant] of worldBossState.participants.entries()) {
        if (participant.damageDealt > 0) {
            const boxItem = createItemInstance('boss_participation_box');
            if (!boxItem) continue;

            const onlinePlayer = onlinePlayers[userId];
            if (onlinePlayer) {
                handleItemStacking(onlinePlayer, boxItem);
                pushLog(onlinePlayer, "[월드보스] 기본 참여 보상으로 '월드보스 참여 상자'를 획득했습니다.");
                playersToUpdate.add(onlinePlayer);
            } else {
                const playerData = await GameData.findOne({ user: userId });
                if (playerData) {
                    handleItemStacking(playerData, boxItem);
                    await playerData.save();
                }
            }
        }
    }

    const sortedParticipants = Array.from(worldBossState.participants.entries()).sort((a, b) => b[1].damageDealt - a[1].damageDealt);
    io.emit('chatMessage', { isSystem: true, message: "<b>[월드보스] ✨ 기여도 랭킹 ✨</b>" });
    const topN = Math.min(5, sortedParticipants.length);
    for (let i = 0; i < topN; i++) {
        const [userId, participant] = sortedParticipants[i];
        const percentage = (participant.damageDealt / totalDamage * 100).toFixed(2);
        io.emit('chatMessage', { isSystem: true, message: `<b>${i + 1}위</b>: ${participant.username} (기여도: ${percentage}%)` });
    }
    io.emit('chatMessage', { isSystem: true, message: "====================" });
    for (const [userId, participant] of sortedParticipants) {
        const damageShare = participant.damageDealt / totalDamage;
        const goldReward = Math.floor(WORLD_BOSS_CONFIG.REWARDS.GOLD * damageShare);
        if (goldReward <= 0) continue;
        const onlinePlayer = onlinePlayers[userId];
        if (onlinePlayer) {
            onlinePlayer.gold += goldReward;
            pushLog(onlinePlayer, `[월드보스] 기여도 보상으로 ${goldReward.toLocaleString()} G를 획득했습니다.`);
        } else {
            await GameData.updateOne({ user: userId }, { $inc: { gold: goldReward } });
        }
    }

    const ticketWinners = {};
    for (let i = 0; i < WORLD_BOSS_CONFIG.REWARDS.PREVENTION_TICKETS; i++) {
        const rWinner = Math.random();
        let accWinner = 0;
        let winnerId = null;
        for (const [userId] of sortedParticipants) {
            const damageShare = worldBossState.participants.get(userId).damageDealt / totalDamage;
            accWinner += damageShare;
            if (rWinner < accWinner) { winnerId = userId; break; }
        }
        if (winnerId) {
            const winnerUsername = worldBossState.participants.get(winnerId).username;
            ticketWinners[winnerUsername] = (ticketWinners[winnerUsername] || 0) + 1;
        }
    }
    if (Object.keys(ticketWinners).length > 0) {
        const ticketLog = Object.entries(ticketWinners).map(([name, count]) => `${name}님 ${count}개`).join(', ');
        io.emit('chatMessage', { isSystem: true, message: `[월드보스] 📜 파괴 방지 티켓 분배 결과: ${ticketLog}` });
        for (const [winnerUsername, count] of Object.entries(ticketWinners)) {
            const winner = Object.values(onlinePlayers).find(p => p.username === winnerUsername);
            const ticketItem = createItemInstance('prevention_ticket', count);
            if (ticketItem) {
                if (winner) {
                    handleItemStacking(winner, ticketItem);
                    pushLog(winner, `[월드보스] 행운 보상으로 '파괴 방지권' ${count}개를 획득했습니다!`);
                    playersToUpdate.add(winner);
                } else {
                    const winnerData = await GameData.findOne({ username: winnerUsername });
                    if (winnerData) {
                        handleItemStacking(winnerData, ticketItem);
                        await winnerData.save();
                    }
                }
            }
        }
    }

    const { ITEM_DROP_RATES } = WORLD_BOSS_CONFIG.REWARDS;
    let droppedItem = null;
    const rGrade = Math.random();
    let accGrade = 0;
    let chosenGrade = null;
    for (const grade in ITEM_DROP_RATES) {
        accGrade += ITEM_DROP_RATES[grade];
        if (rGrade < accGrade) { chosenGrade = grade; break; }
    }
    if (chosenGrade) {
        const itemPool = Object.keys(itemData).filter(id => itemData[id].grade === chosenGrade && itemData[id].tradable === true);
        if (itemPool.length > 0) {
            const chosenItemId = itemPool[Math.floor(Math.random() * itemPool.length)];
            droppedItem = createItemInstance(chosenItemId);
        }
    }
    if (droppedItem) {
        io.emit('chatMessage', { isSystem: true, message: `[월드보스] 기여도에 따라 💎<b>아이템</b>💎 획득 롤을 시작합니다...` });
        const rWinner = Math.random();
        let accWinner = 0;
        let winnerId = null;
        for (const [userId] of sortedParticipants) {
            const damageShare = worldBossState.participants.get(userId).damageDealt / totalDamage;
            accWinner += damageShare;
            if (rWinner < accWinner) { winnerId = userId; break; }
        }
        if (winnerId) {
            const winnerParticipantData = worldBossState.participants.get(winnerId);
            const winnerUsername = winnerParticipantData.username;
            const onlineWinner = onlinePlayers[winnerId];
            const winnerShare = (winnerParticipantData.damageDealt / totalDamage * 100).toFixed(2);
            const itemNameHTML = `<span class="${droppedItem.grade}">${droppedItem.name}</span>`;
            if (onlineWinner) {
                handleItemStacking(onlineWinner, droppedItem);

                pushLog(onlineWinner, `[최종 롤 당첨] 축하합니다! 최종 보상으로 '${droppedItem.name}' 아이템을 획득했습니다!`);
                playersToUpdate.add(onlineWinner);
            } else {
                await GameData.updateOne({ user: winnerId }, { $push: { inventory: droppedItem } });
            }
            const winMessage = `[월드보스] ${winnerUsername}님이 <b>${winnerShare}%</b>의 확률로 승리하여 ${itemNameHTML} 아이템을 획득했습니다!`;
            io.emit('globalAnnouncement', `🎉 ${winMessage} 🎉`);
            io.emit('chatMessage', { isSystem: true, message: winMessage });
        }
    }


    for (const player of playersToUpdate) {
        sendInventoryUpdate(player);
    }
    

    await GameData.updateMany({ "worldBossContribution.bossId": worldBossState.bossId }, { $set: { worldBossContribution: { damageDealt: 0, bossId: null } } });
    for (const player of Object.values(onlinePlayers)) {
        sendState(player.socket, player, calcMonsterStats(player));
    }
    io.emit('worldBossDefeated');
    worldBossState = null;
    if (worldBossTimer) clearTimeout(worldBossTimer);
    worldBossTimer = setTimeout(spawnWorldBoss, WORLD_BOSS_CONFIG.SPAWN_INTERVAL);
}







async function listOnAuction(player, { uid, price, quantity }) {
    if (!player || !uid || !price || !quantity) {
        return { success: false, message: '잘못된 요청입니다.' };
    }

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

    try {
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
    }
}


async function buyFromAuction(player, { listingId, quantity }) {
    if (!player || !listingId || !quantity) return;
    const amountToBuy = parseInt(quantity, 10);
    if (isNaN(amountToBuy) || amountToBuy <= 0) {
        return player.socket.emit('serverAlert', '유효한 구매 수량을 입력해주세요.');
    }
    try {
        const listing = await AuctionItem.findById(listingId);
        if (!listing) {
            pushLog(player, '[거래소] 이미 판매되었거나 존재하지 않는 물품입니다.');
            return io.emit('auctionUpdate');
        }
        if (listing.sellerId.toString() === player.user.toString()) {
            return player.socket.emit('serverAlert', '자신이 등록한 물품은 구매할 수 없습니다.');
        }
        if (listing.item.quantity < amountToBuy) {
            return player.socket.emit('serverAlert', '구매하려는 수량이 재고보다 많습니다.');
        }

        const totalPrice = listing.price * amountToBuy;
        if (player.gold < totalPrice) {
            const feedbackMsg = `골드가 부족하여 구매에 실패했습니다.\n\n필요 골드: ${totalPrice.toLocaleString()} G\n보유 골드: ${player.gold.toLocaleString()} G`;
            return player.socket.emit('serverAlert', feedbackMsg);
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

        listing.item.quantity -= amountToBuy;
        if (listing.item.quantity <= 0) {
            await AuctionItem.findByIdAndDelete(listingId);
        } else {
            await AuctionItem.findByIdAndUpdate(listingId, { $set: { 'item.quantity': listing.item.quantity } });
        }

        const itemNameHTML = `<span class="${listing.item.grade}">${listing.item.name}</span>`;
        const announcementMessage = `[거래소] ${listing.sellerUsername}님이 등록한 ${itemNameHTML} 아이템을 ${player.username}님이 구매했습니다.`;
        io.emit('chatMessage', { isSystem: true, message: announcementMessage });
        pushLog(player, `[거래소] ${listing.item.name} ${amountToBuy}개를 ${totalPrice.toLocaleString()} G에 구매하여 우편으로 받았습니다.`);
sendState(player.socket, player, calcMonsterStats(player));
        io.emit('auctionUpdate');

    } catch (e) {
        console.error('거래소 구매 오류:', e);
        pushLog(player, '[거래소] 아이템 구매에 실패했습니다.');
    }
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



    if ((kstHour === 19 && kstMinutes === 0) || (kstHour === 22 && kstMinutes === 00)) {

        isBossSpawning = true;

        console.log(`[스케줄러] 정해진 시간 (${kstHour}시)이 되어 월드보스를 소환합니다.`);

        spawnWorldBoss().finally(() => {

            setTimeout(() => { isBossSpawning = false; }, 60000);

        });

    }

}



function toggleExploration(player) {
    if (!player) return;
    player.isExploring = !player.isExploring;
    if (player.isExploring) {
        player.levelBeforeExploration = player.level;
        pushLog(player, '[탐험] 미지의 영역으로 탐험을 시작합니다.');
    } else {
        player.level = player.levelBeforeExploration;
        pushLog(player, `[탐험] 탐험을 마치고 ${player.level}층으로 복귀합니다.`);
    }
    sendPlayerState(player); 
}







function startHatching(player) {
    if (!player || !player.incubator.egg || player.incubator.hatchCompleteTime) return;
    
    const eggId = player.incubator.egg.id;
    const hatchDuration = itemData[eggId]?.hatchDuration;
    if (!hatchDuration) return;
    player.incubator.hatchDuration = hatchDuration;
    player.incubator.hatchCompleteTime = new Date(Date.now() + hatchDuration);
    
    pushLog(player, `[부화기] ${player.incubator.egg.name} 부화를 시작합니다!`);
    sendInventoryUpdate(player); 
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



        await sendMail(player.user, '거래소', {

            item: listing.item,

            description: `등록 취소한 '${listing.item.name}' 아이템이 반환되었습니다.`

        });



        await AuctionItem.findByIdAndDelete(listingId);

        pushLog(player, `[거래소] ${listing.item.name} 등록을 취소하고 아이템을 우편으로 회수했습니다.`);

        io.emit('auctionUpdate');

    } catch (e) {

        console.error('거래소 취소 오류:', e);

        pushLog(player, '[거래소] 등록 취소에 실패했습니다.');

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

server.listen(PORT, () => console.log(`Server is running on http://localhost:${PORT}`));