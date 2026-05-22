'use strict';

const { z } = require('zod');

const LICENSE_REGEX = /^PRYU-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

const ActivateSchema = z.object({
  key: z
    .string({ required_error: 'La clave de licencia es obligatoria' })
    .trim()
    .toUpperCase()
    .refine(k => LICENSE_REGEX.test(k), {
      message: 'Formato inválido. Usa: PRYU-XXXX-XXXX-XXXX',
    }),
});

const MigrationStatusSchema = z.object({
  batchId: z.string({ required_error: 'batchId es obligatorio' }).trim().min(1),
});

const SongImportSchema = z.object({
  title:       z.string().trim().min(1).max(200),
  artist:      z.string().trim().max(200).optional(),
  album:       z.string().trim().max(200).optional(),
  youtube_url: z.string().url().optional().nullable(),
  type:        z.enum(['audio', 'video']).optional().default('audio'),
}).passthrough();

const ImportSchema = z.object({
  data: z.object({
    songs:      z.array(SongImportSchema).min(1, 'Se requiere al menos una canción'),
    categories: z.array(z.object({ name: z.string().min(1) }).passthrough()).optional().default([]),
    playlists:  z.array(z.object({ name: z.string().min(1) }).passthrough()).optional().default([]),
  }),
  redownload: z.coerce.boolean().optional().default(false),
});

module.exports = { ActivateSchema, MigrationStatusSchema, ImportSchema };
