// === ПОЛНЫЙ КОД JAVASCRIPT ВИДЖЕТА (Версия #177 - БЕЗ авто-заполнения колонки А) ===

// === ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ ===
let map;
let currentTableId = null;
let currentRecordId = null;
const MARKER_ZOOM_LEVEL = 15;
let poiMarkersLayer = null;
// УБРАЛИ: let g_currentRouteName = null;

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
    } catch (e) { /* ... error handling ... */ }
}

function setupGrist() {
     if (typeof grist === 'undefined' || !grist.ready) { console.error("Grist API not found..."); return; }
     console.log("Setting up Grist interaction...");
    grist.ready({
        requiredAccess: 'full',
        columns: [ // Колонка A остается для возможного ручного ввода или отображения
            { name: "A", type: 'Text',    optional: true, title: 'Название/Ссылка Маршрута' }, // Обновили title
            { name: "B", type: 'Text',    title: 'Тип объекта' },
            { name: "C", type: 'Numeric', title: 'Широта' },
            { name: "D", type: 'Numeric', title: 'Долгота' },
            { name: "G", type: 'Text', optional: true, title: 'Описание POI' }
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
    if (foundTableId) { currentTableId = String(foundTableId); console.log(`Current Table ID set to: ${currentTableId}`);}
    else { console.warn("Could not find tableId in options/interaction."); currentTableId = null; }
}

function handleGristRecordUpdate(record, mappings) {
    console.log("Grist: handleGristRecordUpdate - new selected record:", record);
    if (!map || !record || typeof record.id === 'undefined') { return; }
    currentRecordId = record.id;

    // УБРАЛИ: g_currentRouteName = record.A || null;

    const lat = record.C; // Широта из колонки C
    const lng = record.D; // Долгота из колонки D
    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
        const position = L.latLng(lat, lng);
        map.flyTo(position, MARKER_ZOOM_LEVEL);
        console.log("Map flew to selected POI from Grist:", position);
    }
}

function loadExistingPOIs(records, mappings) {
    console.log("loadExistingPOIs called. Received records count:", records ? records.length : 0);
    if (!map) { console.error("Map not initialized in loadExistingPOIs"); return; }
    if (!poiMarkersLayer) { poiMarkersLayer = L.layerGroup().addTo(map); }

    poiMarkersLayer.clearLayers();
    console.log("Previous POI markers cleared from poiMarkersLayer.");

    if (records && records.length > 0) {
        let addedCount = 0;
        records.forEach(record => {
            const routeNameOrLink = record.A; // Читаем колонку A
            const type = record.B;
            const lat = record.C;
            const lng = record.D;
            const description = record.G || "";

            let popupText = `<b>Тип:</b> ${type || "N/A"}`;
            if (routeNameOrLink) { popupText += `<br><b>Маршрут:</b> ${routeNameOrLink}`; } // Отображаем, если есть
            if (description) { popupText += `<br><b>Описание:</b> ${description}`; }
            popupText += `<br><small>ID: ${record.id}</small>`;

            if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
                L.marker(L.latLng(lat, lng), { gristRecordId: record.id })
                    .addTo(poiMarkersLayer)
                    .bindPopup(popupText);
                addedCount++;
            }
        });
        console.log(`Loaded ${addedCount} POIs onto the map from Grist records.`);
    } else { console.log("No POIs to load from Grist."); }
}

/**
 * Обрабатывает клик, ставит маркер и добавляет запись в Grist (B,C,D,G),
 * колонка A (Название Маршрута) будет заполнена формулой Grist.
 * @param {L.LeafletMouseEvent} e - Событие клика Leaflet
 */
async function handleMapClick(e) {
    if (!e.latlng) return;

    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    const positionLeaflet = e.latlng;
    const poiType = "Точка интереса";
    const description = ""; // Пустое описание

    // Убираем routeNameForNewPoi из текста Popup, т.к. оно будет заполнено Grist
    const popupText = `<b>Тип:</b> ${poiType}<br><small>Координаты: ${lat.toFixed(4)}, ${lng.toFixed(4)}</small>`;
    console.log("Map clicked at:", positionLeaflet, "Creating POI:", poiType, "Desc: (empty)");

    // Визуальный маркер (будет обновлен/перерисован из Grist после добавления записи)
    L.marker(positionLeaflet).addTo(poiMarkersLayer || map).bindPopup(popupText).openPopup();

    let tableIdToUse = currentTableId;
    if (!tableIdToUse && grist.selectedTable && typeof grist.selectedTable.getTableId === 'function') {
        try {
            console.log("DEBUG: tableId not from options, trying grist.selectedTable.getTableId()...");
            const idFromMethod = await grist.selectedTable.getTableId();
            if (idFromMethod && typeof idFromMethod === 'string') {
                tableIdToUse = idFromMethod;
                currentTableId = idFromMethod; // Сохраняем для последующих вызовов
                console.log(`DEBUG: Table ID for new POI set to: ${tableIdToUse} via getTableId().`);
            } else {
                console.warn("DEBUG: getTableId() returned invalid value:", idFromMethod);
            }
        } catch(err) { console.error("Error calling grist.selectedTable.getTableId():", err); }
    }

    if (tableIdToUse && typeof tableIdToUse === 'string') {
        // ИЗМЕНЕНО: Убрали поле 'A' из newRecord
        const newRecord = {
            'B': poiType,       // Тип объекта
            'C': lat,           // Широта
            'D': lng,           // Долгота
            'G': description    // Пустое описание
        };
        const userActions = [ ['AddRecord', tableIdToUse, null, newRecord] ];

        console.log(`Attempting to add record to Grist table ID: ${tableIdToUse}`, JSON.stringify(newRecord));
        try {
            if (!grist.docApi?.applyUserActions) { throw new Error("Grist docApi or applyUserActions not available."); }
            console.log("Sending to Grist (applyUserActions):", JSON.stringify(userActions));
            await grist.docApi.applyUserActions(userActions);
            console.log(`New POI record add action sent successfully to Grist.`);
            // После этого Grist должен:
            // 1. Создать запись с B, C, D, G.
            // 2. Заполнить вашу КОЛОНКУ-ССЫЛКУ (например, RouteRef) ID выбранного маршрута из Table1.
            // 3. Вычислить КОЛОНКУ A по ее формуле (например, $RouteRef.A).
            // 4. Прислать событие onRecords, которое вызовет loadExistingPOIs и обновит карту.
        } catch (error) {
            console.error(`Failed to add record to Grist:`, error);
            alert(`Ошибка добавления POI в Grist: ${error.message}\nУбедитесь, что виджет имеет доступ 'full' и вы НЕ в 'Builder'.`);
        }
    } else {
        console.error("Cannot add record: Table ID is unknown or invalid. Current value:", tableIdToUse);
        alert("Не удалось добавить POI: ID таблицы неизвестен. Проверьте настройки виджета и консоль.");
    }
}

function updateMarkerOnMap(position, label) {
    // Эта функция сейчас используется только для центрирования в handleGristRecordUpdate, если необходимо
    // Основная логика маркеров теперь в loadExistingPOIs
    console.log("updateMarkerOnMap called. For POI display, see loadExistingPOIs.");
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
