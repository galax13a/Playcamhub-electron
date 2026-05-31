'use strict';

const { z } = require('zod');

const SOURCE_TYPES = ['url', 'file', 'blob'];

const IdParamsSchema = z.object({
  id: z.coerce.number({ invalid_type_error: 'El id debe ser numérico' }).int().positive(),
});

// ── History ────────────────────────────────────────────────────────────────────

const HistoryQuerySchema = z.object({
  username: z.string().trim().max(64).optional(),
  search:   z.string().trim().max(200).optional(),
  page:     z.coerce.number().int().positive().optional().default(1),
  per_page: z.coerce.number().int().min(5).max(100).optional().default(25),
});

const HistoryCreateSchema = z.object({
  title:         z.string().trim().min(1, 'El título es obligatorio').max(500),
  source:        z.string().trim().min(1, 'La fuente es obligatoria').max(4000),
  source_type:   z.enum(SOURCE_TYPES).optional().default('url'),
  mime_type:     z.string().trim().max(120).optional().nullable(),
  player_id:     z.string().trim().max(64).optional().nullable(),
  duration:      z.coerce.number().nonnegative().optional().nullable(),
  last_position: z.coerce.number().nonnegative().optional().default(0),
  username:      z.string().trim().max(64).optional().nullable(),
});

const HistoryUpdateSchema = z.object({
  last_position: z.coerce.number().nonnegative(),
  duration:      z.coerce.number().nonnegative().optional().nullable(),
});

// ── Playlists ──────────────────────────────────────────────────────────────────

const PlaylistCreateSchema = z.object({
  name:        z.string().trim().min(1, 'El nombre es obligatorio').max(200),
  description: z.string().max(2000).optional().nullable(),
  username:    z.string().trim().max(64).optional().nullable(),
});

const PlaylistUpdateSchema = PlaylistCreateSchema.omit({ username: true });

const PlaylistItemSchema = z.object({
  title:       z.string().trim().min(1).max(500),
  source:      z.string().trim().min(1).max(4000),
  source_type: z.enum(SOURCE_TYPES).optional().default('url'),
  position:    z.coerce.number().int().min(0).optional(),
});

const PlaylistReorderSchema = z.object({
  order: z.array(z.coerce.number().int().positive()).min(1),
});

const PlaylistImportSchema = z.object({
  name:        z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  items:       z.array(PlaylistItemSchema).default([]),
  username:    z.string().trim().max(64).optional().nullable(),
});

module.exports = {
  IdParamsSchema,
  HistoryQuerySchema, HistoryCreateSchema, HistoryUpdateSchema,
  PlaylistCreateSchema, PlaylistUpdateSchema,
  PlaylistItemSchema, PlaylistReorderSchema, PlaylistImportSchema,
};
