import { query } from '../config/db.js';

export async function logAdminActivity(adminId, action, entityType, entityId, details = null) {
  await query(
    'INSERT INTO admin_activity_logs (admin_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)',
    [adminId, action, entityType, entityId ?? null, details ? JSON.stringify(details) : null],
  );
}
