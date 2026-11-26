/* =====================================================
   DOM ELEMENTS
===================================================== */

const searchInput =
    document.getElementById("search-input");

const searchButton =
    document.getElementById("search-button");

const searchResults =
    document.getElementById("search-results");

const infoPanel =
    document.getElementById("info-panel");

const panelContent =
    document.getElementById("panel-content");

const closePanel =
    document.getElementById("close-panel");

const loading =
    document.getElementById("loading");

const notification =
    document.getElementById("notification");


/* =====================================================
   APPLICATION STATE
===================================================== */

let selectedGame = null;

let currentGameImage = null;

let searchTimeout = null;

let searchController = null;

let notificationTimeout = null;

let requestNumber = 0;


/* =====================================================
   UTILS
===================================================== */

function escapeHtml(value) {

    return String(value ?? "").replace(
        /[&<>"']/g,
        character => ({

            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"

        })[character]
    );
}


function safeExternalUrl(value) {

    try {

        const url = new URL(value);

        if (
            url.protocol === "https:" ||
            url.protocol === "http:"
        ) {
            return url.href;
        }

    } catch {
        return null;
    }

    return null;
}


/* =====================================================
   LOADING
===================================================== */

function setLoading(state) {

    loading.classList.toggle("hidden", !state);

    searchButton.disabled = state;
}


/* =====================================================
   NOTIFICATIONS
===================================================== */

function showNotification(message) {

    notification.textContent = message;

    notification.classList.remove("hidden");

    clearTimeout(notificationTimeout);

    notificationTimeout = setTimeout(() => {

        notification.classList.add("hidden");

    }, 4500);
}


/* =====================================================
   SEARCH RESULTS
===================================================== */

function displaySearchResults(results) {

    searchResults.innerHTML = "";

    searchResults.classList.remove("hidden");

    if (results.length === 0) {

        searchResults.innerHTML = `
            <div class="search-empty">
                Aucun résultat trouvé.
            </div>
        `;

        return;
    }

    results.forEach(game => {

        const item = document.createElement("div");

        item.className = "search-result";

        const title = document.createElement("div");

        title.className = "result-title";

        title.textContent = game.label;

        const description = document.createElement("div");

        description.className = "result-description";

        description.textContent =
            game.description || "Aucune description disponible";

        item.append(title, description);

        item.addEventListener("click", () => {
            selectGame(game);
        });

        searchResults.appendChild(item);

    });

}


/* =====================================================
   SEARCH INPUT
===================================================== */

searchInput.addEventListener("input", () => {

    const term = searchInput.value.trim();

    selectedGame = null;

    // Invalider les résultats d'une recherche précédente
    requestNumber++;

    clearTimeout(searchTimeout);

    if (searchController) {
        searchController.abort();
    }

    if (term.length < 2) {

        searchResults.classList.add("hidden");

        return;
    }

    searchTimeout = setTimeout(async () => {

        searchController = new AbortController();

        const controller = searchController;

        try {

            const results = await searchGames(
                term,
                controller.signal
            );

            if (
                controller.signal.aborted ||
                searchInput.value.trim() !== term
            ) {
                return;
            }

            displaySearchResults(results);

        } catch (error) {

            if (error.name === "AbortError") {
                return;
            }

            console.error(error);

            showNotification(
                "Impossible de rechercher les jeux."
            );

        }

    }, 350);

});


/* =====================================================
   SELECT GAME
===================================================== */

async function selectGame(game) {

    if (!game || !/^Q[1-9]\d*$/.test(game.id)) {
        return;
    }

    selectedGame = game;

    searchInput.value = game.label;

    searchResults.classList.add("hidden");

    await loadGame(game);

}


/* =====================================================
   SEARCH BUTTON
===================================================== */

searchButton.addEventListener("click", async () => {

    if (selectedGame) {

        await loadGame(selectedGame);

        return;
    }

    const firstResult =
        searchResults.querySelector(".search-result");

    if (firstResult) {

        firstResult.click();

    } else {

        showNotification(
            "Sélectionne un jeu dans les suggestions."
        );

    }

});


/* =====================================================
   ENTER / ESCAPE
===================================================== */

searchInput.addEventListener("keydown", event => {

    if (event.key === "Enter") {

        event.preventDefault();

        if (selectedGame) {

            loadGame(selectedGame);

        } else {

            const firstResult =
                searchResults.querySelector(".search-result");

            if (firstResult) {
                firstResult.click();
            }

        }

    }

    if (event.key === "Escape") {

        searchResults.classList.add("hidden");

    }

});


/* =====================================================
   LOAD GAME
===================================================== */

async function loadGame(game) {

    const currentRequest = ++requestNumber;

    setLoading(true);

    infoPanel.classList.add("hidden");

    panelContent.innerHTML = "";

    // Effacer les anciens marqueurs
    markers.clearLayers();

    try {

        const result = await getGameStudios(game.id);

        // Ignorer les réponses devenues obsolètes
        if (currentRequest !== requestNumber) {
            return;
        }

        currentGameImage = result.gameImage;

        const count = displayStudios(
            result.studios,
            result.gameImage
        );

        if (count === 0) {

            if (result.studios.length > 0) {

                showNotification(
                    `${result.studios.length} studio(s) trouvé(s), mais aucune coordonnée géographique exploitable.`
                );

            } else {

                showNotification(
                    "Aucun développeur renseigné dans Wikidata pour ce jeu."
                );

            }

            return;
        }

        showNotification(
            `${count} studio(s) géolocalisé(s) pour ${game.label}.`
        );

    } catch (error) {

        if (currentRequest !== requestNumber) {
            return;
        }

        console.error(error);

        showNotification(
            error.message || "Une erreur est survenue."
        );

    } finally {

        if (currentRequest === requestNumber) {
            setLoading(false);
        }

    }

}


/* =====================================================
   STUDIO INFORMATION PANEL
===================================================== */

function showStudioDetails(studio) {

    if (!selectedGame) {
        return;
    }

    const gameImage = currentGameImage
        ? `
            <img
                class="panel-game-image"
                src="${escapeHtml(currentGameImage)}"
                alt="Image de ${escapeHtml(selectedGame.label)}"
            >
        `
        : "";

    const website = safeExternalUrl(studio.website);

    const websiteHtml = website
        ? `
            <div class="info-row">
                <span class="info-label">Site officiel</span>

                <span class="info-value">
                    <a
                        href="${escapeHtml(website)}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Visiter le site
                    </a>
                </span>
            </div>
        `
        : "";

    const wikidataUrl = safeExternalUrl(studio.wikidataUrl);

    panelContent.innerHTML = `

        ${gameImage}

        <div class="panel-subtitle">
            JEU VIDÉO
        </div>

        <h2 class="panel-title">
            ${escapeHtml(selectedGame.label)}
        </h2>

        <div class="panel-section">

            <h3>Studio développeur</h3>

            <div class="info-row">

                <span class="info-label">
                    Nom
                </span>

                <span class="info-value">
                    ${escapeHtml(studio.name)}
                </span>

            </div>

            <div class="info-row">

                <span class="info-label">
                    Pays
                </span>

                <span class="info-value">
                    ${escapeHtml(studio.country || "Non renseigné")}
                </span>

            </div>

            <div class="info-row">

                <span class="info-label">
                    Précision géographique
                </span>

                <span class="info-value">
                    ${escapeHtml(studio.locationPrecision)}
                </span>

            </div>

            <div class="info-row">

                <span class="info-label">
                    Coordonnées
                </span>

                <span class="info-value">
                    ${escapeHtml(studio.latitude)},
                    ${escapeHtml(studio.longitude)}
                </span>

            </div>

            ${websiteHtml}

        </div>

        ${
            wikidataUrl
                ? `
                    <a
                        class="wikidata-link"
                        href="${escapeHtml(wikidataUrl)}"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Consulter sur Wikidata ↗
                    </a>
                `
                : ""
        }

    `;

    infoPanel.classList.remove("hidden");

}


/* =====================================================
   CLOSE PANEL
===================================================== */

closePanel.addEventListener("click", () => {

    infoPanel.classList.add("hidden");

});


/* =====================================================
   CLOSE SEARCH SUGGESTIONS
===================================================== */

document.addEventListener("click", event => {

    if (!event.target.closest(".search-box")) {

        searchResults.classList.add("hidden");

    }

});


/* =====================================================
   INITIALIZATION
===================================================== */

console.log("Game Atlas initialized.");
