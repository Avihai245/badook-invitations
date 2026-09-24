# כניסה עם Google

הכפתור "המשך עם Google" מופיע בעמודי הכניסה וההרשמה **לבד**, תוך כמה דקות מהרגע שספק Google מופעל ב־Supabase. לא צריך לשנות קוד ולא צריך Redeploy. עד אז הכפתור פשוט לא מוצג.

איך זה עובד: הכפתור שולח את המשתמש ל־Google דרך Supabase Auth, ומשם הוא חוזר ל־`/auth/callback` של האתר עם קוד חד־פעמי (PKCE), שמוחלף בחיבור. משתמש חדש מקבל חשבון עם השם מ־Google. אם כבר יש חשבון עם אותו מייל, Google מתחבר לאותו חשבון, וההזמנות שלו נשארות.

## 1. ב־Google Cloud Console

1. נכנסים ל־[console.cloud.google.com](https://console.cloud.google.com) ויוצרים פרויקט (או בוחרים קיים).
2. **APIs & Services → OAuth consent screen** (או Google Auth Platform → Branding):
   - שם האפליקציה: Badook, מייל תמיכה ולוגו.
   - Authorized domains: `badooks.com`.
   - קישורים: מדיניות פרטיות `https://invitations.badooks.com/privacy`, תנאי שימוש `https://invitations.badooks.com/terms`.
   - Scopes: רק `openid`, `email` ו־`profile`, שלא דורשים אימות מיוחד של Google.
   - Audience: **External**, ואחר כך **Publish app** (במצב Testing רק משתמשי בדיקה יכולים להיכנס).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Authorized JavaScript origins: `https://invitations.badooks.com`
   - Authorized redirect URIs: `https://ulbdxqwziikrginjqqbv.supabase.co/auth/v1/callback` (הכתובת של Supabase, לא של האתר).
4. שומרים. מקבלים **Client ID** ו־**Client Secret**.

## 2. ב־Supabase

1. **Authentication → Sign In / Providers → Google**: מפעילים, ומדביקים את ה־Client ID וה־Client Secret. (ה־Secret נשאר רק שם. לא צריך אותו באתר או ב־Amplify.)
2. **Authentication → URL Configuration**:
   - Site URL: `https://invitations.badooks.com`
   - Redirect URLs: מוסיפים `https://invitations.badooks.com/**` (עם הכוכביות: הכתובת שחוזרים אליה היא `/auth/callback` עם פרמטרים, כמו `?next=`). כתובת בדומיין של ה־Site URL תמיד מתקבלת; כל כתובת אחרת (למשל הכתובת של Amplify, `*.amplifyapp.com`) חייבת להתאים לאחת הכתובות ברשימה, כולל הפרמטרים.

   המערכת שולחת ל־Supabase את הכתובת שהמשתמש גולש בה (גם כש־`INVITES_PUBLIC_BASE_URL` עוד מצביע על הכתובת של Amplify). כתובת שלא מתקבלת גורמת ל־Supabase לחזור ל־Site URL, כלומר לדף הבית עם `?code=…` (או `?error=…`). האתר מזהה את זה ומעביר ל־`/auth/callback`, כך שהכניסה מסתיימת גם אז, אבל הדף שהמשתמש ביקש (`next`) הולך לאיבוד. לכן כדאי שההגדרות יהיו נכונות.

## 3. בדיקה

1. תוך כחמש דקות מופיע בעמוד `/login` הכפתור "המשך עם Google".
2. נכנסים עם חשבון Google. אמורים להגיע ל"ההזמנות שלי", ובמסך "החשבון שלי" רואים "כניסה: Google" והשם מ־Google.
3. אם Google מחזיר שגיאה (למשל `redirect_uri_mismatch`), בודקים שה־Redirect URI בסעיף 1.3 הוא בדיוק הכתובת של Supabase.
4. משתמש שביטל באמצע חוזר לעמוד הכניסה עם ההודעה "הכניסה עם Google לא הושלמה". כך גם אם Google כובה ב־Supabase בזמן שהכפתור עוד הופיע בדף (הכפתור נבדק מחדש בכל לחיצה).

## הערות

- כדי להסתיר שוב את הכפתור מכבים את Google ב־Supabase. משתמשים שנכנסו עם Google יוכלו להיכנס שוב אחרי "שכחתי סיסמה", שקובע להם סיסמה.
- מדיניות הפרטיות כבר מציינת שבכניסה עם Google מתקבלים השם, המייל ותמונת הפרופיל.
