// --- THE THINGSPEAK & CHART AYARLARI ---
const TS_CHANNEL_ID = "3295895";
const TS_READ_API_KEY = "ZPIELNVVD3ZPO8EW";

let sensorChart; // Chart nesnemiz bağlandıktan sonra kullanılacak (Global)
let sonGelenSicaklik = null;

// Broker Ayarları
const MQTT_SERVER = "broker.hivemq.com";
const MQTT_PORT = 8884; // Hızlı WSS bağlantısı için HiveMQ portu 8884 (SSL destekli)
const CLIENT_ID = "WebClient-" + Math.floor(Math.random() * 10000);

// Topic Ayarları (ESP32 ile birebir aynı olmalı)
const TOPIC_LED1_CMD = "feramuz_iot_9876/led1/komut";
const TOPIC_LED1_STATUS = "feramuz_iot_9876/led1/durum";

const TOPIC_LED2_CMD = "feramuz_iot_9876/led2/komut";
const TOPIC_LED2_STATUS = "feramuz_iot_9876/led2/durum";

const TOPIC_ESP32_STATUS = "feramuz_iot_9876/esp32/durum"; // LWT Online/Offline

const TOPIC_SENSOR_TEMP = "feramuz_iot_9876/sensor/sicaklik";
const TOPIC_SENSOR_HUM = "feramuz_iot_9876/sensor/nem";

// Arayüz Elementlerini Seçme
const statusBadge = document.getElementById('connection-status');
const esp32StatusBadge = document.getElementById('esp32-status');
const led1Badge = document.getElementById('led1-badge');
const led2Badge = document.getElementById('led2-badge');

const tempValueElement = document.getElementById('temp-value');
const humValueElement = document.getElementById('hum-value');

// Paho MQTT Client'ı Oluşturma
const client = new Paho.MQTT.Client(MQTT_SERVER, MQTT_PORT, CLIENT_ID);

// Callback Fonksiyonlarını Ayarlama
client.onConnectionLost = onConnectionLost;
client.onMessageArrived = onMessageArrived;

// Sayfa Yüklendiğinde Başlat (ThingSpeak'den Eski Veriyi Çek + Cihazı Bağla)
window.onload = () => {
    initChart();       // Önce Geçmiş Veriyi Getir & Grafiği Çiz
    
    // Sonra MQTT Başlat
    console.log("Bağlanılıyor: " + MQTT_SERVER + ":" + MQTT_PORT);
    client.connect({
        onSuccess: onConnect,
        onFailure: onFailure,
        useSSL: true // GitHub Pages (HTTPS) üzerinden çalışması için ZORUNLU!
    });
};

// MQTT Bağlantısı Başarılı Olduğunda
function onConnect() {
    console.log("MQTT Broker'a Bağlanıldı!");
    
    // UI Güncelleme
    statusBadge.className = 'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-white/5 border border-white/10 text-emerald-400';
    statusBadge.innerHTML = '<span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span> Broker\'a Bağlı';
    
    // ESP32'den gelen durum mesajlarını dinlemeye başla (Subscribe)
    client.subscribe(TOPIC_LED1_STATUS);
    client.subscribe(TOPIC_LED2_STATUS);
    client.subscribe(TOPIC_ESP32_STATUS); // Online/Offline durumunu dinle
    
    // Sensör verilerini dinlemeye başla
    client.subscribe(TOPIC_SENSOR_TEMP);
    client.subscribe(TOPIC_SENSOR_HUM);
    
    console.log("Durum odalarına abone olundu.");
}

// MQTT Bağlantısı Başarısız Olduğunda
function onFailure(error) {
    console.error("Bağlantı Hatası: ", error.errorMessage);
    statusBadge.className = 'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-white/5 border border-white/10 text-red-500';
    statusBadge.innerHTML = '<span class="w-2.5 h-2.5 rounded-full bg-red-500"></span> Bağlantı Hatası!';
}

