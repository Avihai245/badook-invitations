import 'server-only';
import { albumNotifyDeps } from '@/features/album/server/deps';
import { albumNoticesState, sendAlbumNotices } from '@/features/album/server/notices-api';
import { featureInput } from '@/features/flags/server';
import { galleryNotifyDeps } from '@/features/live-gallery/server/deps';
import { galleryNoticesState, sendGalleryNotices } from '@/features/live-gallery/server/notices-api';
import { sendEmail } from '@/features/invitations/server/email';
import { cloudApiConfigured, postTemplate } from '@/features/whatsapp/cloud-api';
import { configuredTemplateLanguages } from '@/features/whatsapp/sender';
import { serverEnv } from '@/lib/env';
import type { SendKind } from '../types';
import type { ScheduleDeps } from './api';
import { scheduleDb } from './db';
import type { FailureMailDeps } from './email';
import type { RunDeps } from './run';
import type { FailureAlertDeps } from './whatsapp';

/** The real dependencies of the scheduled sends (tests pass their own). */

const base = () => serverEnv().INVITES_PUBLIC_BASE_URL;

export function scheduleDeps(): ScheduleDeps {
  return {
    db: scheduleDb,
    featureInput,
    ready: (kind: SendKind) => (kind === 'album_thanks' ? albumNotifyDeps() : galleryNotifyDeps()).ready(),
  };
}

/** The clock's turn: each kind sends as the host would from its dialog, as the invitation's owner. */
export function scheduleRunDeps(): RunDeps {
  return {
    db: scheduleDb,
    runners: {
      gallery_link: {
        state: (ownerId, id) => galleryNoticesState(ownerId, id, base(), galleryNotifyDeps()),
        send: (ownerId, id, body) => sendGalleryNotices(ownerId, id, body, galleryNotifyDeps()),
      },
      album_thanks: {
        state: (ownerId, id) => albumNoticesState(ownerId, id, base(), albumNotifyDeps()),
        send: (ownerId, id, body) => sendAlbumNotices(ownerId, id, body, albumNotifyDeps()),
      },
    },
  };
}

/** "Your scheduled send didn't go out": the host's email. */
export function failureMailDeps(): FailureMailDeps {
  return {
    db: scheduleDb,
    send: (email) => sendEmail({ ...email, kind: 'scheduled_send' }),
    base: base(),
    brand: serverEnv().INVITES_BRAND_NAME,
  };
}

/** "Your scheduled send didn't go out" on WhatsApp: the host alert template, once it is approved. */
export function failureAlertDeps(): FailureAlertDeps {
  return {
    db: scheduleDb,
    template: cloudApiConfigured() ? serverEnv().INVITES_WHATSAPP_HOST_ALERT_TEMPLATE : '',
    languages: configuredTemplateLanguages,
    send: (m) => postTemplate(m),
  };
}
