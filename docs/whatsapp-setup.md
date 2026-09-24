# חיבור השליחה בוואטסאפ (WhatsApp Business Platform — Cloud API)

המערכת שולחת את ההזמנה לרשימת המוזמנים מ**מספר הוואטסאפ הרשמי של Badook**, בהודעה קבועה אחת (טמפלט מאושר של Meta) עם השם של כל מוזמן וכפתור לקישור האישי שלו. עד שהחיבור מוגדר, כפתור "שליחה בוואטסאפ" מסביר שהשליחה עוד לא חוברה, והמשתמשים יכולים לשלוח מהוואטסאפ שלהם ("שליחה מהוואטסאפ שלי" ליד כל מוזמן).

## 1. מה צריך אצל Meta

1. **Meta Business Portfolio** (business.facebook.com). מומלץ לאמת את העסק (Business Verification), כי זה מעלה את מגבלות השליחה.
2. **אפליקציה** ב-developers.facebook.com מסוג Business, עם המוצר **WhatsApp**.
3. **WhatsApp Business Account (WABA)** ו**מספר טלפון** שמחובר אליו. המספר לא יכול להיות רשום באפליקציית הוואטסאפ הרגילה (אפשר להעביר אותו). צריך להגדיר לו Display name ולקבל עליו אישור.
4. **System User** עם **טוקן קבוע** (Business Settings → Users → System users → Generate token) עם ההרשאות `whatsapp_business_messaging` ו-`whatsapp_business_management`, ולשייך אליו את ה-WABA ואת האפליקציה.
5. **אמצעי תשלום** ב-WABA. Meta מחייבת על כל הודעת טמפלט שנמסרה.

## 2. הטמפלט להגשה

ב-WhatsApp Manager → Message templates → Create template:

| שדה | ערך |
|---|---|
| Category | **Marketing** |
| Name | `badook_invitation` (או שם אחר, ואז מגדירים אותו ב-`INVITES_WHATSAPP_TEMPLATE`) |
| Language | Hebrew (`he`) |
| Header | ללא |
| Body | ראו למטה |
| Footer | `נשלח באמצעות Badook` |
| Button | Call to action → Visit website → **Dynamic**, טקסט: `להזמנה ולאישור הגעה`, URL: `https://invitations.badooks.com/i/{{1}}` |

