import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Database,
  FileAudio,
  Hash,
  Inbox,
  Loader2,
  MessageSquare,
  Mic,
  Search,
  UserRound,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type DbRecord = Record<string, unknown>;
type MessageDirection = "inbound" | "outbound";
type MessageType = "text" | "audio" | "image" | "video" | "document" | "media" | "unknown";
type IngestionStatus = "saved" | "pending" | "processing" | "failed" | "unknown";
type TranscriptStatus = "pending" | "done" | "failed" | "not_available" | null;

interface RelatedCompany {
  id: string;
  name: string;
  buying_signal: string | null;
}

interface RelatedContact {
  id: string | null;
  name: string | null;
  whatsapp: string | null;
}

export interface WhatsAppConversation {
  id: string;
  companyId: string | null;
  contactId: string | null;
  companyName: string | null;
  contactName: string | null;
  phoneNumber: string | null;
  chatKey: string | null;
  source: string | null;
  rawText: string | null;
  contentHash: string | null;
  messageCount: number;
  ingestionStatus: IngestionStatus;
  ingestionError: string | null;
  summary: string | null;
  analyzed: boolean | null;
  createdAt: string;
  company: RelatedCompany | null;
  contact: RelatedContact | null;
}

interface WhatsAppMessage {
  id: string;
  conversationId: string | null;
  chatKey: string | null;
  companyId: string | null;
  contactId: string | null;
  direction: MessageDirection;
  messageType: MessageType;
  occurredAt: string | null;
  timeLabel: string | null;
  body: string;
  messageFingerprint: string | null;
  ingestionStatus: IngestionStatus;
  ingestionError: string | null;
  transcriptStatus: TranscriptStatus;
  transcript: string | null;
  transcriptError: string | null;
  audioUrl: string | null;
  source: "table" | "raw_text";
}

interface MessageQueryResult {
  messages: WhatsAppMessage[];
  source: "table" | "raw_text" | "empty";
  warning: string | null;
}

interface WhatsAppTimelineProps {
  companyId?: string | null;
  title?: string;
  description?: string;
  compact?: boolean;
  showStats?: boolean;
  storageKey?: string;
  onOpenCompany?: (companyId: string) => void;
}

const EXTENDED_CONVERSATION_SELECT = `
  id, company_id, contact_id, company_name, contact_name, phone_number, chat_key,
  source, raw_text, content_hash, message_count, ingestion_status, ingestion_error,
  summary, analyzed, created_at,
  company:companies(id, name, buying_signal),
  contact:contacts(id, name, whatsapp)
`;

const LEGACY_CONVERSATION_SELECT = `
  id, company_id, contact_id, company_name, contact_name, phone_number, chat_key,
  source, raw_text, content_hash, message_count, summary, analyzed, created_at,
  company:companies(id, name, buying_signal),
  contact:contacts(id, name, whatsapp)
`;

const MESSAGE_SELECT_RICH = `
  id, chat_key, company_id, contact_id, direction, message_type, occurred_at,
  body, message_fingerprint, ingestion_status, ingestion_error,
  transcription_status, transcript, transcription_error, audio_url, media_url,
  metadata
`;

const MESSAGE_SELECT_NEW = `
  id, chat_key, company_id, contact_id, direction, message_type, occurred_at,
  body, message_fingerprint, ingestion_status, ingestion_error,
  transcription_status, transcript, transcription_error
`;

const MESSAGE_SELECT_ALT_TRANSCRIPT = `
  id, chat_key, company_id, contact_id, direction, message_type, occurred_at,
  body, message_fingerprint, ingestion_status, ingestion_error,
  transcript_status, transcript_text, transcript_error
`;

const MESSAGE_SELECT_TRANSCRIPT_ONLY = `
  id, chat_key, company_id, contact_id, direction, message_type, occurred_at,
  body, message_fingerprint, transcription_status, transcript, transcription_error
`;

const MESSAGE_SELECT_ALT_TRANSCRIPT_ONLY = `
  id, chat_key, company_id, contact_id, direction, message_type, occurred_at,
  body, message_fingerprint, transcript_status, transcript_text, transcript_error
`;

