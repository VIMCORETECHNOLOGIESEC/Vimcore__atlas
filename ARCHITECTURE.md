# Atlas Cultural — propuesta técnica

## Objetivo del prototipo

Validar el recorrido principal antes de invertir en cartografía y modelado: vista territorial, selección de un punto, acercamiento cinematográfico, aparición del edificio 3D y retorno al país.

## Arquitectura recomendada

- **Interfaz:** React + TypeScript. Mantiene el catálogo, la ficha del museo y el estado de navegación.
- **Escena 3D:** Three.js mediante React Three Fiber. Resuelve cámara, luces, materiales, picking de pines y carga de modelos.
- **Animación:** interpolación por frame para la cámara y escalado del edificio. Para una narrativa más larga puede añadirse GSAP Timeline.
- **Territorio real:** GeoJSON simplificado convertido a malla extruida. Para relieve real, usar un heightmap o tiles de elevación con varios niveles de detalle.
- **Museos reales:** modelos `.glb`/`.gltf` optimizados en Blender; compresión Draco/Meshopt y texturas KTX2.
- **Datos:** catálogo JSON o CMS con identificador, nombre, latitud, longitud, texto, miniatura y URL del modelo.

## Implementación actual

- Silueta continental aproximada de 51 coordenadas geográficas.
- Malla topográfica procedural con costa, doble corredor andino, Amazonía y curvas visuales de nivel.
- Peana extruida y contorno superior para reforzar la lectura territorial.
- Museos conceptuales visibles a escala exagerada y posicionados con latitud/longitud.
- Labels HTML accesibles que activan la transición de cámara.
- Navegación orbital con límites de inclinación, distancia y objetivo para impedir vistas bajo el mapa.
- Panel lateral independiente del canvas; en móvil se transforma en una sección inferior.

## Flujo de interacción

1. Se carga una representación liviana del país y sus pines.
2. El usuario elige un pin; raycasting identifica el museo.
3. La cámara interpola hacia una posición relativa al punto seleccionado.
4. El edificio aparece y escala desde el terreno mientras se abre la ficha.
5. “Vista país” revierte cámara, escala y panel sin recargar la página.

## Paso de prototipo a producción

1. Sustituir el contorno ilustrativo por GeoJSON oficial y el relieve procedural por un DEM/heightmap validado.
2. Definir un presupuesto por museo: idealmente menos de 5 MB iniciales y carga diferida de detalles.
3. Exportar cada museo desde Blender con pivote, escala y orientación homogéneos.
4. Precargar sólo el museo seleccionado y liberar recursos al cambiar de ubicación.
5. Añadir niveles de detalle, fallback 2D y medición de FPS para móviles modestos.
6. Incorporar el recorrido interior como una segunda escena únicamente después de validar navegación y rendimiento.

## Riesgos a controlar

- Los modelos fotogramétricos sin optimizar saturan memoria y GPU móvil.
- Un mapa geográficamente exacto necesita una única proyección consistente para pines y terreno.
- Cámara, etiquetas HTML y objetos 3D deben mantener legibilidad en pantallas pequeñas.
- El contenido cultural necesita una fuente editorial y derechos claros para textos, imágenes y modelos.
