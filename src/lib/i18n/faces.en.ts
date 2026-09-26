import type { FacesDict } from './faces.he';

/** Face search — "the photos I'm in" — in the host's gallery tab (feature face_albums) — English. */
export const facesEn: FacesDict = {
  title: 'The photos I’m in',
  badge: 'Face search',
  body: 'Each guest takes a selfie on their phone and gets a personal album of the gallery’s photos they appear in. Faces are recognized on the phones and in your browser, with the explicit consent of every guest who searches.',
  plan: {
    title: 'Face search is part of the {plan} package',
    cta: 'Upgrade to {plan}',
  },
  off: {
    title: 'Face search is off for this event',
    body: 'When it is on, guests can find the photos they appear in — after they explicitly agree. Face codes are deleted 30 days after the event.',
    cta: 'Turn face search on',
  },
  status: '{scanned} of {photos} photos ready for search · {faces} faces',
  excluded: '{n} faces removed from search at guests’ request',
  optouts: {
    one: '1 guest asked not to appear in searches',
    other: '{n} guests asked not to appear in searches',
  },
  window: 'Search is open until {date} — then all of the event’s face codes are deleted automatically.',
  expired: 'Search has closed: the event’s face codes were deleted 30 days after the event.',
  noGallery: 'Turn the gallery on first.',
  prepare: 'Prepare face search',
  prepareHint:
    'Your computer goes through the photos not prepared yet and finds the faces in them (in the browser, without sending photos anywhere). You can stop and continue later from the same point.',
  preparing: 'Preparing… {done} of {total}',
  loadingModel: 'Loading face recognition in the browser…',
  stop: 'Stop',
  stopHint: 'Stops now. What was prepared is kept, and it continues from the same point.',
  prepared: 'Search is ready for every photo',
  allReady:
    'Every photo is ready for search. New photos are prepared by the phone that uploaded them, or here.',
  failed: 'Preparing stopped. Check the connection and try again — it continues from the same point.',
  unsupported:
    'This browser can’t run face recognition. Try another browser (a recent Chrome, Edge or Safari).',
  switchOff: 'Turn off and delete face codes',
  switchOffHint: 'Turns face search off for this event and deletes all of its face codes at once.',
  switchOnHint: 'Lets guests find the photos they appear in, with their explicit consent.',
  confirmTitle: 'Turn face search off?',
  confirmBody:
    'All of the event’s face codes are deleted at once, and guests can’t search. You can turn it on again later — then it is prepared again.',
  confirm: 'Turn off and delete',
  switchedOff: 'Face search is off, and the face codes were deleted',
  switchedOn: 'Face search is on',
  privacy:
    'Privacy: a guest’s selfie never leaves their phone; only where a face is in a photo and a code of 128 numbers are kept — no names, no crops.',
};
