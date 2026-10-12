# GastroOS

**GastroOS** es una aplicación web progresiva (PWA) para gestionar recetas, planificar menús de lunes a viernes, controlar existencias, calcular compras y aplicar las normas de una cocina de autoservicio.

Está construida con HTML, CSS y JavaScript sin framework de aplicación ni backend propio. La información de trabajo se guarda en el navegador; la sincronización con GitHub es opcional.

## Funciones principales

- Catálogo de recetas: creación, edición, filtros, edición masiva, técnicas, clasificaciones, ingredientes y alérgenos.
- Generación y validación de menús semanales con estructura configurable, reglas diarias y semanales, límites de repetición, restricciones de carnes y pescados, guisos y disponibilidad de stock.
- Regeneración de días y búsqueda de alternativas que respeten las reglas configuradas.
- Gestión diferenciada de materias primas/productos precocinados y platos elaborados.
- Cálculo de la lista de la compra, agrupación por categoría de proveedor, ajuste de cantidades y exportación TXT.
- Catálogos editables de carnes y especies de pescado.
- Alérgenos por producto, historial local, diagnósticos, copias de seguridad y restauración.
- PWA instalable, almacenamiento local y sincronización opcional de `recipes.json` con GitHub Contents API.

## Arquitectura actual

```text
GastroOS-main/
├── index.html                  # Interfaz, vistas y carga ordenada de módulos
├── css/gastroos.css            # Estilos propios de la aplicación
├── js/
│   ├── gastroos.js             # Estado de la app, interfaz y orquestación principal
│   ├── data-store-facade.js    # Acceso y migraciones de localStorage
│   ├── kitchen-rules.js        # Perfil y configuración de las reglas de cocina
│   ├── stock-utils.js          # Normalización y validación de registros de stock
│   ├── shopping-engine.js      # Cálculos de necesidades y compra
│   ├── menu-generation-engine.js # Orquestación de intentos de generación semanal
│   ├── menu-selection-rules.js # Reglas estructurales para elegir platos
│   ├── menu-structure-validator.js # Validación estructural de la semana
│   ├── menu-daily-rules.js     # Restricciones de composición diaria
│   ├── menu-frequency-rules.js # Límites y frecuencias semanales
│   ├── menu-continuity-rules.js # Restricciones entre días consecutivos
│   ├── menu-engine-facade.js   # Fachada sobre las funciones del motor existentes
│   ├── github-network.js       # Construcción de rutas y timeout de red de GitHub
│   └── github-facade.js        # Fachada para las operaciones de sincronización
├── recipes.json                # Recetario semilla y metadatos compartidos del catálogo
├── manifest.json               # Metadatos de instalación PWA
├── sw.js                       # Instalación, actualización y caché offline
├── icon-192.png
├── icon-512.png
├── apple-touch-icon.png
├── favicon-32.png
└── README.md
```

### Responsabilidades y límites

- `gastroos.js` sigue siendo el módulo principal y contiene partes importantes del motor culinario y de la interfaz. Las fachadas no son motores duplicados: exponen funciones existentes para facilitar una separación gradual.
- Los módulos `*-rules.js`, `menu-structure-validator.js`, `stock-utils.js` y `shopping-engine.js` aíslan comprobaciones o cálculos para poder probarlos por separado.
- Los scripts de `index.html` se cargan en un orden deliberado: primero utilidades y reglas, después `gastroos.js` y finalmente las fachadas que exponen sus funciones.
- `recipes.json` se utiliza como fuente inicial cuando no hay recetario local utilizable. La instalación del Service Worker lo trata como recurso esencial junto con los módulos de aplicación.

## Datos y persistencia

- `localStorage` guarda el recetario de trabajo, la configuración, existencias, menú actual e histórico, alérgenos, copias automáticas y metadatos de sincronización.
- Las migraciones de esquema se realizan mediante `data-store-facade.js`. No borres manualmente las claves `chefTrack_*` si quieres conservar los datos.
- Las copias de seguridad exportadas son la vía recomendada para trasladar o recuperar datos. Haz una exportación antes de actualizar la aplicación o restaurar datos antiguos.
- El token de GitHub se conserva en `sessionStorage` de la pestaña/sesión del navegador. La configuración no secreta del repositorio se guarda por separado en `localStorage`. Al cerrar la sesión del navegador, puede ser necesario volver a introducir el token.

## Sincronización con GitHub

La integración es opcional y usa la GitHub Contents API para leer y actualizar el archivo configurado (normalmente `recipes.json`). No se necesita GitHub para usar las funciones locales.

Recomendaciones de seguridad:

1. Usa un token fine-grained con acceso únicamente al repositorio requerido y los permisos mínimos de Contents necesarios para leer/escribir.
2. No incluyas el token en archivos del repositorio, capturas, incidencias ni documentación.
3. El token está disponible para el JavaScript de la aplicación durante la sesión; un script malicioso ejecutado en el mismo origen podría acceder a él. Publica únicamente código de confianza y revoca el token si sospechas que se ha expuesto.
4. GitHub Pages no proporciona un backend secreto: la autenticación se realiza desde el navegador.

`github-network.js` valida el formato de propietario/repositorio/ruta y aplica un timeout a las peticiones. Esto mejora la robustez, pero no elimina errores de red, límites de API ni conflictos de escritura simultánea.

## PWA y funcionamiento sin conexión

El Service Worker usa caché versionada y elimina cachés antiguas de GastroOS al activarse. Durante la instalación precarga los recursos esenciales; si falta un recurso esencial, cancela la instalación en lugar de dejar una shell incompleta. La CDN de Tailwind es opcional durante la instalación y se intenta almacenar en caché cuando está disponible.

**Límite conocido:** `index.html` carga Tailwind desde `https://cdn.tailwindcss.com`. La copia en caché es de mejor esfuerzo y no garantiza el estilo completo en una primera instalación sin conexión ni frente a cambios del proveedor externo. Para offline predecible, la siguiente mejora sería compilar Tailwind como CSS local y probar instalación, actualización y uso sin red en navegadores reales.

Los datos existentes están en `localStorage`, pero la disponibilidad de la interfaz y de los recursos en una instalación inicial sin conexión depende de haber cargado antes la aplicación y sus recursos esenciales con éxito.

## Desarrollo y comprobaciones

No se necesita Node.js para ejecutar la PWA publicada. Node.js se puede usar para comprobaciones estáticas y pruebas automatizadas si están presentes en el repositorio:

```bash
node --check js/gastroos.js
node --check sw.js
```

Antes de publicar cambios, comprueba que todos los módulos referenciados por `index.html` existen y están incluidos en la lista de recursos esenciales de `sw.js`. Después prueba en la aplicación publicada: generación semanal, regeneración de un día, lista de compra, persistencia tras recargar y sincronización de GitHub si está configurada.

## Despliegue

La aplicación puede servirse como sitio estático con GitHub Pages. Publica el contenido de esta carpeta conservando la estructura de archivos. No requiere un proceso de compilación para su funcionamiento actual.

## Diseño y objetivo

GastroOS prioriza claridad, controles compactos y configuración explícita. Su objetivo es automatizar tareas repetitivas de planificación y compra sin ocultar las reglas que condicionan la selección de platos ni quitar al usuario el control final.
