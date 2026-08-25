פקויקט פולל סטאק מרצה סטודנט שלב 1:

הריפו: https://github.com/dormor589/EMS_M1 ב dev ולא ב main לפי מה שהתבקשנו

כניסה והרשמה לאתר באופן הבא :
- מרצה: teacher@ems.dev / סיסמה: password
- סטודנט: student@ems.dev / סיסמה: password

אפשר גם להירשם כמשתמש חדש – יש דף Register שעובד.


מה אפשר לעשות במערכת

בתור מרצה:
- ליצור מבחן חדש עם שאלות סגורות (multiple choice) ושאלות פתוחות
- לערוך מבחן קיים
- לפרסם מבחן (Draft → Published) או לסגור אותו (Published → Closed)
- לראות אילו סטודנטים הגישו, ולפתוח כל הגשה ולראות את התשובות
- לתת ציון בין 0 ל-100 ולכתוב פידבק

בתור סטודנט:
- לראות מבחנים שפורסמו (לא רואה מבחנים ב-Draft או סגורים)
- לפתוח מבחן ולענות על השאלות
- לראות את הציון אחרי שהמרצה נתן אותו

המידע נשמר אחרי refresh כי הכל יושב ב-localStorage.


  אלו השלבים שעבדתי בהם:

1 – הקמת הפרויקט. התקנתי Vite + React, הקמתי שלד של Express, ויצרתי את ה-branch בשם dev. עבדתי ב-JavaScript.

2 – ארבעה שירותים בסיסיים. בניתי את ConfigService, LoggerService, StorageService ו-NotifyService כמחלקות OOP. StorageService הוא היחיד שניגש ל-localStorage ישירות.

3 – שכבת המידע. בניתי את המודלים (User, Exam, Question, Submission, Answer) ואת MockApiService שמדמה backend. הכנסתי נתוני seed עם משתמשי דמו.

4 – התחברות והרשמה. בניתי את AuthService ואת הדפים LoginPage ו-RegisterPage. הסטודנט יכול להירשם ולבחור תפקיד, והמשתמש המחובר נשמר ב-localStorage דרך ה-Storage.

5 – ניווט לפי תפקיד. הוספתי MainLayout, NavigationMenu שמשתנה לפי המשתמש, ו-ProtectedRoute שמונע ממישהו לא מורשה להיכנס לדפים. סטודנט שמנסה להיכנס לדף של מרצה מועבר חזרה לדף שלו.

6 –פעולות למרצה: בניתי את ExamService עם state machine (Draft → Published → Closed) שאוכף את החוקים. הוספתי את הדפים: דשבורד, רשימת מבחנים, יצירה, עריכה, וסטאב לדף ההגשות.

7 – פעולות לסטודנט : בניתי את SubmissionService ואת הדפים של הסטודנט: דשבורד, מבחנים זמינים, מילוי מבחן, ודף ציונים. 

8 – ממשק בדיקת הגשות ומתן ציון: הוספתי דף שמראה למרצה את כל התשובות של הסטודנט, עם טופס לתת ציון (0–100) ופידבק. הציון מגיע לדף הציונים של הסטודנט.



דיאגרמות וuml בריפו בגיט ב dev.

הרצה :
  git clone https://github.com/dormor589/EMS_M1
  cd EMS_M1
  git checkout dev
  cd client && npm install && npm run dev
  פותחים http://localhost:5173 בדפדפן.