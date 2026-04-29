import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const OPENAI_TRANSCRIPTION_MODEL = Deno.env.get("OPENAI_TRANSCRIPTION_MODEL") || "whisper-1";
const TRANSCRIPTION_LANGUAGE = Deno.env.get("TRANSCRIPTION_LANGUAGE") || "pt";
const DEFAULT_STORAGE_BUCKET = Deno.env.get("TRANSCRIPTION_STORAGE_BUCKET") || "";

const JOB_TABLE = "transcription_jobs";
const STATUS_COLUMNS = ["transcription_status", "status"] as const;
const MESSAGE_TABLES = ["whatsapp_messages", "crm_messages", "messages"];
const MEDIA_TABLES = ["message_media", "crm_message_media", "media"];

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type SupabaseClient = ReturnType<typeof createClient>;
type JobRow = Record<string, unknown> & { id: string };

type TranscribeRequest = {
  job_id?: string;
  limit?: number;
  reprocess_failed?: boolean;
  force?: boolean;
};

type LinkedTarget = {
  table: string;
  id: string;
};

type AudioSource = {
  bucket?: string;
  path?: string;
  url?: string;
  filename: string;
  contentType?: string;
  target?: LinkedTarget;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function firstString(record: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

function uniqueTargets(targets: LinkedTarget[]) {
  const seen = new Set<string>();
  return targets.filter((target) => {
    const key = `${target.table}:${target.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function statusColumnFor(job: Record<string, unknown>) {
  return STATUS_COLUMNS.find((column) => Object.prototype.hasOwnProperty.call(job, column)) ?? "status";
}

function statusPayloadFor(job: Record<string, unknown>, status: "processing" | "done" | "failed") {
  const columns = STATUS_COLUMNS.filter((column) =>
    Object.prototype.hasOwnProperty.call(job, column)
  );
  const targetColumns = columns.length ? columns : [statusColumnFor(job)];
  return Object.fromEntries(targetColumns.map((column) => [column, status]));
}

function requestLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 5;
  return Math.max(1, Math.min(10, Math.trunc(parsed)));
}

async function readRequest(req: Request): Promise<TranscribeRequest> {
  const url = new URL(req.url);
  let body: TranscribeRequest = {};
  const limitParam = url.searchParams.get("limit");

  if (req.method !== "GET") {
    try {
      body = await req.json();
    } catch {
      body = {};
    }
  }

  return {
    ...body,
    job_id: body.job_id ?? url.searchParams.get("job_id") ?? undefined,
    limit: body.limit ?? (limitParam ? Number(limitParam) : undefined),
    reprocess_failed:
      body.reprocess_failed ?? (url.searchParams.get("reprocess_failed") === "true"),
    force: body.force ?? (url.searchParams.get("force") === "true"),
  };
}

async function fetchJobs(db: SupabaseClient, request: TranscribeRequest) {
  if (request.job_id) {
    const { data, error } = await db
      .from(JOB_TABLE)
      .select("*")
      .eq("id", request.job_id)
      .maybeSingle();

    if (error) throw error;
    return data ? [data as JobRow] : [];
  }

  const statuses = request.reprocess_failed ? ["pending", "failed"] : ["pending"];
  let lastError: unknown = null;

  for (const statusColumn of STATUS_COLUMNS) {
    const { data, error } = await db
      .from(JOB_TABLE)
      .select("*")
      .in(statusColumn, statuses)
      .limit(requestLimit(request.limit));

    if (!error) return (data ?? []) as JobRow[];
    lastError = error;
  }

  throw lastError ?? new Error("Unable to read transcription_jobs");
}

function jobStatusVariants(job: JobRow, status: "processing" | "done" | "failed", extras: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  const statusColumn = statusColumnFor(job);
  const statusPayload = statusPayloadFor(job, status);
  const nextAttempts = typeof job.attempts === "number" ? job.attempts + 1 : undefined;
  const error = typeof extras.error === "string" ? extras.error : undefined;
  const transcript = typeof extras.transcript === "string" ? extras.transcript : undefined;

  if (status === "processing") {
    return [
      compact({
        ...statusPayload,
        started_at: now,
        processing_started_at: now,
        updated_at: now,
        error_message: null,
        transcription_error: null,
        attempts: nextAttempts,
      }),
      compact({
        ...statusPayload,
        updated_at: now,
        attempts: nextAttempts,
      }),
      { [statusColumn]: "processing" },
    ];
  }

  if (status === "done") {
    return [
      compact({
        ...statusPayload,
        transcript,
        transcript_text: transcript,
        completed_at: now,
        processed_at: now,
        updated_at: now,
        error_message: null,
        transcription_error: null,
      }),
      compact({
        ...statusPayload,
        transcript,
        completed_at: now,
        processed_at: now,
      }),
      compact({ [statusColumn]: "done", transcript }),
      { [statusColumn]: "done" },
    ];
  }

  return [
    compact({
      ...statusPayload,
      error_message: error,
      transcription_error: error,
      failed_at: now,
      processed_at: now,
      updated_at: now,
    }),
    compact({
      ...statusPayload,
      error_message: error,
      processed_at: now,
    }),
    compact({ [statusColumn]: "failed", error_message: error }),
    { [statusColumn]: "failed" },
  ];
}

async function patchRecord(
  db: SupabaseClient,
  table: string,
  id: string,
  variants: Record<string, unknown>[],
) {
  let lastError: unknown = null;

  for (const payload of variants) {
    const { error } = await db
      .from(table)
      .update(payload)
      .eq("id", id);

    if (!error) return { ok: true };
    lastError = error;
  }

  return { ok: false, error: lastError };
}

async function claimJob(db: SupabaseClient, job: JobRow, request: TranscribeRequest) {
  const statusColumn = statusColumnFor(job);
  const allowedStatuses = request.force
    ? ["pending", "processing", "failed"]
    : request.reprocess_failed
      ? ["pending", "failed"]
      : ["pending"];

  let lastError: unknown = null;
  for (const payload of jobStatusVariants(job, "processing")) {
    const { data, error } = await db
      .from(JOB_TABLE)
      .update(payload)
      .eq("id", job.id)
      .in(statusColumn, allowedStatuses)
      .select("*")
      .maybeSingle();

    if (!error) return data as JobRow | null;
    lastError = error;
  }

  throw lastError ?? new Error(`Unable to claim transcription job ${job.id}`);
}

function linkedTargetsFromJob(job: JobRow) {
  const targets: LinkedTarget[] = [];
  const targetTable = firstString(job, ["target_table", "record_table"]);
  const targetId = firstString(job, ["target_id", "record_id"]);
  const messageId = firstString(job, ["message_id", "whatsapp_message_id", "crm_message_id"]);
  const mediaId = firstString(job, ["media_id", "message_media_id"]);

  if (targetTable && targetId) targets.push({ table: targetTable, id: targetId });
  if (messageId) {
    MESSAGE_TABLES.forEach((table) => targets.push({ table, id: messageId }));
  }
  if (mediaId) {
    MEDIA_TABLES.forEach((table) => targets.push({ table, id: mediaId }));
  }

  return uniqueTargets(targets);
}

function sourceFromRecord(record: Record<string, unknown>, target?: LinkedTarget): AudioSource | null {
  const bucket = firstString(record, [
    "storage_bucket",
    "audio_bucket",
    "media_bucket",
    "bucket",
  ]) ?? DEFAULT_STORAGE_BUCKET;
  const path = firstString(record, [
    "storage_path",
    "audio_storage_path",
    "audio_path",
    "media_path",
    "file_path",
    "object_path",
  ]);
  const url = firstString(record, ["signed_url", "media_url", "audio_url", "file_url"]);
  const contentType = firstString(record, ["content_type", "mime_type", "media_mime_type"]) ?? undefined;

  if (path) {
    return {
      bucket: bucket || undefined,
      path,
      filename: path.split("/").pop() || "audio.ogg",
      contentType,
      target,
    };
  }

  if (url?.startsWith("http://") || url?.startsWith("https://")) {
    return {
      url,
      filename: url.split("?")[0].split("/").pop() || "audio.ogg",
      contentType,
      target,
    };
  }

  if (url && bucket) {
    return {
      bucket,
      path: url,
      filename: url.split("/").pop() || "audio.ogg",
      contentType,
      target,
    };
  }

  return null;
}

async function fetchLinkedRecord(db: SupabaseClient, target: LinkedTarget) {
  const { data, error } = await db
    .from(target.table)
    .select("*")
    .eq("id", target.id)
    .maybeSingle();

  if (error || !data) return null;
  return data as Record<string, unknown>;
}

async function resolveAudioSource(db: SupabaseClient, job: JobRow, targets: LinkedTarget[]) {
  const sourceFromJob = sourceFromRecord(job);
  if (sourceFromJob) return sourceFromJob;

  for (const target of targets) {
    const record = await fetchLinkedRecord(db, target);
    if (!record) continue;

    const source = sourceFromRecord(record, target);
    if (source) return source;
  }

  throw new Error("Audio storage path not found for transcription job");
}

async function downloadAudio(db: SupabaseClient, source: AudioSource) {
  if (source.path) {
    if (!source.bucket) {
      throw new Error("Audio storage bucket is required");
    }

    const { data, error } = await db.storage
      .from(source.bucket)
      .download(source.path);

    if (error) throw error;
    return data as Blob;
  }

  if (!source.url) {
    throw new Error("Audio source is missing");
  }

  const response = await fetch(source.url);
  if (!response.ok) {
    throw new Error(`Audio download failed: ${response.status} ${await response.text()}`);
  }
  return await response.blob();
}

async function transcribeWithOpenAI(blob: Blob, source: AudioSource) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const file = new File([blob], source.filename, {
    type: source.contentType || blob.type || "audio/ogg",
  });
  const form = new FormData();
  form.append("file", file);
  form.append("model", OPENAI_TRANSCRIPTION_MODEL);
  form.append("response_format", "json");
  if (TRANSCRIPTION_LANGUAGE !== "auto") {
    form.append("language", TRANSCRIPTION_LANGUAGE);
  }

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: form,
  });

  if (!response.ok) {
    throw new Error(`OpenAI transcription error: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  const transcript = typeof result.text === "string" ? result.text.trim() : "";
  if (!transcript) {
    throw new Error("Transcription provider returned an empty transcript");
  }

  return transcript;
}

function linkedStatusVariants(status: "processing" | "done" | "failed", transcript?: string, error?: string) {
  const now = new Date().toISOString();

  if (status === "processing") {
    return [
      { transcription_status: "processing", updated_at: now },
      { transcription_status: "processing" },
    ];
  }

  if (status === "done") {
    return [
      compact({
        transcription_status: "done",
        transcript,
        transcript_text: transcript,
        transcription_error: null,
        transcribed_at: now,
        updated_at: now,
      }),
      compact({
        transcription_status: "done",
        transcript,
        transcribed_at: now,
      }),
      compact({ transcription_status: "done", transcript }),
      { transcription_status: "done" },
    ];
  }

  return [
    compact({
      transcription_status: "failed",
      transcription_error: error,
      error_message: error,
      updated_at: now,
    }),
    compact({ transcription_status: "failed", transcription_error: error }),
    compact({ transcription_status: "failed", error_message: error }),
    { transcription_status: "failed" },
  ];
}

async function patchLinkedTargets(
  db: SupabaseClient,
  targets: LinkedTarget[],
  status: "processing" | "done" | "failed",
  transcript?: string,
  error?: string,
) {
  const results = [];

  for (const target of uniqueTargets(targets)) {
    const result = await patchRecord(
      db,
      target.table,
      target.id,
      linkedStatusVariants(status, transcript, error),
    );

    results.push({ ...target, ok: result.ok });
  }

  return results;
}

async function markJob(
  db: SupabaseClient,
  job: JobRow,
  status: "done" | "failed",
  extras: Record<string, unknown> = {},
) {
  const result = await patchRecord(db, JOB_TABLE, job.id, jobStatusVariants(job, status, extras));
  if (!result.ok) {
    throw new Error(`Unable to mark transcription job ${job.id} as ${status}: ${errorMessage(result.error)}`);
  }
}

async function processJob(db: SupabaseClient, job: JobRow, request: TranscribeRequest) {
  const claimedJob = await claimJob(db, job, request);
  if (!claimedJob) {
    return {
      job_id: job.id,
      status: "skipped",
      reason: "Job is not pending or eligible for reprocess",
    };
  }

  const targets = linkedTargetsFromJob(claimedJob);
  await patchLinkedTargets(db, targets, "processing");

  try {
    const source = await resolveAudioSource(db, claimedJob, targets);
    const patchTargets = source.target ? uniqueTargets([...targets, source.target]) : targets;
    const audio = await downloadAudio(db, source);
    const transcript = await transcribeWithOpenAI(audio, source);

    await markJob(db, claimedJob, "done", { transcript });
    const targetResults = await patchLinkedTargets(db, patchTargets, "done", transcript);

    return {
      job_id: claimedJob.id,
      status: "done",
      transcript_length: transcript.length,
      linked_updates: targetResults,
    };
  } catch (error) {
    const message = errorMessage(error);
    await markJob(db, claimedJob, "failed", { error: message });
    await patchLinkedTargets(db, targets, "failed", undefined, message);

    return {
      job_id: claimedJob.id,
      status: "failed",
      error: message,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!["GET", "POST"].includes(req.method)) {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const request = await readRequest(req);
  const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const jobs = await fetchJobs(db, request);
    const results = [];

    for (const job of jobs) {
      results.push(await processJob(db, job, request));
    }

    return json({
      ok: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error("transcribe-audio error:", error);
    return json({
      ok: false,
      error: errorMessage(error),
    }, 500);
  }
});
