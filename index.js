// ────────────────
// INDEX.JS BOT WA
// ────────────────
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    jidDecode
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const chalk = require("chalk");
const path = require("path");
const fs = require("fs");

// تحميل الإعدادات
require("./config");

// تحميل الأوامر
const gizzyHandler = require("./system/gizzy");

// إعداد Express
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

let sockInstance;

// بدء البوت
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("session");

    sockInstance = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        logger: pino({ level: "silent" }),
        browser: ["GizzyBot", "Chrome", "3.0"]
    });

    // حفظ الجلسة عند التحديث
    sockInstance.ev.on("creds.update", saveCreds);

    // استقبال الرسائل وتمريرها للأوامر
    sockInstance.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message) return;

        try {
            await gizzyHandler(sockInstance, m, {}, {});
        } catch (err) {
            console.error(chalk.red(`❌ خطأ في gizzy.js: ${err.message}`));
        }
    });

    // مراقبة الاتصال
    sockInstance.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log(chalk.red(`❌ الاتصال انقطع: ${reason}`));
            if (reason !== DisconnectReason.loggedOut) {
                console.log(chalk.green("🔄 إعادة الاتصال..."));
                startBot(); // إعادة التشغيل تلقائيًا
            }
        } else if (connection === "open") {
            console.log(chalk.green("✅ تم الاتصال بنجاح!"));
        }
    });

    // إضافة دوال مساعدة
    sockInstance.decodeJid = (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {};
            return decode.user && decode.server ? decode.user + '@' + decode.server : jid;
        } else return jid;
    };

    sockInstance.sendText = (jid, text, quoted = '', options) =>
        sockInstance.sendMessage(jid, { text, ...options }, { quoted });
}

// ✅ API لطلب رمز الاقتران
app.post("/pair", async (req, res) => {
    try {
        const { number } = req.body;
        if (!number) return res.status(400).json({ error: "يرجى إدخال رقم الهاتف" });

        if (!sockInstance) return res.status(500).json({ error: "البوت غير جاهز حالياً" });

        const pairingCode = await sockInstance.requestPairingCode(number.trim());
        res.json({ code: pairingCode });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "حدث خطأ أثناء توليد الرمز" });
    }
});

// ✅ API لفحص حالة الجلسة
app.get("/status", (req, res) => {
    if (!sockInstance) return res.json({ status: "not_ready" });
    res.json({ status: "connected" });
});

// تشغيل السيرفر
app.listen(PORT, () => {
    console.log(chalk.green(`🚀 السيرفر يعمل على http://localhost:${PORT}`));
});

console.log(chalk.green.bold(`
[ BOT ONLINE ]
────────────────────────────
 Author  : Gizzy Official
 Version : 24.0 VIP
────────────────────────────`));

startBot();
