'use strict';

const { z } = require('zod');

const IdParamsSchema = z.object({
  id: z.coerce.number({ invalid_type_error: 'El id debe ser numérico' }).int().positive(),
});

const DownloadAddSchema = z.object({
  url: z
    .string({ required_error: 'url es obligatorio' })
    .trim()
    .min(1, 'url es obligatorio')
    .url('Debe ser una URL válida')
    .refine(
      u => /youtube\.com|youtu\.be|yt\.be/i.test(u),
      { message: 'Solo se aceptan URLs de YouTube (youtube.com, youtu.be)' },
    ),
  format: z.enum(['audio', 'video'], {
    errorMap: () => ({ message: 'format debe ser "audio" o "video"' }),
  }).optional().default('audio'),
});

module.exports = { IdParamsSchema, DownloadAddSchema };
