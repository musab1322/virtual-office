// Microsoft Graph: إنشاء اجتماع Teams حقيقي بصلاحية التطبيق (client credentials)

let cachedToken: { value: string; expiresAt: number } | null = null;

export function isGraphConfigured() {
  return Boolean(
    process.env.AZURE_TENANT_ID &&
      process.env.AZURE_CLIENT_ID &&
      process.env.AZURE_CLIENT_SECRET &&
      process.env.AZURE_USER_ID
  );
}

export async function getGraphAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const url = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AZURE_CLIENT_ID!,
      client_secret: process.env.AZURE_CLIENT_SECRET!,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }).toString(),
    signal: AbortSignal.timeout(15_000),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`Entra token error: ${data.error_description || data.error || res.status}`);
  }
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

export interface OnlineMeeting {
  id: string;
  joinWebUrl: string;
  subject: string;
}

export async function createTeamsOnlineMeeting(
  subject: string,
  durationMinutes = 30
): Promise<OnlineMeeting> {
  const token = await getGraphAccessToken();
  const start = new Date();
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/users/${process.env.AZURE_USER_ID}/onlineMeetings`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
        subject,
      }),
      signal: AbortSignal.timeout(20_000),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 403) {
      throw new Error(
        "Graph 403: تأكد من إنشاء Application Access Policy وربطها بحسابك (انظر README). " +
          err.slice(0, 200)
      );
    }
    throw new Error(`Graph API error ${res.status}: ${err.slice(0, 300)}`);
  }
  return res.json();
}
