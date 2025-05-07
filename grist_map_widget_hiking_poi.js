// === ПОЛНЫЙ КОД JAVASCRIPT ВИДЖЕТА (Версия #189) ===

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let map;
let currentTableId = null;  // ID таблицы Table7
let currentRecordId = null; // ID текущей выбранной строки в Table7
const MARKER_ZOOM_LEVEL = 15;
let poiMarkersLayer = null;
let g_currentRouteActualRefId = null; // Хранит ID строки из Table1 (значение из колонки-ССЫЛКИ Table7.RouteLink)

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
        poiMarkersLayer = L.layerGroup().addTo(map);
        console.log("poiMarkersLayer initialized and added to map.");
        map.on('click', handleMapClick);
        console.log("Leaflet map click listener added.");
        setupGrist();
    } catch (e) { /* ... error handling ... */ }
}

function setupGrist() {
     if (typeof grist === 'undefined' || !grist.ready) { console.error("Grist API not found..."); return; }
     console.log("Setting up Grist interaction...");
    grist.ready({
        requiredAccess: 'full',
        columns: [
            // Колонка A в Table7 - для отображения названия маршрута (должна быть ФОРМУЛЬНОЙ в Grist: $RouteLink.A)
            { name: "A", type: 'Any',    optional: true, title: 'Название Маршрута (Формула)' },
            { name: "B", type: 'Text',    title: 'Тип объекта' },
            { name: "C", type: 'Numeric', title: 'Широта' },
            { name: "D", type: 'Numeric', title: 'Долгота' },
            { name: "G", type: 'Text', optional: true, title: 'Описание POI' },
            // ВАЖНО: 'RouteLink' - это ID вашей КОЛОНКИ-ССЫЛКИ в Table7, которая ссылается на Table1.
            // Grist пришлет сюда числовой ID строки из Table1.
            { name: "RouteLink", type: 'Ref:Table1', title: 'ID Связанного Маршрута' } // Имя для Grist, тип Ref
        ]
    });
    grist.onOptions(handleOptionsUpdate);
    grist.onRecords(loadExistingPOIs);
    grist.onRecord(handleGristRecordUpdate);
    console.log("Grist API ready, listening for records and options...");
}

function handleOptionsUpdate(options, interaction) {
    console.log("Grist: Received options update:", options);
    let foundTableId = null;
    if (options && options.tableId) { foundTableId = options.tableId; }
    else if (interaction && interaction.tableId) { foundTableId = interaction.tableId; }
    else if (options && options.tableRef) { foundTableId = String(options.tableRef); }
    if (foundTableId) { currentTableId = String(foundTableId); console.log(`Current Table ID (Table7) set to: ${currentTableId}`);}
    else { console.warn("Could not find tableId for Table7 in options/interaction."); currentTableId = null; }
}

function handleGristRecordUpdate(record, mappings) {
    console.log("Grist: handleGristRecordUpdate - selected record in Table7:", record);
    if (!map) { return; }
    currentRecordId = record ? record.id : null; // ID текущей выбранной строки в Table7

    if (record && typeof record.id !== 'undefined') {
        // ВАЖНО: Замените 'RouteLink' на РЕАЛЬНЫЙ ID вашей колонки-ссылки в Table7!
        const refValue = record.RouteLink;
        let extractedRouteId = null;

        if (typeof refValue === 'number') {
            extractedRouteId = refValue; // Если это уже число, используем его
        } else if (Array.isArray(refValue) && refValue.length > 0 && typeof refValue[0] === 'string' && refValue[0].toUpperCase() === 'L') {
            // Похоже на формат Grist "L<table_numeric_id>;<row_id>" или ["L<table_numeric_id>", row_id]
            // Пример: refValue = ["L1", 2] -> ID = 2
            // Пример: refValue = "L1;2" (менее вероятно из JS API, но проверим)
            if (Array.isArray(refValue) && refValue.length === 2 && typeof refValue[1] === 'number') {
                 extractedRouteId = refValue[1];
            } else if (typeof refValue === 'string') {
                const parts = refValue.split(';');
                if (parts.length === 2 && !isNaN(parseInt(parts[1], 10))) {
                    extractedRouteId = parseInt(parts[1], 10);
                }
            }
        }
        // Можно добавить другие проверки, если Grist возвращает ID ссылки в другом формате

        g_currentRouteActualRefId = extractedRouteId;
        console.log(`Current g_currentRouteActualRefId (ID of route in Table1, from Table7.RouteLink) set to: ${g_currentRouteActualRefId} (Type: ${typeof g_currentRouteActualRefId})`);

        const lat = record.C; const lng = record.D;
        if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
            map.flyTo(L.latLng(lat, lng), MARKER_ZOOM_LEVEL);
        }
    } else {
        g_currentRouteActualRefId = null;
        console.log("No specific POI record selected in Table7, g_currentRouteActualRefId reset.");
    }
}

