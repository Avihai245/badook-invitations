# חיבור Badook Events: פתיחת משתמשים מרחוק והנחות לחשבון

דרך ה־API הזה, השרת של Badook Events פותח משתמש מורשה במערכת ההזמנות (שם, מייל וטלפון) ומקבל עבורו **קישור כניסה חד־פעמי**. הקישור פותח עמוד עם כפתור "המשך ל־Badook", והלחיצה עליו מכניסה את המשתמש ישר ל"ההזמנות שלי", בלי הרשמה ובלי סיסמה. אפשר גם לתת לחשבון הספציפי הזה **הנחה על החבילות** (ראו "הנחה לחשבון").

## מה צריך כדי שהחיבור יעבוד

1. **מפתח סודי משותף, באורך 32 תווים לפחות.** יוצרים מחרוזת אקראית ארוכה, למשל `openssl rand -hex 32` (64 תווים). מפתח קצר מ־32 תווים לא מתקבל: ה־API נשאר כבוי (404), ובלוג של השרת נרשמת הסיבה.
2. **במערכת ההזמנות (Amplify):** משתנה סביבה `INVITES_PARTNER_API_KEY` עם המפתח, ואחר כך Redeploy. בלי המשתנה ה־API כבוי ומחזיר 404.
3. **`INVITES_PUBLIC_BASE_URL`** הוא הכתובת הציבורית של האתר (`https://invitations.badooks.com`), וקישורי הכניסה נבנים ממנה. בענף `main` הבנייה משתמשת בכתובת הזו לבד אם המשתנה חסר או שהוא עדיין הכתובת של Amplify (`*.amplifyapp.com`). בסביבה אחרת, כשהמשתנה חסר או שהוא הכתובת של Amplify, הקישורים נבנים מהכתובת ש־Badook Events פנתה אליה.
4. **ב־Badook Events:** אותו מפתח נשמר בהגדרות הסודיות של **השרת** בלבד. אסור שיופיע בקוד של הדפדפן או של האפליקציה.
5. **ב־Supabase:** ב־Authentication → URL Configuration: ה־Site URL הוא `https://invitations.badooks.com`, וב־Redirect URLs מופיע `https://invitations.badooks.com/**` (עם הכוכביות: הכתובות שחוזרים אליהן כוללות פרמטרים). קישורי הכניסה של Badook Events לא עוברים דרך ההפניות של Supabase, אבל המיילים של איפוס סיסמה והכניסה עם Google כן.
6. **הקריאות יוצאות מהשרת של Badook Events**, ב־HTTPS, עם הכותרת:
   ```
   Authorization: Bearer <המפתח>
   Content-Type: application/json
   ```

## התהליך המומלץ ("פתיחת מערכת ההזמנות" ב־Badook Events)

1. המשתמש לוחץ ב־Badook Events על "להזמנות הדיגיטליות".
2. השרת של Badook Events שולח `POST /api/partner/v1/users` עם הפרטים. בפעם הראשונה המשתמש נוצר; בפעמים הבאות הפרטים מתעדכנים.
3. מהתשובה לוקחים את `loginUrl` ומפנים אליו את הדפדפן של המשתמש מיד (HTTP 302).
4. הקישור פותח עמוד עם כפתור **"המשך ל־Badook"**. רק הלחיצה על הכפתור משתמשת בקישור ומכניסה את המשתמש. הקישור עובד **פעם אחת** ותקף **שעה**. אם צריך קישור נוסף, קוראים ל־`POST /api/partner/v1/login-links`.
5. אם התשובה היא `409 user_managed` (המשתמש כבר נכנס בעצמו, ראו בהמשך), מפנים אותו ל־`signInUrl` שבתשובה, עמוד הכניסה הרגיל.

אפשר גם לשלוח את הקישור למשתמש במייל או ב־SMS. סורקי קישורים של שירותי מייל ותצוגה מקדימה של קישורים באפליקציות צ'אט רק פותחים את העמוד ולא לוחצים על הכפתור, ולכן הם לא "מבזבזים" את הקישור. מי שמחזיק בקישור נכנס לחשבון, לכן שולחים אותו רק למשתמש עצמו.

## הקריאות

כתובת הבסיס: `https://invitations.badooks.com`

### פתיחת משתמש / עדכון: `POST /api/partner/v1/users`

```json
{
  "email": "dana@example.com",
  "fullName": "דנה לוי",
  "phone": "050-123-4567",
  "externalId": "be-12345",
  "next": "/app/invitations/new"
}
```

