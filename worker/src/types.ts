export interface Env {
  TS_KV: KVNamespace;
  PLK_API_KEY?: string;
}

export interface Profile {
  id: string;
  name: string;
  lat: number;
  lon: number;
  r: number;
  from: number[];
  to: number[];
}

export interface DeviceConfig {
  secret: string;
  profiles: Profile[];
}

export interface SignedFields {
  timestamp: string;
  lat: string;
  lon: string;
  profile: string;
}

// Subset of https://pdp-api.plk-sa.pl/swagger/v1/swagger.json

export interface TrainRef {
  scheduleId: number;
  orderId: number;
  trainOrderId?: number | null;
}

export interface PlkStop {
  stationId: number;
  orderNumber: number;
  departureTime?: string | null;
  departureDay?: number | null;
  departurePlatform?: string | null;
  departureTrainNumber?: string | null;
  departureCommercialCategory?: string | null;
}

export interface PlkRoute extends TrainRef {
  carrierCode?: string | null;
  nationalNumber?: string | null;
  commercialCategorySymbol?: string | null;
  operatingDates?: string[] | null;
  stations?: PlkStop[] | null;
}

export interface PlkSchedules {
  routes?: PlkRoute[] | null;
  dictionaries?: { stations?: Record<string, { name?: string | null }> | null } | null;
}

export interface PlkOperations {
  trains?:
    | (TrainRef & {
        operatingDate: string;
        trainStatus?: string | null;
        stations?: {
          stationId: number;
          departureDelayMinutes?: number | null;
          actualDeparture?: string | null;
          isCancelled?: boolean;
        }[] | null;
      })[]
    | null;
}

export interface Candidate {
  rtKey: string;
  dep: number;
  station: string;
  platform: string;
  label: string;
}

export interface Realtime {
  delay: number;
  // Raw PLK local time; converting thousands of these would blow the CPU budget.
  actual: string | null;
  cancelled: boolean;
}

// [expected departure, delay min, train, origin station, platform, cancelled]
export type Row = [number, number, string, string, string, boolean];

export interface WatchResponse {
  time: number;
  profile: string;
  name: string;
  matched: boolean;
  stale: boolean;
  profiles: string[];
  departures: Row[];
}
