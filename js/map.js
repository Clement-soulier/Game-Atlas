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

function createGameIcon(imageUrl, gameName, width = 80, height = 110) {
    return L.divIcon({
        className: "custom-game-marker",
        html: `
            <div class="game-marker" style="width:${width}px;height:${height}px">
                <img src="${imageUrl}" alt="${gameName}">
            </div>
        `,
        iconSize: [width, height],
        iconAnchor: [width / 2, height],
        popupAnchor: [0, -height]
    });
}

/* =========================
   ADD STUDIO MARKER
========================= */

function addStudioMarker(studio, gameImage) {

    const MAX_HEIGHT = 110;
    const DEFAULT_WIDTH = 80;

    // Création du marqueur avec une taille provisoire
    const icon = createGameIcon(
        gameImage,
        studio.name,
        DEFAULT_WIDTH,
        MAX_HEIGHT
    );

    const marker = L.marker(
        [studio.latitude, studio.longitude],
        { icon }
    );

    marker.addTo(markers);

    marker.on("click", () => {
        showStudioDetails(studio);
    });

    // Chargement de l'image pour récupérer ses dimensions réelles
    if (gameImage) {
        const img = new Image();

        img.onload = () => {
            const ratio = img.naturalWidth / img.naturalHeight;

            const height = MAX_HEIGHT;
            const width = height * ratio;

            marker.setIcon(
                createGameIcon(
                    gameImage,
                    studio.name,
                    width,
                    height
                )
            );
        };

        img.src = gameImage;
    }

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
