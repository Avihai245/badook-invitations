import type { billingHe } from './billing.he';

/** The billing screen (/app/billing) and the upgrade prompts — English. */
export const billingEn: typeof billingHe = {
  metaTitle: 'Plan & billing',
  title: 'Plan & billing',
  subtitle: 'Your plan, credits for WhatsApp messages, and your payment history.',
  current: 'Your plan',
  status: {
    active: 'Renews on {date}',
    activeFree: 'Free, with no time limit',
    canceled: 'Canceled: active until {date}, then free',
    past_due: 'The last charge didn’t go through. Try again or update your payment method by {date}.',
    admin: 'Admin account: everything is open',
  },
  usageTitle: 'Your usage',
  usage: {
    invitations: 'Active invitations',
    of: '{used} of {limit}',
    unlimited: '{used} (unlimited)',
    guests: 'Guests per invitation',
    credits: 'WhatsApp credits',
    creditsHint: 'Each message from the official number = one credit',
  },
  plans: 'Plans',
  choose: {
    pro: 'Upgrade to Pro',
    business: 'Upgrade to Business',
    switchPro: 'Switch to Pro',
    switchBusiness: 'Switch to Business',
    retry: 'Pay again',
  },
  toFree: 'Move to Free',
  cancel: {
    button: 'Cancel subscription',
    title: 'Cancel your subscription?',
    body: 'There will be no more charges. Your plan stays active until {date}, then your account moves to the free plan. Published invitations keep working.',
    confirm: 'Cancel subscription',
    keep: 'Keep my plan',
    done: 'Your subscription was canceled. The plan is active until {date}.',
  },
  packs: {
    title: 'Credits for WhatsApp messages',
    subtitle: 'For sending the invitation from the official number. One-time purchase; credits don’t expire.',
    count: '{n} messages',
    per: '{price} per message',
    buy: 'Buy',
  },
  returned: {
    success: 'Payment received, thank you! Your plan and credits are updated.',
    pending:
      'The payment is still being confirmed. It usually takes a few seconds; this page updates by itself.',
    failure: 'The payment didn’t go through. You can try again, with the same card or another.',
    cancel: 'The payment was canceled. You were not charged.',
  },
  off: 'Online payment isn’t enabled yet. To upgrade or buy credits, write to us and we’ll take care of it right away.',
  contact: 'Contact us',
  history: {
    title: 'History',
    payments: 'Payments',
    credits: 'Credit movements',
    none: 'No payments yet.',
    noCredits: 'No credit movements yet.',
    renewal: 'Monthly renewal',
    date: 'Date',
    item: 'Item',
    amount: 'Amount',
    status: 'Status',
    statuses: { paid: 'Paid', failed: 'Failed', canceled: 'Canceled', pending: 'Pending' },
    reasons: {
      purchase: 'Purchase',
      plan_grant: 'Monthly plan credits',
      whatsapp_send: 'WhatsApp message',
      whatsapp_refund: 'Refund for an unsent message',
      admin: 'Manual update',
    },
  },
  products: {
    pro: 'Pro plan (monthly)',
    business: 'Business plan (monthly)',
    credits_100: '100 WhatsApp messages',
    credits_300: '300 WhatsApp messages',
    credits_1000: '1,000 WhatsApp messages',
  },
  errors: {
    already: 'That’s already your plan.',
    not_configured: 'Online payment isn’t enabled yet.',
    server: 'Something went wrong. Please try again in a moment.',
  },
  going: 'Going to payment…',
  secure: 'You pay on PayPlus’s secure page. Card details never reach us.',
  help: {
    choose:
      'Opens a secure payment page. The plan starts right after payment and renews every month until you cancel.',
    cancel: 'Stops the monthly charges. The plan stays until the end of the paid period.',
    buy: 'Buys a one-time pack of credits for sending on WhatsApp from the official number.',
    toFree:
      'Stops the monthly charges, like canceling: the paid plan stays until the end of the period you paid for, then the account moves to the free plan. Published invitations keep working.',
    retry:
      'Pays for the plan again, with another card if you like. The new payment replaces the monthly charge that failed.',
    usage:
      'The cards under your plan: how many invitations are active out of what the plan allows (archiving one frees a place), how many guests each invitation’s list can have, and how many credits are left for sending on WhatsApp (one message = one credit).',
    history:
      'Payments: every purchase and monthly charge, with its amount and status. Credit movements: credits added (purchases, the plan’s monthly credits) and used (messages you sent, refunds for messages that weren’t sent).',
  },
  disabled: {
    off: 'These buttons work once online payment is enabled. Until then, write to us to upgrade or buy credits.',
  },
  test: {
    title: 'Test payment page',
    body: 'This is a test environment: no card is charged.',
    pay: 'Pay (test)',
    fail: 'Fail (test)',
  },
  upgrade: {
    planLimitTitle: 'You’ve reached your plan’s invitations',
    guestsTitle: 'You’ve reached your plan’s guest limit',
    planLimitBody:
      'Your plan allows {limit} active invitations at a time. Archive an old one, or upgrade to create more.',
    premiumTitle: 'A premium design',
    premiumBody: 'This design is included in Pro and Business. Keep editing, and publish after upgrading.',
    brandingTitle: 'The credit at the bottom',
    brandingBody:
      'Removing “Made with Badook” is part of Pro and Business. Turn the credit back on in the closing section, or upgrade.',
    guestsBody: 'Your plan allows up to {max} guests per invitation. Upgrade to add more.',
    cta: 'See plans',
    later: 'Not now',
  },
};
