export type PennyRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: PennyRole;
  text: string;
  remaining?: number;
  offline?: boolean;
}

export interface PennyPageContext {
  page: string;
  detail?: string;
}

export interface PennyOpenOptions {
  prompt?: string;
  context?: PennyPageContext;
}

export interface PennyContextValue {
  messages: ChatMessage[];
  busy: boolean;
  isOpen: boolean;
  mode: "kid" | "parent";
  pageContext: PennyPageContext | null;
  parentPinRequired: boolean;
  openPenny: (opts?: PennyOpenOptions) => void;
  closePenny: () => void;
  send: (text: string, contextOverride?: PennyPageContext) => Promise<void>;
  newChat: () => void;
  setPageContext: (ctx: PennyPageContext | null) => void;
  setParentPinRequired: (required: boolean) => void;
  retryAfterParentPin: () => Promise<void>;
}