const MESSAGE_SELECT_MINIMAL = `
  id, chat_key, company_id, contact_id, direction, message_type, occurred_at,
  body, message_fingerprint
`;

const LEGACY_MESSAGE_SELECT = `
  id, conversation_id, company_id, contact_id, direction, body, wa_message_id,
  status, sent_at, created_at
`;

const EMPTY_MESSAGES: MessageQueryResult = {
  messages: [],
  source: "empty",
  warning: null,
};

function isRecord(value: unknown): value is DbRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function relationRecord(value: unknown) {
  if (Array.isArray(value)) return isRecord(value[0]) ? value[0] : null;
  return isRecord(value) ? value : null;
}

function stringValue(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const text = stringValue(value);
    if (text?.trim()) return text.trim();
  }
  return null;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function booleanValue(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return null;
}

function formatDateTime(value: string | null) {
  if (!value) return "sem horario";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function compactId(value: string | null, size = 10) {
  if (!value) return null;
  return value.length > size ? `${value.slice(0, size)}...` : value;
}

function normalizeIngestionStatus(status: string | null, error?: string | null): IngestionStatus {
  if (error) return "failed";
  if (!status) return "saved";

  const normalized = status.toLowerCase();
  if (["failed", "fail", "error", "erro"].some((entry) => normalized.includes(entry))) return "failed";
  if (["processing", "transcribing", "running"].some((entry) => normalized.includes(entry))) return "processing";
  if (["pending", "queued", "received", "recebido"].some((entry) => normalized.includes(entry))) return "pending";
  if (["saved", "stored", "inserted", "sent", "delivered", "read", "done"].some((entry) => normalized.includes(entry))) {
    return "saved";
  }
  return "unknown";
}

function normalizeTranscriptStatus(
  status: string | null,
  transcript: string | null,
  error: string | null,
  messageType: MessageType,
): TranscriptStatus {
  if (messageType !== "audio") return null;
  if (error) return "failed";
  if (transcript) return "done";
  if (!status) return "pending";

  const normalized = status.toLowerCase();
  if (["failed", "fail", "error", "erro"].some((entry) => normalized.includes(entry))) return "failed";
  if (["done", "completed", "complete", "success", "ready", "pronta"].some((entry) => normalized.includes(entry))) return "done";
  if (["none", "not_available", "unavailable", "indisponivel"].some((entry) => normalized.includes(entry))) {
    return "not_available";
  }
  return "pending";
}

function normalizeDirection(value: string | null): MessageDirection {
  const normalized = value?.toLowerCase();
  if (normalized === "outbound" || normalized === "sent" || normalized === "saida") return "outbound";
  return "inbound";
}

function inferMessageType(body: string | null): MessageType {
  const normalized = body?.toLowerCase() ?? "";
  if (normalized.includes("[audio]") || normalized.includes("[audio") || normalized.includes("[áudio") || normalized.includes("audio")) {
    return "audio";
  }
  return "text";
}

function normalizeMessageType(value: string | null, body: string | null): MessageType {
  const normalized = value?.toLowerCase();
  if (normalized === "audio" || normalized === "voice" || normalized === "ptt") return "audio";
  if (normalized === "image" || normalized === "video" || normalized === "document" || normalized === "media") return normalized;
  if (normalized === "text") return "text";
  return inferMessageType(body);
}

function normalizeConversation(row: DbRecord): WhatsAppConversation {
  const company = relationRecord(row.company);
  const contact = relationRecord(row.contact);
  const ingestionError = firstString(row.ingestion_error);

  return {
    id: firstString(row.id) ?? crypto.randomUUID(),
    companyId: firstString(row.company_id),
    contactId: firstString(row.contact_id),
    companyName: firstString(row.company_name),
    contactName: firstString(row.contact_name),
    phoneNumber: firstString(row.phone_number),
    chatKey: firstString(row.chat_key),
    source: firstString(row.source),
    rawText: firstString(row.raw_text),
    contentHash: firstString(row.content_hash),
    messageCount: numberValue(row.message_count),
    ingestionStatus: normalizeIngestionStatus(firstString(row.ingestion_status), ingestionError),
    ingestionError,
    summary: firstString(row.summary),
    analyzed: booleanValue(row.analyzed),
    createdAt: firstString(row.created_at) ?? new Date().toISOString(),
    company: company
      ? {
        id: firstString(company.id) ?? "",
        name: firstString(company.name) ?? "Conta sem nome",
        buying_signal: firstString(company.buying_signal),
      }
      : null,
    contact: contact
      ? {
        id: firstString(contact.id),
        name: firstString(contact.name),
        whatsapp: firstString(contact.whatsapp),
      }
      : null,
  };
}

function normalizeDbMessage(row: DbRecord, conversation: WhatsAppConversation): WhatsAppMessage {
  const metadata = relationRecord(row.metadata);
  const body = firstString(row.body) ?? "[Mensagem sem corpo]";
  const messageType = normalizeMessageType(
    firstString(row.message_type, metadata?.message_type, metadata?.messageType),
    body,
  );
  const transcript = firstString(
    row.transcript,
    row.transcript_text,
    metadata?.transcript,
    metadata?.transcript_text,
  );
  const transcriptError = firstString(
    row.transcription_error,
    row.transcript_error,
    metadata?.transcription_error,
    metadata?.transcript_error,
  );
  const transcriptStatus = normalizeTranscriptStatus(
    firstString(row.transcription_status, row.transcript_status, metadata?.transcription_status, metadata?.transcript_status),
    transcript,
    transcriptError,
    messageType,
  );
  const ingestionError = firstString(row.ingestion_error, metadata?.ingestion_error);

  return {
    id: firstString(row.id) ?? crypto.randomUUID(),
    conversationId: firstString(row.conversation_id) ?? conversation.id,
    chatKey: firstString(row.chat_key) ?? conversation.chatKey,
    companyId: firstString(row.company_id) ?? conversation.companyId,
    contactId: firstString(row.contact_id) ?? conversation.contactId,
    direction: normalizeDirection(firstString(row.direction)),
    messageType,
    occurredAt: firstString(row.occurred_at, row.sent_at, row.created_at) ?? conversation.createdAt,
    timeLabel: null,
    body,
    messageFingerprint: firstString(row.message_fingerprint, row.wa_message_id, metadata?.message_fingerprint),
    ingestionStatus: normalizeIngestionStatus(firstString(row.ingestion_status, row.status), ingestionError),
    ingestionError,
    transcriptStatus,
    transcript,
    transcriptError,
    audioUrl: firstString(row.audio_url, row.media_url, metadata?.audio_url, metadata?.media_url),
    source: "table",
  };
}

function inferRawDirection(sender: string | null, conversation: WhatsAppConversation): MessageDirection {
  if (!sender) return "inbound";
  const normalizedSender = sender.toLowerCase();
  const contactName = conversation.contact?.name ?? conversation.contactName;
  if (contactName && contactName.toLowerCase().includes(normalizedSender)) return "inbound";
  if (normalizedSender.includes("cliente") || normalizedSender.includes("lead") || normalizedSender.includes("contato")) return "inbound";
  return "outbound";
}

function parseRawTextMessages(conversation: WhatsAppConversation) {
  const lines = (conversation.rawText ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line, index): WhatsAppMessage => {
    const match = line.match(/^(?:\[(?<time>[^\]]+)\]\s*)?(?:(?<sender>[^:]{1,80}):\s*)?(?<body>.*)$/);
    const sender = match?.groups?.sender?.trim() || null;
    const body = match?.groups?.body?.trim() || line;
    const messageType = inferMessageType(body);
    const transcriptStatus = normalizeTranscriptStatus(null, null, null, messageType);

    return {
      id: `${conversation.id}-raw-${index}`,
      conversationId: conversation.id,
      chatKey: conversation.chatKey,
      companyId: conversation.companyId,
      contactId: conversation.contactId,
      direction: inferRawDirection(sender, conversation),
      messageType,
      occurredAt: conversation.createdAt,
      timeLabel: match?.groups?.time?.trim() || null,
      body,
      messageFingerprint: `${conversation.contentHash ?? conversation.id}:${index + 1}`,
      ingestionStatus: "saved",
      ingestionError: null,
      transcriptStatus,
      transcript: null,
      transcriptError: null,
      audioUrl: null,
      source: "raw_text",
    };
  });
}

