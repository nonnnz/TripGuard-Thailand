import { useAppStore } from "@/lib/store";
import {
  PLACES,
  TRUST_DECISIONS,
  FAIR_PRICES,
  CULTURAL_CONTEXTS,
  GRAPHS,
  SEASON_CURRENT,
  PROVINCES,
  FACILITIES,
  ROUTES,
  ITINERARIES,
  PREFERENCES,
  RISK_FLAGS,
  REPORTS,
  AI_LOGS,
  DATA_JOBS,
} from "./mockData";
import { FOOD_CSV_DATA } from "./foodData";
import type {
  PlaceKind,
  PlaceCardVM,
  PlaceDetail,
  TrustDecisionVM,
  FairPriceVM,
  CulturalContextVM,
  GraphVM,
  DetourRequest,
  DetourResponse,
  SeasonInfo,
  Province,
  Facility,
  RouteVM,
  Itinerary,
  ItineraryItem,
  TouristPreferences,
  ReportInput,
  Report,
  AdminRiskFlag,
  ChatRequest,
  ChatResponseVM,
  ChatSuggestedAction,
  ChatRiskHint,
  AdminAILog,
  AdminDataJob,
  FairPriceHint,
  TrustSource,
} from "./types";

const API_BASE =
  ((import.meta as any).env?.VITE_API_URL as string | undefined)?.replace(
    /\/$/,
    "",
  ) || "http://localhost:3001";
const USE_MOCK_FRONTEND_DATA = false;
const STORAGE_USER_ID = "AllWay_user_id";
const STORAGE_GUEST_EMAIL = "AllWay_guest_email";
const STORAGE_ACTIVE_ITINERARY_ID = "AllWay_active_itinerary_id";
const STORAGE_LOCAL_ITINERARIES = "AllWay_local_itineraries_v2";

let cachedUserId: string | null = null;
let provinceNameByIdCache: Record<number, string> | null = null;

const delay = <T>(value: T, ms = 220): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

const DEFAULT_PREFS: TouristPreferences = {
  budgetRange: [1000, 8000],
  vibe: [],
  crowdTolerance: 0.5,
  accessibility: false,
  consents: {
    analytics: true,
    personalization: true,
    sharing: false,
  },
};

