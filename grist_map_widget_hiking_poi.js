// === ПОЛНЫЙ КОД JAVASCRIPT ВИДЖЕТА (Версия для отладки ID ссылки) ===

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
    } catch (e) { console.error("DEBUG: initMap: Error creating Leaflet Map object:", e); }
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
            // ЗАМЕНИТЕ "RouteLink"
            { name: "RouteLink", type: 'Any', title: 'ID Связанного Маршрута' }
        ]
    });
    grist.onOptions(handleOptionsUpdate);
    grist.onRecords(loadExistingPOIs);
    grist.onRecord(handleGristRecordUpdate);
    console.log("DEBUG: setupGrist: Grist API ready, listening for records and options...");
}

function handleOptionsUpdate(options, interaction) { /* ... без изменений из #196 ... */ }

function handleGristRecordUpdate(record, mappings) {
    console.log("DEBUG: handleGristRecordUpdate: Raw 'record' object received from Grist:", JSON.parse(JSON.stringify(record || {})));
    if (!map) { return; }
    currentRecordId = record ? record.id : null;

    if (record && typeof record.id !== 'undefined') {
        // ЗАМЕНИТЕ "RouteLink"
        const refValue = record.RouteLink;

        console.log("DEBUG: handleGristRecordUpdate: Value of Ref Column (refValue):", refValue);
        console.log(`DEBUG: handleGristRecordUpdate: Type of Ref Column (refValue): ${typeof refValue}`);

        let extractedRouteId = null;
        if (typeof refValue === 'number') { extractedRouteId = refValue; }
        else if (typeof refValue === 'string' && refValue.trim() !== "") { extractedRouteId = refValue; }
        else if (Array.isArray(refValue) && refValue.length === 2 && typeof refValue[0] === 'string' && refValue[0].toUpperCase() === 'L') { extractedRouteId = refValue[1]; }
        else { console.warn("DEBUG: handleGristRecordUpdate: refValue for Ref Column is in an unexpected format or null/empty."); }

        g_currentRouteActualRefId = extractedRouteId;
        console.log(`DEBUG: handleGristRecordUpdate: Global g_currentRouteActualRefId set to: ${g_currentRouteActualRefId} (Type: ${typeof g_currentRouteActualRefId})`);

        const lat = record.C; const lng = record.D;
        if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) { map.flyTo(L.latLng(lat, lng), MARKER_ZOOM_LEVEL); }
    } else { g_currentRouteActualRefId = null; console.log("DEBUG: handleGristRecordUpdate: No POI selected, g_currentRouteActualRefId reset."); }
}

function loadExistingPOIs(records, mappings) { /* ... без изменений из #196 ... */ }

async function handleMapClick(e) {
    if (!e.latlng) return;
    const lat = e.latlng.lat; const lng = e.latlng.lng;
    const positionLeaflet = e.latlng;
    const poiType = "Точка интереса"; const description = "";

    console.log("DEBUG: handleMapClick: Clicked. Current RouteRef ID to use:", g_currentRouteActualRefId);
    L.marker(positionLeaflet).addTo(poiMarkersLayer).bindPopup(`<i>Новая точка (связь с ID: ${g_currentRouteActualRefId || '???'})...</i>`).openPopup();

    let tableIdToUse = currentTableId;
    if (!tableIdToUse && grist.selectedTable?.getTableId) { try { const id = await grist.selectedTable.getTableId(); if (id) tableIdToUse = id; currentTableId = tableIdToUse; } catch(err) {} }

    if (!g_currentRouteActualRefId) {
        alert("Контекст маршрута не определен..."); console.error("DEBUG: handleMapClick: Cannot add POI - g_currentRouteActualRefId is not set."); return;
    }
    const routeRefValueForGrist = g_currentRouteActualRefId; // Используем как есть (число или UUID-строка)

    if (tableIdToUse && typeof tableIdToUse === 'string') {
        // ЗАМЕНИТЕ "RouteLink"
        const newRecord = {
            'RouteLink': routeRefValueForGrist,
            'B': poiType, 'C': lat, 'D': lng, 'G': description
        };
        const userActions = [ ['AddRecord', tableIdToUse, null, newRecord] ];
        console.log(`DEBUG: handleMapClick: Attempting to add record to Grist table ${tableIdToUse}:`, JSON.stringify(newRecord));
        try {
            if (!grist.docApi?.applyUserActions) { throw new Error("Grist docApi not available."); }
            await grist.docApi.applyUserActions(userActions);
            console.log(`DEBUG: handleMapClick: New POI record add action sent successfully.`);
        } catch (error) { console.error(`DEBUG: handleMapClick: Failed to add record:`, error); alert(`Ошибка добавления POI: ${error.message}`); }
    } else { console.error("DEBUG: handleMapClick: Cannot add record - Table7 ID is unknown.", tableIdToUse); alert("Не удалось добавить POI: ID таблицы Table7 неизвестен."); }
}

function updateMarkerOnMap(position, label) { /* ... без изменений ... */ }
function checkLeafletApi() { /* ... код из ответа #196 ... */ }
console.log("DEBUG: Main script: --- START --- About to call checkLeafletApi for the first time.");
checkLeafletApi();
console.log("DEBUG: Main script: --- END --- grist_map_widget_hiking_poi.js has finished initial synchronous execution.");
// === КОНЕЦ СКРИПТА ===
