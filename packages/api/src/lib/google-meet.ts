import { google } from "googleapis";

export async function createGoogleMeetLink(options: {
  title: string;
  startTime: Date;
  durationMinutes: number;
}): Promise<string | null> {
  const email      = process.env.GOOGLE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.trim().replace(/\\n/g, "\n");
  const subject    = process.env.GOOGLE_CALENDAR_ID?.trim(); // DWD subject (ifno@bouh.site)

  if (!email || !privateKey || !subject) {
    console.warn("[Google Meet] Missing env vars");
    return null;
  }

  try {
    const auth = new google.auth.JWT({
      email,
      key: privateKey,
      scopes: ["https://www.googleapis.com/auth/calendar"],
      subject, // Domain-Wide Delegation — impersonate ifno@bouh.site
    });

    const calendar = google.calendar({ version: "v3", auth });

    const endTime = new Date(options.startTime.getTime() + options.durationMinutes * 60 * 1000);

    const response = await calendar.events.insert({
      calendarId: "primary",
      conferenceDataVersion: 1,
      requestBody: {
        summary: options.title,
        start: { dateTime: options.startTime.toISOString() },
        end:   { dateTime: endTime.toISOString() },
        conferenceData: {
          createRequest: {
            requestId: `misahuh-${Date.now()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      },
    });

    const meetLink = response.data.hangoutLink;

    console.log("[Google Meet] Link created:", meetLink);
    return meetLink ?? null;

  } catch (err: unknown) {
    const e = err as { message?: string; code?: number };
    console.error("[Google Meet] Error:", e?.message, e?.code);
    return null;
  }
}