function numberOr(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toKind(raw: unknown): PlaceKind {
  const value = String(raw ?? "").toLowerCase();
  if (
    value === "restaurant" ||
    value === "accommodation" ||
    value === "attraction"
  )
    return value;
  if (value === "stays" || value === "hotel" || value === "accommodation")
    return "accommodation";
  if (value === "event" || value === "experience") return "experience";
  return "attraction";
}

function fairLabelFromDelta(deltaPct: number): FairPriceHint["label"] {
  if (!Number.isFinite(deltaPct)) return "unknown";
  if (deltaPct >= 30) return "high";
  if (deltaPct >= 10) return "slightly_high";
  if (deltaPct <= -15) return "low";
  return "in-range";
}

function normalizeSeason(value: unknown): SeasonInfo["current"] {
  const v = String(value ?? "").toLowerCase();
  if (v === "cool" || v === "hot") return v;
  if (v === "rain") return "green";
  return "shoulder";
}

function toTitleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((token) => token[0].toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}

function mapDiscoveryPlace(item: any): PlaceCardVM {
  const destination = item?.destination ?? {};
  const viewerCount = numberOr(item?.viewerCount, 0);
  const hasSha = !!item?.shaName;
  const status = String(item?.status || "").toLowerCase();
  const kind = toKind(item?.kind);

  const derivedTrust = (() => {
    const base = status === "approved" ? 0.72 : 0.46;
    const viewerBoost = Math.min(0.14, Math.log10(viewerCount + 1) * 0.04);
    const shaBoost = hasSha ? 0.05 : 0;
    const eventPenalty = kind === "experience" ? -0.03 : 0;
    return Math.max(
      0.35,
      Math.min(0.93, base + viewerBoost + shaBoost + eventPenalty),
    );
  })();

  const trustScore = Math.max(
    0,
    Math.min(1, numberOr(destination.trustScore, derivedTrust)),
  );
  const crowdScore = Math.max(
    0,
    Math.min(
      1,
      numberOr(
        destination.crowdScore,
        Math.min(0.92, 0.18 + viewerCount / 420),
      ),
    ),
  );
  const seasonFitScore = Math.max(
    0,
    Math.min(
      1,
      numberOr(
        destination.seasonFitScore,
        kind === "attraction" ? 0.74 : kind === "restaurant" ? 0.68 : 0.64,
      ),
    ),
  );
  const accessibilityScore = Math.max(
    0,
    Math.min(1, numberOr(destination.accessibilityScore, hasSha ? 0.67 : 0.53)),
  );
  const localValueScore = Math.max(
    0,
    Math.min(
      1,
      numberOr(
        destination.localValueScore,
        kind === "restaurant" ? 0.74 : kind === "attraction" ? 0.68 : 0.62,
      ),
    ),
  );

  const safetyTags: string[] = [];
  if (item?.shaName) safetyTags.push("sha");
  if (trustScore < 0.6) safetyTags.push("review");

  const culturalPaths: string[] | undefined = Array.isArray(item?.path)
    ? item.path.map((entry: unknown) => String(entry)).filter(Boolean)
    : Array.isArray(item?.paths)
      ? item.paths.map((entry: unknown) => String(entry)).filter(Boolean)
      : Array.isArray(item?.culturalContext?.path)
        ? item.culturalContext.path
            .map((entry: unknown) => String(entry))
            .filter(Boolean)
        : undefined;
  const culturalDos: string[] | undefined = Array.isArray(item?.dos)
    ? item.dos.map((entry: unknown) => String(entry)).filter(Boolean)
    : Array.isArray(item?.culturalContext?.dos)
      ? item.culturalContext.dos
          .map((entry: unknown) => String(entry))
          .filter(Boolean)
      : undefined;
  const culturalDonts: string[] | undefined = Array.isArray(item?.donts)
    ? item.donts.map((entry: unknown) => String(entry)).filter(Boolean)
    : Array.isArray(item?.culturalContext?.donts)
      ? item.culturalContext.donts
          .map((entry: unknown) => String(entry))
          .filter(Boolean)
      : undefined;

  return {
    id: String(item?.id ?? ""),
    kind,
    kindLabel: String(item?.kind || "").toUpperCase() || undefined,
    name: String(item?.nameEn || item?.name || "Unknown place"),
    nameTh: item?.name ? String(item.name) : undefined,
    provinceName: String(
      item?.province ||
        destination?.province ||
        item?.provinceName ||
        item?.district ||
        "Unknown province",
    ),
    provinceNameTh: item?.province ? String(item.province) : undefined,
    imageUrl: (() => {
      const thumb = item?.thumbnailUrl || item?.thumbnail_url || item?.imageUrl;
      if (thumb) {
        if (thumb.startsWith("http") || thumb.startsWith("/")) return thumb;
        return `/place/${thumb}`;
      }
      return item?.id ? `/place/${item.id}.jpg` : "/hero.png";
    })(),
    trustScore,
    crowdScore,
    seasonFitScore,
    accessibilityScore,
    localValueScore,
    fairPrice: {
      label: "unknown",
      deltaPct: 0,
    },
    reasonSnippet: String(
      item?.introduction ||
        item?.description ||
        item?.categoryName ||
        "Verified destination signal available.",
    ),
    reasonSnippetTh: item?.introduction ? String(item.introduction) : undefined,
    safetyTags,
    lat: numberOr(item?.latitude, 13.7563),
    lng: numberOr(item?.longitude, 100.5018),
    culturalPaths,
    culturalDos,
    culturalDonts,
  };
}

function mapDiscoveryPlaceWithProvince(
  item: any,
  provinceNameById: Record<number, string> | null,
): PlaceCardVM {
  const place = mapDiscoveryPlace(item);
  const provinceId = numberOr(item?.provinceId, 0);
  if (
    !place.provinceName ||
    place.provinceName === "Unknown province" ||
    place.provinceName === "Thailand"
  ) {
    if (provinceId > 0 && provinceNameById && provinceNameById[provinceId]) {
      place.provinceName = provinceNameById[provinceId];
    }
  }
  return place;
}

function mapSeverityToLabel(value: unknown): Report["severity"] {
  const n = numberOr(value, 3);
  if (n >= 4) return "high";
  if (n <= 2) return "low";
  return "medium";
}

function mapSeverityToNumber(value: ReportInput["severity"]): number {
  if (value === "high") return 5;
  if (value === "low") return 2;
  return 3;
}

function mapCategoryToApi(value: ReportInput["category"]): string {
  if (value === "safety") return "unsafe";
  if (value === "misleading") return "fake-product";
  return value;
}

function mapCategoryFromApi(value: unknown): Report["category"] {
  const raw = String(value ?? "").toLowerCase();
  if (raw === "unsafe" || raw === "safety") return "safety";
  if (raw === "overcharge") return "overcharge";
  if (raw === "closed") return "closed";
  if (raw === "misleading" || raw === "fake-product") return "misleading";
  return "other";
}

function normalizeCrowdTolerance(raw: unknown): number {
  if (typeof raw === "number") {
    if (raw > 1) return Math.max(0, Math.min(1, raw / 100));
    return Math.max(0, Math.min(1, raw));
  }
  if (typeof raw === "string") {
    if (raw === "low") return 0.2;
    if (raw === "high") return 0.8;
    if (raw === "medium") return 0.5;
  }
  return DEFAULT_PREFS.crowdTolerance;
}

function mapPreferencesPayload(payload: any): TouristPreferences {
  const source = payload?.preferences ?? payload ?? {};
  const budgetRange: [number, number] =
    Array.isArray(source?.budgetRange) && source.budgetRange.length === 2
      ? [
          Number(source.budgetRange[0]) || DEFAULT_PREFS.budgetRange[0],
          Number(source.budgetRange[1]) || DEFAULT_PREFS.budgetRange[1],
        ]
      : (() => {
          const budgetRaw = String(source?.budget ?? "").toLowerCase();
          if (budgetRaw === "low") return [500, 3000] as [number, number];
          if (budgetRaw === "high") return [10000, 30000] as [number, number];
          if (budgetRaw === "mid") return [3000, 10000] as [number, number];
          return DEFAULT_PREFS.budgetRange;
        })();

  const vibe = Array.isArray(source?.vibe)
    ? source.vibe
    : Array.isArray(source?.vibePrefs)
      ? source.vibePrefs
      : [];

  const accessibility =
    typeof source?.accessibility === "boolean"
      ? source.accessibility
      : Array.isArray(source?.accessibilityNeeds)
        ? source.accessibilityNeeds.length > 0
        : DEFAULT_PREFS.accessibility;

  const consentsFromSource = source?.consents ?? {};
  const consentGiven = payload?.consentGiven;

  return {
    budgetRange,
    vibe: vibe.map((entry: any) => String(entry)).filter(Boolean),
    crowdTolerance: normalizeCrowdTolerance(source?.crowdTolerance),
    accessibility,
    consents: {
      analytics:
        typeof consentsFromSource.analytics === "boolean"
          ? consentsFromSource.analytics
          : !!consentGiven,
      personalization:
        typeof consentsFromSource.personalization === "boolean"
          ? consentsFromSource.personalization
          : !!consentGiven,
      sharing:
        typeof consentsFromSource.sharing === "boolean"
          ? consentsFromSource.sharing
          : false,
    },
  };
}

function mapItineraryItem(raw: any, index: number): ItineraryItem {
  const placeId = String(
    raw?.placeId || raw?.destinationId || raw?.tatPoiId || `unknown-${index}`,
  );
  const placeName = String(
    raw?.placeName || raw?.name || raw?.destinationName || placeId,
  );
  const day = Math.max(1, numberOr(raw?.day ?? raw?.dayIndex, 1));
  return {
    id: String(raw?.id || `${placeId}-${day}-${index}`),
    placeId,
    placeName,
    day,
    note: raw?.note ? String(raw.note) : undefined,
    trustSnapshot: Math.max(
      0,
      Math.min(1, numberOr(raw?.trustSnapshot ?? raw?.trustScore, 0.7)),
    ),
    dateISO: raw?.dateISO ? String(raw.dateISO) : undefined,
    startTime: raw?.startTime ? String(raw.startTime) : undefined,
    durationMin: Math.max(30, numberOr(raw?.durationMin, 90)),
    flowX: Number.isFinite(numberOr(raw?.flowX, NaN))
      ? numberOr(raw?.flowX, 0)
      : undefined,
    flowY: Number.isFinite(numberOr(raw?.flowY, NaN))
      ? numberOr(raw?.flowY, 0)
      : undefined,
  };
}

function mapItineraryRecord(record: any): Itinerary {
  const rawItems = Array.isArray(record?.items) ? record.items : [];
  return {
    id: String(record?.id ?? ""),
    title: String(record?.title || "My itinerary"),
    createdISO: String(
      record?.createdAt || record?.createdISO || new Date().toISOString(),
    ),
    updatedISO:
      record?.updatedAt || record?.updatedISO
        ? String(record?.updatedAt || record?.updatedISO)
        : undefined,
    startDateISO: record?.startDateISO
      ? String(record.startDateISO)
      : undefined,
    endDateISO: record?.endDateISO ? String(record.endDateISO) : undefined,
    items: rawItems
      .map(mapItineraryItem)
      .sort(
        (a, b) =>
          (a.dateISO || "").localeCompare(b.dateISO || "") ||
          (a.startTime || "").localeCompare(b.startTime || "") ||
          a.day - b.day,
      ),
  };
}

function cloneFallbackItineraries(): Itinerary[] {
  return ITINERARIES.map((it) => ({
    ...it,
    items: it.items.map((item) => ({
      ...item,
      durationMin: item.durationMin ?? 90,
    })),
  }));
}

function readLocalItineraries(): Itinerary[] {
  try {
    const raw = localStorage.getItem(STORAGE_LOCAL_ITINERARIES);
    if (!raw) return cloneFallbackItineraries();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return cloneFallbackItineraries();
    return parsed.map(mapItineraryRecord);
  } catch {
    return cloneFallbackItineraries();
  }
}

function writeLocalItineraries(itineraries: Itinerary[]): void {
  localStorage.setItem(STORAGE_LOCAL_ITINERARIES, JSON.stringify(itineraries));
}

function selectActiveItinerary(
  itineraries: Itinerary[],
): Itinerary | undefined {
  const activeId = localStorage.getItem(STORAGE_ACTIVE_ITINERARY_ID);
  if (activeId) {
    const active = itineraries.find((it) => it.id === activeId);
    if (active) return active;
  }
  return itineraries[0];
}

export function setActiveItineraryId(itineraryId: string): void {
  localStorage.setItem(STORAGE_ACTIVE_ITINERARY_ID, itineraryId);
}

export function getActiveItineraryId(): string | null {
  return localStorage.getItem(STORAGE_ACTIVE_ITINERARY_ID);
}

async function requestJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${text}`);
  }

  return (await response.json()) as T;
}

async function withFallback<T>(
  live: () => Promise<T>,
  fallback: () => Promise<T>,
  preferMock: boolean = USE_MOCK_FRONTEND_DATA,
): Promise<T> {
  if (preferMock) return fallback();
  try {
    return await live();
  } catch {
    return fallback();
  }
}

function resolveRoleForAuth() {
  const role = useAppStore.getState().role;
  return role === "admin" ? "ADMIN" : "TRAVELER";
}

function resolveSessionEmail() {
  const state = useAppStore.getState();
  if (state.user?.email) return state.user.email;

  const existing = localStorage.getItem(STORAGE_GUEST_EMAIL);
  if (existing) return existing;

  const generated = `guest-${Math.random().toString(36).slice(2, 10)}@AllWay.local`;
  localStorage.setItem(STORAGE_GUEST_EMAIL, generated);
  return generated;
}

async function ensureUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;

  const cached = localStorage.getItem(STORAGE_USER_ID);
  if (cached) {
    cachedUserId = cached;
    return cached;
  }

  const payload = await requestJSON<{ user: { id: string } }>(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({
        email: resolveSessionEmail(),
        role: resolveRoleForAuth(),
      }),
    },
  );

  cachedUserId = payload.user.id;
  localStorage.setItem(STORAGE_USER_ID, payload.user.id);
  return payload.user.id;
}

async function getProvinceNameByIdMap(): Promise<Record<number, string>> {
  if (provinceNameByIdCache) return provinceNameByIdCache;
  try {
    const payload = await requestJSON<{ provinces: any[] }>(
      "/api/v1/discovery/provinces",
    );
    provinceNameByIdCache = (payload.provinces || []).reduce(
      (acc, province) => {
        const id = numberOr(province?.id, 0);
        if (id > 0)
          acc[id] = String(province?.nameEn || province?.nameTh || id);
        return acc;
      },
      {} as Record<number, string>,
    );
    return provinceNameByIdCache;
  } catch {
    provinceNameByIdCache = {};
    return provinceNameByIdCache;
  }
}

function csvToCard(csv: any, index: number): PlaceCardVM {
  return {
    id: `food-csv-${index}`,
    kind: "restaurant",
    name: csv.name,
    provinceName: csv.location || "Bangkok",
    imageUrl: csv.imageUrl,
    trustScore: 0.78,
    crowdScore: 0.45,
    seasonFitScore: 0.8,
    accessibilityScore: 0.8,
    localValueScore: 0.85,
    fairPrice: {
      label: "in-range",
      deltaPct: 0,
      min_avg: csv.min_avg,
      max_avg: csv.max_avg,
    },
    reasonSnippet: `Approx. ฿${csv.min_avg || "?"}${csv.max_avg && csv.max_avg !== csv.min_avg ? ` - ฿${csv.max_avg}` : ""}. Community sourced.`,
    safetyTags: ["community-sourced", "verified-location"],
    lat: csv.lat,
    lng: csv.lng,
    isCsvData: true,
    csvFields: {
      restaurantName: csv.name,
      averagePrice: csv.price,
      location: csv.location,
      wongnaiLink: csv.wongnai,
      googleMapsLink: csv.googleMapsUrl,
    },
  };
}

function csvToDetail(csv: any, index: number): PlaceDetail {
  return {
    ...csvToCard(csv, index),
    description: `Community-verified restaurant in ${csv.location}. Part of the curated Bangkok food list. Verify current menu and pricing via the Wongnai link below.`,
    hours: "Check Google Maps for live hours.",
    galleryUrls: [csv.imageUrl],
    contact: csv.wongnai,
  };
}

function mockToCard(place: PlaceDetail): PlaceCardVM {
  const fallbackPaths = CULTURAL_CONTEXTS[place.id]?.paths;
  return {
    id: place.id,
    kind: place.kind,
    name: place.name,
    nameTh: place.nameTh,
    provinceName: place.provinceName,
    provinceNameTh: place.provinceNameTh,
    imageUrl: place.imageUrl,
    trustScore: place.trustScore,
    crowdScore: place.crowdScore,
    seasonFitScore: place.seasonFitScore,
    accessibilityScore: place.accessibilityScore,
    localValueScore: place.localValueScore,
    fairPrice: place.fairPrice,
    reasonSnippet: place.reasonSnippet,
    reasonSnippetTh: place.reasonSnippetTh,
    safetyTags: place.safetyTags,
    lat: place.lat,
    lng: place.lng,
    culturalPaths: place.culturalPaths || fallbackPaths,
  };
}

// GET /api/v1/discovery/seasons/current
export const getCurrentSeason = (): Promise<SeasonInfo> =>
  withFallback(
    async () => {
      const payload = await requestJSON<any>(
        "/api/v1/discovery/seasons/current",
      );
      const current = normalizeSeason(payload?.season);
      const label = toTitleCase(String(payload?.season ?? current));
      const monthsRange =
        current === "hot"
          ? "Mar-May"
          : current === "green"
            ? "Jun-Oct"
            : current === "cool"
              ? "Nov-Feb"
              : "All year";
      const topHints = Array.isArray(payload?.hints)
        ? payload.hints.slice(0, 3)
        : [];
      const recommendation = topHints.length
        ? `Good season in ${topHints
            .map(
              (entry: any) =>
                entry?.province?.nameEn || entry?.province?.nameTh,
            )
            .filter(Boolean)
            .join(", ")}`
        : "Plan around weather and crowd patterns for better trust outcomes.";
      return { current, label, monthsRange, recommendation };
    },
    () => delay(SEASON_CURRENT),
  );

// GET /api/v1/discovery/places
export const getPlaces = (params?: {
  kind?: string;
  provinceId?: string;
  sortBy?: "relevance" | "trust" | "crowd";
  limit?: number;
  page?: number;
}): Promise<PlaceCardVM[]> =>
  withFallback(
    async () => {
      const provinceNameById = await getProvinceNameByIdMap();
      const query = new URLSearchParams();
      const limit = params?.limit ?? 12;
      const page = params?.page ?? 1;

      if (params?.kind)
        query.set("kind", params.kind === "experience" ? "event" : params.kind);
      if (params?.provinceId) query.set("provinceId", params.provinceId);
      query.set("limit", String(limit));
      query.set("offset", String((page - 1) * limit));

      if (params?.sortBy === "trust") query.set("sortBy", "trust_desc");
      else if (params?.sortBy === "relevance") query.set("sortBy", "relevance");
      else query.set("sortBy", "updated_desc");

      const payload = await requestJSON<{ data: any[] }>(
        `/api/v1/discovery/places?${query.toString()}`,
      );
      let items = (payload.data || []).map((entry) =>
        mapDiscoveryPlaceWithProvince(entry, provinceNameById),
      );

      // discovery list does not always carry fair-price/cultural fields; hydrate per place
      items = await Promise.all(
        items.map(async (item) => {
          let enriched = item;
          if (enriched.fairPrice.label === "unknown") {
            try {
              const fairPayload = await requestJSON<any>(
                `/api/v1/fair-price/places/${encodeURIComponent(enriched.id)}`,
              );
              const baseline = fairPayload?.baseline;
              if (baseline) {
                const avgMin = numberOr(baseline.avgMin, 0);
                const avgMax = numberOr(baseline.avgMax, 0);
                const observed = avgMax || avgMin;
                const areaAvg =
                  avgMin && avgMax ? (avgMin + avgMax) / 2 : observed;
                const deltaPct =
                  areaAvg > 0
                    ? Math.round(((observed - areaAvg) / areaAvg) * 100)
                    : 0;
                enriched = {
                  ...enriched,
                  fairPrice: {
                    label: fairLabelFromDelta(deltaPct),
                    deltaPct,
                    min_avg: avgMin > 0 ? Math.round(avgMin) : undefined,
                    max_avg: avgMax > 0 ? Math.round(avgMax) : undefined,
                  },
                };
              }
            } catch {
              // keep fallback value
            }
          }
          if (
            Array.isArray(enriched.culturalPaths) &&
            enriched.culturalPaths.length > 0
          )
            return enriched;
          try {
            const cultural = await requestJSON<{
              path?: string[];
              paths?: string[];
              dos?: string[];
              donts?: string[];
            }>(
              `/api/v1/cultural-context/places/${encodeURIComponent(
                enriched.id,
              )}`,
            );
            const paths = Array.isArray(cultural?.path)
              ? cultural.path
              : Array.isArray(cultural?.paths)
                ? cultural.paths
                : [];
            const dos = Array.isArray(cultural?.dos)
              ? cultural.dos
                  .map((entry) => String(entry || "").trim())
                  .filter(Boolean)
              : [];
            const donts = Array.isArray(cultural?.donts)
              ? cultural.donts
                  .map((entry) => String(entry || "").trim())
                  .filter(Boolean)
              : [];
            if (paths.length === 0 && dos.length === 0 && donts.length === 0)
              return enriched;
            return {
              ...enriched,
              culturalPaths: paths
                .map((entry) => String(entry || "").trim())
                .filter(Boolean),
              culturalDos: dos,
              culturalDonts: donts,
            };
          } catch {
            return enriched;
          }
        }),
      );

      // Merge CSV food data if requested
      if (params?.kind === "restaurant" || !params?.kind) {
        const csvCards = FOOD_CSV_DATA.map((csv, i) => csvToCard(csv, i));
        items = [...items, ...csvCards];
      }

      if (params?.sortBy === "trust") {
        items = [...items].sort((a, b) => b.trustScore - a.trustScore);
      }
      if (params?.sortBy === "crowd") {
        items = [...items].sort((a, b) => a.crowdScore - b.crowdScore);
      }

      const start = (page - 1) * limit;
      return items.slice(start, start + limit);
    },
    async () => {
      let list = PLACES.map(mockToCard);
      const limit = params?.limit ?? 12;
      const page = params?.page ?? 1;

      if (params?.kind === "restaurant" || !params?.kind) {
        const csvCards = FOOD_CSV_DATA.map((csv, i) => csvToCard(csv, i));
        list = [...list, ...csvCards];
      }

      if (params?.kind) {
        const kind = params.kind.toUpperCase();
        list = list.filter((place) => {
          const pk = place.kind.toUpperCase();
          if (kind === "ACCOMMODATION")
            return pk === "ACCOMMODATION" || pk === "STAYS" || pk === "HOTEL";
          if (kind === "EXPERIENCE")
            return pk === "EXPERIENCE" || pk === "EVENT";
          return pk === kind;
        });
      }

      if (params?.sortBy === "trust")
        list = list.sort((a, b) => b.trustScore - a.trustScore);
      if (params?.sortBy === "crowd")
        list = list.sort((a, b) => a.crowdScore - b.crowdScore);

      const start = (page - 1) * limit;
      return delay(list.slice(start, start + limit));
    },
  );

// GET /api/v1/discovery/places/{id}
export const getPlace = (id: string): Promise<PlaceDetail | undefined> => {
  if (id.startsWith("food-csv-")) {
    const index = parseInt(id.replace("food-csv-", ""), 10);
    const csv = FOOD_CSV_DATA[index];
    if (csv) return delay(csvToDetail(csv, index));
  }

  return withFallback(
    async () => {
      const provinceNameById = await getProvinceNameByIdMap();
      const payload = await requestJSON<any>(
        `/api/v1/discovery/places/${encodeURIComponent(id)}`,
      );
      const place = payload?.place;
      if (!place) return undefined;

      const card = mapDiscoveryPlaceWithProvince(place, provinceNameById);
      const guidance = payload?.fairPriceGuidance;
      let fairPrice = card.fairPrice;
      if (guidance) {
        const avgMin = numberOr(guidance.avgMin, 0);
        const avgMax = numberOr(guidance.avgMax, 0);
        const observed = avgMax || avgMin;
        const areaAvg = avgMin && avgMax ? (avgMin + avgMax) / 2 : observed;
        const deltaPct =
          areaAvg > 0 ? Math.round(((observed - areaAvg) / areaAvg) * 100) : 0;
        fairPrice = {
          label: fairLabelFromDelta(deltaPct),
          deltaPct,
        };
      }

      return {
        ...card,
        fairPrice,
        description: String(
          place?.introduction ||
            place?.description ||
            "No detailed description available yet.",
        ),
        descriptionTh: place?.introduction
          ? String(place.introduction)
          : undefined,
        hours: String(
          place?.hours || place?.openingHours || "Check local listing",
        ),
        contact: place?.contact ? String(place.contact) : undefined,
        galleryUrls: [
          String(
            place?.thumbnailUrl ||
              place?.thumbnail_url ||
              place?.imageUrl ||
              "/hero.png",
          ),
        ],
      };
    },
    () => delay(PLACES.find((entry) => entry.id === id)),
  );
};

// GET /api/v1/discovery/provinces
export const getProvinces = (): Promise<Province[]> =>
  withFallback(
    async () => {
      const payload = await requestJSON<{ provinces: any[] }>(
        "/api/v1/discovery/provinces",
      );
      return (payload.provinces || []).map((province) => ({
        id: String(province.id),
        name: String(province.nameEn || province.nameTh || province.id),
        nameTh: String(province.nameTh || province.nameEn || province.id),
        region:
          (String(
            province.region || "central",
          ).toLowerCase() as Province["region"]) || "central",
      }));
    },
    () => delay(PROVINCES),
  );

// GET /api/v1/discovery/facilities
export const getFacilities = (): Promise<Facility[]> =>
  withFallback(
    async () => {
      const payload = await requestJSON<{ facilities: any[] }>(
        "/api/v1/discovery/facilities?limit=200",
      );
      return (payload.facilities || []).map((facility) => ({
        id: String(facility.id),
        name: String(facility.name || facility.facilityType || "facility"),
        icon: String(facility.icon || "shield-check"),
      }));
    },
    () => delay(FACILITIES),
  );

// POST /api/v1/recommendations/detour
export const postDetour = (req: DetourRequest): Promise<DetourResponse> =>
  withFallback(
    async () => {
      const payload = await requestJSON<any>("/api/v1/recommendations/detour", {
        method: "POST",
        body: JSON.stringify({
          rawMessage: req.intent,
          currentDestination: req.origin,
          budget: req.budgetTHB,
          groupSize: req.groupSize,
          preferences: req.vibe,
          accessibility: req.accessibility ? ["wheelchair"] : [],
        }),
      });

      const candidates = Array.isArray(payload?.recommendations)
        ? payload.recommendations
        : [];
      const results = candidates.map((entry: any) => {
        const mapped = mapDiscoveryPlace(entry);
        const canonicalId = String(
          entry?.placeId ||
            entry?.tatPoiId ||
            entry?.id ||
            entry?.sourceId ||
            entry?.destinationId ||
            mapped.id ||
            "",
        );
        if (canonicalId) mapped.id = canonicalId;
        if (entry?.destinationName)
          mapped.provinceName = String(entry.destinationName);
        if (typeof entry?.trustScore === "number")
          mapped.trustScore = Math.max(0, Math.min(1, entry.trustScore));
        if (typeof entry?.crowdScore === "number")
          mapped.crowdScore = Math.max(0, Math.min(1, entry.crowdScore));
        if (entry?.reason) mapped.reasonSnippet = String(entry.reason);
        return mapped;
      });

      return {
        requestId: `req-${Math.random().toString(36).slice(2, 10)}`,
        results,
        rationale: results.length
          ? "Ranked by trust, crowd level, and preference fit from current destination graph signals."
          : "No strong alternatives found for these constraints.",
      };
    },
    async () => {
      const results = [...PLACES]
        .map(mockToCard)
        .sort(
          (a, b) =>
            b.trustScore +
            (1 - b.crowdScore) -
            (a.trustScore + (1 - a.crowdScore)),
        )
        .slice(0, 4);
      return delay({
        requestId: `req-${Math.random().toString(36).slice(2, 10)}`,
        results,
        rationale: req.avoidCrowds
          ? "Prioritized verified places with lower crowd scores and stable trust signals."
          : "Balanced trust signals, season fit, and your selected vibe.",
      });
    },
  );

// GET /api/v1/trust/places/{id}
export const getTrust = (id: string): Promise<TrustDecisionVM | undefined> =>
  withFallback(
    async () => {
      const [trust, fair, cultural] = await Promise.all([
        requestJSON<any>(`/api/v1/trust/places/${encodeURIComponent(id)}`),
        getFairPrice(id),
        getCulturalContext(id),
      ]);

      if (!trust) return undefined;

      const riskLabels = Array.isArray(trust.riskLabels)
        ? trust.riskLabels
        : [];
      const mappedRiskLabels: TrustDecisionVM["riskLabels"] = riskLabels.map(
        (label: string) => {
          if (label.includes("high")) return "high_risk";
          if (label.includes("review")) return "medium_review_risk";
          if (label.includes("recent") || label.includes("complaint"))
            return "recent_reports";
          return "medium_review_risk";
        },
      );

      const sourceBreakdown = trust.sourceBreakdown ?? {};
      const reasonsPositive: string[] = [];
      const reasonsNegative: string[] = [];

      if (numberOr(trust.trustScore, 0) >= 0.7)
        reasonsPositive.push(
          "Strong composite trust score from destination signals.",
        );
      if (
        String(sourceBreakdown.tatStatus || "").toLowerCase() === "approved"
      ) {
        reasonsPositive.push("Source listing status is approved.");
      }
      if (numberOr(sourceBreakdown.reviewSignals, 0) > 0) {
        reasonsPositive.push(
          "Recent review signals support this recommendation.",
        );
      }

      if (mappedRiskLabels.length === 0) {
        reasonsNegative.push("No notable concerns in the latest risk window.");
      } else {
        for (const label of mappedRiskLabels) {
          if (label === "high_risk")
            reasonsNegative.push(
              "High-severity complaint has been detected recently.",
            );
          if (label === "recent_reports")
            reasonsNegative.push(
              "Recent complaint reports require manual review.",
            );
          if (label === "medium_review_risk")
            reasonsNegative.push(
              "This place should be reviewed before finalizing plans.",
            );
        }
      }

      const sources: TrustSource[] = [
        {
          source: "tat_status",
          signal: String(sourceBreakdown.tatStatus || "unknown"),
          weight: 0.4,
          status:
            String(sourceBreakdown.tatStatus || "").toLowerCase() === "approved"
              ? "positive"
              : "neutral",
        },
        {
          source: "complaint_signals",
          signal: `${numberOr(sourceBreakdown.complaintSignals, 0)} reports`,
          weight: 0.3,
          status:
            numberOr(sourceBreakdown.complaintSignals, 0) > 0
              ? "negative"
              : "positive",
        },
        {
          source: "review_signals",
          signal: `${numberOr(sourceBreakdown.reviewSignals, 0)} entries`,
          weight: 0.3,
          status:
            numberOr(sourceBreakdown.reviewSignals, 0) > 0
              ? "positive"
              : "neutral",
        },
      ];

      return {
        placeId: id,
        trustScore: Math.max(0, Math.min(1, numberOr(trust.trustScore, 0.6))),
        riskLabels: mappedRiskLabels,
        reasonsPositive,
        reasonsNegative,
        sources,
        lastUpdatedISO: new Date().toISOString(),
        priceFairness: {
          status: fair?.status ?? "unknown",
          areaAvg: fair?.areaAvg ?? 0,
          observed: fair?.observed ?? 0,
          currency: "THB",
        },
        culturalContext:
          cultural?.tips?.[0]?.text ||
          "Follow local etiquette and verify current conditions.",
        culturalContextTh: cultural?.tips?.[0]?.textTh,
      };
    },
    () => delay(TRUST_DECISIONS[id]),
  );

// GET /api/v1/fair-price/places/{id}
export const getFairPrice = (id: string): Promise<FairPriceVM | undefined> => {
  if (id.startsWith("food-csv-")) {
    const index = parseInt(id.replace("food-csv-", ""), 10);
    const csv = FOOD_CSV_DATA[index];
    if (csv) {
      return delay({
        placeId: id,
        status: "in-range",
        observed: csv.min_avg || 0,
        areaAvg: csv.min_avg || 0,
        areaMin: csv.min_avg || 0,
        areaMax: csv.max_avg || csv.min_avg || 0,
        sampleSize: 1,
        currency: "THB",
        notes: `Community reported price range: ฿${csv.min_avg} - ฿${csv.max_avg}. Verified by local data.`,
      });
    }
  }

  return withFallback(
    async () => {
      const payload = await requestJSON<any>(
        `/api/v1/fair-price/places/${encodeURIComponent(id)}`,
      );
      const baseline = payload?.baseline;
      if (!baseline) {
        return {
          placeId: id,
          status: "unknown",
          observed: 0,
          areaAvg: 0,
          areaMin: 0,
          areaMax: 0,
          sampleSize: 0,
          currency: "THB",
          notes: "No local baseline available yet for this location.",
        };
      }

      const avgMin = numberOr(baseline.avgMin, 0);
      const avgMax = numberOr(baseline.avgMax, 0);
      const observed = avgMax || avgMin;
      const areaAvg = avgMin && avgMax ? (avgMin + avgMax) / 2 : observed;
      const areaMin = numberOr(baseline.p25Min, avgMin);
      const areaMax = numberOr(baseline.p75Max, avgMax);
      const sampleSize = numberOr(baseline.sampleCount, 0);
      const deltaPct = areaAvg > 0 ? ((observed - areaAvg) / areaAvg) * 100 : 0;

      return {
        placeId: id,
        status: fairLabelFromDelta(deltaPct),
        observed,
        areaAvg,
        areaMin,
        areaMax,
        sampleSize,
        currency: "THB",
        notes:
          sampleSize > 0
            ? `Baseline from ${sampleSize} nearby price points within local area.`
            : "Limited local price samples; compare manually before booking.",
      };
    },
    () => delay(FAIR_PRICES[id]),
  );
};

// GET /api/v1/cultural-context/places/{id}
export const getCulturalContext = (
  id: string,
): Promise<CulturalContextVM | undefined> =>
  withFallback(
    async () => {
      const payload = await requestJSON<any>(
        `/api/v1/cultural-context/places/${encodeURIComponent(id)}`,
      );
      const tips = [
        ...(payload?.context
          ? [{ icon: "info", text: String(payload.context) }]
          : []),
        ...(Array.isArray(payload?.dos) ? payload.dos : []).map(
          (entry: string) => ({ icon: "check", text: String(entry) }),
        ),
      ];

      return {
        placeId: id,
        tips:
          tips.length > 0
            ? tips
            : [
                {
                  icon: "info",
                  text: "Respect local customs and dress appropriately.",
                },
              ],
        taboos: Array.isArray(payload?.donts)
          ? payload.donts.map((entry: any) => String(entry))
          : [],
        bestTime: "Morning and late afternoon",
        paths: Array.isArray(payload?.path)
          ? payload.path.map((entry: unknown) => String(entry)).filter(Boolean)
          : Array.isArray(payload?.paths)
            ? payload.paths
                .map((entry: unknown) => String(entry))
                .filter(Boolean)
            : Array.isArray(payload?.culturalContext?.path)
              ? payload.culturalContext.path
                  .map((entry: unknown) => String(entry))
                  .filter(Boolean)
              : undefined,
      } as CulturalContextVM;
    },
    () => delay(CULTURAL_CONTEXTS[id]),
  );

function groupFromRelation(
  relation: string,
): GraphVM["nodes"][number]["group"] {
  const value = relation.toLowerCase();
  if (value.includes("food")) return "food";
  if (value.includes("culture")) return "culture";
  if (value.includes("nature")) return "nature";
  if (value.includes("route") || value.includes("detour")) return "route";
  return "place";
}

function normalizeGraphGroup(
  value: unknown,
): GraphVM["nodes"][number]["group"] {
  const raw = String(value ?? "").toLowerCase();
  if (
    raw === "place" ||
    raw === "food" ||
    raw === "culture" ||
    raw === "nature" ||
    raw === "route"
  )
    return raw;
  return "place";
}

// GET /api/v1/graph/places/{id}
export const getGraph = (id: string): Promise<GraphVM | undefined> =>
  withFallback(
    async () => {
      const payload = await requestJSON<any>(
        `/api/v1/graph/places/${encodeURIComponent(id)}`,
      );
      const nodes = Array.isArray(payload?.nodes) ? payload.nodes : [];
      const edges = Array.isArray(payload?.edges) ? payload.edges : [];

      const fallbackGroup =
        edges.length > 0
          ? groupFromRelation(String(edges[0].relation || ""))
          : "place";

      return {
        placeId: id,
        nodes: nodes.map((node: any, index: number) => ({
          id: String(node?.id || `node-${index}`),
          label: String(node?.label || node?.name || `Node ${index + 1}`),
          group: node?.group
            ? normalizeGraphGroup(node.group)
            : index === 0
              ? "place"
              : fallbackGroup,
          trustScore: undefined,
        })),
        links: edges.map((edge: any) => ({
          source: String(edge?.source || ""),
          target: String(edge?.target || ""),
          relation: String(edge?.relation || "RELATED_TO"),
          distanceKm:
            typeof edge?.distanceKm === "number" &&
            Number.isFinite(edge.distanceKm)
              ? edge.distanceKm
              : undefined,
          weight: Math.max(
            0.2,
            Math.min(
              1,
              numberOr(
                edge?.confidence,
                numberOr(
                  edge?.trustScore,
                  numberOr(edge?.distanceKm ? 1 / (1 + edge.distanceKm) : 0.6),
                ),
              ),
            ),
          ),
        })),
      };
    },
    () => delay(GRAPHS[id]),
  );

// GET /api/v1/routes/smart
export const getRoutes = (): Promise<RouteVM[]> =>
  withFallback(
    async () => {
      const userId = await ensureUserId();
      const payload = await requestJSON<any>(
        `/api/v1/routes/smart?limit=8&days=5&userId=${encodeURIComponent(userId)}`,
      );
      const routes = Array.isArray(payload?.routes) ? payload.routes : [];

      return routes.map((route: any) => {
        const rawStops = Array.isArray(route?.stops) ? route.stops : [];
        const dayMap = new Map<number, RouteVM["stops"][number]>();

        for (const stop of rawStops) {
          const day = Math.max(1, numberOr(stop?.dayIndex, 1));
          const list = dayMap.get(day) || [];
          const placeId = String(
            stop?.tatPoi?.id ||
              stop?.destination?.id ||
              `${route.id}-day${day}-${list.length + 1}`,
          );
          const name = String(
            stop?.tatPoi?.name ||
              stop?.destination?.nameEn ||
              stop?.destination?.name ||
              `Stop ${list.length + 1}`,
          );
          const lat = numberOr(
            stop?.tatPoi?.latitude,
            numberOr(stop?.destination?.latitude, 13.7563),
          );
          const lng = numberOr(
            stop?.tatPoi?.longitude,
            numberOr(stop?.destination?.longitude, 100.5018),
          );
          list.push({
            placeId,
            name,
            arriveISO: `Day ${day} ${String(Math.max(1, numberOr(stop?.stopOrder, list.length + 1))).padStart(2, "0")}:00`,
            durationMin: Math.max(20, numberOr(stop?.travelTimeMin, 90)),
            trustScore: Math.max(
              0,
              Math.min(1, numberOr(stop?.destination?.trustScore, 0.7)),
            ),
            warning: stop?.warning ? String(stop.warning) : undefined,
            imageUrl: undefined,
            lat,
            lng,
          });
          dayMap.set(day, list);
        }

        const sortedDays = Array.from(dayMap.keys()).sort((a, b) => a - b);
        const groupedStops = sortedDays.map((day) => dayMap.get(day) || []);
        const allStops = groupedStops.flat();
        const trustAverage =
          allStops.length > 0
            ? allStops.reduce((acc, stop) => acc + stop.trustScore, 0) /
              allStops.length
            : numberOr(route?.trustScore, 0.7);

        return {
          id: String(route?.id || crypto.randomUUID()),
          title: String(route?.name || route?.nameEn || "Smart route"),
          days: groupedStops.length || numberOr(payload?.days, 1),
          totalDistanceKm: Math.round(
            numberOr(route?.distanceKm, numberOr(route?.distance, 0)),
          ),
          trustAverage,
          stops: groupedStops,
        };
      });
    },
    () => delay(ROUTES),
    USE_MOCK_FRONTEND_DATA,
  );

// GET /api/v1/tourist/itineraries
export const getItineraries = async (): Promise<Itinerary[]> =>
  delay(
    readLocalItineraries().sort((a, b) =>
      (b.updatedISO || b.createdISO).localeCompare(
        a.updatedISO || a.createdISO,
      ),
    ),
  );

export const getItinerary = async (
  id: string,
): Promise<Itinerary | undefined> => {
  return delay(readLocalItineraries().find((item) => item.id === id));
};

export const getActiveItinerary = async (): Promise<Itinerary | undefined> => {
  const itineraries = await getItineraries();
  return selectActiveItinerary(itineraries);
};

async function createOrUpdateItinerary(data: {
  itineraryId?: string;
  title?: string;
  startDateISO?: string;
  endDateISO?: string;
  items: ItineraryItem[];
}): Promise<Itinerary> {
  const nowISO = new Date().toISOString();
  const itineraries = readLocalItineraries();
  const normalizedItems = data.items.map((item) => ({
    ...item,
    durationMin: Math.max(30, numberOr(item.durationMin, 90)),
  }));

  if (!data.itineraryId) {
    const created: Itinerary = {
      id: `trip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: data.title || "My itinerary",
      createdISO: nowISO,
      updatedISO: nowISO,
      startDateISO: data.startDateISO,
      endDateISO: data.endDateISO,
      items: normalizedItems,
    };
    const next = [created, ...itineraries];
    writeLocalItineraries(next);
    setActiveItineraryId(created.id);
    return delay(created);
  }

  const current = itineraries.find((it) => it.id === data.itineraryId);
  if (!current) throw new Error("Itinerary not found");

  const updated: Itinerary = {
    ...current,
    title: data.title ?? current.title,
    startDateISO: data.startDateISO ?? current.startDateISO,
    endDateISO: data.endDateISO ?? current.endDateISO,
    updatedISO: nowISO,
    items: normalizedItems,
  };

  const next = itineraries.map((it) => (it.id === current.id ? updated : it));
  writeLocalItineraries(next);
  return delay(updated);
}