| שדה | חובה | הסבר |
|---|---|---|
| `email` | כן | המייל של המשתמש. זה המזהה של החשבון. |
| `fullName` | כן | שם מלא, עד 120 תווים. |
| `phone` | לא | טלפון בכל פורמט ישראלי או בינלאומי. נשמר בפורמט E.164 (`+972501234567`). |
| `externalId` | לא (מומלץ) | המזהה של המשתמש ב־Badook Events, לחיפוש ולקישורים בהמשך. |
| `next` | לא | לאן הקישור מוביל אחרי הכניסה: נתיב באתר (ברירת מחדל `/app/invitations`). |

תשובה: `201` למשתמש חדש, `200` למשתמש קיים שעודכן.

```json
{
  "ok": true,
  "created": true,
  "user": {
    "userId": "6f1c…",
    "email": "dana@example.com",
    "fullName": "דנה לוי",
    "phone": "+972501234567",
    "plan": "free",
    "activeInvitations": 0,
    "createdAt": "2026-09-24T10:00:00Z",
    "userManaged": false,
    "discount": null
  },
  "loginUrl": "https://invitations.badooks.com/auth/continue?token_hash=…&next=%2Fapp%2Finvitations%2Fnew",
  "loginUrlExpiresIn": 3600
}
```

`userManaged: true` אומר שהמשתמש כבר נכנס בעצמו (קבע סיסמה, או חיבר Google). ראו "משתמש שמנהל את הכניסה בעצמו".

### קישור כניסה חדש: `POST /api/partner/v1/login-links`

```json
{ "externalId": "be-12345", "next": "/app/invitations" }
```

שולחים `externalId` **או** `userId`, לא את שניהם. התשובה: `{ "ok": true, "userId": "…", "loginUrl": "…", "loginUrlExpiresIn": 3600 }`.

### שינוי מייל: `PATCH /api/partner/v1/users`

כשהמייל של המשתמש משתנה ב־Badook Events:

```json
{ "externalId": "be-12345", "email": "dana.levi@example.com" }
```

שולחים `externalId` **או** `userId`, לא את שניהם. התשובה: `{ "ok": true, "user": { … } }` עם המייל החדש. המייל מתעדכן מיד, בלי מייל אישור. מתאים רק למשתמש שעוד לא מנהל את הכניסה בעצמו (אחרת `409 user_managed`: את המייל שלו הוא משנה בעצמו), ורק למייל שאין לו חשבון אחר (אחרת `409 email_taken`).

**לא** שולחים `POST /users` עם המייל החדש: זה ינסה לפתוח משתמש חדש, ויחזיר `409 external_id_taken` כי ה־`externalId` שייך למשתמש הקיים (בלי להשאיר משתמש חדש מאחור). עד שמעדכנים את המייל, הקישורים ממשיכים לעבוד לפי `externalId`.

### חיפוש משתמש: `GET /api/partner/v1/users?externalId=…`

אפשר לחפש גם לפי `?userId=…` או `?email=…`. התשובה: `{ "ok": true, "user": { … } }`, עם החבילה, מספר ההזמנות הפעילות ו־`userManaged`.

### הנחה לחשבון: `POST /api/partner/v1/discounts`

Badook Events יכולה לתת הנחה באחוזים על החבילות (Pro ו־Business) לחשבון ספציפי של משתמש שהיא פתחה:

```json
{ "externalId": "be-12345", "percent": 20, "until": "2026-12-31", "note": "לקוח Badook Events" }
```

| שדה | חובה | הסבר |
|---|---|---|
| `externalId` / `userId` | אחד מהם | המשתמש (כמו בשאר הקריאות). |
| `percent` | כן | אחוז ההנחה, מספר שלם בין 1 ל־90. |
| `until` | לא | עד מתי אפשר לקנות בהנחה: יום (`2026-12-31`, עד סוף היום לפי שעון ישראל) או רגע מדויק עם אזור זמן (`2026-12-31T18:00:00+02:00`). בלי `until` ההנחה בלי הגבלת זמן. |
| `note` | לא | הערה פנימית, עד 200 תווים (למשל מאיזה מבצע). המשתמש לא רואה אותה. |

התשובה: `{ "ok": true, "user": { …, "discount": { "percent": 20, "until": "2026-12-31T22:00:00.000Z", "note": "…" } } }`.

