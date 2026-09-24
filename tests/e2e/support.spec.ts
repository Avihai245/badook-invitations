import { expect, test, type Page } from '@playwright/test';

// The support assistant, against the Anthropic API stand-in (tests/support/mock-whatsapp.mjs): a
// visitor asks on the site and the answer streams in (links lead only inside the site); the
// conversation stays while moving between pages; an answer can be stopped; a failure gets a kind
// message; in the app it opens from the header, the "?" explanations and the editor's bar — and what
// goes to the API is only the conversation and the screen, without ids or the user's details.

const LOCAL = !process.env.PW_BASE_URL;
const MOCK = `http://127.0.0.1:${Number(process.env.PW_WHATSAPP_PORT || 54340)}`;

interface AiRequest {
  headers: { version: string | null };
  body: {
    model: string;
    stream: boolean;
    system: { text: string; cache_control?: { type: string } }[];
    messages: { role: string; content: string }[];
  };
}

/** The last request to the stand-in whose question was `question`. */
async function asked(question: string): Promise<AiRequest | undefined> {
  const all = (await (await fetch(`${MOCK}/__ai`)).json()) as AiRequest[];
  return all.filter((r) => r.body.messages.at(-1)?.content === question).at(-1);
}

async function open(page: Page, url: string) {
  await page.goto(url);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
}

