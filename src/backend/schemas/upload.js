'use strict';

const { z } = require('zod');

const SUPPORTED_EXTS = new Set([
  '.mp3', '.m4a', '.flac', '.ogg', '.wav', '.aac', '.wma', '.opus',
  '.mp4', '.webm', '.mkv', '.mov', '.avi', '.m4v',
]);

const UploadSchema = z.object({
  paths: z
    .array(
      z.string().trim().min(1, 'Cada ruta no puede estar vacía').max(2000)
        .refine(p => {
          const ext = p.includes('.') ? p.slice(p.lastIndexOf('.')).toLowerCase() : '';
          return SUPPORTED_EXTS.has(ext);
        }, { message: 'Formato de archivo no soportado (usa mp3, mp4, flac, wav, ogg, mkv, etc.)' }),
    )
    .min(1, 'Se requiere al menos una ruta')
    .max(500, 'Máximo 500 archivos por petición'),
});

module.exports = { UploadSchema };
