// === ПОЛНЫЙ КОД JAVASCRIPT ВИДЖЕТА (Версия #177 - улучшенное логирование checkLeafletApi) ===

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let map;
let currentTableId = null;
let currentRecordId = null;
const MARKER_ZOOM_LEVEL = 15;
let poiMarkersLayer = null;
let g_currentRouteRefId = null; // Для ID маршрута из Table1

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
    } catch (e) {
        console.error("DEBUG: initMap: Error creating Leaflet Map object:", e);
        alert("Error creating Leaflet Map: " + e.message);
    }
}

function setupGrist() {
     if (typeof grist === 'undefined' || !grist.ready) { console.error("DEBUG: setupGrist: Grist API not found..."); return; }
     console.log("DEBUG: setupGrist: Setting up Grist interaction...");
    grist.ready({
        requiredAccess: 'full',
        columns: [
            { name: "A", type: 'Any',    optional: true, title: 'Название Маршрута (Формула)' },
            { name: "B", type: 'Text',    title: 'Тип объекта' },
            { name: "C", type: 'Numeric', title: 'Широта' },
            { name: "D", type: 'Numeric', title: 'Долгота' },
            { name: "G", type: 'Text', optional: true, title: 'Описание POI' },
            // ВАЖНО: Замените 'RouteLink' на РЕАЛЬНЫЙ ID вашей колонки-ссылки в Table7!
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
    if (foundTableId) { currentTableId = String(foundTableId); console.log(`DEBUG: handleOptionsUpdate: Current Table ID set to: ${currentTableId}`);}
    else { console.warn("DEBUG: handleOptionsUpdate: Could not find tableId in options/interaction."); currentTableId = null; }
}

function handleGristRecordUpdate(record, mappings) {
    console.log("DEBUG: handleGristRecordUpdate: Grist: new selected record:", record);
    if (!map) { return; }
    currentRecordId = record ? record.id : null;

    if (record && typeof record.id !== 'undefined') {
        // ВАЖНО: Замените 'RouteLink' на РЕАЛЬНЫЙ ID вашей колонки-ссылки в Table7!
        const refValue = record.RouteLink;
        let extractedRouteId = null;
        if (typeof refValue === 'number') { extractedRouteId = refValue; }
        else if (Array.isArray(refValue) && refValue.length === 2 && typeof refValue[1] === 'number') { extractedRouteId = refValue[1];}
        else if (typeof refValue === 'string') {
            const match = refValue.match(/\[(\d+)\]$/);
            if (match && match[1]) { extractedRouteId = parseInt(match[1], 10); }
            else if (!isNaN(parseInt(refValue, 10))) { extractedRouteId = parseInt(refValue, 10); }
        }
        g_currentRouteRefId = extractedRouteId;
        console.log(`DEBUG: handleGristRecordUpdate: Current g_currentRouteRefId set to: ${g_currentRouteRefId} (Type: ${typeof g_currentRouteRefId})`);

        const lat = record.C; const lng = record.D;
        if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
            map.flyTo(L.latLng(lat, lng), MARKER_ZOOM_LEVEL);
        }
    } else { g_currentRouteRefId = null; console.log("DEBUG: handleGristRecordUpdate: No POI selected, g_currentRouteRefId reset."); }
}

function loadExistingPOIs(records, mappings) {
    // ... (код loadExistingPOIs без изменений из ответа #171 / #184) ...
}

async function handleMapClick(e) {
    // ... (код handleMapClick без изменений из ответа #184, который записывает 'RouteLink') ...
}

function updateMarkerOnMap(position, label) {
    // ... (код updateMarkerOnMap без изменений из ответа #171) ...
}

// === БЛОК РУЧНОЙ ИНИЦИАЛИЗАЦИИ LEAFLET (из ответа #177) ===
function checkLeafletApi() {
    console.log("DEBUG: checkLeafletApi: --- Top of function ---"); // Улучшенный лог
    try {
        if (typeof L === 'object' && L !== null && typeof L.map === 'function') {
            console.log("DEBUG: checkLeafletApi: Leaflet (L) is DEFINED and L.map is a function. Calling initMap().");
            initMap();
        } else {
            let leafletStatus = "Leaflet (L) is UNDEFINED.";
            if (typeof L === 'object' && L !== null) {
                leafletStatus = "Leaflet (L) is an object, but L.map is NOT a function.";
            } else if (typeof L !== 'undefined') {
                leafletStatus = `Leaflet (L) is of type ${typeof L}, not an object.`;
            }
            console.warn(`DEBUG: checkLeafletApi: ${leafletStatus} Will retry in 250ms.`);
            setTimeout(checkLeafletApi, 250);
        }
    } catch (e) {
        console.error("DEBUG: checkLeafletApi: !!! ERROR WITHIN checkLeafletApi !!!", e);
        console.warn("DEBUG: checkLeafletApi: Retrying after error in 1000ms.");
        setTimeout(checkLeafletApi, 1000); // Более медленная попытка после ошибки
    }
    console.log("DEBUG: checkLeafletApi: --- Bottom of function (after if/else or error) ---");
}

// === ТОЧКА ВХОДА (ПРЯМОЙ ВЫЗОВ ПРОВЕРКИ API) ===
console.log("DEBUG: Main script: --- START --- About to call checkLeafletApi for the first time.");
checkLeafletApi();
console.log("DEBUG: Main script: --- END --- grist_map_widget_hiking_poi.js has finished initial synchronous execution.");
// === КОНЕЦ СКРИПТА ===