- **מה ההנחה עושה:** כל עוד היא בתוקף, מחירי החבילות במסך "חבילה וחיובים" של המשתמש מוצגים אחרי ההנחה (עם המחיר המקורי מחוק), וכתוב שם "הנחה של 20% על החבילות · בזכות Badook Events". התשלום בעמוד התשלום הוא המחיר המוזל.
- **חבילה שנקנתה בהנחה ממשיכה להתחדש כל חודש באותו מחיר,** עד שמבטלים או מחליפים אותה, גם אחרי ש־`until` עבר או שההנחה הוסרה. ההנחה חלה על רכישה חדשה של חבילה: מנוי שכבר משלם מחיר מלא לא משתנה.
- **קרדיטים לוואטסאפ לא בהנחה:** הם נמכרים במחיר העלות של Meta.
- קריאה נוספת **מחליפה** את ההנחה הקודמת. היא עובדת גם למשתמש שכבר מנהל את הכניסה בעצמו (`userManaged: true`): הוא עדיין הלקוח של Badook Events.
- בחיפוש (`GET /users`) ובשאר התשובות, `discount` הוא ההנחה שבתוקף, או `null` כשאין הנחה או שהיא הסתיימה.

### הסרת הנחה: `DELETE /api/partner/v1/discounts?externalId=…`

(או `?userId=…`). התשובה: `{ "ok": true, "user": { …, "discount": null } }`. חבילה שכבר נקנתה בהנחה שומרת על המחיר שלה.

## שגיאות

| קוד | `code` | מה זה אומר |
|---|---|---|
| 400 | `invalid` | שדה חסר או לא תקין. `fields` מפרט אילו (למשל `percent` מחוץ לטווח 1–90, או `until` שכבר עבר). |
| 401 | `unauthorized` | אין מפתח, או שהמפתח שגוי. |
| 404 | `not_found` | אין משתמש כזה, או שהוא לא נפתח דרך Badook Events. גם כשה־API כבוי (אין מפתח, או מפתח קצר מ־32 תווים). |
| 409 | `account_exists` | יש כבר חשבון עם המייל הזה, שהמשתמש פתח בעצמו. הוא נכנס אליו ישירות (מייל וסיסמה, או Google). |
| 409 | `external_id_taken` | ה־`externalId` כבר שייך למשתמש אחר. שום דבר לא נוצר, ואפשר לנסות שוב עם הפרטים הנכונים. |
| 409 | `user_managed` | המשתמש מנהל את הכניסה בעצמו (קבע סיסמה או חיבר Google), ולכן לא מקבלים עבורו קישורי כניסה. בתשובה יש `signInUrl`: עמוד הכניסה, שחוזר אחרי הכניסה ל־`next`. |
| 409 | `email_taken` | (שינוי מייל) יש כבר חשבון אחר עם המייל הזה. |
| 429 | `rate_limited` | יותר מ־600 קריאות בשעה. |
| 500 | `server_error` | תקלה אצלנו. אפשר לנסות שוב. |

## משתמש שמנהל את הכניסה בעצמו

משתמש שנפתח דרך Badook Events יכול להתחיל להיכנס בעצמו: לקבוע סיסמה ב"שכחתי סיסמה", או להיכנס עם Google באותו מייל. מאותו רגע החשבון שלו בידיים שלו, ולכן:

- `POST /login-links` ו־`POST /users` מחזירים `409 user_managed` עם `signInUrl`, ולא קישור כניסה.
- `PATCH /users` (שינוי מייל) מחזיר `409 user_managed`.
- החיפוש (`GET /users`) ממשיך לעבוד ומחזיר `userManaged: true`.

כך גם מי שהשיג את המפתח לא יכול להמשיך להיכנס לחשבון שהבעלים שלו כבר משתמש בו בעצמו.

## אבטחה

- Badook Events יכולה ליצור משתמשים ולנהל רק את המשתמשים **שהיא פתחה**: משתמש שהיא יוצרת מסומן ב־Supabase Auth (`app_metadata.provisioned_by = "partner:badook-events"`), ורק משתמש כזה אפשר לשייך אליה. חשבון שמישהו פתח בעצמו, גם אם נפתח באותו רגע ממש, לא משויך אליה (`409 account_exists`), ולא מקבלים עבורו קישור כניסה.
- משתמש שנוצר אבל לא שויך (למשל `external_id_taken`) נמחק מיד, כך שניסיון חוזר מתחיל מחדש.
- החלפת מפתח: משנים את `INVITES_PARTNER_API_KEY` ב־Amplify (ו־Redeploy) ובשרת של Badook Events. המפתח הישן מפסיק לעבוד מיד.
- הקישורים חד־פעמיים ותקפים שעה, ומשמשים רק בלחיצה על "המשך ל־Badook". אפשר לשנות את משך התוקף ב־Supabase: Authentication → Email → Email OTP Expiration.

