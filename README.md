# Game Atlas

Application web permettant de rechercher des jeux vidéo et de visualiser
géographiquement leurs studios développeurs.

## Technologies

- HTML5
- CSS3
- JavaScript
- Wikidata API
- SPARQL
- Leaflet
- OpenStreetMap

## Fonctionnement

1. Recherche d'un jeu dans Wikidata.
2. Récupération de son identifiant QID.
3. Extraction des studios développeurs avec SPARQL.
4. Récupération des sièges sociaux et coordonnées.
5. Affichage des studios sur une carte interactive.

## Lancement local

pré-requis:
- Python

Lancer le serveur:
```bash
python3 -m http.server 7000
```

Ouvrir ensuite dans un navigateur l'url: `http://localhost:8000`

## Sources

- [wikidata](https://www.wikidata.org/)
- [leafletjs](https://leafletjs.com/)
- [openstreetmap](https://www.openstreetmap.org/)

## Limitations

Les localisations correspondent aux sièges sociaux renseignés dans Wikidata,
et non nécessairement aux lieux effectifs de développement.

La couverture des données dépend des contributions disponibles dans Wikidata.
