import { readFileSync } from "node:fs";

type MockPlace = {
  id: string;
  sourceId?: string;
  kind: string;
  status?: string;
  name: string;
  nameEn?: string;
  categoryId?: number;
  categoryName?: string;
  introduction?: string;
  latitude?: number;
  longitude?: number;
  provinceId?: number;
  province?: string;
  thumbnailUrl?: string;
  viewerCount?: number;
  shaName?: string | null;
  destinationId?: string | null;
  destination?: {
    id: string;
    province?: string | null;
    trustScore?: number | null;
    crowdScore?: number | null;
    seasonFitScore?: number | null;
    accessibilityScore?: number | null;
    isSecondaryCity?: boolean | null;
  } | null;
};

type MockGraph = {
  nodes: Array<{ id: string; label: string }>;
  edges: Array<{ source: string; target: string; relation: string; [k: string]: unknown }>;
};

type MockDataset = {
  season: {
    current: "hot" | "rain" | "cool";
    label: string;
    monthsRange: string;
    recommendation: string;
  };
  provinces: Array<{
    id: number;
    nameTh: string;
    nameEn: string;
    region: string;
    isSecondary: boolean;
  }>;
  facilities: Array<{
    id: string;
    provinceId: number;
    facilityType: string;
    name: string;
  }>;
  places: MockPlace[];
  fairPrice: Record<
    string,
    {
      avgMin: number;
      avgMax: number;
      p25Min: number;
      p75Max: number;
      sampleCount: number;
      currency: string;
    }
  >;
  culturalContext: Record<
    string,
    {
      context: string;
      dos: string[];
      donts: string[];
      path?: string[];
    }
  >;
  graph: Record<string, MockGraph>;
  routes: unknown[];
};

let _dataset: MockDataset | null = null;

function parseDataset(): MockDataset {
  const raw = readFileSync(new URL("../mocks/dataset.json", import.meta.url), "utf8");
  return JSON.parse(raw) as MockDataset;
}

export function getMockDataset(): MockDataset {
  return parseDataset();
}

export function isMockMode() {
  return true; // Forced to use dataset.json as requested
}

export function listMockPlaces(params: {
  kind?: string;
  keyword?: string;
  provinceId?: string;
  limit?: string;
  page?: string;
  sortBy?: string;
}) {
  const dataset = getMockDataset();
  const limit = Math.min(Number(params.limit || 20), 100);
  const page = Math.max(Number(params.page || 1), 1);
  const skip = (page - 1) * limit;
  let rows = [...dataset.places];
  console.log(`[MockDB] Total places in dataset: ${dataset.places.length}. Filtering for:`, params);

  if (params.kind) {
    const kind = params.kind.toUpperCase();
    rows = rows.filter((place) => {
      const pk = place.kind.toUpperCase();
      if (kind === 'ACCOMMODATION') return pk === 'ACCOMMODATION' || pk === 'STAYS' || pk === 'HOTEL';
      if (kind === 'EXPERIENCE') return pk === 'EXPERIENCE' || pk === 'EVENT';
      return pk === kind;
    });
  }
  if (params.keyword) {
    const keyword = params.keyword.toLowerCase();
    rows = rows.filter(
      (place) => place.name.toLowerCase().includes(keyword) || (place.nameEn || "").toLowerCase().includes(keyword),
    );
  }
  if (params.provinceId) {
    const provinceId = Number(params.provinceId);
    rows = rows.filter((place) => place.provinceId === provinceId);
  }

  const sortBy = params.sortBy || "updated_desc";
  if (sortBy === "trust_desc") {
    rows.sort((a, b) => (b.destination?.trustScore || 0) - (a.destination?.trustScore || 0));
  } else if (sortBy === "viewer_desc") {
    rows.sort((a, b) => (b.viewerCount || 0) - (a.viewerCount || 0));
  } else if (sortBy === "season_fit_desc") {
    rows.sort((a, b) => (b.destination?.seasonFitScore || 0) - (a.destination?.seasonFitScore || 0));
  } else if (sortBy === "accessibility_desc") {
    rows.sort((a, b) => (b.destination?.accessibilityScore || 0) - (a.destination?.accessibilityScore || 0));
  }

  return {
    data: rows.slice(skip, skip + limit).map((p) => ({
      ...p,
      thumbnailUrl: p.thumbnailUrl || `${p.id}.jpg`,
    })),
    paging: { page, limit, returned: Math.min(limit, Math.max(0, rows.length - skip)) },
  };
}

export function getMockPlaceById(id: string) {
  const dataset = getMockDataset();
  const place = dataset.places.find((place) => place.id === id || place.sourceId === id);
  if (!place) return null;
  return {
    ...place,
    thumbnailUrl: place.thumbnailUrl || `${place.id}.jpg`,
  };
}

export function getMockGraphByPlaceId(id: string): MockGraph {
  const dataset = getMockDataset();
  return dataset.graph[id] || { nodes: [], edges: [] };
}

export function getMockFairPrice(placeId: string) {
  return getMockDataset().fairPrice[placeId] || null;
}

export function getMockCulturalContext(placeId: string) {
  return getMockDataset().culturalContext[placeId] || null;
}

export function getMockDetourCandidates(excludeNameEn?: string) {
  return getMockDataset().places
    .filter((entry) => (entry.nameEn || entry.name) !== excludeNameEn)
    .slice(0, 50)
    .map((entry) => ({
      id: entry.id,
      placeId: entry.id,
      destinationId: entry.destinationId || entry.id,
      name: entry.nameEn || entry.name,
      destinationName: entry.province || entry.destination?.province || "Thailand",
      trustScore: entry.destination?.trustScore || 0.65,
      crowdScore: entry.destination?.crowdScore || 0.5,
      localValueScore: 0.7,
      fitScore: 0.75,
      reason: entry.introduction || "Balanced trust and crowd profile.",
      safetyNotes: ["Trust score is an estimate, not a safety guarantee."],
      latitude: entry.latitude,
      longitude: entry.longitude,
      kind: entry.kind,
      thumbnailUrl: entry.thumbnailUrl || `${entry.id}.jpg`,
      nameEn: entry.nameEn,
      name: entry.name,
      province: entry.province,
      destination: entry.destination,
    }));
}