export const upsertItinerary = async (data: {
  itineraryId?: string;
  title?: string;
  startDateISO?: string;
  endDateISO?: string;
  items: ItineraryItem[];
}): Promise<Itinerary> => createOrUpdateItinerary(data);

export const savePlaceToItinerary = async (
  place: Pick<PlaceCardVM, "id" | "name" | "trustScore">,
  options?: {
    note?: string;
    dateISO: string;
    startTime: string;
    durationMin?: number;
    itineraryId?: string;
  },
): Promise<Itinerary> => {
  const existing = await getItineraries();
  const active =
    (options?.itineraryId
      ? existing.find((it) => it.id === options.itineraryId)
      : undefined) || selectActiveItinerary(existing);
  const chosenDateISO =
    options?.dateISO || new Date().toISOString().slice(0, 10);
  const chosenStartTime = options?.startTime || "09:00";
  const newItem: ItineraryItem = {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    placeId: place.id,
    placeName: place.name,
    day: 1,
    note: options?.note,
    trustSnapshot: place.trustScore,
    durationMin: Math.max(30, numberOr(options?.durationMin, 90)),
    dateISO: chosenDateISO,
    startTime: chosenStartTime,
  };

  if (!active) {
    return createOrUpdateItinerary({
      title: `My Trip ${chosenDateISO}`,
      startDateISO: chosenDateISO,
      endDateISO: chosenDateISO,
      items: [newItem],
    });
  }

  const alreadyExists = active.items.some(
    (item) =>
      item.placeId === place.id &&
      item.dateISO === chosenDateISO &&
      item.startTime === chosenStartTime,
  );
  const currentStart = active.startDateISO || chosenDateISO;
  const currentEnd = active.endDateISO || currentStart;
  const nextStart = chosenDateISO < currentStart ? chosenDateISO : currentStart;
  const nextEnd = chosenDateISO > currentEnd ? chosenDateISO : currentEnd;
  const items = alreadyExists ? active.items : [...active.items, newItem];
  const normalizedItems = items.map((item) => ({
    ...item,
    day: Math.max(
      1,
      Math.round(
        (new Date(
          `${(item.dateISO || chosenDateISO).slice(0, 10)}T00:00:00`,
        ).getTime() -
          new Date(`${nextStart}T00:00:00`).getTime()) /
          86_400_000,
      ) + 1,
    ),
  }));

  return createOrUpdateItinerary({
    itineraryId: active.id,
    title: active.title,
    startDateISO: nextStart,
    endDateISO: nextEnd,
    items: normalizedItems,
  });
};