// Bağlantı Koptuğunda
function onConnectionLost(responseObject) {
    if (responseObject.errorCode !== 0) {
        console.error("Bağlantı Koptu: " + responseObject.errorMessage);
        statusBadge.className = 'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-white/5 border border-white/10 text-red-500';
        statusBadge.innerHTML = '<span class="w-2.5 h-2.5 rounded-full bg-red-500"></span> Bağlantı Koptu';
        
        // Yeniden Bağlanma Denemesi
        setTimeout(() => {
            statusBadge.className = 'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-white/5 border border-white/10 text-yellow-500';
            statusBadge.innerHTML = '<span class="w-2.5 h-2.5 rounded-full bg-yellow-500 animate-pulse"></span> Yeniden Bağlanılıyor...';
            client.connect({ onSuccess: onConnect, useSSL: true });
        }, 5000);
    }
}

// Timeouts
let esp32Timeout = null;

// ESP32'yi Çevrimdışı (Offline) Yapma Fonksiyonu
function setEsp32Offline() {
    esp32StatusBadge.className = "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-white/5 border border-white/10 text-red-500";
    esp32StatusBadge.innerHTML = '<span class="w-2.5 h-2.5 rounded-full bg-red-500"></span> ESP32 Çevrimdışı';
    
    // ESP çevrimdışı olunca LED'leri de bilinmeyen/kapalı duruma çekebiliriz
    led1Badge.textContent = "BİLİNMİYOR";
    led1Badge.className = "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-500/10 text-slate-500 border border-slate-500/20";
    led2Badge.textContent = "BİLİNMİYOR";
    led2Badge.className = "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-500/10 text-slate-500 border border-slate-500/20";
    
    // Sensör verilerini de sıfırla
    tempValueElement.innerHTML = '-- <span class="text-sm font-normal text-red-200">°C</span>';
    humValueElement.innerHTML = '-- <span class="text-sm font-normal text-blue-200">%</span>';
}

