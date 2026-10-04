# Guess Who catalogue research

Researched 2026-10-04 against official documentation. This is a proposal; no game or catalogue has been implemented.

## Game decisions already made

- Two players share the same randomly selected board and privately choose a secret card.
- Players ask questions and answer each other. The game does not need AI or a complete machine-readable trait database to judge questions.
- A lobby setting enables or disables in-app text chat. With chat disabled, players speak together or use their existing phone call, then explicitly end their turn. No built-in voice service is necessary.
- The category catalogue is larger than a single board. A proposed round samples 20 approved entries, with rematches avoiding recent entries when the pool permits.

## Recommendation

Use a small, reviewed catalogue imported from established sources, rather than requesting new content from a provider whenever someone starts a match. **Wikidata plus Wikimedia Commons is the strongest general-purpose starting point for photographic animals and celebrities.** Animals and food can instead use an existing illustrated emoji catalogue for substantially simpler sourcing and consistent artwork. These sources provide established collections, but none evaluated here is a complete, already-balanced Guess Who board.

Start with animals and celebrities if photographs are the desired visual style. An initial target of roughly 100–200 recognizable entries per category is a product goal, **not a verified count of usable licensed entries**. Validate a small sample first. If minimizing content work matters more than photographs, illustrated animals and foods are easier first categories.

## Source options

| Source | Useful categories | What it supplies | Main limitation |
| --- | --- | --- | --- |
| Wikidata + Wikimedia Commons | Celebrities, animals, landmarks, foods; some fictional characters | Structured identifiers, labels and classifications; associated media | Encyclopedic coverage needs selection for recognizability and image quality; image licenses vary |
| Twemoji / OpenMoji | Animals, foods, everyday objects, sports | Consistent downloadable illustrations; OpenMoji includes a metadata catalogue | Smaller, stylized pools; duplicate animal depictions and variants need filtering |
| iNaturalist | Animals, later plants | Taxonomy, common names, observation photographs | Scientific specificity exceeds game needs; photo rights vary |
| GBIF | Animals and plants | Taxonomic name matching, species/checklist data, occurrence media | Designed for biodiversity records rather than recognizable game cards |
| TMDB | Film/TV celebrities | Popular-person listings and profile images | Commercial licensing and attribution requirements; not all celebrities |
| TheMealDB | Foods/dishes | Meal catalogue, categories and images | Recipes include obscure or visually similar dishes; service terms differ from open-data licenses |

### Wikidata and Commons: best general-purpose foundation

Wikidata's structured data is CC0, with search/entity APIs, SPARQL and dumps as access options. Import specific candidate sets using occupations or category classifications, then review the results. The service explicitly advises against large-scale extraction through SPARQL; a small approved game catalogue does not require a full dump. [Wikidata data access](https://www.wikidata.org/wiki/Help:Data_access)

