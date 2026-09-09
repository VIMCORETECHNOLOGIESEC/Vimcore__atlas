# Ecuador elevation raster

`elevation.json` contains actual terrain elevations sampled from [Mapzen Terrain Tiles / AWS Open Data](https://registry.opendata.aws/terrain-tiles/) on 2026-09-09. It is a 320 × 350 regular longitude/latitude grid, covering west −81.10°, east −75.18°, south −5.02°, north 1.46°. The 112,000 values are row-major integer meters: row 0 is north, column 0 west, with both bounding endpoints included. Longitude = west + column/(width−1) × (east−west); latitude = north − row/(height−1) × (north−south).

## Data and transformation

Thirty 256 × 256 Terrarium PNG tiles at zoom 8, x=70…74 and y=126…131, were fetched from `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/8/{x}/{y}.png`. Source elevation was decoded as `(red × 256 + green + blue/256) − 32768`, following [the provider's format documentation](https://github.com/tilezen/joerd/blob/master/docs/formats.md). Numeric elevation samples were bilinearly reprojected from Web Mercator pixel centers onto the regular longitude/latitude grid, then rounded to meters. There is no synthetic terrain, peak injection, noise, smoothing filter, or manual elevation correction. Negative bathymetry is preserved. The grid spacing is approximately 2.06 km; narrow summits are reduced by coarse sampling. `maxElevation` is the actual grid maximum, not Ecuador's surveyed summit height.

`build_elevation.py` reproduces the asset with Python, NumPy and Pillow. `tile-manifest.json` records the 30 source URLs, SHA-256 digests, and actual source-image filenames reported by the AWS `x-amz-meta-x-imagery-sources` headers. `validation.json` records checks and the asset digest. `elevation-preview.png` is a derived inspection preview only.

## Reuse and attribution

The [AWS registry's license link](https://registry.opendata.aws/terrain-tiles/) points to [Tilezen's source-specific attribution and terms](https://github.com/tilezen/joerd/blob/master/docs/attribution.md). For this Ecuador extent at zoom 8, the [documented source table](https://github.com/tilezen/joerd/blob/master/docs/data-sources.md) identifies USGS SRTM on land and NOAA ETOPO1 offshore; these are described in the terms as public-domain datasets. The downloaded tiles also identify GMTED2010 fallback imagery in their AWS metadata; all three sources are credited below. The [USGS SRTM Global data catalog](https://data.usgs.gov/datacatalog/data/USGS%3AEROS5e83a3ee1af480c5) independently lists public access and a public-domain license. This is source-specific open data, not a blanket CC-BY license for the whole global tile collection. Preserve attribution and describe the resampling modification.

Suggested visible map credit: **Terrain: Mapzen / AWS Open Data; SRTM & GMTED2010: U.S. Geological Survey; ETOPO1: NOAA.**

Long-form source acknowledgment: SRTM and GMTED2010 terrain data courtesy of the U.S. Geological Survey. Global ETOPO1 terrain data: DOC/NOAA/NESDIS/NCEI, U.S. Department of Commerce. These U.S. Government source materials are not subject to copyright protection within the United States. Terrain Tiles was accessed on 2026-09-09 from https://registry.opendata.aws/terrain-tiles/. The longitude/latitude resampling and integer rounding described above were performed for this visualization and are not endorsed by the source agencies.

## Validation

All 112,000 samples are finite integer meters. Minimum −4,015 m lies offshore; maximum 5,960 m is near Chimborazo at −78.81737°, −1.47364°. Bilinear grid queries give Quito historic center 2,889 m, Guayaquil 9 m, Cuenca 2,548 m, Loja 2,113 m and Coca 257 m. Raw zoom-8 source queries at the same points are 2,829 m, 14 m, 2,544 m, 2,070 m and 255 m. The grid also retains distinct Cotopaxi and Cayambe highlands. The few-kilometer render grid is appropriate for regional relief visualization, not exact point or summit elevations.