## מה המשתמש רואה

- הקישור פותח עמוד "כניסה ל־Badook" עם הכפתור "המשך ל־Badook". קישור שכבר שימש או שפג תוקפו מוביל לעמוד הכניסה עם הסבר.
- במסך "החשבון שלי" רשום "כניסה: Badook Events", עם השם והטלפון שנשלחו.
- הוא יכול להיכנס גם בלי הקישור: עם Google באותו מייל, או ב"שכחתי סיסמה" כדי לקבוע סיסמה. מאותו רגע הוא מנהל את הכניסה בעצמו (ראו למעלה).
- החשבון מתחיל בחבילה החינמית, כמו כל חשבון. שדרוג נעשה במסך "חבילה וחיובים", ושם מופיעה גם ההנחה של Badook Events אם ניתנה.

## בדיקה מהירה (curl)

```bash
curl -sS https://invitations.badooks.com/api/partner/v1/users \
  -H "Authorization: Bearer $INVITES_PARTNER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","fullName":"בדיקה","externalId":"be-test-1"}'

# 15% הנחה על החבילות לאותו משתמש, עד סוף השנה
curl -sS https://invitations.badooks.com/api/partner/v1/discounts \
  -H "Authorization: Bearer $INVITES_PARTNER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"externalId":"be-test-1","percent":15,"until":"2026-12-31"}'
```

## אולמות: תוכנית האולם לסידור השולחנות

בעל אולם שפותח משתמשים ללקוחות שלו יכול לשלוח **פעם אחת** את תוכנית האולם, ולשייך אליה את הלקוחות. כשלקוח כזה פותח את "סידור שולחנות" באירוע שלו, המפה כבר מוכנה עם התוכנית של האולם, בקנה מידה נכון אם נשלח רוחב האולם, והוא לא צריך להתעסק בזה. הלקוח יכול להחליף את התוכנית באירוע שלו בכל רגע, בלי שזה משנה משהו באולם או אצל לקוחות אחרים.

### יצירת אולם / עדכון: `PUT /api/partner/v1/venues/{venueId}`

`venueId` הוא המזהה של האולם ב־Badook Events: אותיות באנגלית, ספרות ו־`. _ : ~ -`, עד 200 תווים.

```json
{
  "name": "אולמי הגן",
  "address": "הרצל 1, ראשון לציון",
  "widthMeters": 36.5,
  "floorPlan": { "url": "https://files.badook-events.example/halls/17/plan.pdf" }
}
```

| שדה | חובה | הסבר |
|---|---|---|
| `name` | ביצירה | שם האולם, עד 120 תווים. |
| `address` | לא | כתובת, עד 300 תווים. |
| `widthMeters` | לא (מומלץ) | כמה מטרים **רוחב התוכנית כולה** (מקצה התמונה לקצה). ממנו מחושב קנה המידה, והשולחנות מוצגים על התוכנית בגודל האמיתי. בלעדיו הלקוח יכול לכייל בעצמו. |
| `floorPlan` | לא | התוכנית: `{ "url": "https://…" }` (השרת שלנו מוריד את הקובץ), או `{ "base64": "…" }` (אפשר גם `data:…;base64,…`). |

- **קבצים:** PNG, JPEG, WebP או PDF (העמוד הראשון), עד **15MB**. הסוג נקבע לפי תוכן הקובץ, לא לפי השם או `contentType`. קובץ PDF הופך לתמונה בדפדפן של הלקוח בפעם הראשונה שהוא פותח את סידור השולחנות.
- **`url`:** רק `https`, בפורט הרגיל (443), בלי שם משתמש וסיסמה בכתובת, וכתובת ציבורית באינטרנט (לא רשת פנימית). עד 3 הפניות (redirect), וההורדה צריכה להסתיים תוך 15 שניות. כתובת חתומה לזמן קצוב (למשל מ־S3) מתאימה, כי הקובץ נשמר אצלנו מיד.
- **קבצים גדולים:** מומלץ לשלוח `url`. `base64` מגדיל את הבקשה בשליש, ובקשה גדולה מאוד עלולה להיחסם בדרך (413).
- **עדכון:** רק השדות שנשלחים משתנים. `null` מוחק את `address`, `widthMeters` או `floorPlan`. תוכנית חדשה מחליפה את הקודמת: אירועים שכבר התחילו לסדר עם הקודמת ממשיכים איתה, ואירועים חדשים מקבלים את החדשה. הלקוח יכול לעבור לתוכנית החדשה במסך "תוכנית האולם".

