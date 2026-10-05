# Asset map

Maps every extracted asset and every shared DOM id to its source.
Source frames live one level above `site/`: `Desktop - 9.svg` … `Desktop - 19.svg` (never edit them).

## Rasters (`assets/img/`)
_Filled in by T1._ Known from inspection (base64 PNG inside each SVG's `<pattern>`):

| Planned file | Source frames | Raster size | Notes |
|---|---|---|---|
| hero-a | D9 | 1447×1087 | woman holding phone |
| hero-a-glow | D10 | 1448×1086 | same shot, glowing face dots baked in |
| front | D11, D12, D13 (identical) | 1526×1031 | facing camera, soft-blue bg |
| cheek | D14, D15 (identical) | 1483×1061 | cheek close-up |
| skin | D16 | 1774×887 | skin cross-section, placed at y=457 |
| finale | D19 | 1672×941 | heart/lungs overlay |

## Vectors (`assets/svg/`)
_Filled in by T1._

## Shared DOM (used by more than one scene)
| Selector | Owner | Used by | Purpose |
|---|---|---|---|
| `#nav` | index.html | all | persistent nav (fixed, outside stage) |
| `#stage` | index.html | all | pinned stage; every scene appends one `.layer` |
| `.layer--<scene-id>` | main.js | its scene | one per config entry, created in config order |

## Image sequences (`assets/seq/`)
_T4: `assets/seq/turn/` head-turn frames._