export async function fetchWhatsAppConversations(companyId?: string | null) {
  async function run(select: string) {
    let query = supabase
      .from("whatsapp_conversations")
      .select(select)
      .order("created_at", { ascending: false })
      .limit(150);

    if (companyId) query = query.eq("company_id", companyId);

    const { data, error } = await query;
    if (error) throw error;
    return ((data ?? []) as DbRecord[]).map(normalizeConversation);
  }

  try {
    return await run(EXTENDED_CONVERSATION_SELECT);
  } catch {
    return run(LEGACY_CONVERSATION_SELECT);
  }
}

async function fetchWhatsAppMessages(conversation: WhatsAppConversation): Promise<MessageQueryResult> {
  async function runByChatKey(select: string) {
    if (!conversation.chatKey) return [];
    let query = supabase
      .from("whatsapp_messages")
      .select(select)
      .eq("chat_key", conversation.chatKey);

    const { data, error } = await query.order("occurred_at", { ascending: true });

    if (error) throw error;
    return ((data ?? []) as DbRecord[]).map((row) => normalizeDbMessage(row, conversation));
  }

  async function runLegacy() {
    const { data, error } = await supabase
      .from("whatsapp_messages")
      .select(LEGACY_MESSAGE_SELECT)
      .eq("conversation_id", conversation.id)
      .order("sent_at", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) throw error;
    return ((data ?? []) as DbRecord[]).map((row) => normalizeDbMessage(row, conversation));
  }

  try {
    const messages = await runByChatKey(MESSAGE_SELECT_RICH);
    if (messages.length > 0) return { messages, source: "table", warning: null };
  } catch {
    // Optional media fields may not exist in the DB contract yet.
  }

  try {
    const messages = await runByChatKey(MESSAGE_SELECT_NEW);
    if (messages.length > 0) return { messages, source: "table", warning: null };
  } catch {
    // Try the alternate transcript naming before falling back to legacy/raw text.
  }

  try {
    const messages = await runByChatKey(MESSAGE_SELECT_ALT_TRANSCRIPT);
    if (messages.length > 0) return { messages, source: "table", warning: null };
  } catch {
    // Keep moving through progressively smaller contracts.
  }

  try {
    const messages = await runByChatKey(MESSAGE_SELECT_TRANSCRIPT_ONLY);
    if (messages.length > 0) return { messages, source: "table", warning: null };
  } catch {
    // Some schemas expose ingestion and transcript status separately.
  }

  try {
    const messages = await runByChatKey(MESSAGE_SELECT_ALT_TRANSCRIPT_ONLY);
    if (messages.length > 0) return { messages, source: "table", warning: null };
  } catch {
    // Minimal contract below still satisfies the saved-message timeline.
  }

  try {
    const messages = await runByChatKey(MESSAGE_SELECT_MINIMAL);
    if (messages.length > 0) return { messages, source: "table", warning: null };
  } catch {
    // Contract can still be landing in parallel with Chat 3; fall back below.
  }

  try {
    const messages = await runLegacy();
    if (messages.length > 0) return { messages, source: "table", warning: null };
  } catch {
    // Keep the saved conversation visible even when message rows are not readable yet.
  }

  const rawMessages = parseRawTextMessages(conversation);
  if (rawMessages.length > 0) {
    return {
      messages: rawMessages,
      source: "raw_text",
      warning: "Mensagens individuais ainda nao estao disponiveis; exibindo o texto salvo da conversa linha a linha.",
    };
  }

  return {
    messages: [],
    source: "empty",
    warning: "Conversa salva, mas sem mensagens individuais legiveis para exibir.",
  };
}

