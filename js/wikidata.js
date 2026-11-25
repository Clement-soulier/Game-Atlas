
const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const SPARQL_ENDPOINT = "https://query.wikidata.org/sparql";

/**
 * Recherche des entités Wikidata correspondant à un jeu.
 */
async function searchGames(searchTerm, signal) {
    const search = async (language) => {
        const params = new URLSearchParams({
            action: "wbsearchentities",
            search: searchTerm,
            language,
            uselang: language,
            type: "item",
            limit: "10",
            format: "json",
            origin: "*"
        });

        const response = await fetch(
            `${WIKIDATA_API}?${params}`,
            { signal }
        );

        if (!response.ok) {
            throw new Error(`Erreur de recherche Wikidata : ${response.status}`);
        }

        const data = await response.json();

        return (data.search || []).map((item) => ({
            id: item.id,
            label: item.label,
            description: item.description || "",
            url: item.url
        }));
    };

    let results = await search("fr");

    if (results.length === 0) {
        results = await search("en");
    }

    return results;
}

/**
 * Convertit une image Wikimedia Commons en URL affichable.
 */
function getCommonsImageUrl(imageValue) {
    if (!imageValue) return null;

    try {
        const url = new URL(imageValue);

        if (url.hostname.includes("wikimedia.org")) {
            return imageValue;
        }

        const filename = decodeURIComponent(
            imageValue.split("/").pop()
        );

        return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=400`;
    } catch {
        return null;
    }
}

/**
 * Extrait un QID depuis une URI Wikidata.
 */
function getQid(uri) {
    if (!uri) return null;

    const match = uri.match(/\/(Q[1-9]\d*)$/);

    return match ? match[1] : null;
}

/**
 * Convertit les coordonnées WKT de Wikidata.
 *
 * Exemple : Point(2.3522 48.8566)
 */
function parseWikidataCoordinates(wkt) {
    if (!wkt) return null;

    const match = wkt.match(
        /Point\s*\(\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s+(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*\)/
    );

    if (!match) return null;

    const longitude = Number(match[1]);
    const latitude = Number(match[2]);

    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
    ) {
        return null;
    }

    return { latitude, longitude };
}

/**
 * Exécute une requête SPARQL en POST.
 */
async function executeSparql(query, signal) {
    const response = await fetch(SPARQL_ENDPOINT, {
        method: "POST",
        headers: {
            "Accept": "application/sparql-results+json",
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
        },
        body: new URLSearchParams({ query }),
        signal
    });

    if (!response.ok) {
        throw new Error(
            `Erreur SPARQL HTTP ${response.status}`
        );
    }

    const data = await response.json();

    return data.results.bindings;
}

/**
 * Première étape :
 * récupérer les développeurs et l'image du jeu.
 *
 * Cette requête est volontairement très simple.
 */
function buildDevelopersQuery(gameId) {
    if (!/^Q[1-9]\d*$/.test(gameId)) {
        throw new Error("Identifiant Wikidata invalide.");
    }

    return `
        PREFIX wd: <http://www.wikidata.org/entity/>
        PREFIX wdt: <http://www.wikidata.org/prop/direct/>

        SELECT DISTINCT ?studio ?gameImage
        WHERE {
            wd:${gameId} wdt:P178 ?studio .

            OPTIONAL {
                wd:${gameId} wdt:P18 ?gameImage .
            }
        }
        LIMIT 100
    `;
}

/**
 * Deuxième étape :
 * récupérer les localisations des studios.
 *
 * On utilise UNION pour récupérer les différentes
 * propriétés géographiques sans multiplier les OPTIONAL.
 */
function buildLocationsQuery(studioIds) {
    const values = studioIds
        .map((id) => `wd:${id}`)
        .join(" ");

    return `
        PREFIX wd: <http://www.wikidata.org/entity/>
        PREFIX wdt: <http://www.wikidata.org/prop/direct/>

        SELECT DISTINCT
            ?studio
            ?location
            ?coordinates
            ?country
            ?website
            ?precision

        WHERE {
            VALUES ?studio { ${values} }

            OPTIONAL {
                {
                    ?studio wdt:P159 ?location .
                    BIND("Siège social" AS ?precision)
                }
                UNION
                {
                    ?studio wdt:P740 ?location .
                    BIND("Lieu de formation" AS ?precision)
                }
                UNION
                {
                    ?studio wdt:P625 ?coordinates .
                    BIND(?studio AS ?location)
                    BIND("Coordonnées du studio" AS ?precision)
                }

                OPTIONAL {
                    ?location wdt:P625 ?coordinates .
                }

                OPTIONAL {
                    ?location wdt:P17 ?country .
                }
            }

            OPTIONAL {
                ?studio wdt:P856 ?website .
            }
        }

        LIMIT 500
    `;
}

/**
 * Récupère les libellés français ou anglais
 * des entités Wikidata.
 *
 * On utilise l'API Wikidata plutôt que le service
 * wikibase:label dans les requêtes SPARQL.
 */
async function getEntityLabels(entityIds, signal) {
    const uniqueIds = [...new Set(entityIds.filter(Boolean))];
    const labels = {};

    // L'API Wikidata accepte au maximum 50 identifiants
    // par requête pour les utilisateurs non privilégiés.
    for (let i = 0; i < uniqueIds.length; i += 50) {
        const batch = uniqueIds.slice(i, i + 50);

        const params = new URLSearchParams({
            action: "wbgetentities",
            ids: batch.join("|"),
            props: "labels",
            languages: "fr|en",
            languagefallback: "1",
            format: "json",
            origin: "*"
        });

        const response = await fetch(
            `${WIKIDATA_API}?${params}`,
            { signal }
        );

        if (!response.ok) {
            throw new Error(
                `Erreur API des libellés : ${response.status}`
            );
        }

        const data = await response.json();

        for (const [id, entity] of Object.entries(data.entities || {})) {
            const entityLabels = entity.labels || {};

            labels[id] =
                entityLabels.fr?.value ||
                entityLabels.en?.value ||
                id;
        }
    }

    return labels;
}

/**
 * Détermine le niveau de précision géographique.
 */
function getLocationPrecision(item) {
    if (item.locationPrecision) {
        return item.locationPrecision;
    }

    return "Localisation non renseignée";
}

/**
 * Récupère les développeurs et leurs localisations
 * pour un jeu donné.
 */
async function getGameStudios(gameId, signal) {
    // -----------------------------------------------
    // ÉTAPE 1 : développeurs du jeu
    // -----------------------------------------------

    const developersQuery = buildDevelopersQuery(gameId);

    const developerBindings = await executeSparql(
        developersQuery,
        signal
    );

    const studios = new Map();

    let gameImage = null;

    for (const binding of developerBindings) {
        const studioId = getQid(binding.studio?.value);

        if (!studioId) continue;

        if (!studios.has(studioId)) {
            studios.set(studioId, {
                id: studioId,
                name: studioId,
                latitude: null,
                longitude: null,
                location: null,
                country: null,
                website: null,
                locationPrecision: "Localisation non renseignée"
            });
        }

        if (binding.gameImage?.value && !gameImage) {
            gameImage = getCommonsImageUrl(
                binding.gameImage.value
            );
        }
    }

    const studioIds = [...studios.keys()];

    if (studioIds.length === 0) {
        return {
            studios: [],
            gameImage
        };
    }

    // -----------------------------------------------
    // ÉTAPE 2 : localisations des développeurs
    // -----------------------------------------------

    const locationsQuery = buildLocationsQuery(studioIds);

    const locationBindings = await executeSparql(
        locationsQuery,
        signal
    );

    // -----------------------------------------------
    // ÉTAPE 3 : récupérer les libellés
    // -----------------------------------------------

    const entityIds = [];

    for (const binding of locationBindings) {
        const studioId = getQid(binding.studio?.value);
        const locationId = getQid(binding.location?.value);
        const countryId = getQid(binding.country?.value);

        if (studioId) entityIds.push(studioId);
        if (locationId) entityIds.push(locationId);
        if (countryId) entityIds.push(countryId);
    }

    const labels = await getEntityLabels(entityIds, signal);

    // -----------------------------------------------
    // ÉTAPE 4 : construire les résultats
    // -----------------------------------------------

    const results = [];
    const seen = new Set();

    for (const binding of locationBindings) {
        const studioId = getQid(binding.studio?.value);

        if (!studioId || !studios.has(studioId)) continue;

        const studio = studios.get(studioId);

        const locationId = getQid(binding.location?.value);
        const countryId = getQid(binding.country?.value);

        const coordinates = parseWikidataCoordinates(
            binding.coordinates?.value
        );

        const locationPrecision =
            binding.precision?.value ||
            "Localisation non renseignée";

        const website = binding.website?.value || null;

        // Les doublons sont éliminés en fonction
        // du studio et de ses coordonnées.
        const uniqueKey = [
            studioId,
            locationId || "",
            coordinates?.latitude ?? "",
            coordinates?.longitude ?? ""
        ].join("|");

        if (seen.has(uniqueKey)) continue;
        seen.add(uniqueKey);

        results.push({
            id: studioId,
            name: labels[studioId] || studioId,

            latitude: coordinates?.latitude ?? null,
            longitude: coordinates?.longitude ?? null,

            location: locationId
                ? labels[locationId] || locationId
                : null,

            country: countryId
                ? labels[countryId] || countryId
                : null,

            website,

            locationPrecision,

            wikidataUrl:
                `https://www.wikidata.org/wiki/${studioId}`
        });
    }

    // Si un studio n'a aucune localisation renseignée,
    // on le conserve pour que l'application puisse
    // signaler son absence de coordonnées.
    for (const [studioId, studio] of studios) {
        const alreadyPresent = results.some(
            (item) => item.id === studioId
        );

        if (!alreadyPresent) {
            results.push({
                ...studio,
                name: labels[studioId] || studioId,
                wikidataUrl:
                    `https://www.wikidata.org/wiki/${studioId}`
            });
        }
    }

    return {
        studios: results,
        gameImage
    };
}