async function signUp(page: Page) {
  const email = `support-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  await page.goto('/signup');
  await page.fill('input[name=email]', email);
  await page.fill('input[name=password]', 'a-good-password');
  await page.click('button[type=submit]');
  await page.waitForURL(/\/app\/invitations$/);
  await page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
  return email;
}

const createInvitation = (page: Page) =>
  page.evaluate(async () => {
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        templateId: 'sahar-bordeaux',
        eventType: 'wedding',
        locales: ['he'],
        defaultLocale: 'he',
        hosts: { primary: { he: 'נועה' }, secondary: { he: 'איתי' } },
        date: '2027-06-17',
        startTime: '19:30',
        timezone: 'Asia/Jerusalem',
      }),
    });
    return (await res.json()) as { id: string };
  });

test.describe('the support assistant', () => {
  test.skip(!LOCAL, 'the answers come from the local API stand-in');

  test('a visitor asks: the answer streams in, links stay inside the site, and the conversation stays', async ({
    page,
  }) => {
    await open(page, '/');
    await page.getByTestId('cookie-banner').getByRole('button', { name: 'רק חיוניות' }).click();
    const launcher = page.getByTestId('support-launcher');
    await launcher.click();
    const chat = page.getByRole('dialog', { name: 'העוזר של Badook' });
    await expect(chat).toBeVisible();
    await expect(launcher).toBeHidden();
    await expect(chat.getByText(/היי! אני העוזר של Badook/)).toBeVisible();

    const question = 'איך מעלים רשימת מוזמנים מאקסל?';
    await chat.getByRole('button', { name: question }).click();
    const log = chat.getByRole('log');
    await expect(log.getByText(question, { exact: true })).toBeVisible();
    const steps = log.locator('ol > li');
    await expect(steps).toHaveCount(3);
    await expect(steps.first().locator('strong')).toHaveText('מוזמנים');
    await expect(log.getByRole('link', { name: '/contact' })).toHaveAttribute('href', '/contact');
    // an address outside the site stays plain text
    await expect(log.getByText(/https:\/\/evil\.example\/login/)).toBeVisible();
    await expect(log.locator('a[href*="evil.example"]')).toHaveCount(0);

    // what went to the API: the rules and the manual (cached), the screen, the question — nothing else
    const sent = await asked(question);
    expect(sent?.headers.version).toBe('2023-06-01');
    expect(sent?.body.stream).toBe(true);
    expect(sent?.body.system[0]?.cache_control).toEqual({ type: 'ephemeral' });
    expect(sent?.body.system[0]?.text).toContain('<manual>');
    expect(sent?.body.system[1]?.text).toContain('screen of the app: /.');
    expect(sent?.body.messages).toEqual([{ role: 'user', content: question }]);

    // off topic: a kind no, and the conversation carries on
    const input = chat.getByRole('textbox', { name: 'כתבו שאלה…' });
    await input.fill('תן לי מתכון לעוגת שוקולד');
    await input.press('Enter');
    await expect(log.getByText('אני יכול לעזור רק בנושאים של Badook')).toBeVisible();
    expect((await asked('תן לי מתכון לעוגת שוקולד'))?.body.messages.map((m) => m.role)).toEqual([
      'user',
      'assistant',
      'user',
    ]);

    // Escape closes it and the floating button is back
    await input.press('Escape');
    await expect(chat).toBeHidden();
    await expect(launcher).toBeVisible();

    // on another page the conversation is still there (this tab only), until starting over
    await open(page, '/terms');
    await page.getByTestId('support-launcher').click();
    await expect(chat.getByRole('log').getByText(question, { exact: true })).toBeVisible();
    await chat.getByRole('button', { name: 'שיחה חדשה' }).click();
    await expect(chat.getByRole('log').getByText('אתם:')).toHaveCount(0);
    await expect(chat.getByRole('button', { name: 'איך יוצרים הזמנה ראשונה?' })).toBeVisible();
  });

  test('a long answer can be stopped; when the API fails, a kind message', async ({ page }) => {
    await open(page, '/contact');
    await page.getByTestId('cookie-banner').getByRole('button', { name: 'רק חיוניות' }).click();
    await page.getByTestId('support-launcher').click();
    const chat = page.getByTestId('support-chat');
    const input = chat.getByRole('textbox', { name: 'כתבו שאלה…' });
    await input.fill('אפשר תשובה ארוכה?');
    await chat.getByRole('button', { name: 'שליחה' }).click();
    await expect(chat.getByText('זו שורה מספר 1 בתשובה ארוכה.')).toBeVisible();
    await chat.getByRole('button', { name: 'עצירה' }).click();
    await expect(chat.getByText('התשובה נעצרה.')).toBeVisible();
    await expect(chat.getByText('זו שורה מספר 60 בתשובה ארוכה.')).toHaveCount(0);

    await input.fill('נפילה');
    await input.press('Enter');
    await expect(chat.getByText(/סליחה, לא הצלחתי לענות כרגע/)).toBeVisible();
    await expect(chat.getByRole('button', { name: 'שליחה' })).toBeVisible();
  });

  test('in the app: from the header, the "?" explanations and the editor, with that screen’s suggestions', async ({
    page,
  }, testInfo) => {
    const email = await signUp(page);
    const { id } = await createInvitation(page);
    await open(page, `/app/invitations/${id}/guests`);
    // the app has it in its header instead of a floating button
    await expect(page.getByTestId('support-launcher')).toHaveCount(0);
    await page.getByTestId('support-button').click();
    const chat = page.getByRole('dialog', { name: 'העוזר של Badook' });
    const question = 'איך שולחים לכולם בוואטסאפ?';
    await chat.getByRole('button', { name: question }).click();
    await expect(chat.getByText(/שאלה טובה!/)).toBeVisible();
    const sent = await asked(question);
    expect(sent?.body.system[1]?.text).toContain('/app/invitations/:id/guests');
    expect(JSON.stringify(sent)).not.toContain(id);
    expect(JSON.stringify(sent)).not.toContain(email);
    await chat.getByRole('button', { name: 'סגירת הצ׳אט' }).click();
    await expect(chat).toBeHidden();

    // an area's "?" ends with a way to ask
    await page.getByTestId('area-help').first().click();
    await page.getByRole('button', { name: 'שאלו את העוזר', exact: true }).click();
    await expect(chat).toBeVisible();
    await chat.getByRole('button', { name: 'סגירת הצ׳אט' }).click();

    // the editor's bar (phones: its ⋯ menu); a new conversation there suggests editor questions
    await open(page, `/app/invitations/${id}/edit`);
    if (testInfo.project.name === 'mobile') {
      await page.getByRole('button', { name: 'פעולות נוספות' }).click();
      await page.getByRole('menuitem', { name: 'עזרה: שאלו את העוזר' }).click();
    } else await page.getByTestId('support-button').click();
    await expect(chat).toBeVisible();
    await chat.getByRole('button', { name: 'שיחה חדשה' }).click();
    await expect(chat.getByRole('button', { name: 'איך שמים סרטון מיוטיוב ברקע?' })).toBeVisible();
  });
});
