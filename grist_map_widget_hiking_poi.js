// === ПОЛНЫЙ КОД JAVASCRIPT ВИДЖЕТА (Версия #211 - с перетаскиванием маркеров POI и исправленным handleGristRecordUpdate) ===

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

        // Инициализируем слой для маркеров сразу
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
            { name: "A", type: 'Any',    optional: true, title: 'Название Маршрута (Формула Grist)' },
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

    if (foundTableId) {
         currentTableId = String(foundTableId); // ID таблицы Table7
         console.log(`DEBUG: handleOptionsUpdate: Current Table ID (Table7) set to: ${currentTableId}`);
    } else {
        console.warn("DEBUG: handleOptionsUpdate: Could not find tableId for Table7 in options/interaction.");
        currentTableId = null;
    }
}

// ИСПРАВЛЕННАЯ ВЕРСИЯ ИЗ #208 для парсинга объекта Reference {tableId, rowId}
function handleGristRecordUpdate(record, mappings) {
    console.log("DEBUG: handleGristRecordUpdate: Raw 'record' object received from Grist:", JSON.parse(JSON.stringify(record || {})));

    if (!map) { console.error("DEBUG: handleGristRecordUpdate: Map not initialized yet."); return; }
    currentRecordId = record ? record.id : null; // ID текущей выбранной строки в Table7

    if (record && typeof record.id !== 'undefined' && record.id !== null) {
        // ВАЖНО: Убедитесь, что 'RouteLink' - это РЕАЛЬНЫЙ ID вашей колонки-ссылки в Table7!
        const refValue = record.RouteLink;

        console.log("DEBUG: handleGristRecordUpdate: Value of record.RouteLink (refValue):", refValue);
        console.log(`DEBUG: handleGristRecordUpdate: Type of record.RouteLink (refValue): ${typeof refValue}`);

        let extractedRouteId = null;

        if (typeof refValue === 'number') {
            extractedRouteId = refValue;
            console.log("DEBUG: handleGristRecordUpdate: refValue is a number.");
        } else if (typeof refValue === 'object' && refValue !== null && refValue.hasOwnProperty('rowId')) {
            extractedRouteId = refValue.rowId;
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

        if (g_currentRouteActualRefId !== null && typeof g_currentRouteActualRefId !== 'undefined' && !isNaN(Number(g_currentRouteActualRefId))) {
             g_currentRouteActualRefId = Number(g_currentRouteActualRefId);
        } else if (typeof g_currentRouteActualRefId === 'string' && g_currentRouteActualRefId.trim() === "") {
             g_currentRouteActualRefId = null;
        }
        console.log(`DEBUG: handleGristRecordUpdate: Global g_currentRouteActualRefId set to: ${g_currentRouteActualRefId} (Type: ${typeof g_currentRouteActualRefId})`);

        const lat = record.C; const lng = record.D;
        if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
            map.flyTo(L.latLng(lat, lng), MARKER_ZOOM_LEVEL);
            // Открытие Popup для выбранного маркера
            if (poiMarkersLayer) {
                poiMarkersLayer.eachLayer(layer => {
                    if (layer.options && layer.options.gristRecordId === record.id) {
                        layer.openPopup();
                    }
                });
            }
        }
    } else {
        g_currentRouteActualRefId = null;
        console.log("DEBUG: handleGristRecordUpdate: No POI selected or record is invalid, g_currentRouteActualRefId reset.");
    }
}

/**
 * Загружает существующие POI, делает их перетаскиваемыми и обновляет Grist при перетаскивании.
 */
