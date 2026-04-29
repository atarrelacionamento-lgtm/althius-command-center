import { supabase } from "@/lib/supabase";
import type { PersonaType } from "./abmService";

interface GenerateMessageParams {
  company_id: string;
  persona_type: PersonaType;
  cadence_day: number;
  contact_name?: string;
  loom_url?: string;
  phase0_result?: {
    first_response_minutes: number | null;
    followup_count: number;
    followup_days: number;
  } | null;
}

interface GenerateMessageResult {
  message: string;
  source: "claude" | "template";
}

export async function generateMessage(
  params: GenerateMessageParams
): Promise<GenerateMessageResult> {
  const { data, error } = await supabase.functions.invoke("generate-message", {
    body: params,
  });
  if (error) throw error;
  return data;
}
