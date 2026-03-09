// Broker Ayarları
const MQTT_SERVER = "broker.hivemq.com";
const MQTT_PORT = 8000; // Dikkat! WebSockets portu genelde 8000 veya 8884'tür (1883 değil)
const CLIENT_ID = "WebClient-" + Math.floor(Math.random() * 10000);

// Topic Ayarları (ESP32 ile birebir aynı olmalı)
const TOPIC_LED1_CMD = "feramuz_iot_9876/led1/komut";
const TOPIC_LED1_STATUS = "feramuz_iot_9876/led1/durum";

const TOPIC_LED2_CMD = "feramuz_iot_9876/led2/komut";
const TOPIC_LED2_STATUS = "feramuz_iot_9876/led2/durum";

const TOPIC_ESP32_STATUS = "feramuz_iot_9876/esp32/durum"; // LWT Online/Offline

// Arayüz Elementlerini Seçme
const statusBadge = document.getElementById('connection-status');
const esp32StatusBadge = document.getElementById('esp32-status');
const led1Badge = document.getElementById('led1-badge');
const led2Badge = document.getElementById('led2-badge');

// Paho MQTT Client'ı Oluşturma
const client = new Paho.MQTT.Client(MQTT_SERVER, MQTT_PORT, CLIENT_ID);

// Callback Fonksiyonlarını Ayarlama
client.onConnectionLost = onConnectionLost;
client.onMessageArrived = onMessageArrived;

// Sayfa Yüklendiğinde Bağlan
console.log("Bağlanılıyor: " + MQTT_SERVER + ":" + MQTT_PORT);
client.connect({
    onSuccess: onConnect,
    onFailure: onFailure,
    useSSL: false // Public Broker için doğrudan SSL'siz hızlı WebSocket bağlantısı
});

// MQTT Bağlantısı Başarılı Olduğunda
function onConnect() {
    console.log("MQTT Broker'a Bağlanıldı!");
    
    // UI Güncelleme
    statusBadge.className = 'status-badge connected';
    statusBadge.innerHTML = '<span class="dot"></span> Broker\'a Bağlı';
    
    // ESP32'den gelen durum mesajlarını dinlemeye başla (Subscribe)
    client.subscribe(TOPIC_LED1_STATUS);
    client.subscribe(TOPIC_LED2_STATUS);
    client.subscribe(TOPIC_ESP32_STATUS); // Online/Offline durumunu dinle
    console.log("Durum odalarına abone olundu.");
}

// MQTT Bağlantısı Başarısız Olduğunda
function onFailure(error) {
    console.error("Bağlantı Hatası: ", error.errorMessage);
    statusBadge.className = 'status-badge disconnected';
    statusBadge.innerHTML = '<span class="dot"></span> Bağlantı Hatası!';
}

// Bağlantı Koptuğunda
function onConnectionLost(responseObject) {
    if (responseObject.errorCode !== 0) {
        console.error("Bağlantı Koptu: " + responseObject.errorMessage);
        statusBadge.className = 'status-badge disconnected';
        statusBadge.innerHTML = '<span class="dot"></span> Bağlantı Koptu';
        
        // Yeniden Bağlanma Denemesi
        setTimeout(() => {
            statusBadge.className = 'status-badge connecting';
            statusBadge.innerHTML = '<span class="dot"></span> Yeniden Bağlanılıyor...';
            client.connect({ onSuccess: onConnect, useSSL: false });
        }, 5000);
    }
}

// Mesaj Geldiğinde (Durum Güncellemeleri)
function onMessageArrived(message) {
    const topic = message.destinationName;
    const payload = message.payloadString;
    console.log("Gelen Mesaj -> Topic: " + topic + " - Mesaj: " + payload);

    // ESP32 Online/Offline Durumu (LWT)
    if (topic === TOPIC_ESP32_STATUS) {
        if (payload === "online") {
            esp32StatusBadge.className = "status-badge connected";
            esp32StatusBadge.innerHTML = '<span class="dot"></span> ESP32 Çevrimiçi';
        } else if (payload === "offline") {
            esp32StatusBadge.className = "status-badge disconnected";
            esp32StatusBadge.innerHTML = '<span class="dot"></span> ESP32 Çevrimdışı';
            
            // ESP çevrimdışı olunca LED'leri de bilinmeyen/kapalı duruma çekebiliriz
            led1Badge.textContent = "BİLİNMİYOR";
            led1Badge.className = "state-badge off";
            led2Badge.textContent = "BİLİNMİYOR";
            led2Badge.className = "state-badge off";
        }
    }
    
    // 1. LED Durumu (Gerçekten Yandı mı?)
    if (topic === TOPIC_LED1_STATUS) {
        if (payload === "1") {
            led1Badge.textContent = "AÇIK";
            led1Badge.className = "state-badge on";
        } else if (payload === "0") {
            led1Badge.textContent = "KAPALI";
            led1Badge.className = "state-badge off";
        }
    }
    
    // 2. LED Durumu
    else if (topic === TOPIC_LED2_STATUS) {
        if (payload === "1") {
            led2Badge.textContent = "AÇIK";
            led2Badge.className = "state-badge on";
        } else if (payload === "0") {
            led2Badge.textContent = "KAPALI";
            led2Badge.className = "state-badge off";
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
