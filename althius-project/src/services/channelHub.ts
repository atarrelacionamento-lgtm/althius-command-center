export type ChannelType = "email" | "linkedin" | "whatsapp";
export type ChannelConnectionStatus = "disconnected" | "connecting" | "connected" | "error";
export type MessageDirection = "outbound" | "inbound";
export type DeliveryStatus = "draft" | "queued" | "sent" | "delivered" | "failed";

export interface ChannelConnection {
  id: string;
  channelType: ChannelType;
  provider: string;
  status: ChannelConnectionStatus;
  metadata?: Record<string, unknown>;
}

export interface ChannelThread {
  id: string;
  channelType: ChannelType;
  companyId: string | null;
  contactId: string | null;
  externalThreadId: string;
  lastMessageAt: string | null;
}

export interface ChannelMessage {
  id: string;
  threadId: string;
  direction: MessageDirection;
  content: string;
  externalMessageId?: string;
  deliveryStatus: DeliveryStatus;
  sentAt?: string;
}

export interface SendChannelMessageInput {
  connectionId: string;
  threadId?: string;
  companyId?: string;
  contactId?: string;
  content: string;
}

export interface ChannelProvider {
  type: ChannelType;
  connect(): Promise<void>;
  syncThreads(): Promise<ChannelThread[]>;
  sendMessage(input: SendChannelMessageInput): Promise<ChannelMessage>;
}

const registry = new Map<ChannelType, ChannelProvider>();

export function registerChannelProvider(provider: ChannelProvider) {
  registry.set(provider.type, provider);
}

export function getChannelProvider(type: ChannelType) {
  return registry.get(type) ?? null;
}

export async function sendChannelMessage(type: ChannelType, input: SendChannelMessageInput) {
  const provider = getChannelProvider(type);
  if (!provider) {
    throw new Error(`Canal ${type} ainda não configurado.`);
  }
  return provider.sendMessage(input);
}
