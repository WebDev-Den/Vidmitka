import { describe, expect, it } from "vitest";

import {
  createClassReminderPayload,
  createTestPushPayload,
  createPushDeliveryKey,
  createDailyDigestPayload,
  getKyivDateTimeParts,
  isDueAtKyivMinute,
  isLessonReminderDue,
  isWithinPushScanWindow,
  validateBrowserPushSubscription,
  validatePublicPushPreferences,
  type PublicPushPreferences,
} from "./rules";
import type { PublicScheduleItem } from "@/lib/schedule-v2/public-schedule";

const teacherId = "7f67b6d8-1979-4f28-80ea-cedda7d4d0f6";

const preferences: PublicPushPreferences = {
  teacherId,
  morningEnabled: true,
  morningTime: "07:30",
  lessonReminderEnabled: true,
  lessonLeadMinutes: 15,
};

function scheduleItem(overrides: Partial<PublicScheduleItem> = {}): PublicScheduleItem {
  return {
    id: "7f67b6d8-1979-4f28-80ea-cedda7d4d0f7",
    occurrenceDate: "2026-09-04",
    periodNumber: 2,
    startTime: "09:35",
    endTime: "10:55",
    discipline: "Аналіз даних",
    lessonType: "Лекція",
    lessonTypeColor: "#0F766E",
    groups: ["QA-1", "QA-2"],
    teachers: ["Тестовий Викладач"],
    rooms: ["1-101"],
    note: "",
    changeKind: null,
    changeReason: "",
    cancelled: false,
    originalDate: null,
    ...overrides,
  };
}

describe("validatePublicPushPreferences", () => {
  it("приймає один пристрій з обома типами подій", () => {
    expect(validatePublicPushPreferences(preferences)).toEqual({
      ok: true,
      value: preferences,
    });
  });

  it("не дозволяє вимкнути всі події або вийти за погоджені межі", () => {
    expect(validatePublicPushPreferences({
      ...preferences,
      morningEnabled: false,
      lessonReminderEnabled: false,
    })).toEqual({ ok: false, message: "Оберіть хоча б один тип сповіщень." });

    expect(validatePublicPushPreferences({ ...preferences, morningTime: "20:01" }))
      .toEqual({ ok: false, message: "Час ранкового сповіщення має бути від 07:00 до 20:00." });
    expect(validatePublicPushPreferences({ ...preferences, lessonLeadMinutes: 61 }))
      .toEqual({ ok: false, message: "Нагадування має бути від 1 до 60 хвилин до заняття." });
  });
});

describe("validateBrowserPushSubscription", () => {
  it("приймає лише придатну підписку від публічного провайдера", () => {
    expect(validateBrowserPushSubscription({
      endpoint: "https://fcm.googleapis.com/fcm/send/example-token",
      expirationTime: null,
      keys: { p256dh: "cHVibGljLWtleS1ieXRlcw", auth: "MDEyMzQ1Njc4OUFCQ0RFRg" },
    })).toMatchObject({ ok: true });
  });

  it("не розкриває endpoint у повідомленні про некоректного провайдера", () => {
    const endpoint = "https://push.example.test/secret-endpoint";
    const result = validateBrowserPushSubscription({
      endpoint,
      expirationTime: null,
      keys: { p256dh: "cHVibGljLWtleS1ieXRlcw", auth: "MDEyMzQ1Njc4OUFCQ0RFRg" },
    });

    expect(result).toEqual({ ok: false, message: "Підписка має належати підтримуваному Push-провайдеру." });
    if (!result.ok) expect(result.message).not.toContain(endpoint);
  });
});

describe("Kyiv clock and scan window", () => {
  it("отримує дату й хвилину доби в часовому поясі Києва", () => {
    expect(getKyivDateTimeParts(new Date("2026-09-04T04:30:00.000Z"))).toMatchObject({
      date: "2026-09-04",
      time: "07:30",
      minuteOfDay: 450,
    });
  });

  it("включає межі 07:00 та 20:00 і лише grace для затриманого 20:00", () => {
    expect(isWithinPushScanWindow(7 * 60)).toBe(true);
    expect(isWithinPushScanWindow(20 * 60)).toBe(true);
    expect(isWithinPushScanWindow(20 * 60 + 1)).toBe(true);
    expect(isWithinPushScanWindow(7 * 60 - 1)).toBe(false);
    expect(isWithinPushScanWindow(20 * 60 + 2)).toBe(false);
  });
});

describe("due notification matching", () => {
  it("дозволяє максимум одну хвилину запізнення, але ніколи не надсилає раніше", () => {
    expect(isDueAtKyivMinute(480, 480)).toBe(true);
    expect(isDueAtKyivMinute(480, 481)).toBe(true);
    expect(isDueAtKyivMinute(480, 479)).toBe(false);
    expect(isDueAtKyivMinute(480, 482)).toBe(false);
  });

  it("співвідносить нагадування з конкретною датою, а не лише з годиною", () => {
    const item = scheduleItem({ startTime: "08:00" });
    const dueAt = { date: "2026-09-04", time: "07:45", hour: 7, minute: 45, minuteOfDay: 465 };

    expect(isLessonReminderDue(item, preferences, dueAt)).toBe(true);
    expect(isLessonReminderDue(item, preferences, { ...dueAt, date: "2026-09-05" })).toBe(false);
  });
});

describe("Ukrainian public push payloads", () => {
  it("повідомляє точний текст, якщо на сьогодні немає активних занять", () => {
    expect(createDailyDigestPayload("2026-09-04", [scheduleItem({ cancelled: true })]).body)
      .toBe("Сьогодні занять немає 🙂");
  });

  it("включає номер, час, аудиторію та групи в нагадування", () => {
    const payload = createClassReminderPayload(scheduleItem());

    expect(payload.title).toContain("2 пара");
    expect(payload.body).toContain("09:35–10:55");
    expect(payload.body).toContain("Аудиторія: 1-101");
    expect(payload.body).toContain("Групи: QA-1, QA-2");
  });

  it("створює нейтральний test payload без даних розкладу або викладача", () => {
    expect(createTestPushPayload()).toEqual({
      title: "Тестове сповіщення",
      body: "Якщо ви бачите це повідомлення, push-сповіщення працюють.",
      tag: "vidmitka:test",
      url: "/",
    });
  });
});

describe("createPushDeliveryKey", () => {
  it("детерміновано хешує лише ідентифікатори події", async () => {
    const input = {
      subscriptionId: "7f67b6d8-1979-4f28-80ea-cedda7d4d0f8",
      notificationKind: "lesson" as const,
      date: "2026-09-04",
      scheduledMinute: 465,
      scheduleItemId: "7f67b6d8-1979-4f28-80ea-cedda7d4d0f7",
    };

    await expect(createPushDeliveryKey(input)).resolves.toMatch(/^[a-f0-9]{64}$/u);
    await expect(createPushDeliveryKey(input)).resolves.toBe(await createPushDeliveryKey(input));
    await expect(createPushDeliveryKey({ ...input, scheduledMinute: 466 })).resolves.not.toBe(
      await createPushDeliveryKey(input),
    );
  });
});