// Mesaj Geldiğinde (Durum Güncellemeleri)
function onMessageArrived(message) {
    const topic = message.destinationName;
    const payload = message.payloadString;
    console.log("Gelen Mesaj -> Topic: " + topic + " - Mesaj: " + payload);

    // ESP32 Online/Offline Durumu (LWT ve Heartbeat)
    if (topic === TOPIC_ESP32_STATUS) {
        if (payload === "online") {
            esp32StatusBadge.className = "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-white/5 border border-white/10 text-emerald-400";
            esp32StatusBadge.innerHTML = '<span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span> ESP32 Çevrimiçi';
            
            // Heartbeat Reset (15 saniye boyunca yeni mesaj gelmezse Offline say)
            clearTimeout(esp32Timeout);
            esp32Timeout = setTimeout(setEsp32Offline, 15000);
            
        } else if (payload === "offline") {
            // Cihaz bilerek "offline" yolladıysa hemen çevrimdışı yap
            clearTimeout(esp32Timeout);
            setEsp32Offline();
        }
    }
    
    // Sensör Verileri Gelirse UI'ı Güncelle
    if (topic === TOPIC_SENSOR_TEMP) {
        tempValueElement.innerHTML = `${payload} <span class="text-sm font-normal text-red-200">°C</span>`;
        // Sensör verisi geliyorsa da online'dır, süreyi sıfırla
        clearTimeout(esp32Timeout);
        esp32Timeout = setTimeout(setEsp32Offline, 15000);
        
        // Veriyi geçici olarak tut (Çünkü hem sicaklık hem nem lazim grafiğe ayni anda)
        sonGelenSicaklik = payload;
    }
    else if (topic === TOPIC_SENSOR_HUM) {
        humValueElement.innerHTML = `${payload} <span class="text-sm font-normal text-blue-200">%</span>`;
        
        // Eğer sicaklık az önce geldiyse, simdi Nem ile birlikte grafiği canli güncelle
        if(sonGelenSicaklik !== null && sensorChart){
            const currentTime = new Date().toLocaleTimeString('tr-TR', { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' });
            
            // Grafiğe yeni veriyi ekle
            sensorChart.data.labels.push(currentTime);
            sensorChart.data.datasets[0].data.push(sonGelenSicaklik); // Sıcaklık
            sensorChart.data.datasets[1].data.push(payload); // Nem
            
            // Eğer grafik 50 veriyi (noktayõ) geçerse sağa doğru kaydırılarak eskiyi silsin
            if (sensorChart.data.labels.length > 50) {
                sensorChart.data.labels.shift();
                sensorChart.data.datasets[0].data.shift();
                sensorChart.data.datasets[1].data.shift();
            }
            sensorChart.update();
        }
    }
    
    // 1. LED Durumu
    if (topic === TOPIC_LED1_STATUS) {
        if (payload === "1") {
            led1Badge.textContent = "AÇIK";
            led1Badge.className = "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
        } else if (payload === "0") {
            led1Badge.textContent = "KAPALI";
            led1Badge.className = "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-500/10 text-red-500 border border-red-500/20";
        }
    }
    
    // 2. LED Durumu
    else if (topic === TOPIC_LED2_STATUS) {
        if (payload === "1") {
            led2Badge.textContent = "AÇIK";
            led2Badge.className = "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
        } else if (payload === "0") {
            led2Badge.textContent = "KAPALI";
            led2Badge.className = "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-500/10 text-red-500 border border-red-500/20";
        }
    }
}

// Mesaj Gönderme (Publish) Fonksiyonu
function publishMessage(topic, payload) {
    if (client.isConnected()) {
        const message = new Paho.MQTT.Message(payload);
        message.destinationName = topic;
        client.send(message);
        console.log("Gönderildi -> Topic: " + topic + " - Mesaj: " + payload);
    } else {
        alert("Mesaj Gönderilemedi! Lütfen Broker bağlantısını bekleyin.");
    }
}

// --- BUTON ETKİLEŞİMLERİ ---

// 1. LED Butonları
document.getElementById('btn-led1-on').addEventListener('click', () => {
    publishMessage(TOPIC_LED1_CMD, "1");
});

document.getElementById('btn-led1-off').addEventListener('click', () => {
    publishMessage(TOPIC_LED1_CMD, "0");
});

// 2. LED Butonları
document.getElementById('btn-led2-on').addEventListener('click', () => {
    publishMessage(TOPIC_LED2_CMD, "1");
});

document.getElementById('btn-led2-off').addEventListener('click', () => {
    publishMessage(TOPIC_LED2_CMD, "0");
});

// ==========================================
// THINGSPEAK'TEN GEÇMİŞ VERİLERİ ÇEKME & CHART.JS
// ==========================================

let currentMinutes = 60; // Varsayılan olarak son 1 Saati göster (60 dakika)

function initChart() {
    const ctx = document.getElementById('sensorChart').getContext('2d');
    
    // Boş bir grafikle başla
    sensorChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [], 
            datasets: [
                {
                    label: 'Sıcaklık (°C)',
                    borderColor: 'rgb(239, 68, 68)', // Tailwind red-500
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    data: [],
                    yAxisID: 'y',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 0 // Noktaları gizle, akıcı dursun
                },
                {
                    label: 'Nem (%)',
                    borderColor: 'rgb(59, 130, 246)', // Tailwind blue-500
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    data: [],
                    yAxisID: 'y1',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            color: '#cbd5e1', // Yazı renkleri
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { maxTicksLimit: 10 }
                },
                y: {
                    type: 'linear', display: true, position: 'left',
                    title: { display: true, text: 'Sıcaklık (°C)', color: 'rgb(239, 68, 68)' },
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    // Dağ gibi dalgalanma olmasın, referans skala verelim (Esnek Scaling)
                    suggestedMin: 15, // Sıcaklık genellikle 15-35 arasıdır (Gerekirse bu sınırı aşar ama içi hep boş durmaz)
                    suggestedMax: 35
                },
                y1: {
                    type: 'linear', display: true, position: 'right',
                    title: { display: true, text: 'Nem (%)', color: 'rgb(59, 130, 246)' },
                    grid: { drawOnChartArea: false },
                    // Nem için de benzer şekilde yumuşak geçiş aralığı (Örn Türkiye ortalaması 30-80)
                    suggestedMin: 20,
                    suggestedMax: 80
                }
            },
            plugins: {
                legend: { labels: { color: '#cbd5e1' } }
            }
        }
    });

    // İlk açılışta 1 Saatlik Veriyi Çek (60 dk)
    fetchChartData(currentMinutes);
}

