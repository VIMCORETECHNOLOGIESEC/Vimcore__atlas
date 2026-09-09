# Atlas Cultural — propuesta técnica

## Objetivo del prototipo

Validar el recorrido principal antes de invertir en cartografía y modelado: contemplar el Ecuador dentro de un libro cartográfico 3D, localizar museos, acercarse a uno de ellos y volver a la vista completa.

## Arquitectura recomendada

- **Interfaz:** React + TypeScript. Mantiene el catálogo, la ficha del museo y el estado de navegación.
- **Escena 3D:** Three.js mediante React Three Fiber. Resuelve cámara, luces, materiales, picking de pines y carga de modelos.
- **Animación:** interpolación por frame para la cámara y escalado del edificio. Para una narrativa más larga puede añadirse GSAP Timeline.
- **Territorio real:** GeoJSON simplificado convertido a malla extruida. Para relieve real, usar un heightmap o tiles de elevación con varios niveles de detalle.
- **Museos reales:** modelos `.glb`/`.gltf` optimizados en Blender; compresión Draco/Meshopt y texturas KTX2.
- **Datos:** catálogo JSON o CMS con identificador estable, slug, nombre, provincia, región, latitud, longitud, colección, variante visual y URL opcional del modelo.

## Implementación actual

- Libro completo construido en 3D: tapas, bloques de hojas, lomo y dos páginas superiores subdivididas con curvatura junto al pliegue.
- El libro no contiene títulos ni listas editoriales: esos elementos permanecen en el panel lateral. Sus páginas muestran únicamente la cartografía y las ubicaciones culturales.
- Silueta continental aproximada de 51 coordenadas geográficas, acompañada de un inserto de Galápagos.
- Malla topográfica procedural en bajo relieve y paleta de pergamino; la lámina del país es deliberadamente fina para conservar la visibilidad de los edificios.
- Museos conceptuales visibles a escala exagerada y posicionados con latitud/longitud.
- Labels HTML accesibles, unidos a sus pines mediante líneas guía, que activan la transición de cámara.
- Navegación orbital de todo el conjunto con límites de inclinación, distancia y objetivo para impedir vistas bajo el libro.
- Panel lateral independiente del canvas con búsqueda, filtros regionales y catálogo paginado en lotes de 20; en móvil se transforma en una sección inferior.

## Escala de 3 a 140 museos

- Los tres registros actuales son un catálogo piloto; no se inventan los 137 registros restantes.
- Los identificadores y variantes ya son abiertos, sin condicionales ligados a Quito, Cuenca o Guayaquil.
- Se montan como máximo 12 modelos y labels prioritarios. Los demás registros se representan en la vista general mediante un `InstancedMesh` liviano.
- El museo seleccionado siempre entra en el grupo prioritario. En producción, su `.glb` detallado se descargará bajo demanda; los demás conservarán proxies compartidos.
- Búsqueda y filtros operan sobre nombre, ciudad, provincia, región y colección. La lista lateral muestra 20 resultados por lote.
- Cuando se incorpore el catálogo completo, los puntos cercanos deben agruparse en pantalla: clusters en vista país, un máximo de 6–8 labels en zoom medio y 10–12 en zoom cercano.
- Para ciudades con varios museos, el cluster mostrará ciudad y cantidad; al acercarse, cada label mostrará museo y ciudad.

## Flujo de interacción

1. Se carga el libro, una representación liviana del país y los pines prioritarios.
2. El usuario filtra el catálogo o elige un label anclado al mapa.
3. La cámara interpola hacia una posición relativa al punto seleccionado.
4. El edificio se destaca mientras se abre la ficha dentro del panel lateral, sin cubrir la escena.
5. “Vista país” revierte cámara, escala y panel sin recargar la página.

## Paso de prototipo a producción

1. Sustituir el contorno ilustrativo por GeoJSON oficial del IGM, incluyendo Ecuador continental y Galápagos, y validar su proyección.
2. Importar los 140 registros desde una fuente editorial o CMS, con coordenadas y taxonomías verificadas.
3. Definir un presupuesto por museo: proxy compartido en vista general y menos de 5 MB para el modelo detallado cargado bajo demanda.
4. Exportar cada museo desde Blender con pivote, escala, altura de ancla y orientación homogéneos.
5. Implementar clustering en coordenadas de pantalla y carga diferida de `.glb`, Draco/Meshopt y KTX2.
6. Añadir niveles de detalle, fallback 2D y medición de FPS para móviles modestos.
7. Incorporar el recorrido interior como una segunda escena únicamente después de validar navegación y rendimiento.

## Riesgos a controlar

- Los modelos fotogramétricos sin optimizar saturan memoria y GPU móvil.
- Un mapa geográficamente exacto necesita una única proyección consistente para pines y terreno.
- Cámara, líneas guía, etiquetas HTML y objetos 3D deben mantener alineación y legibilidad en pantallas pequeñas.
- La distribución de 140 ubicaciones necesita clustering; renderizar 140 labels DOM simultáneos no es aceptable.
- El contenido cultural necesita una fuente editorial y derechos claros para textos, imágenes y modelos.
