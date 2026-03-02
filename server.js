const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

var DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK || "https://discord.com/api/webhooks/1477882979354148885/TRJLd7W0wB65OdcL8qgX6zad9cFdCIB2I3gZBN9lEG9CcxJBtb8hY164C9GQTsAS7ZoE";
var DISCORD_INTERVAL = 30000;

var scanTimestamps = [];
var WINDOW = 300000;
var totalScans = 0;
var startTime = Date.now();

app.post('/scan-complete', function(req, res) {
    var now = Date.now();
    totalScans++;
    scanTimestamps.push(now);
    while (scanTimestamps.length > 0 && (now - scanTimestamps[0]) > WINDOW) {
        scanTimestamps.shift();
    }
    res.json({ ok: true });
});

app.get('/stats', function(req, res) {
    var now = Date.now();
    while (scanTimestamps.length > 0 && (now - scanTimestamps[0]) > WINDOW) {
        scanTimestamps.shift();
    }
    var elapsed60 = Math.min(60000, now - startTime);
    var recent60 = scanTimestamps.filter(function(t) { return (now - t) <= 60000; }).length;
    var hpm = elapsed60 > 0 ? Math.round(recent60 * (60000 / elapsed60)) : 0;
    var elapsed300 = Math.min(300000, now - startTime);
    var recent300 = scanTimestamps.length;
    var avg5 = elapsed300 > 0 ? Math.round(recent300 * (60000 / elapsed300)) : 0;
    res.json({
        hops_per_min: hpm,
        avg_5min: avg5,
        total: totalScans,
        uptime_min: Math.floor((now - startTime) / 60000)
    });
});

app.get('/health', function(req, res) {
    res.json({ status: 'ok', total: totalScans });
});

function sendDiscordStats() {
    if (!DISCORD_WEBHOOK || DISCORD_WEBHOOK === "") return;

    var now = Date.now();
    while (scanTimestamps.length > 0 && (now - scanTimestamps[0]) > WINDOW) {
        scanTimestamps.shift();
    }

    var elapsed60 = Math.min(60000, now - startTime);
    var recent60 = scanTimestamps.filter(function(t) { return (now - t) <= 60000; }).length;
    var hpm = elapsed60 > 0 ? Math.round(recent60 * (60000 / elapsed60)) : 0;

    var elapsed300 = Math.min(300000, now - startTime);
    var avg5 = elapsed300 > 0 ? Math.round(scanTimestamps.length * (60000 / elapsed300)) : 0;

    var uptimeMin = Math.floor((now - startTime) / 60000);
    var uptimeH = Math.floor(uptimeMin / 60);
    var uptimeM = uptimeMin % 60;

    var payload = JSON.stringify({
        embeds: [{
            title: "Hops Stats",
            color: 65280,
            fields: [
                { name: "Hops/min", value: String(hpm), inline: true },
                { name: "Avg 5min", value: String(avg5), inline: true },
                { name: "Total", value: String(totalScans), inline: true },
                { name: "Uptime", value: uptimeH + "h " + uptimeM + "m", inline: true }
            ],
            timestamp: new Date().toISOString()
        }]
    });

    fetch(DISCORD_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload
    }).catch(function(e) {
        console.error("Discord error:", e.message);
    });
}

setInterval(sendDiscordStats, DISCORD_INTERVAL);

app.listen(PORT, function() {
    console.log("Hops tracker running on port " + PORT);
});