export const removeItineraryItem = async (
  itineraryId: string,
  itemId: string,
): Promise<Itinerary> => {
  const current = await getItinerary(itineraryId);
  if (!current) throw new Error("Itinerary not found");
  const items = current.items.filter((item) => item.id !== itemId);
  return createOrUpdateItinerary({
    itineraryId: current.id,
    title: current.title,
    items,
  });
};

export const deleteItinerary = async (itineraryId: string): Promise<void> => {
  const itineraries = readLocalItineraries();
  const next = itineraries.filter((it) => it.id !== itineraryId);
  writeLocalItineraries(next);
  if (localStorage.getItem(STORAGE_ACTIVE_ITINERARY_ID) === itineraryId) {
    if (next[0]) setActiveItineraryId(next[0].id);
    else localStorage.removeItem(STORAGE_ACTIVE_ITINERARY_ID);
  }
};

// GET/PATCH /api/v1/tourist/preferences
export const getPreferences = (): Promise<TouristPreferences> =>
  withFallback(
    async () => {
      const userId = await ensureUserId();
      const payload = await requestJSON<any>(
        `/api/v1/tourist/preferences?userId=${encodeURIComponent(userId)}`,
      );
      return mapPreferencesPayload(payload);
    },
    () => delay(PREFERENCES),
    USE_MOCK_FRONTEND_DATA,
  );