The `P18` image property points to Commons media. It is a useful initial image suggestion, not a guarantee that a crop fits the card. [Image property](https://www.wikidata.org/wiki/Property:P18)

Commons file rights must be checked individually. Retain the actual creator, source page, license/version and license URL; credit the creator rather than assuming the uploader is the photographer. Commons also warns that images from other Wikimedia projects can have different reuse rules, including non-free material. This particularly affects fictional-character images. Photograph copyright licenses do not automatically resolve every other applicable right. [Commons reuse guidance](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia/en)

The Imageinfo API exposes URLs, thumbnail sizing and extended metadata. Use that metadata to build an attribution record, then verify the source file page where necessary. [Imageinfo API](https://www.mediawiki.org/wiki/API:Imageinfo)

Import ahead of gameplay: WDQS has processing budgets, five concurrent queries per IP, and throttles exceeding clients with HTTP 429. Our game's match-start path should remain independent of its availability. [WDQS service limits](https://www.mediawiki.org/wiki/Wikidata_Query_Service/User_Manual)

### Illustrated catalogues: easiest content pipeline

Twemoji offers downloadable SVG/PNG artwork covering Unicode emoji. Its graphics use CC BY 4.0; code uses MIT. This can provide consistent animal, food and object cards, with attribution in the app's credits. We can copy only the approved assets and pin their release, without adding its parser or a runtime CDN dependency. [Twemoji repository and licensing](https://github.com/jdecked/twemoji)

OpenMoji provides exported SVG/PNG files and a central `openmoji.json` metadata catalogue. Graphics use CC BY-SA 4.0; modified artwork needs the applicable share-alike treatment. The project recommends production releases rather than its development branch. Its group/subgroup metadata is useful for candidate categories, but game-specific filtering remains necessary. [OpenMoji repository](https://github.com/hfg-gmuend/openmoji), [metadata catalogue](https://github.com/hfg-gmuend/openmoji/blob/master/data/openmoji.json)

An emoji animal category should not contain both “cat face” and “cat” as separate answers unless the distinction is deliberate. Remove faces/full-body duplicates, mythical creatures if the category means real animals, and unrelated nature entries. Food similarly needs clear names, rather than variant emoji descriptions.

### iNaturalist and GBIF: useful animal supplements

iNaturalist observation, image and sound licenses are separate. Its default is CC BY-NC, and individual uploaders can choose other licenses or retain rights. Filter and validate photo licenses independently; an openly licensed observation does not establish image rights. Prefer CC0/CC BY photos for a catalogue intended to remain usable if the app later monetizes. [iNaturalist licensing](https://help.inaturalist.org/en/support/solutions/articles/151000175695), [media reuse](https://help.inaturalist.org/en/support/solutions/articles/151000169918)

iNaturalist requests roughly one API request per second and around 10,000 daily, and says its API is for small-to-medium batches rather than bulk extraction. A carefully paced import of approved animals fits better than per-match lookups. [API recommended practices](https://www.inaturalist.org/pages/api+recommended+practices)

GBIF's species API offers scientific-name matching and media endpoints. Useful for validating taxonomy, but not a shortcut to game-friendly common-animal selections. [Species API](https://techdocs.gbif.org/en/openapi/v1/species)

Its occurrence image cache can resize photographs, but media may have stricter licenses than the occurrence data. Images absent from its cache can load slowly or fail because the publisher is unavailable. This supports importing approved assets rather than treating its image cache as our game CDN. [Occurrence image documentation](https://techdocs.gbif.org/en/openapi/images)

For game entries, decide a consistent level: “dog”, “lion” and “penguin” are familiar common concepts; dozens of dog breeds or near-identical penguin species should not silently become separate cards in the same beginner pool.

### TMDB: a more curated celebrity alternative

TMDB supplies a popular-person endpoint and profile-image URLs. This is a useful discovery source for actors, although popularity is not the same as broad recognition and the pool excludes many musicians, athletes and creators. [Popular people](https://developer.themoviedb.org/reference/person-popular-list), [image basics](https://developer.themoviedb.org/docs/image-basics)

The API is free for non-commercial use with attribution. Commercial projects must contact TMDB for licensing; the FAQ also requires approved branding and an endorsement disclaimer in an About/Credits section. It does not claim ownership of API images. Consequently, it is an optional provider, not a frictionless replacement for individually licensed Commons portraits. [Official FAQ](https://developer.themoviedb.org/docs/faq)

### Foods, landmarks and fictional characters

TheMealDB supplies categories, meals and image sizes. Its terms permit copying/modifying content returned through official endpoints, specify free development use and paid service use, and require source attribution for paid API artwork. Clarify production usage under its current terms before choosing it; a recipe collection still needs filtering for Guess Who. [API guide](https://themealdb.com/docs_api_guide.php), [terms](https://www.thecocktaildb.com/terms_of_use.php)

Landmarks can follow the Wikidata/Commons pipeline, with an explicit recognizable shortlist. Foods can follow that pipeline too, or use illustrated assets to avoid variable photography. Defer copyrighted fictional-character artwork until there is a suitable rights-cleared source; a character's name or structured-data entry is not a license for its image.

## Proposed import and runtime design

1. Discover candidates, choose familiar entries, resolve duplicate concepts and review thumbnail suitability.
2. Store a stable ID, display name, category, aliases if useful, approved image, source identifier/page, author and license metadata. Optional short reference facts can help players answer; exhaustive trait tagging is unnecessary.
3. Keep approved images locally as versioned, optimized static assets when their terms permit. The existing frontend hosting can serve them; no separate avatar/blob service is necessary for a modest fixed catalogue. Preserve license notices and record image modifications.
4. At round creation, the server samples the approved catalogue once and saves the board snapshot in the existing room state. Both clients receive the same board; secrets remain private. Crossing out cards stays local and immediate.
5. Update the catalogue outside gameplay and validate imports before release. A missing provider response never blocks a new round.

These are design recommendations, not implemented behavior. Room state remains subject to the existing hosting/restart limitation until room persistence is separately addressed.
