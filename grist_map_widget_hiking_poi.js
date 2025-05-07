// === ПОЛНЫЙ КОД JAVASCRIPT ВИДЖЕТА (Версия #190 - Улучшенная обработка Ref ID) ===

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let map;
let currentTableId = null;  // ID таблицы Table7 ("Детали Маршрута")
let currentRecordId = null; // ID текущей выбранной строки в Table7
const MARKER_ZOOM_LEVEL = 15;
let poiMarkersLayer = null; // Слой для хранения маркеров POI
// g_currentRouteActualRefId будет содержать ID строки из Table1 (например, число или ваш UUID),
// к которой привязан текущий набор точек в Table7.
// Это значение извлекается из КОЛОНКИ-ССЫЛКИ таблицы Table7.
let g_currentRouteActualRefId = null;

// === ОСНОВНЫЕ ФУНКЦИИ ВИДЖЕТА ===

function initMap() {
    console.log("DEBUG: initMap: Leaflet initMap() for Israel Hiking Map called.");
    const initialCoords = [31.5, 34.8]; // Пример: центр Израиля
    const initialZoom = 8;
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
            // Колонка A в Table7 - для названия маршрута (должна быть ФОРМУЛЬНОЙ в Grist: $RouteLink.Имя_или_UUID_из_Table1)
            { name: "A", type: 'Any',    optional: true, title: 'Название Маршрута (из Table1)' },
            { name: "B", type: 'Text',    title: 'Тип объекта' }, // "Точка интереса"
            { name: "C", type: 'Numeric', title: 'Широта' },
            { name: "D", type: 'Numeric', title: 'Долгота' },
            { name: "G", type: 'Text', optional: true, title: 'Описание POI' },
            // ВАЖНО: Замените 'RouteLink' на РЕАЛЬНЫЙ ID вашей колонки-ссылки в Table7,
            // которая ссылается на Table1 (на ее колонку id или вашу колонку UUID).
            // Тип Grist для нее будет "Reference" или "Reference List". Для API можно указать 'Any'.
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

    if (foundTableId) {
         currentTableId = String(foundTableId); // ID таблицы Table7
         console.log(`DEBUG: handleOptionsUpdate: Current Table ID (Table7) set to: ${currentTableId}`);
    } else {
        console.warn("DEBUG: handleOptionsUpdate: Could not find tableId for Table7 in options/interaction. Will rely on getTableId() at click time.");
        currentTableId = null;
    }
}

function handleGristRecordUpdate(record, mappings) {
    console.log("DEBUG: handleGristRecordUpdate: Grist: new selected record in Table7:", record);
    if (!map) { return; }
    currentRecordId = record ? record.id : null; // ID текущей выбранной строки в Table7

    if (record && typeof record.id !== 'undefined') {
        // ВАЖНО: Читаем значение из КОЛОНКИ-ССЫЛКИ 'RouteLink'.
        // ЗАМЕНИТЕ 'RouteLink' на ID вашей колонки-ссылки!
        // Это значение должно быть ID (числовым или вашим UUID) из Table1.
        const refValue = record.RouteLink;
        let extractedRouteId = null;

        if (typeof refValue === 'number') { // Стандартный ID Grist (число)
            extractedRouteId = refValue;
        } else if (typeof refValue === 'string' && refValue.trim() !== "") {
            // Если это ваш текстовый UUID или число в строке
            extractedRouteId = refValue;
        } else if (Array.isArray(refValue) && refValue.length > 0 && typeof refValue[0] === 'string' && refValue[0].toUpperCase() === 'L') {
            // Это формат Grist для ссылок: ["L<table_pk>", row_id] или ["L<table_name>", row_id]
            // Нас интересует row_id (второй элемент)
            if (refValue.length === 2) { // Ожидаем два элемента
                 extractedRouteId = refValue[1]; // Может быть числом или строкой (вашим UUID)
            }
        }
        // Можно добавить console.log(`DEBUG: handleGristRecordUpdate: Raw refValue for RouteLink:`, refValue, `(Type: ${typeof refValue})`);

        g_currentRouteActualRefId = extractedRouteId;
        console.log(`DEBUG: handleGristRecordUpdate: Current g_currentRouteActualRefId (ID of route in Table1, from Table7.RouteLink) set to: ${g_currentRouteActualRefId} (Type: ${typeof g_currentRouteActualRefId})`);

        const lat = record.C; const lng = record.D;
        if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
            map.flyTo(L.latLng(lat, lng), MARKER_ZOOM_LEVEL);
        }
    } else {
        g_currentRouteActualRefId = null;
        console.log("DEBUG: handleGristRecordUpdate: No POI selected, g_currentRouteActualRefId reset.");
    }
}