export const patchPreferences = async (
  p: Partial<TouristPreferences>,
): Promise<TouristPreferences> => {
  const userId = await ensureUserId();

  return withFallback(
    async () => {
      const current = await getPreferences();
      const merged = {
        ...current,
        ...p,
        consents: {
          ...current.consents,
          ...(p.consents ?? {}),
        },
      };

      const payload = await requestJSON<any>("/api/v1/tourist/preferences", {
        method: "PATCH",
        body: JSON.stringify({
          userId,
          consentGiven:
            merged.consents.analytics || merged.consents.personalization,
          preferences: merged,
        }),
      });

      return mapPreferencesPayload(payload);
    },
    async () => {
      Object.assign(PREFERENCES, p);
      return delay(PREFERENCES);
    },
    USE_MOCK_FRONTEND_DATA,
  );
};

// POST /api/v1/reports
export const postReport = async (input: ReportInput): Promise<Report> => {
  const userId = await ensureUserId();

  return withFallback(
    async () => {
      const payload = await requestJSON<{ report: any }>("/api/v1/reports", {
        method: "POST",
        body: JSON.stringify({
          placeId: input.placeId,
          category: mapCategoryToApi(input.category),
          severity: mapSeverityToNumber(input.severity),
          description: input.description,
          userId,
        }),
      });

      return {
        id: String(payload.report.id),
        placeId: input.placeId,
        category: input.category,
        severity: input.severity,
        description: input.description,
        status: "submitted",
        submittedISO: String(
          payload.report.reportedAt || new Date().toISOString(),
        ),
      };
    },
    async () => {
      const entry: Report = {
        id: `rep-${Math.random().toString(36).slice(2, 9)}`,
        placeId: input.placeId,
        category: input.category,
        severity: input.severity,
        description: input.description,
        status: "submitted",
        submittedISO: new Date().toISOString(),
      };
      REPORTS.unshift(entry);
      return delay(entry, 450);
    },
    USE_MOCK_FRONTEND_DATA,
  );
};

