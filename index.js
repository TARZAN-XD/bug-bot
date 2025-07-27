
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    makeInMemoryStore,
    jidDecode
} = require('@whiskeysockets/baileys');

const express = require('express');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const chalk = require('chalk');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const usePairingCode = true;

const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });
let sockInstance;

async function StartBot() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');

    sockInstance = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: !usePairingCode,
        auth: state,
        browser: ['Ubuntu', 'Chrome', '20.0.04']
    });

    sockInstance.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
            console.log(chalk.red(`❌ تم قطع الاتصال، السبب: ${reason}`));
            if (reason === DisconnectReason.loggedOut) {
                console.log(chalk.red('تم تسجيل الخروج، أعد تشغيل البوت.'));
                process.exit();
            } else {
                StartBot();
            }
        }

        if (connection === 'open') {
            console.log(chalk.green('✅ تم الاتصال بواتساب بنجاح!'));
        }
    });

    sockInstance.ev.on('creds.update', saveCreds);
}

// API لتوليد رمز الاقتران
app.post('/pair', async (req, res) => {
    try {
        const { number } = req.body;
        if (!number) return res.status(400).json({ error: 'يرجى إدخال رقم الهاتف' });

        if (!sockInstance) return res.status(500).json({ error: 'البوت غير جاهز حالياً، حاول بعد قليل' });

        const code = await sockInstance.requestPairingCode(number.trim());
        res.json({ code });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'حدث خطأ أثناء توليد الرمز' });
    }
});

app.listen(PORT, () => {
    console.log(chalk.green(`🚀 السيرفر يعمل على المنفذ ${PORT}`));
});

console.log(chalk.green('\n[ BOT ONLINE ]\n────────────────────────────'));
StartBot();
