Extra preset libraries live here. Drop a *.json file in and it becomes a
library the gallery can merge; remove it and the library goes away.

The bundled library stays at ../presets.json, served as `main` and always
enabled. Every library is in the merge until you switch it off; a preset name
two libraries share is resolved in favour of the first one in the list. A
library whose last preset is deleted or moved out is removed.
