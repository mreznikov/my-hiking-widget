// === ПОЛНЫЙ КОД JAVASCRIPT ВИДЖЕТА (Версия #182 - Явная передача ссылки на маршрут) ===

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let map;
let currentTableId = null;  // ID таблицы Table7 (Детали Маршрута)
let currentRecordId = null; // ID текущей выбранной строки в Table7
const MARKER_ZOOM_LEVEL = 15;
let poiMarkersLayer = null;
let g_currentRouteRefId = null; // ID связанной строки из Table1 (значение из колонки-ссылки в Table7)

// === ОСНОВНЫЕ ФУНКЦИИ ВИДЖЕТА ===

function initMap() {
    console.log("Leaflet initMap() for Israel Hiking Map called.");
    const initialCoords = [31.5, 34.8];
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
        poiMarkersLayer = L.layerGroup().addTo(map);
        console.log("poiMarkersLayer initialized and added to map.");
        map.on('click', handleMapClick);
        console.log("Leaflet map click listener added.");
        setupGrist();
    } catch (e) {
        console.error("Error creating Leaflet Map object:", e);
        alert("Error creating Leaflet Map: " + e.message);
    }
}

function setupGrist() {
     if (typeof grist === 'undefined' || !grist.ready) { console.error("Grist API not found..."); return; }
     console.log("Setting up Grist interaction...");
    grist.ready({
        requiredAccess: 'full',
        columns: [
            // Колонка A в Table7 - для названия маршрута (будет формульной)
            { name: "A", type: 'Any',    optional: true, title: 'Название Маршрута (из Table1)' },
            { name: "B", type: 'Text',    title: 'Тип объекта' },
            { name: "C", type: 'Numeric', title: 'Широта' },
            { name: "D", type: 'Numeric', title: 'Долгота' },
            { name: "G", type: 'Text', optional: true, title: 'Описание POI' },
            // ВАЖНО: Замените 'RouteLink' на РЕАЛЬНЫЙ ID вашей колонки-ссылки в Table7,
            // которая ссылается на Table1. Тип Grist будет Ref:ИмяTable1.
            // Для виджета достаточно указать Any или Numeric (если это ID).
            { name: "RouteLink", type: 'Any', title: 'Ссылка на Маршрут (ID из Table1)' }
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

    if (foundTableId) {
         currentTableId = String(foundTableId); // Убедимся, что это строка (для Table7)
         console.log(`Current Table ID (Table7) set to: ${currentTableId}`);
    } else {
        console.warn("Could not find tableId for Table7 in options/interaction.");
        currentTableId = null;
    }
}

function handleGristRecordUpdate(record, mappings) {
    console.log("Grist: handleGristRecordUpdate - new selected record in Table7:", record);
    if (!map) { return; }
    currentRecordId = record ? record.id : null; // ID текущей строки в Table7

    if (record && typeof record.id !== 'undefined') {
        // ВАЖНО: Замените 'RouteLink' на РЕАЛЬНЫЙ ID вашей колонки-ссылки в Table7!
        g_currentRouteRefId = record.RouteLink || null; // Сохраняем ID связанного маршрута из Table1
        console.log(`Current g_currentRouteRefId (from Table1 via Table7.RouteLink) set to: ${g_currentRouteRefId}`);

        const lat = record.C; // Широта из колонки C Table7
        const lng = record.D; // Долгота из колонки D Table7
        if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
            map.flyTo(L.latLng(lat, lng), MARKER_ZOOM_LEVEL);
        }
    } else {
        g_currentRouteRefId = null; // Сбрасываем, если нет выбранной записи
        console.log("No specific POI record selected in Table7, g_currentRouteRefId reset.");
    }
}

function loadExistingPOIs(records, mappings) {
    console.log("loadExistingPOIs called for Table7. Received records count:", records ? records.length : 0);
    if (!map || !poiMarkersLayer) { return; }
    poiMarkersLayer.clearLayers();

    if (records && records.length > 0) {
        records.forEach(record => {
            const routeName = record.A; // Название маршрута (из формулы $RouteLink.A)
            const type = record.B;
            const lat = record.C;
            const lng = record.D;
            const description = record.G || "";

            let popupText = `<b>Маршрут:</b> ${routeName || "N/A"}<br><b>Тип:</b> ${type || "N/A"}`;
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

    console.log("Map clicked at:", positionLeaflet, "Creating POI. Current RouteRef ID:", g_currentRouteRefId);

    // Временный маркер
    L.marker(positionLeaflet)
        .addTo(poiMarkersLayer) // Добавляем на общий слой, он очистится при обновлении
        .bindPopup(`<i>Новая точка (сохраняется для маршрута ID: ${g_currentRouteRefId || '???'})...</i>`)
        .openPopup();

    let tableIdToUse = currentTableId; // Это должен быть ID таблицы Table7
    if (!tableIdToUse && grist.selectedTable && typeof grist.selectedTable.getTableId === 'function') {
        try {
            const idFromMethod = await grist.selectedTable.getTableId();
            if (idFromMethod && typeof idFromMethod === 'string') { tableIdToUse = idFromMethod; currentTableId = idFromMethod; }
        } catch(err) { console.error("Error getting tableId (Table7) in handleMapClick:", err); }
    }

    // Проверяем, что у нас есть ссылка на маршрут
    if (!g_currentRouteRefId) {
        alert("Не выбран контекст маршрута. Пожалуйста, сначала выберите существующую точку этого маршрута в таблице 'Детали Маршрута' (Table7), или убедитесь, что таблица отфильтрована по маршруту из Table1, и в ней есть хотя бы одна запись.");
        console.error("Cannot add POI: g_currentRouteRefId is not set.");
        // Можно удалить временный маркер, если нужно
        // poiMarkersLayer.eachLayer(layer => { if (layer.getLatLng().equals(positionLeaflet)) map.removeLayer(layer);});
        return;
    }

    if (tableIdToUse && typeof tableIdToUse === 'string') {
        // ЗАМЕНИТЕ 'RouteLink' на РЕАЛЬНЫЙ ID вашей колонки-ссылки в Table7!
        const newRecord = {
            'RouteLink': g_currentRouteRefId, // Явно указываем ID связанной записи из Table1
            'B': poiType,
            'C': lat,
            'D': lng,
            'G': description
        };
        // Колонка 'A' в Table7 НЕ указывается, т.к. она формульная ($RouteLink.A)

        const userActions = [ ['AddRecord', tableIdToUse, null, newRecord] ];
        console.log(`Attempting to add record to Grist table ${tableIdToUse} with RouteLink ${g_currentRouteRefId}:`, JSON.stringify(newRecord));
        try {
            if (!grist.docApi?.applyUserActions) { throw new Error("Grist docApi not available."); }
            await grist.docApi.applyUserActions(userActions);
            console.log(`New POI record add action sent successfully to Grist.`);
            // Grist обновит данные, вызовется onRecords -> loadExistingPOIs
        } catch (error) {
            console.error(`Failed to add record to Grist:`, error);
            alert(`Ошибка добавления POI в Grist: ${error.message}`);
        }
    } else {
        console.error("Cannot add record: Table ID for Table7 is unknown or invalid.", tableIdToUse);
        alert("Не удалось добавить POI: ID таблицы 'Детали Маршрута' неизвестен.");
    }
}

// updateMarkerOnMap() - оставляем пустой или для спец. использования, т.к. POI рисуются в loadExistingPOIs
function updateMarkerOnMap(position, label) {
    // console.log("updateMarkerOnMap called with:", position, label);
}

// === БЛОК РУЧНОЙ ИНИЦИАЛИЗАЦИИ LEAFLET ===
function checkLeafletApi() {
    console.log("DEBUG: === ENTERING checkLeafletApi ===");
    if (typeof L === 'object' && L !== null && typeof L.map === 'function') {
        console.log("DEBUG: Leaflet API check PASSED.");
        initMap();
    } else {
        console.warn("DEBUG: Leaflet API check FAILED. Retrying shortly...");
        setTimeout(checkLeafletApi, 250);
    }
    console.log("DEBUG: === EXITING checkLeafletApi (may retry via timeout) ===");
}
// === ТОЧКА ВХОДА (ПРЯМОЙ ВЫЗОВ ПРОВЕРКИ API) ===
console.log("DEBUG: Calling checkLeafletApi directly now for Israel Hiking Map POI widget.");
checkLeafletApi();
console.log("grist_map_widget_hiking_poi.js executed.");
// === КОНЕЦ СКРИПТА ===