function conversationTitle(conversation: WhatsAppConversation) {
  return (
    conversation.company?.name
    ?? conversation.companyName
    ?? conversation.contact?.name
    ?? conversation.contactName
    ?? conversation.phoneNumber
    ?? "Conversa sem vinculo"
  );
}

function conversationSubtitle(conversation: WhatsAppConversation) {
  const contact = conversation.contact?.name ?? conversation.contactName;
  if (contact && contact !== conversationTitle(conversation)) return contact;
  if (conversation.phoneNumber) return conversation.phoneNumber;
  return conversation.source === "extension" ? "Capturada pela extensao" : "Conversa WhatsApp";
}

function IngestionBadge({ status }: { status: IngestionStatus }) {
  const config: Record<IngestionStatus, { label: string; className: string }> = {
    saved: { label: "Salva", className: "border-green-500/25 bg-green-500/10 text-green-700" },
    pending: { label: "Recebida", className: "border-blue-500/25 bg-blue-500/10 text-blue-700" },
    processing: { label: "Processando", className: "border-yellow-500/25 bg-yellow-500/10 text-yellow-700" },
    failed: { label: "Falhou", className: "border-destructive/30 bg-destructive/10 text-destructive" },
    unknown: { label: "Status incerto", className: "border-border bg-muted text-muted-foreground" },
  };
  const entry = config[status];
  return <Badge variant="outline" className={cn("h-5 text-[10px]", entry.className)}>{entry.label}</Badge>;
}