**Body** (בדיוק כך, כולל שורות ואימוג'י):

```
שלום {{1}} 👋
{{2}} מזמינים אותך {{3}} ב{{4}}.
לכל הפרטים ולאישור הגעה לחצו על הכפתור 👇
```

דוגמאות שצריך למלא בהגשה (Meta מבקשת ערך לדוגמה לכל משתנה):

| משתנה | משמעות | דוגמה |
|---|---|---|
| `{{1}}` | שם המוזמן | `דנה לוי` |
| `{{2}}` | המארחים | `נועה & איתי` |
| `{{3}}` | האירוע, עם מילת היחס | `לחתונה` |
| `{{4}}` | התאריך | `יום חמישי, 17 ביוני 2027` |
| כפתור `{{1}}` | סוף הכתובת: ההזמנה והקישור האישי | `noa-and-itay?g=AbCdEfGhIjKlMnOp` |

אם רוצים גם טמפלט באנגלית, מגישים את אותו שם בשפה `en`:

```
Hi {{1}} 👋
{{2}} invite you {{3}} on {{4}}.
Tap the button for all the details and to RSVP 👇
```

Footer: `Sent with Badook`. Button: `Invitation & RSVP` → `https://invitations.badooks.com/i/{{1}}`. כדי לשלוח באנגלית מגדירים `INVITES_WHATSAPP_TEMPLATE_LANG=en`.

> הכתובת בכפתור חייבת להיות הדומיין הציבורי של המערכת (אותו ערך כמו `INVITES_PUBLIC_BASE_URL`), כי הקישור האישי נבנה ממנו.

## 3. משתני הסביבה (Amplify → Hosting → Environment variables)

| משתנה | ערך |
|---|---|
| `INVITES_WHATSAPP_TOKEN` | הטוקן הקבוע של ה-System User |
| `INVITES_WHATSAPP_PHONE_NUMBER_ID` | ה-Phone number ID (WhatsApp → API Setup). זה לא מספר הטלפון עצמו |
| `INVITES_WHATSAPP_APP_SECRET` | App settings → Basic → App secret (לאימות החתימה על ה-webhook) |
| `INVITES_WHATSAPP_VERIFY_TOKEN` | מחרוזת אקראית ארוכה שבוחרים, ואותה מזינים גם בהגדרת ה-webhook |
| `INVITES_WHATSAPP_TEMPLATE` | `badook_invitation` (ברירת המחדל) |
| `INVITES_WHATSAPP_TEMPLATE_LANG` | `he` (ברירת המחדל) |
| `INVITES_WHATSAPP_PRICE_USD` | המחיר להודעת Marketing בישראל לפי מחירון Meta, בלי מע״מ (המחיר למשתמש מוסיף 18% מע״מ). ברירת המחדל `0.0353`, וכדאי לבדוק את המחירון העדכני |
| `INVITES_USD_TO_ILS` | שער הדולר לחישוב המחיר בשקלים (ברירת מחדל `3.7`) |
| `INVITES_ADMIN_EMAILS` | המיילים של מנהלי המערכת, מופרדים בפסיקים. הם שולחים בלי לקנות קרדיטים |

אחרי שינוי משתנים צריך build חדש (Redeploy), כי הערכים נכנסים לשרת בזמן ה-build.

## 4. ה-Webhook (סטטוסים: נמסר / נקרא / נכשל)

ב-App Dashboard → WhatsApp → Configuration:

- **Callback URL:** `https://invitations.badooks.com/api/whatsapp/webhook`
- **Verify token:** הערך של `INVITES_WHATSAPP_VERIFY_TOKEN`
- **Webhook fields:** להירשם ל-`messages`

המערכת בודקת את החתימה (`X-Hub-Signature-256`) על כל עדכון עם ה-App secret ודוחה עדכון לא חתום. הסטטוסים מתעדכנים ברשימת המוזמנים: נשלח → נמסר → נקרא, או "השליחה נכשלה" עם הסיבה.

## 5. שליחה ברקע (הודעות שנשארו בתור)

כשמשתמש שולח, הדף שולח את ההודעות בקבוצות ומראה התקדמות. אם הדף נסגר באמצע, או כשהודעה ממתינה לניסיון חוזר (מגבלת קצב של Meta), המערכת עצמה שולחת את מה שנשאר: בכל כמה דקות שיש בהן פעילות באתר (משתמש מחובר, תשובת מוזמן, עדכון סטטוס מ-Meta) היא בודקת את התור (`src/features/jobs`). אין צורך בהגדרה נוספת.

אפשר להוסיף גם תזמון חיצוני שרץ כל 10 דקות גם כשאין פעילות: ה-workflow `.github/workflows/whatsapp-queue.yml`. הוא צריך שני Secrets ב-GitHub (Settings → Secrets and variables → Actions), אותם Secrets שמשמשים לריצה היומית:

- `INVITES_CRON_URL`: הכתובת הציבורית, למשל `https://invitations.badooks.com`
- `INVITES_CRON_SECRET`: אותו ערך כמו `INVITES_CRON_SECRET` ב-Amplify

## 6. עלויות, קרדיטים ומדיניות

- **קרדיט אחד = הודעה אחת.** המחיר שמוצג למשתמש הוא מחיר הודעת Marketing בישראל (`INVITES_WHATSAPP_PRICE_USD` × `INVITES_USD_TO_ILS` × 1.18 מע״מ, מעוגל כלפי מעלה לאגורה; ‏0.0353$ × 3.7 × 1.18 = ‏₪0.16 להודעה). הודעה שנכשלה מחזירה את הקרדיט.
- **קרדיטים מגיעים מהחבילה** (Pro: 50 בחודש, Business: 300 בחודש) או מקנייה של חבילת הודעות. מנהלי המערכת (`INVITES_ADMIN_EMAILS`) שולחים בלי קרדיטים.
- **הסכמה:** לפני כל שליחה המשתמש מאשר שהמוזמנים מכירים אותו ומצפים להזמנה (מדיניות ה-opt-in של Meta). בכל הודעת Marketing מופיעה אצל המקבל אפשרות לחסום או להפסיק לקבל.
- **מגבלות שליחה:** מספר חדש מתחיל ממגבלה יומית של נמענים ייחודיים (בדרך כלל 250 ב-24 שעות), והיא עולה עם נפח שליחה ואיכות טובה, ובמיוחד אחרי אימות העסק. כדאי לעקוב אחרי ה-Quality rating ב-WhatsApp Manager, כי חסימות רבות מורידות אותו.
- **ניסיונות חוזרים:** מגבלת קצב (130429) או תקלה אצל Meta מחזירות את ההודעה לתור, עד 3 ניסיונות. מספר שלא רשום בוואטסאפ (131026) נכשל מיד, והקרדיט חוזר.

## 7. בדיקה

1. ב-API Setup של האפליקציה אפשר לשלוח מהמספר הזמני של Meta לעד 5 מספרים מאומתים, וכך לבדוק לפני שהמספר הרשמי מוכן.
2. באתר: מפרסמים הזמנה, מוסיפים לרשימת המוזמנים את המספר שלכם, ולוחצים **שליחה בוואטסאפ**. ההודעה מגיעה עם השם שלכם, והכפתור פותח את ההזמנה עם ברכה אישית וטופס ממולא.
3. בסביבת הפיתוח והבדיקות האוטומטיות, `tests/support/mock-whatsapp.mjs` מדמה את ה-API של Meta (`INVITES_WHATSAPP_API_BASE`).
