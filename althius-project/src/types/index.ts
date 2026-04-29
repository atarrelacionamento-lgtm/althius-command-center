export type Role = 'admin' | 'user';

export interface Profile {
  id: string;
  role: Role;
  name: string | null;
  created_at: string;
}

export interface User {
  id: string;
  email: string | undefined;
  profile: Profile | null;
}

// ── CRM ─────────────────────────────────────────────────

export interface Funnel {
  id: string;
  name: string;
  created_at: string;
}

export type BuyingSignal = 'hot' | 'warm' | 'cold';
export type CompanyStatus = 'new' | 'prospecting' | 'contacted' | 'meeting_booked' | 'proposal' | 'customer' | 'lost';
export type SalesModel = 'internal' | 'external' | 'hybrid';
export type ScoreTier = 'A' | 'B' | 'C';

export interface CompanyLaunch {
  id: string;
  company_id: string;
  name: string;
  status: 'active' | 'upcoming' | 'sold_out' | 'cancelled';
  launch_date: string | null;
  delivery_date: string | null;
  units_total: number | null;
  units_sold: number | null;
  vgv: number | null;
  price_per_sqm: number | null;
  address: string | null;
  city: string | null;
  neighborhood: string | null;
  website_url: string | null;
  landing_page_url: string | null;
  instagram_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  cnpj: string | null;
  city: string | null;
  segment: string | null;
  website: string | null;
  owner_id: string;
  created_at: string;
  // ABM / Intelligence
  status: CompanyStatus;
  score_tier: ScoreTier;
  buying_signal: BuyingSignal;
  icp_score: number;
  sales_model: SalesModel | null;
  has_active_launch: boolean;
  upcoming_launch: boolean;
  launch_count_year: number;
  vgv_projected: number | null;
  monthly_media_spend: number | null;
  cadence_status: string;
  cadence_day: number;
  cadence_started_at: string | null;
  last_interaction_at: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  connection_count: number;
  domain: string | null;
  employees_count: number | null;
  founded_year: number | null;
  state: string | null;
  owner?: Pick<Profile, 'id' | 'name'> | null;
}

export interface Contact {
  id: string;
  name: string;
  role: string | null;   // cargo
  email: string | null;
  phone?: string | null;
  whatsapp: string | null;
  company_id: string | null;
  source: string | null;
  owner_id: string;
  created_at: string;
  // Apollo / enrichment (opcionais — populados pelo enrich)
  apollo_person_id?: string | null;
  linkedin_url?: string | null;
  seniority?: string | null;
  departments?: string[] | null;
  enriched_at?: string | null;
  enrichment_source?: string | null;
  company?: Pick<Company, 'id' | 'name'> | null;
  owner?: Pick<Profile, 'id' | 'name'> | null;
}

export interface Deal {
  id: string;
  title: string;
  value: number | null;
  stage: string;
  funnel_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  owner_id: string;
  expected_close: string | null;
  created_at: string;
  funnel?: Pick<Funnel, 'id' | 'name'> | null;
  contact?: Pick<Contact, 'id' | 'name'> | null;
  company?: Pick<Company, 'id' | 'name'> | null;
  owner?: Pick<Profile, 'id' | 'name'> | null;
}

export type DealStage =
  | 'Qualificação'
  | 'Proposta'
  | 'Negociação'
  | 'Fechado - Ganho'
  | 'Fechado - Perdido';

export const DEAL_STAGES: DealStage[] = [
  'Qualificação',
  'Proposta',
  'Negociação',
  'Fechado - Ganho',
  'Fechado - Perdido',
];

export const CONTACT_SOURCES = [
  'Website',
  'Indicação',
  'LinkedIn',
  'Instagram',
  'Google',
  'Outro',
] as const;

export const COMPANY_SEGMENTS = [
  'Incorporadora',
  'Construtora',
  'Imobiliária',
  'Corretor',
  'Outro',
] as const;

// ── Automação / Sequências ────────────────────────────────

export interface FunnelStage {
  id: string;
  funnel_id: string;
  name: string;
  position: number;
}

export type SequenceChannel = 'whatsapp' | 'email';

export interface SequenceStep {
  id: string;
  sequence_id: string;
  position: number;
  channel: SequenceChannel;
  delay_days: number;
  template: string;
}

export interface Sequence {
  id: string;
  name: string;
  funnel_id: string;
  stage_id: string;
  active: boolean;
  created_at: string;
  funnel?: Pick<Funnel, 'id' | 'name'>;
  stage?: Pick<FunnelStage, 'id' | 'name'>;
  steps?: SequenceStep[];
}
