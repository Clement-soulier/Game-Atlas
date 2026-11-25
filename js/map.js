/* =========================
   MAP INITIALIZATION
========================= */

const map = L.map("map", {
    zoomControl: false
}).setView([25, 0], 2);


// Fond cartographique OpenStreetMap
L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
        maxZoom: 19,

        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }
).addTo(map);


// Contrôle du zoom en bas à droite
L.control.zoom({
    position: "bottomleft"
}).addTo(map);


// Groupe de marqueurs
const markers = L.featureGroup().addTo(map);


/* =========================
   GAME IMAGE MARKER
========================= */

function createGameIcon(imageUrl) {

    const content = imageUrl
        ? `<img
                src="${escapeHtml(imageUrl)}"
                alt=""
                onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"
           >
           <div class="marker-fallback" style="display:none">◈</div>`
        : `<div class="marker-fallback">◈</div>`;

    return L.divIcon({

        className: "",

        html: `
            <div class="game-marker">
                ${content}
            </div>
        `,

        iconSize: [54, 72],
        iconAnchor: [27, 36]
    });
}


/* =========================
   ADD STUDIO MARKER
========================= */

function addStudioMarker(studio, gameImage) {

    const icon = createGameIcon(gameImage);

    const marker = L.marker(
        [studio.latitude, studio.longitude],
        { icon }
    );

    marker.addTo(markers);

    marker.on("click", () => {
        showStudioDetails(studio);
    });

    return marker;
}


/* =========================
   DISPLAY MARKERS
========================= */

function displayStudios(studios, gameImage) {

    markers.clearLayers();

    const validStudios = studios.filter(studio => {

        const lat = Number(studio.latitude);
        const lon = Number(studio.longitude);

        return (
            Number.isFinite(lat) &&
            Number.isFinite(lon) &&
            lat >= -90 &&
            lat <= 90 &&
            lon >= -180 &&
            lon <= 180
        );

    });

    validStudios.forEach(studio => {
        addStudioMarker(studio, gameImage);
    });

    if (validStudios.length > 0) {

        map.fitBounds(markers.getBounds(), {
            paddingTopLeft: [40, 100],
            paddingBottomRight: [390, 40],
            maxZoom: 7
        });

    }

    return validStudios.length;
}
