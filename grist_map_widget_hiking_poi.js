// === ПОЛНЫЙ КОД JAVASCRIPT ВИДЖЕТА (Версия #171b - фокус на poiMarkersLayer) ===

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let map;
let currentTableId = null;
let currentRecordId = null;
const MARKER_ZOOM_LEVEL = 15;
let poiMarkersLayer = null; // Слой для хранения маркеров POI

// === ОСНОВНЫЕ ФУНКЦИИ ВИДЖЕТА ===

function initMap() {
    console.log("Leaflet initMap() for Israel Hiking Map called.");
    const initialCoords = [31.5, 34.8]; const initialZoom = 8;
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
    } catch (e) { /* ... error handling ... */ }
}

function setupGrist() {
     if (typeof grist === 'undefined' || !grist.ready) { return; }
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
    grist.onRecords(loadExistingPOIs); // Этот будет перерисовывать все POI
    grist.onRecord(handleGristRecordUpdate); // Этот будет центрировать карту
    console.log("Grist API ready, listening for records and options...");
}

function handleOptionsUpdate(options, interaction) {
    // ... (код без изменений) ...
    console.log("Grist: Received options update:", options);
    let foundTableId = null;
    if (options && options.tableId) { foundTableId = options.tableId; }
    else if (interaction && interaction.tableId) { foundTableId = interaction.tableId; }
    else if (options && options.tableRef) { foundTableId = String(options.tableRef); }
    if (foundTableId) { currentTableId = String(foundTableId); console.log(`Current Table ID set to: ${currentTableId}`);}
    else { console.warn("Could not find tableId in options/interaction."); currentTableId = null; }
}

function handleGristRecordUpdate(record, mappings) {
    console.log("Grist: handleGristRecordUpdate - new selected record:", record);
    if (!map || !record || typeof record.id === 'undefined') { return; }
    currentRecordId = record.id; // Обновляем ID выбранной строки
    const lat = record.C; const lng = record.D;
    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
        const position = L.latLng(lat, lng);
        map.flyTo(position, MARKER_ZOOM_LEVEL);
        console.log("Map flew to selected POI from Grist:", position);
        // Открытие существующего Popup, если маркеры хранятся с доп. опциями
        if (poiMarkersLayer) {
            poiMarkersLayer.eachLayer(layer => {
                if (layer.options && layer.options.gristRecordId === record.id) {
                    layer.openPopup();
                }
            });
        }
    }
}

function loadExistingPOIs(records, mappings) {
    console.log("loadExistingPOIs called. Received records count:", records ? records.length : 0);
    if (!map) { console.error("Map not initialized in loadExistingPOIs"); return; }
    if (!poiMarkersLayer) {
        poiMarkersLayer = L.layerGroup().addTo(map);
        console.warn("poiMarkersLayer was not initialized, creating now.");
    }
    poiMarkersLayer.clearLayers();
    console.log("Previous POI markers cleared from poiMarkersLayer.");

    if (records && records.length > 0) {
        let addedCount = 0;
        records.forEach(record => {
            const type = record.B; const lat = record.C; const lng = record.D;
            const description = record.G || "";
            let popupText = `<b>Тип:</b> ${type || "N/A"}`;
            if (description) { popupText += `<br><b>Описание:</b> ${description}`; }
            popupText += `<br><small>ID: ${record.id}</small>`;

            if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
                L.marker(L.latLng(lat, lng), { gristRecordId: record.id }) // Сохраняем Grist ID в опциях маркера
                    .addTo(poiMarkersLayer)
                    .bindPopup(popupText);
                addedCount++;
            }
        });
        console.log(`Loaded ${addedCount} POIs onto the map from Grist records.`);
    } else { console.log("No POIs to load from Grist."); }
}

async function handleMapClick(e) {
    if (!e.latlng) return;
    const lat = e.latlng.lat; const lng = e.latlng.lng;
    const positionLeaflet = e.latlng;
    const poiType = "Точка интереса"; const description = "";
    const popupText = `<b>Тип:</b> ${poiType}<br><small>Координаты: ${lat.toFixed(4)}, ${lng.toFixed(4)}</small>`;
    console.log("Map clicked at:", positionLeaflet, "Creating POI:", poiType, "Desc: (empty)");

    // 1. Визуальный маркер при клике - НЕ ДОБАВЛЯЕМ СРАЗУ.
    // Вместо этого, Grist после добавления записи пришлет onRecords,
    // и маркер добавится в loadExistingPOIs. Это предотвратит дублирование.
    // Если хотите немедленный отклик, можно создать временный маркер и удалять его.
    // L.marker(positionLeaflet).addTo(poiMarkersLayer).bindPopup(popupText).openPopup();

    let tableIdToUse = currentTableId;
    if (!tableIdToUse && grist.selectedTable && typeof grist.selectedTable.getTableId === 'function') {
        try { /* ... код получения tableId ... */ } catch(err) { /* ... */ }
    }

    if (tableIdToUse && typeof tableIdToUse === 'string') {
        const newRecord = { 'B': poiType, 'C': lat, 'D': lng, 'G': description };
        const userActions = [ ['AddRecord', tableIdToUse, null, newRecord] ];
        console.log(`Attempting to add record to Grist table ID: ${tableIdToUse}`, JSON.stringify(newRecord));
        try {
            if (!grist.docApi?.applyUserActions) { throw new Error("Grist docApi not available."); }
            console.log("Sending to Grist (applyUserActions):", JSON.stringify(userActions));
            await grist.docApi.applyUserActions(userActions);
            console.log(`New POI record add action sent successfully to Grist.`);
        } catch (error) { /* ... error handling ... */ }
    } else { /* ... error handling for tableId ... */ }
}

// Функция updateMarkerOnMap больше не нужна в ее предыдущем виде, так как loadExistingPOIs
// перерисовывает все маркеры. Оставим ее пустой или удалим, если не используется для других целей.
function updateMarkerOnMap(position, label) {
    console.log("updateMarkerOnMap called, but POIs are redrawn by loadExistingPOIs. Centering map for selected record.");
    if (map) {
        // map.flyTo(L.latLng(position), MARKER_ZOOM_LEVEL); // Уже делается в handleGristRecordUpdate
    }
}

// === БЛОК РУЧНОЙ ИНИЦИАЛИЗАЦИИ LEAFLET ===
function checkLeafletApi() { /* ... код без изменений ... */ }
// === ТОЧКА ВХОДА (ПРЯМОЙ ВЫЗОВ ПРОВЕРКИ API) ===
console.log("DEBUG: Calling checkLeafletApi directly now for Israel Hiking Map POI widget.");
checkLeafletApi();
console.log("grist_map_widget_hiking_poi.js executed.");
// === КОНЕЦ СКРИПТА ===
