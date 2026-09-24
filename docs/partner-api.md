# חיבור Badook Events: פתיחת משתמשים מרחוק

דרך ה־API הזה, השרת של Badook Events פותח משתמש מורשה במערכת ההזמנות (שם, מייל וטלפון) ומקבל עבורו **קישור כניסה חד־פעמי**. לחיצה על הקישור מכניסה את המשתמש ישר ל"ההזמנות שלי", בלי הרשמה ובלי סיסמה.

## מה צריך כדי שהחיבור יעבוד

1. **מפתח סודי משותף.** יוצרים מחרוזת אקראית ארוכה, למשל `openssl rand -hex 32`.
2. **במערכת ההזמנות (Amplify):** משתנה סביבה `INVITES_PARTNER_API_KEY` עם המפתח, ואחר כך Redeploy. בלי המשתנה ה־API כבוי ומחזיר 404.
3. **ב־Badook Events:** אותו מפתח נשמר בהגדרות הסודיות של **השרת** בלבד. אסור שיופיע בקוד של הדפדפן או של האפליקציה.
4. **ב־Supabase:** ב־Authentication → URL Configuration → Redirect URLs צריך להופיע `https://invitations.badooks.com/auth/callback` (זה אותו צעד כמו בכניסה עם Google).
5. **הקריאות יוצאות מהשרת של Badook Events**, ב־HTTPS, עם הכותרת:
   ```
   Authorization: Bearer <המפתח>
   Content-Type: application/json
   ```

## התהליך המומלץ ("פתיחת מערכת ההזמנות" ב־Badook Events)

1. המשתמש לוחץ ב־Badook Events על "להזמנות הדיגיטליות".
2. השרת של Badook Events שולח `POST /api/partner/v1/users` עם הפרטים. בפעם הראשונה המשתמש נוצר; בפעמים הבאות הפרטים מתעדכנים.
3. מהתשובה לוקחים את `loginUrl` ומפנים אליו את הדפדפן של המשתמש מיד (HTTP 302).
4. הקישור עובד **פעם אחת** ותקף **שעה**. אם צריך קישור נוסף, קוראים ל־`POST /api/partner/v1/login-links`.

אפשר גם לשלוח את הקישור למשתמש במייל או ב־SMS. מי שמחזיק בקישור נכנס לחשבון, לכן שולחים אותו רק למשתמש עצמו.

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
    "createdAt": "2026-09-24T10:00:00Z"
  },
  "loginUrl": "https://invitations.badooks.com/auth/callback?token_hash=…&type=magiclink&next=%2Fapp%2Finvitations%2Fnew",
  "loginUrlExpiresIn": 3600
}
```

### קישור כניסה חדש: `POST /api/partner/v1/login-links`

```json
{ "externalId": "be-12345", "next": "/app/invitations" }
```

שולחים `externalId` **או** `userId`, לא את שניהם. התשובה: `{ "ok": true, "userId": "…", "loginUrl": "…", "loginUrlExpiresIn": 3600 }`.

### חיפוש משתמש: `GET /api/partner/v1/users?externalId=…`

אפשר לחפש גם לפי `?userId=…` או `?email=…`. התשובה: `{ "ok": true, "user": { … } }`, עם החבילה ומספר ההזמנות הפעילות.

## שגיאות

| קוד | `code` | מה זה אומר |
|---|---|---|
| 400 | `invalid` | שדה חסר או לא תקין. `fields` מפרט אילו. |
| 401 | `unauthorized` | אין מפתח, או שהמפתח שגוי. |
| 404 | `not_found` | אין משתמש כזה, או שהוא לא נפתח דרך Badook Events. גם כשה־API כבוי. |
| 409 | `account_exists` | יש כבר חשבון עם המייל הזה, שהמשתמש פתח בעצמו. הוא נכנס אליו ישירות (מייל וסיסמה, או Google). |
| 409 | `external_id_taken` | ה־`externalId` כבר שייך למשתמש אחר. |
| 429 | `rate_limited` | יותר מ־600 קריאות בשעה. |
| 500 | `server_error` | תקלה אצלנו. אפשר לנסות שוב. |

## אבטחה

- Badook Events יכולה ליצור משתמשים ולנהל רק את המשתמשים **שהיא פתחה**. היא לא יכולה לקבל קישור כניסה לחשבון שמישהו פתח בעצמו, כך שגם מפתח שדלף לא נותן גישה לחשבונות האלה.
- החלפת מפתח: משנים את `INVITES_PARTNER_API_KEY` ב־Amplify (ו־Redeploy) ובשרת של Badook Events. המפתח הישן מפסיק לעבוד מיד.
- הקישורים חד־פעמיים ותקפים שעה. אפשר לשנות את משך התוקף ב־Supabase: Authentication → Email → Email OTP Expiration.

## מה המשתמש רואה

- במסך "החשבון שלי" רשום "כניסה: Badook Events", עם השם והטלפון שנשלחו.
- הוא יכול להיכנס גם בלי הקישור: עם Google באותו מייל, או ב"שכחתי סיסמה" כדי לקבוע סיסמה.
- החשבון מתחיל בחבילה החינמית, כמו כל חשבון. שדרוג נעשה במסך "חבילה וחיובים".

## בדיקה מהירה (curl)

```bash
curl -sS https://invitations.badooks.com/api/partner/v1/users \
  -H "Authorization: Bearer $INVITES_PARTNER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","fullName":"בדיקה","externalId":"be-test-1"}'
```