function loadExistingPOIs(records, mappings) {
    console.log("loadExistingPOIs called for Table7. Received records count:", records ? records.length : 0);
    if (!map || !poiMarkersLayer) { return; }
    poiMarkersLayer.clearLayers();

    if (records && records.length > 0) {
        records.forEach(record => {
            const routeNameFromFormula = record.A; // Это значение из формульной колонки A ($RouteLink.A)
            const type = record.B;
            const lat = record.C;
            const lng = record.D;
            const description = record.G || "";

            let popupText = `<b>Маршрут:</b> ${routeNameFromFormula || "N/A"}<br><b>Тип:</b> ${type || "N/A"}`;
            if (description) { popupText += `<br><b>Описание:</b> ${description}`; }
            popupText += `<br><small>ID точки: ${record.id}</small>`;

            if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
                L.marker(L.latLng(lat, lng), { gristRecordId: record.id })
                    .addTo(poiMarkersLayer)
                    .bindPopup(popupText);
            }
        });
    }
}

async function handleMapClick(e) {
    if (!e.latlng) return;
    const lat = e.latlng.lat; const lng = e.latlng.lng;
    const positionLeaflet = e.latlng;
    const poiType = "Точка интереса"; const description = "";

    console.log("Map clicked at:", positionLeaflet, "Creating POI. Current RouteRef ID to use:", g_currentRouteActualRefId);

    L.marker(positionLeaflet)
        .addTo(poiMarkersLayer)
        .bindPopup(`<i>Новая точка (связь с маршрутом ID: ${g_currentRouteActualRefId || '???'})...</i>`)
        .openPopup();

    let tableIdToUse = currentTableId; // ID таблицы Table7
    if (!tableIdToUse && grist.selectedTable && typeof grist.selectedTable.getTableId === 'function') {
        try {
            const idFromMethod = await grist.selectedTable.getTableId();
            if (idFromMethod && typeof idFromMethod === 'string') { tableIdToUse = idFromMethod; currentTableId = idFromMethod; }
        } catch(err) { console.error("Error getting tableId (Table7) in handleMapClick:", err); }
    }

    if (!g_currentRouteActualRefId) {
        alert("Не выбран контекст маршрута. Пожалуйста, сначала выберите существующую точку маршрута в таблице 'Детали Маршрута' (Table7), чтобы виджет знал, к какому маршруту привязать новую точку.");
        console.error("Cannot add POI: g_currentRouteActualRefId is not set.");
        return;
    }
    // Убедимся, что g_currentRouteActualRefId - это число, если Grist ожидает число для Ref колонки
    const routeRefIdForGrist = Number(g_currentRouteActualRefId);
    if (isNaN(routeRefIdForGrist)) {
        alert("Ошибка: ID связанного маршрута некорректен (не число).");
        console.error("Cannot add POI: g_currentRouteActualRefId is not a number after parsing.", g_currentRouteActualRefId);
        return;
    }


    if (tableIdToUse && typeof tableIdToUse === 'string') {
        // ВАЖНО: Замените 'RouteLink' на РЕАЛЬНЫЙ ID вашей колонки-ссылки в Table7!
        const newRecord = {
            'RouteLink': routeRefIdForGrist, // Явно указываем числовой ID связанной записи из Table1
            'B': poiType,
            'C': lat,
            'D': lng,
            'G': description
        };
        // Колонка 'A' в Table7 НЕ указывается, т.к. она формульная ($RouteLink.A в Grist)

        const userActions = [ ['AddRecord', tableIdToUse, null, newRecord] ];
        console.log(`Attempting to add record to Grist table ${tableIdToUse} with ref ID ${routeRefIdForGrist}:`, JSON.stringify(newRecord));
        try {
            if (!grist.docApi?.applyUserActions) { throw new Error("Grist docApi not available."); }
            await grist.docApi.applyUserActions(userActions);
            console.log(`New POI record add action sent successfully to Grist.`);
        } catch (error) {
            console.error(`Failed to add record to Grist:`, error);
            alert(`Ошибка добавления POI в Grist: ${error.message}`);
        }
    } else {
        console.error("Cannot add record: Table ID for Table7 is unknown or invalid.", tableIdToUse);
        alert("Не удалось добавить POI: ID таблицы 'Детали Маршрута' неизвестен.");
    }
}

// updateMarkerOnMap() - практически не используется для POI, они рисуются в loadExistingPOIs
function updateMarkerOnMap(position, label) { /* ... */ }

// === БЛОК РУЧНОЙ ИНИЦИАЛИЗАЦИИ LEAFLET ===
function checkLeafletApi() { /* ... код без изменений ... */ }
// === ТОЧКА ВХОДА (ПРЯМОЙ ВЫЗОВ ПРОВЕРКИ API) ===
console.log("DEBUG: Calling checkLeafletApi directly now for Israel Hiking Map POI widget.");
checkLeafletApi();
console.log("grist_map_widget_hiking_poi.js executed.");
// === КОНЕЦ СКРИПТА ===