function TranscriptBadge({ status }: { status: TranscriptStatus }) {
  if (!status) return null;
  const config: Record<Exclude<TranscriptStatus, null>, { label: string; className: string }> = {
    done: { label: "Transcript pronto", className: "border-green-500/25 bg-green-500/10 text-green-700" },
    pending: { label: "Transcript pendente", className: "border-blue-500/25 bg-blue-500/10 text-blue-700" },
    failed: { label: "Transcript falhou", className: "border-destructive/30 bg-destructive/10 text-destructive" },
    not_available: { label: "Sem transcript", className: "border-border bg-muted text-muted-foreground" },
  };
  const entry = config[status];
  return <Badge variant="outline" className={cn("h-5 text-[10px]", entry.className)}>{entry.label}</Badge>;
}

function DirectionBadge({ direction }: { direction: MessageDirection }) {
  const inbound = direction === "inbound";
  return (
    <Badge variant="outline" className={cn(
      "h-5 text-[10px]",
      inbound ? "border-green-500/25 bg-green-500/10 text-green-700" : "border-primary/25 bg-primary/10 text-primary",
    )}>
      {inbound ? "Entrada" : "Saida"}
    </Badge>
  );
}

function MessageTypeBadge({ type }: { type: MessageType }) {
  const labels: Record<MessageType, string> = {
    text: "Texto",
    audio: "Audio",
    image: "Imagem",
    video: "Video",
    document: "Documento",
    media: "Midia",
    unknown: "Tipo incerto",
  };

  return (
    <Badge variant="outline" className="h-5 bg-background text-[10px]">
      {labels[type]}
    </Badge>
  );
}