// GET /api/v1/tourist/reports
export const getMyReports = (): Promise<Report[]> =>
  withFallback(
    async () => {
      const userId = await ensureUserId();
      const payload = await requestJSON<{ reports: any[] }>(
        `/api/v1/tourist/reports?userId=${encodeURIComponent(userId)}&limit=100`,
      );
      return (payload.reports || []).map((report) => ({
        id: String(report.id),
        placeId: String(report.placeId || report.destinationId || "unknown"),
        category: mapCategoryFromApi(report.category),
        severity: mapSeverityToLabel(report.severity),
        description: String(report.description || ""),
        status: "submitted",
        submittedISO: String(report.reportedAt || new Date().toISOString()),
      }));
    },
    () => delay(REPORTS),
    USE_MOCK_FRONTEND_DATA,
  );

// GET /api/v1/admin/risk-flags
export const getRiskFlags = (): Promise<AdminRiskFlag[]> =>
  withFallback(
    async () => {
      const payload = await requestJSON<any>("/api/v1/admin/risk-flags");
      const complaints = Array.isArray(payload?.complaints)
        ? payload.complaints
        : [];
      return complaints.map((complaint: any) => ({
        id: String(complaint.id),
        placeId: String(complaint.destinationId || "unknown"),
        placeName: String(
          complaint?.destination?.nameEn ||
            complaint?.destination?.name ||
            "Unknown destination",
        ),
        province: String(complaint?.destination?.province || "Unknown"),
        severity: mapSeverityToLabel(complaint.severity),
        reason: String(
          complaint.description || complaint.category || "Risk signal reported",
        ),
        reportsCount: 1,
        raisedISO: String(complaint.reportedAt || new Date().toISOString()),
        status: "open",
      }));
    },
    () => delay(RISK_FLAGS),
    USE_MOCK_FRONTEND_DATA,
  );

