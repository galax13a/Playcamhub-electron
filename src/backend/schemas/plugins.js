'use strict';

const { z } = require('zod');

const PluginParamsSchema = z.object({
  id: z.string().trim().min(1, 'El id del plugin es obligatorio').max(80),
});

const PluginToggleSchema = z.object({
  enabled: z.boolean({ required_error: '"enabled" (boolean) es obligatorio' }),
});

module.exports = { PluginParamsSchema, PluginToggleSchema };