function loadExistingPOIs(records, mappings) {
    console.log("DEBUG: loadExistingPOIs: Called for Table7. Received records count:", records ? records.length : 0);
    if (!map || !poiMarkersLayer) {
        console.warn("DEBUG: loadExistingPOIs: Map or POI layer not ready.");
        return;
    }
    poiMarkersLayer.clearLayers();
    console.log("DEBUG: loadExistingPOIs: Previous POI markers cleared from poiMarkersLayer.");

    if (records && records.length > 0) {
        let addedCount = 0;
        records.forEach(record => {
            const routeNameFromFormula = record.A; // Название маршрута (из формульной колонки A в Table7)
            const type = record.B;
            const lat = record.C;
            const lng = record.D;
            const description = record.G || "";

            let popupText = `<b>Маршрут:</b> ${routeNameFromFormula || "N/A"}<br><b>Тип:</b> ${type || "N/A"}`;
            if (description) { popupText += `<br><b>Описание:</b> ${description}`; }
            popupText += `<br><small>ID точки: ${record.id}</small>`;

            if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
                const marker = L.marker(L.latLng(lat, lng), {
                    draggable: true, // Делаем маркер перетаскиваемым
                    gristRecordId: record.id // Сохраняем Grist ID в опциях маркера
                })
                .addTo(poiMarkersLayer)
                .bindPopup(popupText);
                addedCount++;

                // Добавляем обработчик события dragend
                marker.on('dragend', async function(event) {
                    const draggedMarker = event.target;
                    const newPosition = draggedMarker.getLatLng();
                    const recordIdToUpdate = draggedMarker.options.gristRecordId;
                    const originalPosition = draggedMarker.options.originalPosition;

                    console.log(`DEBUG: Marker Dragged: ID=${recordIdToUpdate}, NewPos=${newPosition.lat},${newPosition.lng}`);

                    let tableIdToUpdate = currentTableId; // Должен быть ID Table7
                    if (!tableIdToUpdate && grist.selectedTable && typeof grist.selectedTable.getTableId === 'function') {
                        try {
                            tableIdToUpdate = await grist.selectedTable.getTableId();
                            if (tableIdToUpdate) currentTableId = tableIdToUpdate; // Обновляем, если получили
                        } catch (err) {
                            console.error("DEBUG: Marker Drag: Error getting Table7 ID:", err);
                            alert("Ошибка: Не удалось определить таблицу для обновления координат после перетаскивания.");
                            if (originalPosition) draggedMarker.setLatLng(originalPosition);
                            return;
                        }
                    }

                    if (recordIdToUpdate && tableIdToUpdate && typeof tableIdToUpdate === 'string') {
                        const updatedData = {
                            'C': newPosition.lat, // Обновляем Широту
                            'D': newPosition.lng  // Обновляем Долготу
                        };
                        const userActions = [['UpdateRecord', tableIdToUpdate, recordIdToUpdate, updatedData]];
                        try {
                            console.log(`DEBUG: Marker Drag: Updating Grist record ${recordIdToUpdate} in table ${tableIdToUpdate}:`, updatedData);
                            if (!grist.docApi?.applyUserActions) { throw new Error("Grist docApi not available for drag update."); }
                            await grist.docApi.applyUserActions(userActions);
                            console.log(`DEBUG: Marker Drag: Grist record ${recordIdToUpdate} updated successfully.`);
                            draggedMarker.options.originalPosition = newPosition; // Обновляем сохраненную позицию
                        } catch (error) {
                            console.error(`DEBUG: Marker Drag: Failed to update Grist record ${recordIdToUpdate}:`, error);
                            alert(`Ошибка обновления координат точки: ${error.message}`);
                            if (originalPosition) draggedMarker.setLatLng(originalPosition); // Откат на старую позицию
                        }
                    } else {
                        console.error("DEBUG: Marker Drag: Cannot update - recordId or tableId is missing.", { recordIdToUpdate, tableIdToUpdate });
                        if (originalPosition) draggedMarker.setLatLng(originalPosition);
                    }
                });
                // Сохраняем начальную позицию для возможного отката при ошибке обновления
                marker.options.originalPosition = L.latLng(lat, lng);
            }
        });
        console.log(`DEBUG: loadExistingPOIs: Loaded ${addedCount} draggable POIs onto the map.`);
    } else { console.log("DEBUG: loadExistingPOIs: No POIs to load from Grist."); }
}