function loadExistingPOIs(records, mappings) {
    console.log("DEBUG: loadExistingPOIs: Called for Table7. Received records count:", records ? records.length : 0);
    if (!map || !poiMarkersLayer) { return; }
    poiMarkersLayer.clearLayers();
    console.log("DEBUG: loadExistingPOIs: Previous POI markers cleared.");

    if (records && records.length > 0) {
        let addedCount = 0;
        records.forEach(record => {
            const routeNameFromFormula = record.A; // Это значение из формульной колонки A ($RouteLink.A или $RouteLink.UUID)
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

    console.log("DEBUG: handleMapClick: Map clicked at:", positionLeaflet, "Creating POI. Current RouteRef ID to use:", g_currentRouteActualRefId);

    L.marker(positionLeaflet)
        .addTo(poiMarkersLayer)
        .bindPopup(`<i>Новая точка (связь с маршрутом ID: ${g_currentRouteActualRefId || '???'})...</i>`)
        .openPopup();

    let tableIdToUse = currentTableId; // ID таблицы Table7
    if (!tableIdToUse && grist.selectedTable && typeof grist.selectedTable.getTableId === 'function') {
        try {
            const idFromMethod = await grist.selectedTable.getTableId();
            if (idFromMethod && typeof idFromMethod === 'string') { tableIdToUse = idFromMethod; currentTableId = idFromMethod; }
        } catch(err) { console.error("DEBUG: handleMapClick: Error getting Table7 ID:", err); }
    }

    if (!g_currentRouteActualRefId) {
        alert("Контекст маршрута не определен. Сначала выберите маршрут в Table1 (чтобы Table7 отфильтровалась) и кликните на существующую точку в Table7 (если она есть), чтобы виджет 'запомнил' текущий маршрут.");
        console.error("DEBUG: handleMapClick: Cannot add POI - g_currentRouteActualRefId is not set.");
        return;
    }

    // ВАЖНО: g_currentRouteActualRefId УЖЕ ДОЛЖЕН БЫТЬ ПРАВИЛЬНЫМ ID (числом или вашим UUID-строкой)
    // Конвертация в Number(g_currentRouteActualRefId) может быть не нужна, если UUID - строка.
    // Grist должен сам правильно обработать значение для колонки типа Reference.
    const routeRefValueForGrist = g_currentRouteActualRefId;

    if (tableIdToUse && typeof tableIdToUse === 'string') {
        // ВАЖНО: Замените 'RouteLink' на РЕАЛЬНЫЙ ID вашей колонки-ссылки в Table7!
        const newRecord = {
            'RouteLink': routeRefValueForGrist, // Передаем ID (число или UUID-строку)
            'B': poiType,
            'C': lat,
            'D': lng,
            'G': description
        };

        const userActions = [ ['AddRecord', tableIdToUse, null, newRecord] ];
        console.log(`DEBUG: handleMapClick: Attempting to add record to Grist table ${tableIdToUse}:`, JSON.stringify(newRecord));
        try {
            if (!grist.docApi?.applyUserActions) { throw new Error("Grist docApi not available."); }
            await grist.docApi.applyUserActions(userActions);
            console.log(`DEBUG: handleMapClick: New POI record add action sent successfully.`);
        } catch (error) {
            console.error(`DEBUG: handleMapClick: Failed to add record to Grist:`, error);
            alert(`Ошибка добавления POI в Grist: ${error.message}`);
        }
    } else {
        console.error("DEBUG: handleMapClick: Cannot add record - Table7 ID is unknown.", tableIdToUse);
        alert("Не удалось добавить POI: ID таблицы 'Детали Маршрута' неизвестен.");
    }
}

function updateMarkerOnMap(position, label) {
    // console.log("DEBUG: updateMarkerOnMap called (mostly for centering from onRecord)");
}

// === БЛОК РУЧНОЙ ИНИЦИАЛИЗАЦИИ LEAFLET (из ответа #177) ===
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
        setTimeout(checkLeafletApi, 1000);
    }
    console.log("DEBUG: checkLeafletApi: --- Bottom of function (after if/else or error) ---");
}

// === ТОЧКА ВХОДА (ПРЯМОЙ ВЫЗОВ ПРОВЕРКИ API) ===
console.log("DEBUG: Main script: --- START --- About to call checkLeafletApi for the first time.");
checkLeafletApi();
console.log("DEBUG: Main script: --- END --- grist_map_widget_hiking_poi.js has finished initial synchronous execution.");
// === КОНЕЦ СКРИПТА ===