// GET /api/v1/admin/ai-logs (fallback to risk-flags flaggedAiLogs when available)
export const getAILogs = (): Promise<AdminAILog[]> =>
  withFallback(
    async () => {
      const payload = await requestJSON<any>("/api/v1/admin/risk-flags");
      const logs = Array.isArray(payload?.flaggedAiLogs)
        ? payload.flaggedAiLogs
        : [];
      if (logs.length === 0) throw new Error("No AI logs endpoint available");
      return logs.map((log: any) => ({
        id: String(log.id),
        timestampISO: String(log.createdAt || new Date().toISOString()),
        module: "trust_engine",
        inputSnippet: JSON.stringify(log.inputSnapshot || {}).slice(0, 100),
        outputSnippet: JSON.stringify(log.outputSnapshot || {}).slice(0, 120),
        confidence: Math.max(0, Math.min(1, numberOr(log.confidence, 0.7))),
        flagged: !!log.flagged,
        attributionSources: Array.isArray(log.sourcesUsed)
          ? log.sourcesUsed.map((s: any) => String(s))
          : [],
      }));
    },
    () => delay(AI_LOGS),
    USE_MOCK_FRONTEND_DATA,
  );

// GET /api/v1/admin/ingest/jobs (no list endpoint yet -> fallback)
export const getDataJobs = (): Promise<AdminDataJob[]> => delay(DATA_JOBS);

