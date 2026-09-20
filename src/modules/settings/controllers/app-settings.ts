import type { Handler } from "hono";
import { db } from "@/framework/facade.js";
import { appSettings } from "@/modules/settings/database/models/settings.js";
import { eq } from "drizzle-orm";

const DEFAULT_SETTINGS = [
  { key: 'bin_format_regex',       value: '^[0-9]{9}-[0-9]{4}$',  description: 'Regex pattern for BIN validation (default: 000000000-0000)' },
  { key: 'bin_format_description', value: '000000000-0000 (9 digits, dash, 4 digits)', description: 'Human-readable BIN format shown in error messages' },
  { key: 'common_date_format',     value: 'DD/MM/YYYY',           description: 'Date format for Excel uploads (Common)' },
  { key: 'ibas_date_format',       value: 'DD/MM/YYYY',           description: 'Date format for Excel uploads (iBAS++)' },
  { key: 'common_max_file_size_mb',       value: '2',                    description: 'Maximum Excel upload size in MB (Common)' },
  { key: 'common_max_file_rows',          value: '10000',                description: 'Maximum number of rows allowed in uploaded Excel file (Common)' },
  { key: 'ibas_max_file_size_mb',       value: '5',                    description: 'Maximum Excel upload size in MB (iBAS++)' },
  { key: 'ibas_max_file_rows',          value: '50000',                description: 'Maximum number of rows allowed in uploaded Excel file (iBAS++)' },
  { key: 'login_rate_limit_hour',  value: '5',                    description: 'Max failed login attempts per hour before rate-limit response' },
  { key: 'login_block_threshold',  value: '10',                   description: 'Total failed attempts in 24h before 24h account block' },
  { key: 'login_block_hours',      value: '24',                   description: 'Hours to block account after threshold is exceeded' },
  { key: 'module_bin_analyser',    value: 'true',                 description: 'Enable/Disable BIN Analyser module' },
  { key: 'module_ibas',            value: 'true',                 description: 'Enable/Disable iBAS++ Analyser module' },
  { key: 'module_return_data',     value: 'true',                 description: 'Enable/Disable Return Data Analyser module' },
  { key: 'module_revenue',         value: 'true',                 description: 'Enable/Disable Revenue Analyser module' },
];

async function seedDefaultSettings() {
  for (const s of DEFAULT_SETTINGS) {
    await db.insert(appSettings).values(s).onConflictDoNothing();
  }
}

export const getAppSettings: Handler = async (c) => {
  try {
    await seedDefaultSettings();
    const data = await db.query.appSettings.findMany({ orderBy: (t, { asc }) => [asc(t.key)] });
    return c.json({ data });
  } catch (error) {
    return c.json({ error: 'Failed to fetch app settings' }, 500);
  }
};

export const updateAppSetting: Handler = async (c) => {
  try {
    const key = c.req.param('key');
    const { value } = await c.req.json();
    if (value === undefined || value === null || String(value).trim() === '') {
      return c.json({ error: 'Value is required' }, 400);
    }

    // Type validation per key
    if (['common_max_file_size_mb', 'common_max_file_rows', 'ibas_max_file_size_mb', 'ibas_max_file_rows', 'login_rate_limit_hour', 'login_block_threshold', 'login_block_hours'].includes(key)) {
      const num = Number(value);
      if (isNaN(num) || num < 1) return c.json({ error: 'Value must be a positive number' }, 400);
    }

    const updated = await db.update(appSettings)
      .set({ value: String(value), updatedAt: new Date() })
      .where(eq(appSettings.key, key))
      .returning();

    if (updated.length === 0) return c.json({ error: 'Setting not found' }, 404);
    return c.json({ data: updated[0], message: 'Setting updated' });
  } catch (error) {
    return c.json({ error: 'Failed to update setting' }, 500);
  }
};
