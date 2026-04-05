const { 

    default: makeWASocket, 

    useMultiFileAuthState, 

    downloadContentFromMessage, 

    disconnectReason,

    delay 

} = require("@whiskeysockets/baileys");

const pino = require("pino");

const axios = require("axios");

const fs = require("fs-extra");



async function startBot() {

    // Session management

    const { state, saveCreds } = await useMultiFileAuthState('session');

    

    const sock = makeWASocket({

        auth: state,

        printQRInTerminal: true,

        logger: pino({ level: 'silent' }),

        browser: ["Saif-Ullah-Bot", "Safari", "3.0"]

    });



    sock.ev.on('creds.update', saveCreds);



    sock.ev.on('messages.upsert', async (chat) => {

        const m = chat.messages[0];

        if (!m.message || m.key.fromMe) return;



        const from = m.key.remoteJid;

        const type = Object.keys(m.message)[0];

        const body = (type === 'conversation') ? m.message.conversation : 

                     (type === 'extendedTextMessage') ? m.message.extendedTextMessage.text : 

                     (type === 'imageMessage') ? m.message.imageMessage.caption : '';



        const prefix = '.';

        const isCmd = body.startsWith(prefix);

        const command = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';

        const args = body.trim().split(/ +/).slice(1);

        const text = args.join(" ");



        // --- Automatic Fake Voice Recording Status ---

        await sock.sendPresenceUpdate('recording', from);



        if (isCmd) {

            switch (command) {



                case 'menu':

                    const helpMenu = `

🚀 *SAIF ULLAH ULTIMATE BOT* 🚀



🔓 *.one* - Unlock View Once Media

🤖 *.ai [sawal]* - Chat with AI

☁️ *.weather [city]* - Check Weather

🎨 *.flux [prompt]* - AI Image Gen

💣 *.bomb [num] [msg] [count]* - Bomber

🎙️ *Status:* Auto-Recording Active



_Example: .bomb 923xxxx Hello 55_

                    `;

                    await sock.sendMessage(from, { text: helpMenu }, { quoted: m });

                    break;



                // 1. One View Unlocker

                case 'one':

                    const quoted = m.message.extendedTextMessage?.contextInfo?.quotedMessage;

                    const viewOnce = quoted?.viewOnceMessageV2 || quoted?.viewOnceMessage;

                    if (!viewOnce) return sock.sendMessage(from, { text: "Reply to a View Once message!" });



                    const mType = Object.keys(viewOnce.message)[0];

                    const stream = await downloadContentFromMessage(viewOnce.message[mType], mType.replace('Message', ''));

                    let buffer = Buffer.from([]);

                    for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }



                    await sock.sendMessage(from, { [mType.replace('Message', '')]: buffer, caption: "Decoded by Saif Ullah ✅" }, { quoted: m });

                    break;



                // 2. AI Reply

                case 'ai':

                    if (!text) return sock.sendMessage(from, { text: "Kuch toh pucho!" });

                    try {

                        const res = await axios.get(`https://api.simsimi.vn/v1/simtalk?text=${encodeURIComponent(text)}&lc=ur`);

                        await sock.sendMessage(from, { text: `🤖 *AI:* ${res.data.message || "No response."}` }, { quoted: m });

                    } catch { sock.sendMessage(from, { text: "AI server temporarily down." }); }

                    break;



                // 3. SMS/Message Bomber

                case 'bomb':

                    if (args.length < 3) return sock.sendMessage(from, { text: "Format: .bomb 923xxxx Message 55" });

                    const target = args[0].includes('@') ? args[0] : `${args[0]}@s.whatsapp.net`;

                    const bombMsg = args[1];

                    const count = Math.min(parseInt(args[2]), 100); // Limit to 100 for safety



                    sock.sendMessage(from, { text: `🚀 Bombing ${args[0]} with ${count} messages...` });

                    for (let i = 0; i < count; i++) {

                        await sock.sendMessage(target, { text: bombMsg });

                        await delay(250); // Small delay to avoid ban

                    }

                    sock.sendMessage(from, { text: "✅ Bombing Complete!" });

                    break;



                // 4. Weather (RapidAPI)

                case 'weather':

                    if (!text) return sock.sendMessage(from, { text: "City name?" });

                    try {

                        const res = await axios.get(`https://open-weather13.p.rapidapi.com/city/${text}/EN`, {

                            headers: {

                                'x-api-key': 'b946987aa1msh624316aa7fa139fp16fa04jsn1c2843f07791',

                                'x-api-host': 'open-weather13.p.rapidapi.com'

                            }

                        });

                        const w = res.data;

                        const report = `☁️ *Weather: ${text}*\n\nTemp: ${w.main.temp}°F\nHumidity: ${w.main.humidity}%\nSky: ${w.weather[0].description}`;

                        await sock.sendMessage(from, { text: report }, { quoted: m });

                    } catch { sock.sendMessage(from, { text: "City not found." }); }

                    break;



                // 5. Flux AI Image (RapidAPI)

                case 'flux':

                    if (!text) return sock.sendMessage(from, { text: "Prompt please!" });

                    try {

                        sock.sendMessage(from, { text: "🎨 AI is drawing... please wait." });

                        const res = await axios.post('https://ai-text-to-image-generator-flux-free-api.p.rapidapi.com/generate', 

                        { prompt: text }, 

                        {

                            headers: {

                                'x-api-key': 'b946987aa1msh624316aa7fa139fp16fa04jsn1c2843f07791',

                                'x-api-host': 'ai-text-to-image-generator-flux-free-api.p.rapidapi.com'

                            }

                        });

                        await sock.sendMessage(from, { image: { url: res.data.url }, caption: `Flux: ${text}` }, { quoted: m });

                    } catch { sock.sendMessage(from, { text: "Image generation failed." }); }

                    break;

            }

        }

    });



    sock.ev.on('connection.update', (update) => {

        const { connection, lastDisconnect } = update;

        if (connection === 'close') {

            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== disconnectReason.loggedOut;

            if (shouldReconnect) startBot();

        } else if (connection === 'open') {

            console.log('--- BOT IS LIVE ---');

        }

    });

}



startBot();