function mapIntentActions(
  actions: string[] | undefined,
): ChatSuggestedAction[] {
  const mapped = (actions || []).map((action) => {
    if (action === "show_fair_price") return "View Fair Price";
    if (action === "show_cultural_context") return "View Cultural Context";
    if (action === "show_trust_breakdown") return "View Trust Sources";
    if (action === "open_report_flow") return "Report Risk";
    if (
      action === "run_detour_recommendation" ||
      action === "show_graph_neighbors" ||
      action === "show_routes"
    ) {
      return "Find Safer Detours";
    }
    return "Open Place Detail";
  });

  return Array.from(new Set(mapped)).slice(0, 4) as ChatSuggestedAction[];
}

function mapIntentRiskHint(
  intent: string | undefined,
): ChatRiskHint | undefined {
  if (!intent) return undefined;
  if (intent === "report") return "not_guaranteed_safety";
  if (intent === "trust") return "review_suggested";
  return "low_risk";
}

// POST /api/chat + /api/v1/chat/intent
export const postChat = async (req: ChatRequest): Promise<ChatResponseVM> => {
  try {
    const lastMessage = req.messages[req.messages.length - 1]?.content || "";

    const [chat, intent] = await Promise.all([
      requestJSON<{ reply: string }>("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: req.messages,
          context: req.context,
        }),
      }),
      requestJSON<any>("/api/v1/chat/intent", {
        method: "POST",
        body: JSON.stringify({
          message: lastMessage,
          context: req.context,
        }),
      }),
    ]);

    return {
      reply: chat.reply,
      suggestedActions: mapIntentActions(intent?.suggestedActions),
      linkedPlaceIds: req.context?.currentPlaceId
        ? [req.context.currentPlaceId]
        : [],
      riskHint: mapIntentRiskHint(intent?.intent),
    };
  } catch {
    const last =
      req.messages[req.messages.length - 1]?.content?.toLowerCase() ?? "";
    const isReportIntent = /(scam|unsafe|fraud|overcharg|report|risk)/.test(
      last,
    );
    return delay(
      {
        reply: isReportIntent
          ? "Please submit a report if something feels unsafe. Trust guidance is supportive only and not guaranteed safety."
          : "Open place detail to compare trust, fair price, and local context before deciding.",
        suggestedActions: isReportIntent
          ? ["Report Risk", "Open Place Detail"]
          : ["Open Place Detail", "View Trust Sources", "View Fair Price"],
        linkedPlaceIds: req.context?.currentPlaceId
          ? [req.context.currentPlaceId]
          : [],
        riskHint: isReportIntent ? "not_guaranteed_safety" : "low_risk",
      },
      300,
    );
  }
};

export const queryKeys = {
  season: ["season", "current"] as const,
  places: (params?: unknown) => ["places", params] as const,
  place: (id: string) => ["place", id] as const,
  trust: (id: string) => ["trust", id] as const,
  fairPrice: (id: string) => ["fair-price", id] as const,
  cultural: (id: string) => ["cultural", id] as const,
  graph: (id: string) => ["graph", id] as const,
  provinces: ["provinces"] as const,
  facilities: ["facilities"] as const,
  routes: ["routes"] as const,
  itineraries: ["itineraries"] as const,
  itinerary: (id: string) => ["itinerary", id] as const,
  preferences: ["preferences"] as const,
  reports: ["reports"] as const,
  riskFlags: ["admin", "risk-flags"] as const,
  aiLogs: ["admin", "ai-logs"] as const,
  dataJobs: ["admin", "data-jobs"] as const,
};