async function handleMapClick(e) {
    if (!e.latlng) return;
    const lat = e.latlng.lat; const lng = e.latlng.lng;
    const positionLeaflet = e.latlng;
    const poiType = "Точка интереса"; const description = "";

    console.log("DEBUG: handleMapClick: Clicked. Current RouteRef ID to use:", g_currentRouteActualRefId, `(Type: ${typeof g_currentRouteActualRefId})`);

    // Не добавляем маркер сразу, он добавится через loadExistingPOIs после обновления Grist
    // L.marker(positionLeaflet).addTo(poiMarkersLayer).bindPopup(...).openPopup();

    let tableIdToUse = currentTableId;
    if (!tableIdToUse && grist.selectedTable?.getTableId) {
        try {
            const idFromMethod = await grist.selectedTable.getTableId();
            if (idFromMethod && typeof idFromMethod === 'string') { tableIdToUse = idFromMethod; currentTableId = idFromMethod; }
        } catch(err) { console.error("DEBUG: handleMapClick: Error getting Table7 ID:", err); }
    }

    if (g_currentRouteActualRefId === null || typeof g_currentRouteActualRefId === 'undefined') {
        alert("Контекст маршрута не определен. Сначала выберите маршрут в Table1 (чтобы Table7 отфильтровалась) и кликните на существующую точку в Table7 (если она есть), чтобы виджет 'запомнил' текущий маршрут.");
        console.error("DEBUG: handleMapClick: Cannot add POI - g_currentRouteActualRefId is null or undefined.");
        return;
    }

    // g_currentRouteActualRefId уже должен быть правильным типом (число или строка UUID)
    // после обработки в handleGristRecordUpdate
    const routeRefValueForGrist = g_currentRouteActualRefId;

    if (tableIdToUse && typeof tableIdToUse === 'string') {
        // ВАЖНО: Замените 'RouteLink' на РЕАЛЬНЫЙ ID вашей колонки-ссылки в Table7!
        const newRecord = {
            'RouteLink': routeRefValueForGrist,
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
            console.error(`DEBUG: handleMapClick: Failed to add record:`, error);
            alert(`Ошибка добавления POI: ${error.message}`);
        }
    } else {
        console.error("DEBUG: handleMapClick: Cannot add record - Table7 ID is unknown.", tableIdToUse);
        alert("Не удалось добавить POI: ID таблицы 'Детали Маршрута' неизвестен.");
    }
}

function updateMarkerOnMap(position, label) {
    // Эта функция больше не управляет активно POI маркерами,
    // так как loadExistingPOIs их перерисовывает.
    // console.log("DEBUG: updateMarkerOnMap called but not actively managing POI markers.");
}

// === БЛОК РУЧНОЙ ИНИЦИАЛИЗАЦИИ LEAFLET (из ответа #196) ===
function checkLeafletApi() {
    console.log("DEBUG: checkLeafletApi: --- Top of function ---");
    try {
        if (typeof L === 'object' && L !== null && typeof L.map === 'function') {
            console.log("DEBUG: checkLeafletApi: Leaflet (L) is DEFINED and L.map is a function. Calling initMap().");
            initMap();
        } else {
            let leafletStatus = "Leaflet (L) is UNDEFINED.";
            if (typeof L === 'object' && L !== null) { leafletStatus = "Leaflet (L) is an object, but L.map is NOT a function."; }
            else if (typeof L !== 'undefined') { leafletStatus = `Leaflet (L) is of type ${typeof L}, not an object.`; }
            console.warn(`DEBUG: checkLeafletApi: ${leafletStatus} Will retry in 250ms.`);
            setTimeout(checkLeafletApi, 250);
        }
    } catch (e) {
        console.error("DEBUG: checkLeafletApi: !!! ERROR WITHIN checkLeafletApi !!!", e);
        setTimeout(checkLeafletApi, 1000); // Retry after a longer delay on error
    }
    console.log("DEBUG: checkLeafletApi: --- Bottom of function (after if/else or error) ---");
}

// === ТОЧКА ВХОДА ===
console.log("DEBUG: Main script: --- START --- About to call checkLeafletApi for the first time.");
checkLeafletApi();
console.log("DEBUG: Main script: --- END --- grist_map_widget_hiking_poi.js has finished initial synchronous execution.");
// === КОНЕЦ СКРИПТА ===
