import { describe, expect, it } from 'vitest';
import { digestEmail, replyEmail } from '@/features/invitations/lib/notify-email';

const base = {
  title: 'נועה & איתי',
  dashboardUrl: 'https://x.test/app/invitations/1/responses',
  brand: 'Badook',
};

describe('reply email', () => {
  it('Hebrew: subject with the guests, RTL body, the message escaped', () => {
    const e = replyEmail({
      ...base,
      locale: 'he',
      reply: {
        name: 'דנה <b>לוי</b>',
        attending: true,
        adults: 2,
        children: 1,
        message: 'מזל טוב <script>x</script>',
      },
    });
    expect(e.subject).toBe('אישור הגעה חדש: דנה <b>לוי</b> · 3 אורחים');
    expect(e.html).toContain('dir="rtl"');
    expect(e.html).toContain('דנה &lt;b&gt;לוי&lt;/b&gt; — מגיעים · 3 אורחים');
    expect(e.html).toContain('מזל טוב &lt;script&gt;x&lt;/script&gt;');
    expect(e.html).not.toContain('<script>');
    expect(e.html).toContain('href="https://x.test/app/invitations/1/responses"');
    expect(e.text).toContain('2 מבוגרים · ילד אחד');
  });

  it('English decline and an updated reply', () => {
    expect(
      replyEmail({
        ...base,
        locale: 'en',
        reply: { name: 'Avi', attending: false, adults: 0, children: 0, message: null },
      }).subject,
    ).toBe('New reply: Avi · not attending');
    const updated = replyEmail({
      ...base,
      locale: 'en',
      reply: { name: 'Avi', attending: true, adults: 1, children: 0, message: null, replaced: true },
    });
    expect(updated.subject).toBe('Reply updated: Avi · 1 guest');
    expect(updated.text).toContain('1 adult · 0 children');
  });
});

describe('digest email', () => {
  it('lists the new replies with a plural subject', () => {
    const e = digestEmail({
      ...base,
      locale: 'he',
      replies: [
        { name: 'דנה', attending: true, adults: 2, children: 0, message: null },
        { name: 'אבי', attending: false, adults: 0, children: 0, message: null },
      ],
    });
    expect(e.subject).toBe('סיכום יומי: 2 תשובות חדשות · נועה & איתי');
    expect(e.text).toContain('• דנה — מגיעים · 2 אורחים');
    expect(e.text).toContain('• אבי — לא מגיעים');
    expect(e.html.match(/<li/g)).toHaveLength(2);
  });
});
