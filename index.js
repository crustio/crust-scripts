const { ApiPromise, Keyring, WsProvider } = require("@polkadot/api");
const { typesBundleForPolkadot } = require("@crustio/type-definitions");
const fs= require('fs');
const { Sequelize, DataTypes} = require('sequelize');
require('dotenv').config()
const seed = process.env.SEED
const endPoint = process.env.WS_ENDPOINT || 'wss://rpc-crust-mainnet.decoo.io'
const fileSize = process.env.DEFAULT_FILE_SIZE || 5368709120
const filePath = process.env.FILE_PATH || './example/cidList.txt';
const api = new ApiPromise({
    provider: new WsProvider(endPoint),
    typesBundle: typesBundleForPolkadot,
});

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: `./db/db.sqlite`,
    logging: true
});

async function initDb() {
    await sequelize.sync();
}

async function disconnect() {
    await sequelize.close();
}

start().catch();

const Files = sequelize.define("files", {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    cid: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    blockHash: {
        type: DataTypes.STRING,
        allowNull: false,
    }
}, {
    timestamps: true,
});

async function start() {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const cidList = fileContent.split('\n');
    await initDb();
    const set = new Set();
    for (const cid of cidList) {
        if (cid.length > 0 && (cid.length === 46 || cid.length === 59)) {
            set.add(cid);
        }
    }
    while (set.size > 0) {
        for (const cid of set) {
            const exist = await Files.findOne({
                where: {
                    cid
                }
            });
            if (exist) {
                set.delete(cid)
            }
            try {
                await placeOrder(cid)
                set.delete(cid);
            } catch (e) {
                console.error(`place order cid: ${cid} failed ${e.message}`)
            } finally {
                await sleep(500)
            }
        }
    }


    await disconnect();
    process.exit();
}

async function placeOrder(cid) {
    await api.isReadyOrError;
    const pso = api.tx.market.placeStorageOrder(cid, fileSize, '0', undefined);
    const kr = new Keyring({
        type: 'sr25519',
    }).addFromUri(seed);
    const blockHash = await sendTx(kr, pso)
    await Files.create({
        cid,
        blockHash
    });
    console.log(`place order cid: ${cid} at blockHash: ${blockHash}`)
}

function sleep(delay) {
    return new Promise(resolve => setTimeout(resolve, delay));
}

async function sendTx(krp, tx) {
    return new Promise((resolve, reject) => {
        tx.signAndSend(krp, ({ events = [], status }) => {
            if (
                status.isInvalid ||
                status.isDropped ||
                status.isUsurped ||
                status.isRetracted
            ) {
                reject(new Error('order failed'));
            }
            if (status.isInBlock) {
                events.forEach(({ event: { method, section } }) => {
                    if (section === 'system' && method === 'ExtrinsicFailed') {
                        resolve(false);
                    }
                });
                resolve(status.asInBlock.toHex());
            }
        }).catch((e) => {
            reject(e);
        });
    });
}