function ConversationCard({
  conversation,
  selected,
  onSelect,
}: {
  conversation: WhatsAppConversation;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border p-3 text-left transition-colors",
        selected ? "border-primary/35 bg-primary/5" : "border-transparent hover:bg-muted/45",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-500/10">
          <MessageSquare className="h-4 w-4 text-green-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">{conversationTitle(conversation)}</p>
            <span className="shrink-0 text-[10px] text-muted-foreground">{formatShortDate(conversation.createdAt)}</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{conversationSubtitle(conversation)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <IngestionBadge status={conversation.ingestionStatus} />
            <Badge variant="outline" className="h-5 bg-background text-[10px]">
              {conversation.messageCount || "?"} msg
            </Badge>
            {conversation.source && (
              <Badge variant="outline" className="h-5 bg-background text-[10px]">{conversation.source}</Badge>
            )}
          </div>
          {conversation.chatKey && (
            <p className="mt-1 flex items-center gap-1 truncate font-mono text-[10px] text-muted-foreground">
              <Hash className="h-3 w-3 shrink-0" />
              {conversation.chatKey}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function AudioStatus({ message }: { message: WhatsAppMessage }) {
  return (
    <div className="mt-3 space-y-2 rounded-md border bg-background/70 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <FileAudio className="h-4 w-4 text-green-600" />
        <p className="text-xs font-semibold">Audio capturado</p>
        <TranscriptBadge status={message.transcriptStatus} />
      </div>

      {message.audioUrl ? (
        <audio controls src={message.audioUrl} className="w-full" />
      ) : (
        <p className="text-xs text-muted-foreground">
          Audio salvo como mensagem. Arquivo de reproducao ainda nao esta anexado a este registro.
        </p>
      )}

      {message.transcriptStatus === "pending" && (
        <div className="flex items-start gap-2 rounded-md bg-blue-500/5 p-2 text-xs text-blue-700">
          <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin" />
          <span>Transcricao pendente. A mensagem de audio continua salva no Sistemas.</span>
        </div>
      )}

      {message.transcriptStatus === "done" && (
        <div className="rounded-md bg-muted/50 p-2">
          <p className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Transcript</p>
          <p className="whitespace-pre-wrap text-xs leading-relaxed">
            {message.transcript || "Transcricao marcada como pronta, mas sem texto anexado."}
          </p>
        </div>
      )}

      {message.transcriptStatus === "failed" && (
        <Alert variant="destructive" className="py-3">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-sm">Falha na transcricao</AlertTitle>
          <AlertDescription className="text-xs">
            {message.transcriptError || "Nao foi possivel transcrever este audio. O audio e a mensagem seguem salvos."}
          </AlertDescription>
        </Alert>
      )}

      {message.transcriptStatus === "not_available" && (
        <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
          Este audio ainda nao tem transcript disponivel.
        </p>
      )}
    </div>
  );
}

function MessageRow({ message }: { message: WhatsAppMessage }) {
  const outbound = message.direction === "outbound";
  const time = message.timeLabel || formatDateTime(message.occurredAt);

  return (
    <div className={cn("flex", outbound && "justify-end")}>
      <div className={cn(
        "max-w-[92%] rounded-lg border p-3 shadow-sm",
        outbound ? "border-primary/20 bg-primary/5" : "border-border bg-muted/25",
      )}>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <DirectionBadge direction={message.direction} />
          <MessageTypeBadge type={message.messageType} />
          <IngestionBadge status={message.ingestionStatus} />
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {time}
          </span>
        </div>

        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>

        {message.messageFingerprint && (
          <p className="mt-2 flex items-center gap-1 truncate font-mono text-[10px] text-muted-foreground">
            <Database className="h-3 w-3 shrink-0" />
            {compactId(message.messageFingerprint, 24)}
          </p>
        )}

        {message.ingestionStatus === "failed" && (
          <Alert variant="destructive" className="mt-3 py-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm">Falha de ingestao</AlertTitle>
            <AlertDescription className="text-xs">
              {message.ingestionError || "O Sistemas recebeu um status de falha para esta mensagem."}
            </AlertDescription>
          </Alert>
        )}

        {message.messageType === "audio" && <AudioStatus message={message} />}
      </div>
    </div>
  );
}

function TimelineDetail({
  conversation,
  result,
  loading,
  onOpenCompany,
}: {
  conversation: WhatsAppConversation;
  result: MessageQueryResult;
  loading: boolean;
  onOpenCompany?: (companyId: string) => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-base font-semibold">{conversationTitle(conversation)}</h3>
              <IngestionBadge status={conversation.ingestionStatus} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <UserRound className="h-3.5 w-3.5" />
                {conversationSubtitle(conversation)}
              </span>
              <span>{formatDateTime(conversation.createdAt)}</span>
              {conversation.source && <span>origem: {conversation.source}</span>}
            </div>
          </div>
          {conversation.companyId && onOpenCompany && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="shrink-0 gap-1.5"
              onClick={() => conversation.companyId && onOpenCompany(conversation.companyId)}
            >
              <Building2 className="h-3.5 w-3.5" />
              Conta
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
          <div className="rounded-md bg-muted/35 p-2">
            <p className="text-muted-foreground">chat_key</p>
            <p className="truncate font-mono font-medium">{conversation.chatKey || "nao informado"}</p>
          </div>
          <div className="rounded-md bg-muted/35 p-2">
            <p className="text-muted-foreground">Mensagens</p>
            <p className="font-medium">{result.messages.length || conversation.messageCount || 0}</p>
          </div>
          <div className="rounded-md bg-muted/35 p-2">
            <p className="text-muted-foreground">Leitura</p>
            <p className="font-medium">{result.source === "raw_text" ? "texto salvo" : result.source === "table" ? "mensagens" : "sem dados"}</p>
          </div>
        </div>

        {conversation.ingestionError && (
          <Alert variant="destructive" className="mt-3 py-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm">Falha registrada na ingestao</AlertTitle>
            <AlertDescription className="text-xs">{conversation.ingestionError}</AlertDescription>
          </Alert>
        )}

        {conversation.summary && (
          <div className="mt-3 rounded-md border bg-muted/20 p-3">
            <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
              <Mic className="h-3.5 w-3.5" />
              Resumo salvo
            </p>
            <p className="text-sm leading-relaxed">{conversation.summary}</p>
          </div>
        )}
      </div>

      <div className="min-h-[380px] flex-1 space-y-3 overflow-y-auto p-4">
        {result.warning && (
          <Alert className="py-3">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm">Exibicao parcial</AlertTitle>
            <AlertDescription className="text-xs">{result.warning}</AlertDescription>
          </Alert>
        )}

        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-24 w-4/5" />
            <Skeleton className="ml-auto h-24 w-3/4" />
            <Skeleton className="h-24 w-5/6" />
          </div>
        )}

        {!loading && result.messages.length === 0 && (
          <div className="flex min-h-[280px] items-center justify-center text-center text-muted-foreground">
            <div>
              <Inbox className="mx-auto mb-3 h-10 w-10 opacity-25" />
              <p className="text-sm font-medium">Nenhuma mensagem individual para exibir.</p>
              <p className="mt-1 text-xs">A conversa continua registrada no Sistemas.</p>
            </div>
          </div>
        )}

        {!loading && result.messages.map((message) => (
          <MessageRow key={message.id} message={message} />
        ))}
      </div>
    </div>
  );
}

export function WhatsAppTimeline({
  companyId,
  title = "WhatsApp",
  description = "Historico operacional capturado pela extensao.",
  compact = false,
  showStats = true,
  storageKey,
  onOpenCompany,
}: WhatsAppTimelineProps) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (!storageKey || typeof window === "undefined") return null;
    return window.localStorage.getItem(storageKey);
  });

  const {
    data: conversations = [],
    error: conversationsError,
    isLoading: loadingConversations,
  } = useQuery({
    queryKey: ["whatsapp-operational-conversations", companyId ?? "all"],
    queryFn: () => fetchWhatsAppConversations(companyId),
    refetchInterval: 30_000,
  });

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((conversation) => {
      const haystack = [
        conversationTitle(conversation),
        conversationSubtitle(conversation),
        conversation.chatKey,
        conversation.phoneNumber,
        conversation.rawText,
      ].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(term);
    });
  }, [conversations, search]);

  useEffect(() => {
    if (filteredConversations.length === 0) {
      setSelectedId(null);
      return;
    }

    if (selectedId && filteredConversations.some((conversation) => conversation.id === selectedId)) return;
    setSelectedId(filteredConversations[0].id);
  }, [filteredConversations, selectedId]);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    if (selectedId) window.localStorage.setItem(storageKey, selectedId);
    else window.localStorage.removeItem(storageKey);
  }, [selectedId, storageKey]);

  useEffect(() => {
    const filter = companyId ? { filter: `company_id=eq.${companyId}` } : {};
    const channel = supabase
      .channel(`whatsapp-operational-${companyId ?? "all"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversations", ...filter },
        () => {
          qc.invalidateQueries({ queryKey: ["whatsapp-operational-conversations", companyId ?? "all"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_messages", ...filter },
        () => {
          qc.invalidateQueries({ queryKey: ["whatsapp-operational-conversations", companyId ?? "all"] });
          qc.invalidateQueries({ queryKey: ["whatsapp-operational-messages"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, qc]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const {
    data: messageResult = EMPTY_MESSAGES,
    isLoading: loadingMessages,
  } = useQuery({
    queryKey: [
      "whatsapp-operational-messages",
      selectedConversation?.id,
      selectedConversation?.chatKey,
      selectedConversation?.contentHash,
    ],
    queryFn: () => selectedConversation ? fetchWhatsAppMessages(selectedConversation) : Promise.resolve(EMPTY_MESSAGES),
    enabled: Boolean(selectedConversation),
    refetchInterval: 30_000,
  });

  const selectedAudioCount = messageResult.messages.filter((message) => message.messageType === "audio").length;
  const selectedFailedTranscripts = messageResult.messages.filter((message) => message.transcriptStatus === "failed").length;
  const totalMessages = conversations.reduce((sum, conversation) => sum + (conversation.messageCount || 0), 0);
  const extensionCount = conversations.filter((conversation) => conversation.source === "extension").length;

  const stats = [
    { label: "Conversas", value: conversations.length, icon: MessageSquare },
    { label: "Mensagens salvas", value: totalMessages || messageResult.messages.length, icon: Database },
    { label: "Capturadas pela extensao", value: extensionCount, icon: CheckCircle2 },
    { label: "Falhas de transcript no chat", value: selectedFailedTranscripts, icon: AlertTriangle },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={cn("font-semibold", compact ? "text-base" : "text-xl")}>{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {selectedAudioCount > 0 && (
          <Badge variant="outline" className="shrink-0 border-green-500/25 bg-green-500/10 text-green-700">
            {selectedAudioCount} audio{selectedAudioCount > 1 ? "s" : ""}
          </Badge>
        )}
      </div>

      {showStats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-lg border bg-card p-3">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <p className="text-lg font-bold">{value}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      )}

      {conversationsError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Falha ao carregar conversas</AlertTitle>
          <AlertDescription>{String(conversationsError)}</AlertDescription>
        </Alert>
      )}

      <div className={cn("grid gap-4", compact ? "lg:grid-cols-[290px_minmax(0,1fr)]" : "lg:grid-cols-[340px_minmax(0,1fr)]")}>
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por conta, contato ou chat_key"
              className="pl-9"
            />
          </div>

          <div className={cn("space-y-1 overflow-y-auto pr-1", compact ? "max-h-[560px]" : "max-h-[680px]")}>
            {loadingConversations && (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-24 w-full" />)}
              </div>
            )}

            {!loadingConversations && filteredConversations.length === 0 && (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                <Inbox className="mx-auto mb-3 h-9 w-9 opacity-25" />
                <p className="text-sm font-medium">Nenhuma conversa encontrada.</p>
                <p className="mt-1 text-xs">Quando a extensao salvar uma conversa, ela aparece aqui.</p>
              </div>
            )}

            {!loadingConversations && filteredConversations.map((conversation) => (
              <ConversationCard
                key={conversation.id}
                conversation={conversation}
                selected={conversation.id === selectedId}
                onSelect={() => setSelectedId(conversation.id)}
              />
            ))}
          </div>
        </div>

        <div className={cn("min-h-[520px] overflow-hidden rounded-lg border bg-card", compact && "min-h-[480px]")}>
          {selectedConversation ? (
            <TimelineDetail
              conversation={selectedConversation}
              result={messageResult}
              loading={loadingMessages}
              onOpenCompany={onOpenCompany}
            />
          ) : (
            <div className="flex min-h-[520px] items-center justify-center text-center text-muted-foreground">
              <div>
                <MessageSquare className="mx-auto mb-3 h-10 w-10 opacity-25" />
                <p className="text-sm font-medium">Selecione uma conversa.</p>
                <p className="mt-1 text-xs">A timeline mostra mensagens, audio, transcript e falhas.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
