# 🏢 المكتب الافتراضي — وكلاء ذكاء اصطناعي مرتبطون بـ Microsoft Teams

فريق من أربعة وكلاء:

| الوكيل | الدور |
|---|---|
| 🧑‍💼 مصعب | المدير العام: يقسم الهدف ويوزع المهام ويلخص النتائج |
| 📣 كريم | مشتري الإعلانات |
| 🎯 منى | أخصائية مسارات التحويل وصفحات الهبوط |
| 📝 عمر | المساعد التنفيذي: الجداول والمحاضر |

وثلاث طرق للربط مع Teams:

1. **تقارير تلقائية** (`/api/dispatch-task`): عند انتهاء الفريق يرسل مصعب بطاقة Adaptive Card إلى قناة Teams.
2. **بوت ثنائي** (`/api/teams-bot`): تكتب `@Musab جهز لي خطة إعلانية` داخل Teams، فيرد فوراً بالاستلام ثم يرسل التقرير الكامل في القناة.
3. **زر اجتماع الفريق** (`/api/team-meeting`): ينشئ اجتماع Teams حقيقياً عبر Microsoft Graph، ويولّد محضر نقاش الفريق ويرسله للقناة.

## التشغيل محلياً

```bash
npm install
cp .env.example .env.local   # ثم عبّئ القيم
npm run dev
```

افتح http://localhost:3000. أقل إعداد مطلوب هو `GROQ_API_KEY`، والباقي اختياري حسب الميزة.

## 1) تقارير Teams عبر Workflows

1. في Teams افتح القناة (مثلاً `AI-Office-Updates`) ← `•••` ← **Workflows**.
2. اختر قالب **Post to a channel when a webhook request is received** وسمّه `Musab GM Notifier`.
3. انسخ الرابط وضعه في `TEAMS_WEBHOOK_URL`.

تعمل حتى على localhost لأن الخادم هو من يرسل للـ Teams.

## 2) البوت الثنائي (Outgoing Webhook)

يتطلب رابطاً عاماً بـ HTTPS (انشر على Vercel، أو استخدم ngrok للتجربة).

1. في Teams: الفريق ← **Manage team** ← **Apps** ← **Create an outgoing webhook**.
2. الاسم: `Musab`، الرابط: `https://your-domain.com/api/teams-bot`.
3. سيظهر **Security token** مرة واحدة فقط: ضعه في `TEAMS_OUTGOING_WEBHOOK_SECRET`.

**ملاحظات مهمة تم التعامل معها في الكود:**
- كل طلب يُتحقق من توقيع HMAC الخاص به، والطلبات غير الموقعة ترجع 401.
- Teams ينتظر الرد خلال 5 ثوانٍ تقريباً، فالبوت يرد فوراً بالاستلام، ويكمل العمل في الخلفية (`after()`)، ثم يرسل التقرير عبر `TEAMS_WEBHOOK_URL`. لذلك الطريقة 2 تحتاج إعداد الطريقة 1 أيضاً.
- Outgoing Webhook يعمل في القنوات فقط، وليس في المحادثات الخاصة.

## 3) اجتماعات Teams عبر Microsoft Graph

يتطلب حساب Microsoft 365 للعمل أو الدراسة (حساب Teams الشخصي المجاني لا يدعم هذا).

1. في **Microsoft Entra admin center** ← **App registrations** ← **New registration** (مثلاً `Virtual-AI-Office`).
2. انسخ **Application (client) ID** و **Directory (tenant) ID**.
3. **Certificates & secrets** ← **New client secret** ← انسخ القيمة فوراً.
4. **API permissions** ← **Microsoft Graph** ← **Application permissions** ← `OnlineMeetings.ReadWrite.All` ← **Grant admin consent**.
5. `AZURE_USER_ID` هو Object ID لحسابك من صفحة المستخدم في Entra.
6. **إلزامي:** أنشئ سياسة وصول للتطبيق، وإلا سيرجع Graph خطأ 403:

```powershell
Install-Module MicrosoftTeams
Connect-MicrosoftTeams
New-CsApplicationAccessPolicy -Identity VirtualOffice-Policy -AppIds "<AZURE_CLIENT_ID>" -Description "Virtual office meetings"
Grant-CsApplicationAccessPolicy -PolicyName VirtualOffice-Policy -Identity "<AZURE_USER_ID>"
```

قد تحتاج السياسة حتى 30 دقيقة لتفعيلها.

إذا لم تكن إعدادات Azure مكتملة، يعمل الزر ويولّد المحضر ويرسله لـ Teams بدون رابط اجتماع.

> **تنبيه:** المحضر هنا هو محضر نقاش الوكلاء الافتراضي حول الموضوع، وليس تفريغاً لما يُقال في اجتماع Teams الحقيقي. قراءة تفريغ الاجتماع الفعلي تحتاج صلاحيات إضافية (`OnlineMeetingTranscript.Read.All`) وتفعيل التفريغ، ويمكن إضافتها لاحقاً.

## الأمان

- لا ترفع `.env.local` إلى GitHub (مستثنى في `.gitignore`).
- مسارا `/api/dispatch-task` و `/api/team-meeting` مفتوحان لمن يعرف رابط موقعك. عند النشر العام أضف تسجيل دخول أو احمِ الموقع (مثلاً Vercel Deployment Protection) حتى لا يستهلك أحد رصيد الذكاء الاصطناعي.

## هيكل المشروع

```
lib/agents.ts          تعريف الوكلاء الأربعة
lib/llm.ts             عميل Groq
lib/orchestrator.ts    مصعب يخطط ← الفريق ينفذ بالتوازي ← مصعب يلخص
lib/teamsNotifier.ts   بطاقات Teams (مع تقليص الحجم تحت حد 28KB)
lib/teamsAuth.ts       التحقق من توقيع HMAC
lib/graph.ts           رمز Entra وإنشاء الاجتماعات
app/api/*              المسارات الثلاثة
app/page.tsx           واجهة المكتب
```
