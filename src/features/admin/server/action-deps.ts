import 'server-only';
import { after } from 'next/server';
import { serviceDb } from '@/lib/supabase/server';
import type { ActionDeps } from './actions';
import { coreDb } from './core-db';
import { adminDb } from './db';
import type { Staff } from './gate';
import { adminNudge, rotateAdminChannel } from './live';

/** How long a suspension lasts: as long as Supabase Auth allows (about a hundred years). */
export const SUSPEND_DURATION = '876000h';

/** The real dependencies of the console's actions (features/admin/server/actions.ts). */
export function actionDeps(staff: Staff): ActionDeps {
  return {
    credits: coreDb.credits,
    gift: coreDb.gift,
    discount: coreDb.discount,
    suspendCheck: coreDb.suspendCheck,
    async ban(userId, suspend) {
      const { error } = await serviceDb().auth.admin.updateUserById(userId, {
        ban_duration: suspend ? SUSPEND_DURATION : 'none',
      });
      if (error) throw new Error(`auth ban: ${error.message}`);
    },
    audit: adminDb.auditAdd,
    feature: coreDb.feature,
    staffSet: coreDb.staffChange,
    staffRemove: coreDb.staffDrop,
    async renameChannel() {
      await rotateAdminChannel(staff);
    },
    nudge: (kind) => after(() => adminNudge(kind)),
  };
}
