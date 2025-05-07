// === ПОЛНЫЙ КОД JAVASCRIPT ВИДЖЕТА (Версия #171 - Israel Hiking Map POI) ===

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let map;
let currentTableId = null;
let currentRecordId = null; // Используется в handleGristRecordUpdate
const MARKER_ZOOM_LEVEL = 15;
let poiMarkersLayer = null; // Слой для хранения маркеров POI

// === ОСНОВНЫЕ ФУНКЦИИ ВИДЖЕТА ===

function initMap() {
    console.log("Leaflet initMap() for Israel Hiking Map called.");
    const initialCoords = [31.5, 34.8]; // Пример: центр Израиля
    const initialZoom = 8;
    try {
        const mapDiv = document.getElementById('map');
        if (!mapDiv) { console.error("Map container #map not found!"); return; }
        map = L.map('map').setView(initialCoords, initialZoom);
        console.log("Leaflet Map object created.");
        L.tileLayer('https://israelhiking.osm.org.il/English/Tiles/{z}/{x}/{y}.png', {
            maxZoom: 16, minZoom: 7,
            attribution: 'Tiles &copy; <a href="https://israelhiking.osm.org.il" target="_blank">Israel Hiking Map</a> CC BY-NC-SA 3.0 | Map data &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
        }).addTo(map);
        console.log("OSM TileLayer (Israel Hiking) added.");

        // Инициализируем слой для маркеров сразу
        poiMarkersLayer = L.layerGroup().addTo(map);
        console.log("poiMarkersLayer initialized and added to map.");

        map.on('click', handleMapClick);
        console.log("Leaflet map click listener added.");
        setupGrist();
    } catch (e) {
        console.error("Error creating Leaflet Map object:", e);
        alert("Error creating Leaflet Map: " + e.message);
        const mapDiv = document.getElementById('map');
        if (mapDiv) { mapDiv.innerHTML = '<p>Ошибка создания карты Leaflet.</p>'; }
    }
}

function setupGrist() {
     if (typeof grist === 'undefined' || !grist.ready) { console.error("Grist API not found or not ready..."); return; }
     console.log("Setting up Grist interaction...");
    grist.ready({
        requiredAccess: 'full',
        columns: [
            { name: "B", type: 'Text',    title: 'Тип объекта' },
            { name: "C", type: 'Numeric', title: 'Широта' },
            { name: "D", type: 'Numeric', title: 'Долгота' },
            { name: "G", type: 'Text', optional: true, title: 'Описание POI' }
        ]
    });
    grist.onOptions(handleOptionsUpdate);
    grist.onRecords(loadExistingPOIs);
    grist.onRecord(handleGristRecordUpdate); // Для центрирования на выбранной в Grist точке
    console.log("Grist API ready, listening for records and options...");
}

function handleOptionsUpdate(options, interaction) {
    console.log("Grist: Received options update:", options);
    let foundTableId = null;
    if (options && options.tableId) { foundTableId = options.tableId; }
    else if (interaction && interaction.tableId) { foundTableId = interaction.tableId; }
    else if (options && options.tableRef) { foundTableId = String(options.tableRef); }

    if (foundTableId) {
         currentTableId = String(foundTableId); // Убедимся, что это строка
         console.log(`Current Table ID set to: ${currentTableId}`);
    } else {
        console.warn("Could not find tableId in options/interaction. Will rely on getTableId() at click time.");
        currentTableId = null;
    }
}

function handleGristRecordUpdate(record, mappings) {
    console.log("Grist: handleGristRecordUpdate - new selected record:", record);
    if (!map || !record || typeof record.id === 'undefined') {
        return;
    }
    currentRecordId = record.id; // Сохраняем ID текущей выбранной Grist строки

    const lat = record.C; // Широта из колонки C
    const lng = record.D; // Долгота из колонки D

    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
        const position = L.latLng(lat, lng);
        map.flyTo(position, MARKER_ZOOM_LEVEL); // Центрируем карту
        console.log("Map flew to selected POI from Grist:", position);
        // Можно добавить логику для открытия Popup существующего маркера, если нужно
    }
}

function loadExistingPOIs(records, mappings) {
    console.log("loadExistingPOIs called. Received records count:", records ? records.length : 0);
    if (!map) { console.error("Map not initialized in loadExistingPOIs"); return; }
    if (!poiMarkersLayer) {
        poiMarkersLayer = L.layerGroup().addTo(map);
        console.warn("poiMarkersLayer was not initialized during initMap, creating now.");
    }

    poiMarkersLayer.clearLayers();
    console.log("Previous POI markers cleared from poiMarkersLayer.");

    if (records && records.length > 0) {
        let addedCount = 0;
        records.forEach(record => {
            const type = record.B;
            const lat = record.C;
            const lng = record.D