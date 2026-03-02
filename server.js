const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ═══ CONFIG ═══
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK 
 "https://discord.com/api/webhooks/1477882979354148885/TRJLd7W0wB65OdcL8qgX6zad9cFdCIB2I3gZBN9lEG9CcxJBtb8hY164C9GQTsAS7ZoE";
const DISCORD_INTERVAL = 30000; // update discord toutes les 30s

// ═══ STATE ═══
const scanTimestamps = [];
const WINDOW = 300000; // 5 min sliding window
let totalScans = 0;
const startTime = Date.now();

// ═══ ENDPOINTS ═══

// Le scanner envoie ça à chaque hop
app.post('/scan-complete', (req, res) => {
    const now = Date.now();
    totalScans++;
    scanTimestamps.push(now);

    // cleanup vieux timestamps
    while (scanTimestamps.length > 0 && (now - scanTimestamps[0]) > WINDOW) {
        scanTimestamps.shift();
    }

    res.json({ ok: true });
});

app.get('/stats', (req, res) => {
    const now = Date.now();
    while (scanTimestamps.length > 0 && (now - scanTimestamps[0]) > WINDOW) {
        scanTimestamps.shift();
    }

    const elapsed60 = Math.min(60000, now - startTime);
    const recent60 = scanTimestamps.filter(t => (now - t) <= 60000).length;
    const hpm = elapsed60 > 0 ? Math.round(recent60 * (60000 / elapsed60)) : 0;

    const elapsed300 = Math.min(300000, now - startTime);
    const recent300 = scanTimestamps.length;
    const avg5 = elapsed300 > 0 ? Math.round(recent300 * (60000 / elapsed300)) : 0;

    res.json({
        hops_per_min: hpm,
        avg_5min: avg5,
        total: totalScans,
        uptime_min: Math.floor((now - startTime) / 60000),
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', total: totalScans });
});

// ═══ DISCORD EMBED ═══
async function sendDiscordStats() {
    if (!DISCORD_WEBHOOK || DISCORD_WEBHOOK === "METTRE_TON_WEBHOOK_ICI") return;

    const now = Date.now();
    while (scanTimestamps.length > 0 && (now - scanTimestamps[0]) > WINDOW) {
        scanTimestamps.shift();
    }

    const elapsed60 = Math.min(60000, now - startTime);
    const recent60 = scanTimestamps.filter(t => (now - t) <= 60000).length;
    const hpm = elapsed60 > 0 ? Math.round(recent60 * (60000 / elapsed60)) : 0;

    const elapsed300 = Math.min(300000, now - startTime);
    const avg5 = elapsed300 > 0 ? Math.round(scanTimestamps.length * (60000 / elapsed300)) : 0;

    const uptimeMin = Math.floor((now - startTime) / 60000);
    const uptimeH = Math.floor(uptimeMin / 60);
    const uptimeM = uptimeMin % 60;

    try {
        await fetch(DISCORD_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                embeds: [{
                    title: '⚡ Scanner Stats',
                    color: 0x00FF00,
                    fields: [
                        { name: '🔄 Hops/min', value: **${hpm}**, inline: true },
                        { name: '📊 Avg 5min', value: **${avg5}**, inline: true },
                        { name: '📈 Total', value: **${totalScans}**, inline: true },
                        { name: '⏱️ Uptime', value: ${uptimeH}h ${uptimeM}m, inline: true },
                    ],
                    timestamp: new Date().toISOString(),
                }]
            })
        });
    } catch (e) {
        console.error('Discord error:', e.message);
    }
}

setInterval(sendDiscordStats, DISCORD_INTERVAL);

// ═══ START ═══
app.listen(PORT, () => {
    console.log(Hops tracker running on port ${PORT});
});