// Veri Çekme Fonksiyonu
async function fetchChartData(minutes) {
    // Önce Grafikteki Eski Verileri Temizle
    if (sensorChart) {
        sensorChart.data.labels = [];
        sensorChart.data.datasets[0].data = [];
        sensorChart.data.datasets[1].data = [];
        sensorChart.update();
    }

    // API Parametresi: Son X dakikaya ait verileri getir
    const tsUrl = `https://api.thingspeak.com/channels/${TS_CHANNEL_ID}/feeds.json?api_key=${TS_READ_API_KEY}&minutes=${minutes}`;
    
    try {
        const response = await fetch(tsUrl);
        const data = await response.json();
        
        if(data && data.feeds && data.feeds.length > 0){
            data.feeds.forEach(feed => {
                const t = new Date(feed.created_at);
                // Eğer gün (24 Saat) modu seçiliyse saat yanına günü de koy, saat moduysa sadece saat kalsın
                let timeOptions = { hour12: false, hour: '2-digit', minute:'2-digit' };
                if (minutes > 720) timeOptions = {  day:'2-digit', month:'2-digit', hour12: false, hour: '2-digit', minute:'2-digit' };

                const timeLabel = t.toLocaleTimeString('tr-TR', timeOptions);
                const sicaklik = parseFloat(feed.field1);
                const nem = parseFloat(feed.field2);
                
                if(!isNaN(sicaklik) && !isNaN(nem)){
                    sensorChart.data.labels.push(timeLabel);
                    sensorChart.data.datasets[0].data.push(sicaklik);
                    sensorChart.data.datasets[1].data.push(nem);
                }
            });
            sensorChart.update();
            console.log(`ThingSpeak'ten son ${minutes} dakikaya ait ${data.feeds.length} veri grafiğe aktarıldı.`);
        } else {
             console.log("Bu zaman aralığında gösterilecek sensör verisi bulunamadı.");
        }
    } catch (error) {
        console.error("Geçmiş veri çekilirken hata oluştu:", error);
    }
}

// Zaman Butonları Click İşlemleri ve Tasarım Geçişleri
const btnButtons = {
    'btn-1h': 60,         // 60 dk (1 Saat)
    'btn-12h': 720,       // 720 dk (12 Saat)
    'btn-24h': 1440       // 1440 dk (24 Saat)
};

const defaultBtnClass = "px-4 py-2 rounded-lg font-medium transition-all hover:bg-slate-700/50 text-slate-400 hover:text-white";
const activeBtnClass = "px-4 py-2 rounded-lg font-medium transition-all bg-emerald-500/20 text-emerald-400";

Object.keys(btnButtons).forEach(btnId => {
    document.getElementById(btnId).addEventListener('click', (e) => {
        // Tüm butonları pasif (gri) yap
        Object.keys(btnButtons).forEach(id => {
            document.getElementById(id).className = defaultBtnClass;
        });
        
        // Tıklanan butonu aktif (Yeşil/Emerald) yap
        e.target.className = activeBtnClass;
        
        // Veriyi Güncelle (Örn: 12 Saat = 720dk)
        currentMinutes = btnButtons[btnId];
        fetchChartData(currentMinutes);
    });
});
