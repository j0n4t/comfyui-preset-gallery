Extra preset libraries live here. Drop a *.json file in and it becomes a
library the gallery can merge; remove it and the library goes away.

The bundled library stays at ../presets.json, served as `main` and always
enabled. Every checked library merges into one grid; a preset name two
libraries share is resolved in favour of the last one in the list.
