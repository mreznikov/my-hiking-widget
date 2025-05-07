// === ПОЛНЫЙ КОД JAVASCRIPT ВИДЖЕТА (Версия #207b - с исправленным handleGristRecordUpdate) ===

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let map;
let currentTableId = null;
let currentRecordId = null;
const MARKER_ZOOM_LEVEL = 15;
let poiMarkersLayer = null;
let g_currentRouteActualRefId = null;

// === ОСНОВНЫЕ ФУНКЦИИ ВИДЖЕТА ===

function initMap() {
    console.log("DEBUG: initMap: Leaflet initMap() for Israel Hiking Map called.");
    const initialCoords = [31.5, 34.8]; const initialZoom = 8;
    try {
        const mapDiv = document.getElementById('map');
        if (!mapDiv) { console.error("DEBUG: initMap: Map container #map not found!"); return; }
        map = L.map('map').setView(initialCoords, initialZoom);
        console.log("DEBUG: initMap: Leaflet Map object created.");
        L.tileLayer('https://israelhiking.osm.org.il/English/Tiles/{z}/{x}/{y}.png', {
            maxZoom: 16, minZoom: 7,
            attribution: 'Tiles &copy; <a href="https://israelhiking.osm.org.il" target="_blank">Israel Hiking Map</a> CC BY-NC-SA 3.0 | Map data &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
        }).addTo(map);
        console.log("DEBUG: initMap: OSM TileLayer (Israel Hiking) added.");
        poiMarkersLayer = L.layerGroup().addTo(map);
        console.log("DEBUG: initMap: poiMarkersLayer initialized and added to map.");
        map.on('click', handleMapClick);
        console.log("DEBUG: initMap: Leaflet map click listener added.");
        setupGrist();
    } catch (e) { console.error("DEBUG: initMap: Error creating Leaflet Map object:", e); alert("Error creating Leaflet Map: " + e.message); }
}

function setupGrist() {
     if (typeof grist === 'undefined' || !grist.ready) { console.error("DEBUG: setupGrist: Grist API not found..."); return; }
     console.log("DEBUG: setupGrist: Setting up Grist interaction...");
    grist.ready({
        requiredAccess: 'full',
        columns: [
            { name: "A", type: 'Any',    optional: true, title: 'Название Маршрута (Формула Grist)' },
            { name: "B", type: 'Text',    title: 'Тип объекта' },
            { name: "C", type: 'Numeric', title: 'Широта' },
            { name: "D", type: 'Numeric', title: 'Долгота' },
            { name: "G", type: 'Text', optional: true, title: 'Описание POI' },
            // ВАЖНО: Убедитесь, что 'RouteLink' - это РЕАЛЬНЫЙ ID вашей колонки-ссылки в Table7!
            { name: "RouteLink", type: 'Any', title: 'ID Связанного Маршрута (Ref->Table1)' }
        ]
    });
    grist.onOptions(handleOptionsUpdate);
    grist.onRecords(loadExistingPOIs);
    grist.onRecord(handleGristRecordUpdate);
    console.log("DEBUG: setupGrist: Grist API ready, listening for records and options...");
}

function handleOptionsUpdate(options, interaction) {
    console.log("DEBUG: handleOptionsUpdate: Grist: Received options update:", options);
    let foundTableId = null;
    if (options && options.tableId) { foundTableId = options.tableId; }
    else if (interaction && interaction.tableId) { foundTableId = interaction.tableId; }
    else if (options && options.tableRef) { foundTableId = String(options.tableRef); }
    if (foundTableId) { currentTableId = String(foundTableId); console.log(`DEBUG: handleOptionsUpdate: Current Table ID (Table7) set to: ${currentTableId}`);}
    else { console.warn("DEBUG: handleOptionsUpdate: Could not find tableId for Table7 in options/interaction."); currentTableId = null; }
}

