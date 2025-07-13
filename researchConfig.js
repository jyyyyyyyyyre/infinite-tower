// [수정] const를 var로 변경하여 브라우저의 window 객체에 자동으로 할당되도록 합니다.
var researchConfig = {
    warlord: {
        name: '워로드',
        researches: [
            {
                id: 'warlord_attack_1',
                name: '[초급] 기초 공격력 증강',
                maxLevel: 20,
                description: (level) => `공격력이 영구적으로 ${level * 0.5}% 증가합니다.`,
                cost: (level) => 10 + Math.floor(Math.pow(level, 2)),
                getBonus: (level) => ({ attackPercent: level * 0.005 }),
            },
            {
                id: 'warlord_crit_chance_1',
                name: '[초급] 치명타 확률 증강',
                maxLevel: 10,
                description: (level) => `치명타 확률이 영구적으로 ${level * 0.1}% 증가합니다.`,
                cost: (level) => 20 + Math.floor(Math.pow(level, 2.2)),
                requires: { techId: 'warlord_attack_1', level: 5 },
                getBonus: (level) => ({ critChance: level * 0.001 }),
            },
            {
                id: 'warlord_crit_damage_1',
                name: '[중급] 치명타 피해량 증강',
                maxLevel: 20,
                description: (level) => `치명타 피해량이 영구적으로 ${level * 1}% 증가합니다.`,
                cost: (level) => 50 + Math.floor(Math.pow(level, 2.5)),
                requires: { techId: 'warlord_crit_chance_1', level: 5 },
                getBonus: (level) => ({ critDamage: level * 0.01 }),
            },
            {
                id: 'warlord_penetration_1',
                name: '[중급] 관통력 증강',
                maxLevel: 15,
                description: (level) => `관통력이 영구적으로 ${level * 0.2}% 증가합니다.`,
                cost: (level) => 70 + Math.floor(Math.pow(level, 2.6)),
                requires: { techId: 'warlord_crit_chance_1', level: 5 },
                getBonus: (level) => ({ penetration: level * 0.002 }),
            },
            {
                id: 'warlord_focus_1',
                name: '[상급] 집중력 강화',
                maxLevel: 10,
                description: (level) => `집중력이 영구적으로 ${level * 0.2}% 증가합니다.`,
                cost: (level) => 150 + Math.floor(Math.pow(level, 2.8)),
                requires: { techId: 'warlord_crit_damage_1', level: 10 },
                getBonus: (level) => ({ focus: level * 0.002 }),
            },
            {
                id: 'warlord_infinite',
                name: '[무한] 끝없는 투쟁',
                maxLevel: Infinity,
                description: (level) => `모든 공격 관련 능력치가 영구적으로 ${level * 0.01}% 증가합니다.`,
                cost: (level) => 1000 + Math.floor(Math.pow(level, 3)),
                requires: { techId: 'warlord_focus_1', level: 10 },
                getBonus: (level) => ({
                    attackPercent: level * 0.0001,
                    critChance: level * 0.0001,
                    critDamage: level * 0.0001,
                    penetration: level * 0.0001,
                    focus: level * 0.0001
                }),
            }
        ]
    },
    guardian: {
        name: '가디언',
        researches: [
            {
                id: 'guardian_hp_1',
                name: '[초급] 기초 체력 증강',
                maxLevel: 20,
                description: (level) => `최대 체력이 영구적으로 ${level * 0.8}% 증가합니다.`,
                cost: (level) => 10 + Math.floor(Math.pow(level, 2)),
                getBonus: (level) => ({ hpPercent: level * 0.008 }),
            },
            {
                id: 'guardian_def_1',
                name: '[초급] 기초 방어력 증강',
                maxLevel: 20,
                description: (level) => `방어력이 영구적으로 ${level * 0.5}% 증가합니다.`,
                cost: (level) => 10 + Math.floor(Math.pow(level, 2)),
                requires: { techId: 'guardian_hp_1', level: 5 },
                getBonus: (level) => ({ defensePercent: level * 0.005 }),
            },
            {
                id: 'guardian_crit_resist_1',
                name: '[중급] 치명타 저항 증강',
                maxLevel: 15,
                description: (level) => `치명타 저항이 영구적으로 ${level * 0.2}% 증가합니다.`,
                cost: (level) => 60 + Math.floor(Math.pow(level, 2.5)),
                requires: { techId: 'guardian_def_1', level: 10 },
                getBonus: (level) => ({ critResistance: level * 0.002 }),
            },
            {
                id: 'guardian_tenacity_1',
                name: '[상급] 강인함 강화',
                maxLevel: 10,
                description: (level) => `강인함이 영구적으로 ${level * 0.2}% 증가합니다.`,
                cost: (level) => 150 + Math.floor(Math.pow(level, 2.8)),
                requires: { techId: 'guardian_crit_resist_1', level: 5 },
                getBonus: (level) => ({ tenacity: level * 0.002 }),
            },
            {
                id: 'guardian_infinite',
                name: '[무한] 끝없는 수호',
                maxLevel: Infinity,
                description: (level) => `모든 방어 관련 능력치가 영구적으로 ${level * 0.01}% 증가합니다.`,
                cost: (level) => 1000 + Math.floor(Math.pow(level, 3)),
                requires: { techId: 'guardian_tenacity_1', level: 10 },
                getBonus: (level) => ({
                    hpPercent: level * 0.0001,
                    defensePercent: level * 0.0001,
                    critResistance: level * 0.0001,
                    tenacity: level * 0.0001
                }),
            }
        ]
    },
    berserker: {
        name: '버서커',
        researches: [
            {
                id: 'berserker_bloodthirst_1',
                name: '[초급] 피의 갈망',
                maxLevel: 10,
                description: (level) => `공격 시 입힌 피해의 ${level * 0.1}%를 체력으로 흡수합니다.`,
                cost: (level) => 30 + Math.floor(Math.pow(level, 2.5)),
                getBonus: (level) => ({ bloodthirst: level * 0.001 }),
            },
            {
                id: 'berserker_low_hp_attack_1',
                name: '[중급] 증오',
                maxLevel: 20,
                description: (level) => `잃은 체력 1%당 공격력이 ${level * 0.05}% 증폭됩니다.`,
                cost: (level) => 80 + Math.floor(Math.pow(level, 2.6)),
                requires: { techId: 'berserker_bloodthirst_1', level: 5 },
                getBonus: (level) => ({ lowHpAttackPercent: level * 0.0005 }), // 특수 계산 필요
            },
            {
                id: 'berserker_infinite',
                name: '[무한] 끝없는 분노',
                maxLevel: Infinity,
                description: (level) => `공격력과 피의 갈망이 영구적으로 ${level * 0.01}% 증가합니다.`,
                cost: (level) => 1000 + Math.floor(Math.pow(level, 3)),
                requires: { techId: 'berserker_low_hp_attack_1', level: 10 },
                getBonus: (level) => ({
                    attackPercent: level * 0.0001,
                    bloodthirst: level * 0.0001
                }),
            }
        ]
    },
    pioneer: {
        name: '개척자',
        researches: [
            {
                id: 'pioneer_gold_1',
                name: '[초급] 골드 획득량 증가',
                maxLevel: 50,
                description: (level) => `골드 획득량이 영구적으로 ${level * 1}% 증가합니다.`,
                cost: (level) => 5 + Math.floor(Math.pow(level, 1.8)),
                getBonus: (level) => ({ goldGainPercent: level * 0.01 }),
            },
            {
                id: 'pioneer_drop_rate_1',
                name: '[중급] 아이템 드롭률 증가',
                maxLevel: 20,
                description: (level) => `아이템 드롭률이 영구적으로 ${level * 0.5}% 증가합니다.`,
                cost: (level) => 50 + Math.floor(Math.pow(level, 2.4)),
                requires: { techId: 'pioneer_gold_1', level: 10 },
                getBonus: (level) => ({ itemDropRatePercent: level * 0.005 }),
            },
            {
                id: 'pioneer_climb_1',
                name: '[상급] 추가 등반 확률',
                maxLevel: 10,
                description: (level) => `층 클리어 시 ${level * 0.2}% 확률로 1층을 추가 등반합니다.`,
                cost: (level) => 200 + Math.floor(Math.pow(level, 2.9)),
                requires: { techId: 'pioneer_drop_rate_1', level: 5 },
                getBonus: (level) => ({ bonusClimbChance: level * 0.002 }),
            },
            {
                id: 'pioneer_offline_1',
                name: '[상급] 오프라인 보상 효율',
                maxLevel: 20,
                description: (level) => `오프라인 보상 효율이 영구적으로 ${level * 1}% 증가합니다.`,
                cost: (level) => 150 + Math.floor(Math.pow(level, 2.7)),
                requires: { techId: 'pioneer_drop_rate_1', level: 5 },
                getBonus: (level) => ({ offlineRewardPercent: level * 0.01 }),
            },
            {
                id: 'pioneer_infinite',
                name: '[무한] 끝없는 개척',
                maxLevel: Infinity,
                description: (level) => `모든 성장 관련 능력치가 영구적으로 ${level * 0.01}% 증가합니다.`,
                cost: (level) => 1000 + Math.floor(Math.pow(level, 3)),
                requires: { techId: 'pioneer_climb_1', level: 10 },
                getBonus: (level) => ({
                    goldGainPercent: level * 0.0001,
                    itemDropRatePercent: level * 0.0001,
                    offlineRewardPercent: level * 0.0001
                }),
            }
        ]
    }
};

// [수정] Node.js 환경(서버)에서 실행될 경우를 위한 코드 추가
if (typeof module !== 'undefined' && module.exports) {
    module.exports = researchConfig;
}