import { describe, expect, it } from 'vitest';
import { planReminderEmail } from '@/features/planning/model/reminder-email';

const base = {
  title: 'נועה & איתי',
  tasks: [
    { title: 'לסגור <צלם>', due: '2027-05-03', overdue: false },
    { title: 'לחתום על חוזה', due: '2027-04-28', overdue: true },
  ],
  payments: [{ label: 'מקדמה', item: 'די ג׳י', amount: 2500, due: '2027-05-05', overdue: false }],
  url: 'https://invitations.example/app/invitations/abc/plan',
  brand: 'Badook',
};

describe('the weekly planning email', () => {
  it('lists the week’s tasks and payments in Hebrew, escaped, with the link', () => {
    const mail = planReminderEmail({ locale: 'he', ...base });
    expect(mail.subject).toBe('התכנון של נועה & איתי: מה בשבוע הקרוב');
    expect(mail.html).toContain('dir="rtl"');
    expect(mail.html).toContain('לסגור &lt;צלם&gt;');
    expect(mail.html).not.toContain('<צלם>');
    expect(mail.html).toContain('באיחור');
    expect(mail.html).toContain(base.url);
    expect(mail.text).toContain('• מקדמה (די ג׳י): ₪2,500');
    expect(mail.text).toContain(`לתכנון האירוע: ${base.url}`);
  });

  it('and in English', () => {
    const mail = planReminderEmail({ locale: 'en', ...base, title: 'Noa & Itay' });
    expect(mail.subject).toBe('Planning for Noa & Itay: this coming week');
    expect(mail.html).toContain('dir="ltr"');
    expect(mail.text).toContain('Overdue');
    expect(mail.text).toContain('By 3 May');
  });

  it('leaves out an empty section', () => {
    const mail = planReminderEmail({ locale: 'en', ...base, payments: [] });
    expect(mail.text).not.toContain('Payments');
    expect(mail.html).not.toContain('Payments');
  });
});
