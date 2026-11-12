# Rapport de test : recherche d'œuvre (42 cas)

- **Date** : 12 novembre 2026, branche `test/recherche-oeuvre` (code identique à `main` au commit `2b2d7a3`).
- **Service testé** : `findProposals()` ([src/services/artworkSearch/index.ts](../../src/services/artworkSearch/index.ts)). L'IA Gemini prépare des pistes, puis Wikidata cherche et vérifie. Le test passe par le vrai code, sans l'interface.
- **Modèle d'IA** : `gemini-3.1-flash-lite`, celui réglé sur le téléphone.
- **Déroulement** : passe 1 à froid (mémoire vide), puis passe 2 dans la même session, avec le cache de la passe 1. Un cas à la fois, 1 s de pause entre deux cas. Au plus 41 appels à l'IA par passe (limite fixée : 60).
- **Lancement** : `npm run test:recherche` (la clé est lue dans la variable `GEMINI_API_KEY` et n'est jamais écrite).
- **Fichiers** : les cas sont dans [cas.json](cas.json) et le script dans [lancer.ts](lancer.ts). Le détail de chaque cas (propositions dans l'ordre, temps, appels, tokens, verdict) est dans [resultats.json](resultats.json).
- **Annexe** : un premier passage a été fait avec le modèle par défaut de l'app, `gemini-2.5-flash`. Google l'a refusé (voir le problème n° 1), donc ce passage mesure la recherche **sans IA** : [resultats-sans-ia.json](resultats-sans-ia.json).

## Bilan

| | Passe 1 (à froid) | Passe 2 (avec cache) | Sans IA, à froid | Sans IA, avec cache |
|---|---|---|---|---|
| Cas OK | **41 / 42** | 38 / 42 | 38 / 42 | 38 / 42 |
| Appels IA réussis | 39 / 41 | **10 / 41** (IA surchargée) | 0 / 41 (modèle refusé) | 0 / 41 |

En passe 2, Google a répondu « surchargé » (code 503) 13 fois. Il n'a pas répondu dans le délai de 10 s fixé par l'app 18 fois. Les KO supplémentaires de la passe 2 viennent de là, pas du cache.

## 1. Justesse (cas à réponse unique)

Il y a 30 cas dont le résultat attendu commence par « Top-1 » ou « Même résultat » : 1 à 11, 13 à 15, 17, 21 à 27, 29 à 35 et 40.

| | Passe 1 | Passe 2 | Sans IA |
|---|---|---|---|
| Top-1 juste | **29 / 30 (97 %)** | 28 / 30 (93 %) | 28 / 30 (93 %) |
| Bonne œuvre dans les 3 premières | **30 / 30 (100 %)** | 29 / 30 (97 %) | 29 / 30 (97 %) |

- Le seul KO de la passe 1 est le cas 31 (Le Penseur). C'est un problème pour distinguer les exemplaires, pas une erreur d'œuvre.
- Les cas « Même résultat » (22 à 27, 29) donnent bien la même œuvre en tête que leur cas de référence, sauf le cas 27 en passe 2.
- Les cas de traduction (22 à 25) réussissent même sans IA, grâce aux autres noms connus de Wikidata.

## 2. Faux positifs (artiste saisi) : seuil zéro **non respecté**

Il y a 35 cas avec un artiste saisi (cas 42 exclu). Les résultats sont identiques dans les trois passages.

| Cas | Proposition en trop | Type | Cause probable |
|---|---|---|---|
| 10 David / Michel-Ange | *David avec la tête de Goliath* (2 fois) et *David et Goliath*, du **Caravage** | **Autre artiste** (3) | Le Caravage s'appelait Michelangelo Merisi. Wikidata lui donne l'autre nom « Michel-Ange Merisi », qui contient « Michel » et « Ange ». La vérification de l'artiste l'accepte donc. |
| 10 David / Michel-Ange | *Apollon* (Michel-Ange) | Autre œuvre (1) | Une œuvre du bon artiste, sortie parce que la recherche plein texte trouve « David » dans sa fiche (elle est aussi appelée « David-Apollon »). |
| 3 et 26 Radeau de la Méduse | *Morceaux anatomiques* (Géricault) | Autre œuvre (2) | Une étude du même peintre, liée au Radeau dans Wikidata. Elle apparaît en 2e à 6e position, jamais en tête. |

- **Total** : 3 propositions d'un autre artiste et 3 d'une autre œuvre. Le seuil (zéro) n'est pas respecté.
- **Fausses alertes de mon script, écartées** : au cas 18, *Nymphaea* et *Reflets de nuages sur l'étang aux nénuphars* font bien partie de la série des Nymphéas de Monet. Le mot-clé de contrôle était trop étroit.

## 3. Cas négatifs, trop vagues, tolérance et hors ligne (37 à 42) : seuil 100 %

| Cas | Attendu | Passe 1 | Passe 2 | Sans IA |
|---|---|---|---|---|
| 37 Chat bleu | 0 proposition | OK | OK | OK |
| 38 Joconde / Picasso | 0 proposition | OK | OK | OK |
| 39 Joconde / Vinci / 1900 | 0 proposition | OK | OK | OK |
| 40 Guernica / 1938 | Guernica en tête | OK | OK | OK |
| 41 Portrait d'une femme | Demander l'artiste ou l'année | OK | OK | OK |
| 42 Hors ligne | Message simple, aucun plantage | OK | **KO** | **KO** |
| **Taux** | | **100 %** | 83 % | 83 % |

- **Cas 42** : en passe 1, le service signale bien « hors ligne ». L'écran affiche alors « Vous êtes hors ligne. Vous pouvez saisir l'œuvre à la main », et il n'y a aucun plantage.
- En passe 2 et sans IA, la même recherche avait déjà été faite (cas 1). Le service renvoie alors l'ancien résultat gardé en mémoire, sans signaler la coupure. Ce n'est pas un plantage, mais ce n'est pas le comportement attendu.
- À noter : sur le téléphone, l'écran vérifie d'abord l'état du réseau ([add.tsx:187](../../src/app/add.tsx#L187)) et propose la saisie manuelle avant même d'appeler la recherche. Le KO ne se verrait donc que si le téléphone se croit connecté sans l'être (par exemple un Wi-Fi sans Internet). L'affichage réel n'a pas été testé, puisque le test se fait sans interface.

## 4. Vitesse : seuils **non respectés**

Seuils : médiane 3 s, 9e décile 5 s (temps sous lequel se trouvent 90 % des recherches). Les 42 cas sont comptés.

| | Médiane | 9e décile | Maximum |
|---|---|---|---|
| Passe 1, avec IA, à froid | **7,1 s** | **10,0 s** | 12,9 s |
| Passe 2, avec IA, avec cache | **5,7 s** | **12,3 s** | 12,5 s |
| Sans IA, à froid | 4,5 s | 5,2 s | 5,7 s |
| Sans IA, avec cache | 0,15 s | 0,22 s | 0,27 s |

Causes probables :
- **Wikidata** : le service attend au moins 1 s entre deux appels (règle de politesse envers Wikimedia), et une recherche en fait 5 à 7 à la suite. Cela fait déjà 5 à 7 s. Avec l'IA, il y a 1 à 2 appels de plus, car les autres titres proposés par l'IA sont aussi cherchés.
- **IA** : 1 à 3 s quand elle répond. Quand elle ne répond pas, l'app attend 10 s avant de continuer sans elle. Cela explique les recherches à 12 s.
- **Cache** : il ne garde que les réponses de Wikidata. L'IA est rappelée à chaque recherche, même identique, et son temps n'est donc jamais économisé. De plus, la clé du cache contient les pistes de l'IA : si l'IA répond différemment (ou pas du tout), le cache ne sert pas.

## 5. Coût

| | Passe 1 | Passe 2 | Total des 2 passes |
|---|---|---|---|
| Appels à l'IA | 41 (39 réussis) | 41 (10 réussis) | 82 |
| Tokens (entrée / sortie) | 12 660 (9 167 / 3 493) | 3 234 (2 368 / 866) | 15 894 |
| Tokens par appel réussi | ≈ 325 | ≈ 323 | |
| Appels à Wikimedia | 231 (5,5 par recherche) | 87 (2,1 par recherche) | 318 |

- Par recherche : 1 appel à l'IA (≈ 325 tokens, sans « réflexion » facturée) et 4 à 8 appels à Wikimedia (gratuit).
- Le compteur du script affiche 42 tentatives d'appel à l'IA par passe : la 42e est celle du cas 42, bloquée par la coupure simulée et jamais envoyée.
- Hors passes : le passage sans IA a fait 82 appels refusés (404, sans tokens). Le diagnostic en a fait 1 de plus.

## 6. KO et causes probables

| Cas | Passe(s) | Ce qui s'est passé | Cause probable |
|---|---|---|---|
| 31 Le Penseur | toutes | Deux propositions « Le Penseur — musée Rodin » (fontes Hébrard 1882 et Rudier 1880). 4 exemplaires sur 10 sont sans année. | Plusieurs fiches Wikidata pour des exemplaires du même musée. Ils ne se distinguent que par le fondeur, glissé dans le champ artiste, et par l'année, pas par le lieu. Gravité faible : Rodin est bien en tête. |
| 27 Guernika | passe 2, sans IA | Aucune proposition | Seule l'IA corrige les fautes. Wikidata ne trouve pas « Guernika ». En passe 2, l'IA n'a pas répondu dans les 10 s. |
| 28 la jocconde | passe 2, sans IA | Aucune proposition | Même cause (l'IA a répondu 503 « surchargé » en passe 2). En passe 1, l'IA a corrigé en « La Joconde » : Léonard de Vinci est arrivé 1er, et l'écran demande en plus l'artiste ou l'année (28 œuvres homonymes). |
| 42 Hors ligne | passe 2, sans IA | Ancien résultat renvoyé au lieu de « hors ligne » | Le cache est consulté avant le réseau. Voir la section 3. |

Points vérifiés et réussis, à garder à l'esprit :
- 12 et 16 : l'écran demande l'artiste ou l'année et montre la liste. Klimt, Rodin, Manet et Monet y figurent comme œuvres distinctes.
- 14 : la version de 1889 du MoMA est en tête, celle d'Orsay de 1888 en 2e.
- 17 : la Vénus de Milo du Louvre est en tête, sans aucune œuvre de Dalí.
- 35 : les deux propositions sont de Banksy et n'ont pas d'image, donc pas d'image douteuse.
- 36 : aucune proposition.

### Les 3 problèmes les plus graves

1. **Le modèle d'IA par défaut est refusé par Google.** `gemini-2.5-flash` répond « 404 : ce modèle n'est plus disponible pour les nouveaux utilisateurs » (Google conseille `gemini-3.8-flash`). Avec le réglage par défaut, l'IA échoue sans rien dire, et l'app cherche sans elle. Les fautes de frappe ne sont alors plus corrigées (cas 27 et 28 en échec). Toute nouvelle installation est concernée.
2. **Lenteur et dépendance à la disponibilité de l'IA.** La médiane est de 7,1 s, plus du double du seuil de 3 s, avec des pointes à 12,9 s. Le cache n'aide presque pas quand l'IA est active. En passe 2, 31 appels sur 41 ont échoué (surcharge ou délai dépassé) : chaque échec coûte 10 s d'attente et fait perdre la correction des fautes, sans que l'utilisateur en soit prévenu.
3. **Faux positifs sur l'artiste.** Avec « Michel-Ange » saisi, 3 tableaux du Caravage sont proposés, parce que son autre nom « Michel-Ange Merisi » passe la vérification. D'autres œuvres du bon artiste se glissent aussi dans la liste (*Morceaux anatomiques*, *Apollon*). Le seuil fixé (zéro) n'est pas respecté.

## Limites du test

- Le test se fait sans interface. Pour les cas 12, 16, 28, 41 et 42, l'affichage est déduit de la logique de [add.tsx](../../src/app/add.tsx#L199-L212), sans l'avoir vu à l'écran.
- La passe 2 a été perturbée par une surcharge de Google : ses temps et ses KO reflètent cette surcharge plus que le cache. Le passage sans IA donne la mesure du cache Wikidata seul.
- Les verdicts reposent sur des mots-clés (artiste, lieu, titre) définis dans [cas.json](cas.json). Les fausses alertes repérées sont signalées ci-dessus.
- L'IA donne des résultats un peu variables d'une fois à l'autre : un nouveau lancement peut donner des chiffres légèrement différents.