תשובה: `201` לאולם חדש, `200` לאולם קיים שעודכן.

```json
{
  "ok": true,
  "created": true,
  "venue": {
    "venueId": "hall-17",
    "name": "אולמי הגן",
    "address": "הרצל 1, ראשון לציון",
    "widthMeters": 36.5,
    "floorPlan": {
      "url": "https://….supabase.co/storage/v1/object/public/venue-plans/venues/…/….pdf",
      "contentType": "application/pdf",
      "width": null,
      "height": null,
      "bytes": 482113,
      "updatedAt": "2026-09-26T10:00:00Z"
    },
    "users": 0,
    "createdAt": "2026-09-26T10:00:00Z",
    "updatedAt": "2026-09-26T10:00:00Z"
  }
}
```

`width` ו־`height` הם גודל התמונה בפיקסלים (`null` ל־PDF). `users` הוא מספר המשתמשים שמשויכים לאולם.

### פרטי אולם: `GET /api/partner/v1/venues/{venueId}`

התשובה: `{ "ok": true, "venue": { … } }` כמו למעלה, או `404 not_found`.

### שיוך משתמש לאולם: `venueId` ב־`POST /users` וב־`PATCH /users`

- ב־**`POST /api/partner/v1/users`** אפשר להוסיף `"venueId": "hall-17"`: המשתמש נפתח (או מתעדכן) ומשויך לאולם. אולם שלא קיים מחזיר `404 venue_not_found`, ושום משתמש לא נוצר. לכן שולחים קודם `PUT /venues/{venueId}`.
- ב־**`PATCH /api/partner/v1/users`** אפשר לשלוח `venueId` (עם `email` או בלעדיו) כדי להעביר משתמש לאולם אחר, או `"venueId": null` כדי לבטל את השיוך. זה עובד גם למשתמש שמנהל את הכניסה בעצמו (`userManaged: true`).
- בכל התשובות שבהן מופיע `user` יש גם `venueId` (או `null`).

```json
{ "externalId": "be-12345", "venueId": "hall-17" }
```

משתמש שייך לאולם אחד. שיוך חדש מחליף את הקודם.

### שגיאות נוספות

| קוד | `code` | מה זה אומר |
|---|---|---|
| 400 | `invalid` | למשל `venueId` לא תקין, אולם חדש בלי `name`, `url` שאינו `https` או שמוביל לכתובת פנימית, או `base64` פגום. `fields` מפרט אילו. |
| 404 | `venue_not_found` | (`POST`/`PATCH /users`) אין לכם אולם עם ה־`venueId` הזה. |
| 413 | `too_large` | הקובץ גדול מ־15MB (`max` בבתים). |
| 415 | `unsupported_type` | הקובץ אינו PNG, JPEG, WebP או PDF. |
| 422 | `fetch_failed` | לא הצלחנו להוריד את `url` (למשל 404 אצלכם: `status`), או שההורדה לקחה יותר מ־15 שניות. |

### בדיקה מהירה (curl)

```bash
# אולם עם תוכנית מכתובת, ורוחב של 36.5 מטר
curl -sS -X PUT https://invitations.badooks.com/api/partner/v1/venues/hall-17 \
  -H "Authorization: Bearer $INVITES_PARTNER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"אולמי הגן","widthMeters":36.5,"floorPlan":{"url":"https://files.example.com/hall-17.png"}}'

# אותו אולם, תוכנית מקובץ מקומי
curl -sS -X PUT https://invitations.badooks.com/api/partner/v1/venues/hall-17 \
  -H "Authorization: Bearer $INVITES_PARTNER_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"floorPlan\":{\"base64\":\"$(base64 -w0 plan.png)\"}}"

# שיוך לקוח לאולם
curl -sS -X PATCH https://invitations.badooks.com/api/partner/v1/users \
  -H "Authorization: Bearer $INVITES_PARTNER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"externalId":"be-test-1","venueId":"hall-17"}'
```
