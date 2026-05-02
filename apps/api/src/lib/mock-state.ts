type MockUser = {
  id: string;
  email: string;
  role: "GUEST" | "TRAVELER" | "PARTNER" | "ADMIN";
  consentGiven: boolean;
  preferences: any;
  updatedAt: string;
};

type MockItinerary = {
  id: string;
  userId: string;
  title: string | null;
  items: any[];
  createdAt: string;
  updatedAt: string;
};

type MockReport = {
  id: string;
  userId?: string;
  destinationId?: string;
  category: string;
  severity: number;
  source: string;
  description?: string;
  reportedAt: string;
};

const users = new Map<string, MockUser>();
const itineraries = new Map<string, MockItinerary>();
const reports = new Map<string, MockReport>([
  [
    "mock:report:1",
    {
      id: "mock:report:1",
      destinationId: "p1",
      category: "safety",
      severity: 5,
      source: "user_report",
      description: "Reported aggressive touting and unauthorized guide fees near the entrance.",
      reportedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
  ],
  [
    "mock:report:2",
    {
      id: "mock:report:2",
      destinationId: "p3",
      category: "overcharge",
      severity: 4,
      source: "user_report",
      description: "Menu prices did not match the final bill. Charged 3x the listed price for seafood.",
      reportedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
  ],
  [
    "mock:report:3",
    {
      id: "mock:report:3",
      destinationId: "p11",
      category: "misleading",
      severity: 4,
      source: "user_report",
      description: "Place was closed for renovation but still taking bookings through external platforms.",
      reportedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    },
  ],
]);

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  return `${prefix}:${crypto.randomUUID()}`;
}

function normalizeEmailForId(email: string) {
  return email.trim().toLowerCase().replace(/[^a-z0-9@._-]/g, "");
}

export function ensureMockUser(email: string, role: MockUser["role"]) {
  const normalizedEmail = normalizeEmailForId(email);
  const existing = Array.from(users.values()).find((entry) => entry.email === normalizedEmail);
  if (existing) return existing;

  const user: MockUser = {
    id: `mock:user:${Buffer.from(normalizedEmail).toString("base64url").slice(0, 24)}`,
    email: normalizedEmail,
    role,
    consentGiven: false,
    preferences: null,
    updatedAt: nowIso(),
  };
  users.set(user.id, user);
  return user;
}

export function getMockUser(userId: string) {
  return users.get(userId) || null;
}

export function updateMockUser(userId: string, patch: { consentGiven?: boolean; preferences?: any }) {
  const user = users.get(userId);
  if (!user) return null;
  if (patch.consentGiven !== undefined) user.consentGiven = patch.consentGiven;
  if (patch.preferences !== undefined) user.preferences = patch.preferences;
  user.updatedAt = nowIso();
  users.set(user.id, user);
  return user;
}

export function createMockItinerary(input: { userId: string; title?: string | null; items: any[] }) {
  const itinerary: MockItinerary = {
    id: randomId("mock:itinerary"),
    userId: input.userId,
    title: input.title ?? null,
    items: input.items || [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  itineraries.set(itinerary.id, itinerary);
  return itinerary;
}

export function listMockItineraries(userId: string, limit = 50) {
  return Array.from(itineraries.values())
    .filter((entry) => entry.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, Math.max(1, Math.min(limit, 200)));
}

export function getMockItinerary(itineraryId: string) {
  return itineraries.get(itineraryId) || null;
}

export function updateMockItinerary(itineraryId: string, patch: { title?: string | null; items?: any[] }) {
  const itinerary = itineraries.get(itineraryId);
  if (!itinerary) return null;
  if (patch.title !== undefined) itinerary.title = patch.title;
  if (patch.items !== undefined) itinerary.items = patch.items;
  itinerary.updatedAt = nowIso();
  itineraries.set(itinerary.id, itinerary);
  return itinerary;
}

export function deleteMockItinerary(itineraryId: string) {
  return itineraries.delete(itineraryId);
}

export function createMockReport(input: {
  userId?: string;
  destinationId?: string;
  category: string;
  severity: number;
  source: string;
  description?: string;
}) {
  const report: MockReport = {
    id: randomId("mock:report"),
    userId: input.userId,
    destinationId: input.destinationId,
    category: input.category,
    severity: input.severity,
    source: input.source,
    description: input.description,
    reportedAt: nowIso(),
  };
  reports.set(report.id, report);
  return report;
}

export function listMockReports(input: { userId?: string; limit?: number }) {
  const limit = Math.max(1, Math.min(Number(input.limit || 50), 200));
  return Array.from(reports.values())
    .filter((entry) => {
      if (!input.userId) return entry.source === "user_report";
      return entry.userId === input.userId || entry.source === `user_report:${input.userId}`;
    })
    .sort((a, b) => b.reportedAt.localeCompare(a.reportedAt))
    .slice(0, limit);
}

