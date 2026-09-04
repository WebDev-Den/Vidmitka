export type AdminPushSubscription = Readonly<{
  id: string;
  teacherName: string;
  morningTime: string | null;
  lessonLeadMinutes: number | null;
  lastSeenAt: string;
}>;

export type AdminPushScanRun = Readonly<{
  id: string;
  status: "completed" | "ignored" | "failed";
  scanned: boolean;
  subscriptions: number;
  claimed: number;
  sent: number;
  invalid: number;
  failed: number;
  skipped: number;
  scheduleErrors: number;
  failureCode: string | null;
  createdAt: string;
}>;

export type AdminPushManualDelivery = Readonly<{
  id: string;
  teacherName: string;
  kind: "daily_digest" | "class_reminder";
  scheduledDate: string;
  scheduledTime: string;
  status: "pending" | "sent" | "failed" | "invalid";
  providerStatus: number | null;
  createdAt: string;
}>;

export type AdminPushDashboard = Readonly<{
  ready: boolean;
  webPushConfigured: boolean;
  subscriptions: readonly AdminPushSubscription[];
  scanRuns: readonly AdminPushScanRun[];
  manualDeliveries: readonly AdminPushManualDelivery[];
}>;
