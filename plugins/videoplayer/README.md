# Video Player Plugin

Reproductor de video avanzado para **PlaycamHub Studio** con ventanas flotantes, historial automático y playlists.

## Características

- **Mini reproductor por defecto** (320×240) con controles completos.
- **Múltiples reproductores simultáneos**, cada uno en su ventana flotante (drag & drop + resize).
- **3 tamaños predefinidos**: Mini 320×240 · Medio 640×360 · Grande 1280×720.
- **Controles completos**: play/pause, barra de progreso (clic y arrastre), volumen + mute,
  tiempo actual/total, pantalla completa, velocidad (0.5x–2x).
- **Botones de ventana**: minimizar a barra, cerrar.
- **Soporta**: URLs directas (MP4, WebM, OGG) y **HLS** (`.m3u8`, vía `hls.js` cargado bajo demanda),
  más archivos locales (objectURL).
- **Historial persistente** (SQLite): título, fuente, hora de inicio, último segundo visto,
  duración, ID del reproductor. Reanudar desde el segundo donde se dejó.
- **Búsqueda en historial** y borrado individual o total.
- **Playlist persistente** con drag-reorder, exportar/importar JSON.
- **Errores amigables** ante fallos de carga (URL inválida, formato no soportado, CORS).

## Endpoints (Express)

Montado en `/api/videoplayer`:

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET`    | `/history?search=&page=&per_page=` | Historial paginado |
| `POST`   | `/history`                          | Crear registro de reproducción |
| `PUT`    | `/history/:id`                      | Actualizar `last_position` / `duration` |
| `DELETE` | `/history/:id`                      | Borrado (soft) |
| `DELETE` | `/history`                          | Limpiar todo (soft) |
| `GET`    | `/playlists`                        | Listar playlists del usuario |
| `GET`    | `/playlists/:id`                    | Detalle + items |
| `POST`   | `/playlists`                        | Crear playlist |
| `PUT`    | `/playlists/:id`                    | Renombrar |
| `DELETE` | `/playlists/:id`                    | Soft delete |
| `POST`   | `/playlists/:id/items`              | Agregar item |
| `DELETE` | `/playlists/:id/items/:itemId`      | Eliminar item |
| `PATCH`  | `/playlists/:id/reorder`            | Reordenar (`{order: [itemId,...]}`) |
| `POST`   | `/playlists/import`                 | Importar desde JSON |

## Tablas SQLite

- `video_history` — un registro por video reproducido.
- `video_playlists` — playlists del usuario.
- `video_playlist_items` — items ordenados de una playlist.

## Cómo se carga

PluginManager descubre `plugins/videoplayer/`, ejecuta `backend/migrations.js`,
registra rutas en `backend/index.js`, y el renderer carga `frontend/index.js`
(que inyecta los estilos y registra la vista `videoplayer:workspace` + un widget de dashboard).

## Verificación de Node

```bash
npm run check-node
```

Debe imprimir `✅ Todo está bien con el código para Node v24.16.0`.
