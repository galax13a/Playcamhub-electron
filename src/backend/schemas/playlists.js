'use strict';

const { z } = require('zod');

const IdParamsSchema = z.object({
  id: z.coerce.number({ invalid_type_error: 'El id debe ser numérico' }).int().positive(),
});

const DualIdParamsSchema = z.object({
  id:     z.coerce.number().int().positive(),
  songId: z.coerce.number().int().positive(),
});

const PlaylistCreateSchema = z.object({
  name:        z.string({ required_error: 'El nombre es obligatorio' }).trim().min(1, 'El nombre es obligatorio').max(200),
  description: z.string().trim().max(500).optional().default(''),
  cover:       z.string().max(500_000).optional().nullable().default(null),
});

const PlaylistUpdateSchema = z.object({
  name:        z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(500).optional(),
  cover:       z.string().max(500_000).optional().nullable(),
});

const AddSongSchema = z.object({
  songId: z.coerce.number({ required_error: 'songId es obligatorio' }).int().positive(),
});

const ReorderSchema = z.object({
  songIds: z.array(z.coerce.number().int().positive()).min(1, 'songIds no puede estar vacío'),
});

module.exports = { IdParamsSchema, DualIdParamsSchema, PlaylistCreateSchema, PlaylistUpdateSchema, AddSongSchema, ReorderSchema };
