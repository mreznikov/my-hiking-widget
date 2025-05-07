// === ПОЛНЫЙ КОД JAVASCRIPT ВИДЖЕТА (Версия #176b - улучшенное логирование checkLeafletApi) ===

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let map;
let currentTableId = null;
let currentRecordId = null;
const MARKER_ZOOM_LEVEL = 15;
let poiMarkersLayer = null;
let g_currentRouteName = null;

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
        const mapDiv = document.getElementById('map');
        if (mapDiv) { mapDiv.innerHTML = '<p>Ошибка создания карты Leaflet.</p>'; }
    }
}

function setupGrist() {
     if (typeof grist === 'undefined' || !grist.ready) { console.error("DEBUG: setupGrist: Grist API not found..."); return; }
     console.log("DEBUG: setupGrist: Setting up Grist interaction...");
    grist.ready({
        requiredAccess: 'full',
        columns: [
            { name: "A", type: 'Text',    optional: true, title: 'Название Маршрута' },
            { name: "B", type: 'Text',    title: 'Тип объекта' },
            { name: "C", type: 'Numeric', title: 'Широта' },
            { name: "D", type: 'Numeric', title: 'Долгота' },
            { name: "G", type: 'Text', optional: true, title: 'Описание POI' }
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
    else { console.warn("DEBUG: handleOptionsUpdate: Could not find tableId in options/interaction. Will rely on getTableId() at click time."); currentTableId = null; }
}

function handleGristRecordUpdate(record, mappings) {
    console.log("DEBUG: handleGristRecordUpdate: Grist: new selected record:", record);
    if (!map) { return; }
    currentRecordId = record ? record.id : null;

    if (record && typeof record.id !== 'undefined') {
        g_currentRouteName = record.A || null;
        console.log(`DEBUG: handleGristRecordUpdate: Current route name set from selected POI in Table7: ${g_currentRouteName}`);
        const lat = record.C; const lng = record.D;
        if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
            const position = L.latLng(lat, lng);
            map.flyTo(position, MARKER_ZOOM_LEVEL);
            console.log("DEBUG: handleGristRecordUpdate: Map flew to selected POI from Grist:", position);
        }
    } else {
        console.log("DEBUG: handleGristRecordUpdate: No specific POI record selected in Table7 (or table is empty). Route name might be stale if not set otherwise.");
    }
}

function loadExistingPOIs(records, mappings) {
    console.log("DEBUG: loadExistingPOIs: Called. Received records count:", records ? records.length : 0);
    if (!map) { console.error("DEBUG: loadExistingPOIs: Map not initialized"); return; }
    if (!poiMarkersLayer) { poiMarkersLayer = L.layerGroup().addTo(map); console.warn("DEBUG: loadExistingPOIs: poiMarkersLayer was re-initialized."); }

    poiMarkersLayer.clearLayers();
    console.log("DEBUG: loadExistingPOIs: Previous POI markers cleared.");

    if (records && records.length > 0) {
        let addedCount = 0;
        records.forEach(record => {
            const routeName = record.A; const type = record.B;
            const lat = record.C; const lng = record.D;
            const description = record.G || "";
            let popupText = `<b>Маршрут:</b> ${routeName || "N/A"}<br><b>Тип:</b> ${type || "N/A"}`;
            if (description) { popupText += `<br><b>Описание:</b> ${description}`; }
            popupText += `<br><small>ID: ${record.id}</small>`;
            if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
                L.marker(L.latLng(lat, lng), { gristRecordId: record.id })
                    .addTo(poiMarkersLayer)
                    .bindPopup(popupText);
                addedCount++;
            }
        });
        console.log(`DEBUG: loadExistingPOIs: Loaded ${addedCount} POIs onto the map.`);
    } else { console.log("DEBUG: loadExistingPOIs: No POIs to load from Grist."); }
}

async function handleMapClick(e) {
    if (!e.latlng) return;
    const lat = e.latlng.lat; const lng = e.latlng.lng;
    const positionLeaflet = e.latlng;
    const poiType = "Точка интереса"; const description = "";
    const routeNameForNewPoi = g_currentRouteName || "Маршрут не определен";
    const popupText = `<b>Маршрут:</b> ${routeNameForNewPoi}<br><b>Тип:</b> ${poiType}<br><small>Коорд.: ${lat.toFixed(4)}, ${lng.toFixed(4)}</small>`;
    console.log("DEBUG: handleMapClick: Map clicked at:", positionLeaflet, "Creating POI for route:", routeNameForNewPoi);

    L.marker(positionLeaflet).addTo(poiMarkersLayer || map).bindPopup(popupText).openPopup();

    let tableIdToUse = currentTableId;
    if (!tableIdToUse && grist.selectedTable && typeof grist.selectedTable.getTableId === 'function') {
        try {
            const idFromMethod = await grist.selectedTable.getTableId();
            if (idFromMethod && typeof idFromMethod === 'string') {
                tableIdToUse = idFromMethod; currentTableId = idFromMethod;
                console.log(`DEBUG: handleMapClick: Table ID for new POI set to: ${tableIdToUse} via getTableId().`);
            }
        } catch(err) { console.error("DEBUG: handleMapClick: Error getting tableId:", err); }
    }

    if (tableIdToUse && typeof tableIdToUse === 'string') {
        const newRecord = {
            'A': routeNameForNewPoi, 'B': poiType, 'C': lat, 'D': lng, 'G': description
        };
        const userActions = [ ['AddRecord', tableIdToUse, null, newRecord] ];
        console.log(`DEBUG: handleMapClick: Attempting to add record to Grist table ID: ${tableIdToUse}`, JSON.stringify(newRecord));
        try {
            if (!grist.docApi?.applyUserActions) { throw new Error("Grist docApi not available."); }
            await grist.docApi.applyUserActions(userActions);
            console.log(`DEBUG: handleMapClick: New POI record add action sent successfully.`);
        } catch (error) {
            console.error(`DEBUG: handleMapClick: Failed to add record to Grist:`, error);
            alert(`Ошибка добавления POI в Grist: ${error.message}`);
        }
    } else {
        console.error("DEBUG: handleMapClick: Cannot add record: Table ID is unknown.", tableIdToUse);
        alert("Не удалось добавить POI: ID таблицы неизвестен.");
    }
}

function updateMarkerOnMap(position, label) {
    console.log("DEBUG: updateMarkerOnMap: Called. Centering map for selected record.");
}

// === БЛОК РУЧНОЙ ИНИЦИАЛИЗАЦИИ LEAFLET ===
function checkLeafletApi() {
    console.log("DEBUG: checkLeafletApi: --- Top of function ---");
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
        setTimeout(checkLeafletApi, 1000); // Slower retry on error
    }
    console.log("DEBUG: checkLeafletApi: --- Bottom of function (after if/else or error) ---");
}

// === ТОЧКА ВХОДА (ПРЯМОЙ ВЫЗОВ ПРОВЕРКИ API) ===
console.log("DEBUG: Main script: --- START --- About to call checkLeafletApi for the first time.");
checkLeafletApi();
console.log("DEBUG: Main script: --- END --- grist_map_widget_hiking_poi.js has finished initial synchronous execution.");
// === КОНЕЦ СКРИПТА ===
