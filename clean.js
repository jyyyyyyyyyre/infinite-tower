
require('dotenv').config();
const mongoose = require('mongoose');

const GameDataSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    inventory: { type: [Object], default: [] },
}, { strict: false });

const GameData = mongoose.model('GameData', GameDataSchema);
const MONGO_URI = process.env.MONGO_URI;

async function stackExistingItems() {
    console.log('데이터베이스 연결을 시작합니다...');
    await mongoose.connect(MONGO_URI);
    console.log('데이터베이스에 성공적으로 연결되었습니다.');

    console.log('모든 유저의 게임 데이터를 불러옵니다...');
    const cursor = GameData.find().cursor();
    let processedCount = 0;

    for (let gameData = await cursor.next(); gameData != null; gameData = await cursor.next()) {
        const originalInventory = gameData.inventory;
        if (!originalInventory || originalInventory.length === 0) {
            continue;
        }

        const stackableItems = new Map();
        const unstackableItems = [];
        let inventoryModified = false;

        for (const item of originalInventory) {
            const isStackable = (item.category === 'Scroll' || item.category === 'Hammer') && (!item.enhancement || item.enhancement === 0);

            if (isStackable) {
                if (stackableItems.has(item.id)) {
                    const existingItem = stackableItems.get(item.id);
                    existingItem.quantity += item.quantity || 1;
                    inventoryModified = true; 
                } else {
                    stackableItems.set(item.id, item);
                }
            } else {
                unstackableItems.push(item);
            }
        }

        if (inventoryModified) {
            const newInventory = [...unstackableItems, ...stackableItems.values()];
            gameData.inventory = newInventory;
            await gameData.save();
            processedCount++;
            console.log(`- ${processedCount}번째 유저의 인벤토리를 정리했습니다.`);
        }
    }

    console.log(`\n총 ${processedCount}명의 유저 인벤토리 정리를 완료했습니다.`);
    await mongoose.disconnect();
    console.log('데이터베이스 연결을 종료합니다.');
}

stackExistingItems().catch(err => {
    console.error('스크립트 실행 중 오류가 발생했습니다:', err);
    mongoose.disconnect();
});