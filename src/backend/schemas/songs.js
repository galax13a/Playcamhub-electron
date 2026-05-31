'use strict';
// @ts-check

const { z } = require('zod');

const IdParamsSchema = z.object({
  id: z.coerce.number({ invalid_type_error: 'El id debe ser numérico' }).int().positive('El id debe ser positivo'),
});

const SongQuerySchema = z.object({
  limit:    z.coerce.number().int().min(1).max(1000).optional().default(200),
  offset:   z.coerce.number().int().min(0).optional().default(0),
  category: z.coerce.number().int().positive().optional(),
  search:   z.string().trim().max(200).optional(),
  favorite: z.string().optional().transform(v => v === 'true'),
  type:     z.enum(['audio', 'video']).optional(),
});

const LimitQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(12),
});

const HistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(26),
});

const SongUpdateSchema = z.object({
  title:       z.string().trim().min(1).max(200).optional(),
  artist:      z.string().trim().max(200).optional(),
  album:       z.string().trim().max(200).optional(),
  category_id: z.coerce.number().int().positive().nullable().optional(),
  notes:       z.string().max(2000).optional(),
});

const ThumbnailSchema = z.object({
  filePath: z.string().trim().min(1, 'filePath es obligatorio').max(1000),
});

/** @typedef {z.infer<typeof IdParamsSchema>} IdParams */
/** @typedef {z.infer<typeof SongQuerySchema>} SongQuery */
/** @typedef {z.infer<typeof SongUpdateSchema>} SongUpdateInput */

module.exports = { IdParamsSchema, SongQuerySchema, LimitQuerySchema, HistoryQuerySchema, SongUpdateSchema, ThumbnailSchema };