// --- ИСПРАВЛЕННАЯ ВЕРСИЯ ИЗ #204 ---
function handleGristRecordUpdate(record, mappings) {
    console.log("DEBUG: handleGristRecordUpdate: Raw 'record' object received from Grist:", JSON.parse(JSON.stringify(record || {})));
    if (!map) { console.error("DEBUG: handleGristRecordUpdate: Map not initialized yet."); return; }
    currentRecordId = record ? record.id : null;

    if (record && typeof record.id !== 'undefined') {
        // Используем 'RouteLink' как подтвержденный ID вашей колонки-ссылки
        const refValue = record.RouteLink;

        console.log("DEBUG: handleGristRecordUpdate: Value of record.RouteLink (refValue):", refValue);
        console.log(`DEBUG: handleGristRecordUpdate: Type of record.RouteLink (refValue): ${typeof refValue}`);

        let extractedRouteId = null;

        if (typeof refValue === 'number') {
            extractedRouteId = refValue;
            console.log("DEBUG: handleGristRecordUpdate: refValue is a number.");
        } else if (typeof refValue === 'object' && refValue !== null && refValue.hasOwnProperty('rowId')) {
            extractedRouteId = refValue.rowId; // Извлекаем rowId
            console.log("DEBUG: handleGristRecordUpdate: refValue is an object, extracted rowId:", extractedRouteId);
        } else if (Array.isArray(refValue) && refValue.length === 2 && typeof refValue[0] === 'string' && refValue[0].toUpperCase() === 'L') {
            extractedRouteId = refValue[1];
            console.log("DEBUG: handleGristRecordUpdate: refValue is Grist link array, extracted ID/UUID:", extractedRouteId);
        } else if (typeof refValue === 'string' && refValue.trim() !== "") {
            extractedRouteId = refValue;
            console.log("DEBUG: handleGristRecordUpdate: refValue is a string, using it as is (e.g., for UUID).");
        } else {
            console.warn("DEBUG: handleGristRecordUpdate: refValue for RouteLink is in an unexpected format or null/empty.");
        }

        g_currentRouteActualRefId = extractedRouteId;

        // Если ваш ID маршрута (UUID или другой) является числом или строкой, представляющей число,
        // и Grist ожидает число для связи по Ref-колонке.
        if (g_currentRouteActualRefId !== null && typeof g_currentRouteActualRefId !== 'undefined' && !isNaN(Number(g_currentRouteActualRefId))) {
             g_currentRouteActualRefId = Number(g_currentRouteActualRefId);
        }
        // Если ваш ID маршрута - это нечисловая строка (например, сложный UUID) и Grist
        // правильно обрабатывает такие строки для Ref-колонок, то предыдущий блок if не нужен.

        console.log(`DEBUG: handleGristRecordUpdate: Global g_currentRouteActualRefId set to: ${g_currentRouteActualRefId} (Type: ${typeof g_currentRouteActualRefId})`);

        const lat = record.C; const lng = record.D;
        if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
            map.flyTo(L.latLng(lat, lng), MARKER_ZOOM_LEVEL);
        }
    } else {
        g_currentRouteActualRefId = null;
        console.log("DEBUG: handleGristRecordUpdate: No POI selected or record is invalid, g_currentRouteActualRefId reset.");
    }
}


function loadExistingPOIs(records, mappings) { /* ... без изменений из #196 ... */ }
async function handleMapClick(e) { /* ... без изменений из #196, но теперь с более надежным g_currentRouteActualRefId ... */ }
function updateMarkerOnMap(position, label) { /* ... без изменений из #196 ... */ }
function checkLeafletApi() { /* ... без изменений из #196 ... */ }

// === ТОЧКА ВХОДА ===
console.log("DEBUG: Main script: --- START --- About to call checkLeafletApi for the first time.");
checkLeafletApi();
console.log("DEBUG: Main script: --- END --- grist_map_widget_hiking_poi.js has finished initial synchronous execution.");
// === КОНЕЦ СКРИПТА ===
