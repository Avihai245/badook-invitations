import type { accountHe } from './account.he';

/** The account screen (/app/account) — English. */
export const accountEn: typeof accountHe = {
  metaTitle: 'My account',
  title: 'My account',
  subtitle: 'Your details, how you sign in, and your plan.',
  profile: 'Personal details',
  fullName: 'Full name',
  phone: 'Phone',
  phoneHint: 'Optional. Used only to contact you about your account.',
  email: 'Email',
  signIn: 'Sign-in',
  providers: { email: 'Email and password', google: 'Google', partner: 'Badook Events' },
  save: 'Save',
  saved: 'Your details were saved',
  badPhone: 'That phone number doesn’t look right',
  plan: 'Plan',
  planLink: 'Plan & billing',
  password: 'Change password',
  passwordLink: 'Change your password',
  danger: 'Delete account',
  dangerBody:
    'Deleting your account permanently deletes all your invitations, guest lists, RSVPs and uploaded files, and stops your subscription. Published invitations stop working at once. This can’t be undone.',
  delete: 'Delete account',
  confirmTitle: 'Delete your account for good?',
  confirmCheck:
    'I understand that all invitations, guests and replies will be deleted and can’t be recovered.',
  confirm: 'Delete for good',
  keep: 'Cancel',
  deleting: 'Deleting…',
  error: 'Something went wrong. Please try again in a moment.',
  help: {
    save: 'Saves the name and phone on your account.',
    delete: 'Permanently deletes the account and everything in it.',
  },
  auth: {
    errors: {
      link_expired:
        'This link has expired or was already used. Sign in, or get a new link with “Forgot password?”.',
      other_browser:
        'This link has to be opened in the browser where you asked for it. You can ask for a new link here.',
    },
    notices: {
      email_confirmed: 'Your email address is confirmed. Sign in to continue.',
      deleted: 'Your account was deleted, with all its invitations and data.',
      deleted_charge:
        'Your account was deleted. We couldn’t stop the monthly charge automatically: our team was alerted and will stop it by hand. If you’re charged anyway, write to us.',
    },
    contact: 'Contact us',
    terms: 'By signing up you agree to the {terms} and the {privacy}.',
    termsLink: 'Terms',
    privacyLink: 'Privacy Policy',
    continue: {
      title: 'Sign in to Badook',
      subtitle: 'Your link from Badook Events is ready. Click to go to your invitations.',
      button: 'Continue to Badook',
      note: 'The link works only once.',
    },
  },
};
