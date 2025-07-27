const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    makeInMemoryStore,
    jidDecode
} = require('@whiskeysockets/baileys');

const pino = require('pino');
const { Boom } = require('@hapi/boom');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const express = require('express');

const { smsg } = require('./system/lib/myfunction');
const config = require('./system/config');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });
const usePairingCode = true;

let sockInstance;

async function StartZenn() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');

    sockInstance = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !usePairingCode,
        auth: state,
        browser: ['Ubuntu', 'Chrome', '20.0.04']
    });

    sockInstance.public = global.publik;

    sockInstance.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
            const reasonMap = {
                [DisconnectReason.badSession]: 'Bad Session, احذف الجلسة وأعد المسح!',
                [DisconnectReason.connectionClosed]: 'الاتصال مغلق، إعادة المحاولة...',
                [DisconnectReason.connectionLost]: 'تم فقدان الاتصال بالسيرفر، إعادة المحاولة...',
                [DisconnectReason.connectionReplaced]: 'الجلسة استبدلت، أغلق الجلسة القديمة!',
                [DisconnectReason.loggedOut]: 'تم تسجيل الخروج، أعد الاقتران!',
                [DisconnectReason.restartRequired]: 'إعادة التشغيل مطلوبة...',
                [DisconnectReason.timedOut]: 'انتهت مهلة الاتصال، إعادة المحاولة...'
            };

            console.log(reasonMap[statusCode] || `سبب غير معروف: ${statusCode}`);
            (statusCode === DisconnectReason.badSession || statusCode === DisconnectReason.connectionReplaced)
                ? process.exit()
                : StartZenn();
        }

        if (connection === 'open') {
            console.log(chalk.green.bold('✅ [ WhatsApp متصل بنجاح! ]'));
        }
    });

    sockInstance.ev.on('messages.upsert', async ({ messages, type }) => {
        try {
            if (type !== 'notify') return;
            const msg = messages[0] || messages[messages.length - 1];
            if (!msg.message) return;
            if (msg.key && msg.key.remoteJid == 'status@broadcast') return;

            const m = smsg(sockInstance, msg, store);
            require('./system/gizzy')(sockInstance, m, msg, store);
        } catch (err) {
            console.log(err);
        }
    });

    sockInstance.decodeJid = (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {};
            return decode.user && decode.server ? decode.user + '@' + decode.server : jid;
        } else return jid;
    };

    sockInstance.sendText = (jid, text, quoted = '', options) =>
        sockInstance.sendMessage(jid, { text, ...options }, { quoted });

    sockInstance.ev.on('contacts.update', (contacts) => {
        for (let contact of contacts) {
            let id = sockInstance.decodeJid(contact.id);
            if (store && store.contacts) store.contacts[id] = { id, name: contact.notify };
        }
    });

    sockInstance.ev.on('creds.update', saveCreds);
}

// ✅ API لطلب رمز الاقتران
app.post('/pair', async (req, res) => {
    try {
        const { number } = req.body;
        if (!number) return res.status(400).json({ error: 'يرجى إدخال رقم الهاتف' });

        if (!sockInstance) return res.status(500).json({ error: 'البوت غير جاهز حالياً' });

        const pairingCode = await sockInstance.requestPairingCode(number.trim());
        res.json({ code: pairingCode });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'حدث خطأ أثناء توليد الرمز' });
    }
});

app.listen(PORT, () => {
    console.log(chalk.green(`🚀 السيرفر يعمل على http://localhost:${PORT}`));
});

console.log(chalk.green.bold('\n[ BOT ONLINE ]\n────────────────────────────\n 𝙰𝚞𝚝𝚑𝚘𝚛 : Justin Official\n 𝚅𝚎𝚛𝚜𝚒𝚘𝚗 : 23.0 VIP\n────────────────────────────'));
StartZenn();
