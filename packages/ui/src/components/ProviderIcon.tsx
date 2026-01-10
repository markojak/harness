/**
 * ProviderIcon - Shows Claude/Codex logo with optional pulse animation
 * 
 * Providers:
 * - claude: Anthropic "A\" logo
 * - codex: OpenAI hexagonal flower logo
 * 
 * Animation:
 * - Pulses when session is in "waiting" state
 */

export type Provider = "claude" | "codex" | "opencode";

interface ProviderIconProps {
  provider: Provider;
  size?: number;
  waiting?: boolean;
  className?: string;
}

// Pulse animation for waiting state
const pulseKeyframes = `
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.6; transform: scale(0.95); }
  }
`;

// Anthropic/Claude logo - "A\" mark
const ClaudeLogo = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
  </svg>
);

// OpenAI/Codex logo - hexagonal flower
const CodexLogo = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z" />
  </svg>
);

// OpenCode logo - terminal/code brackets (Google blue for Gemini)
const OpenCodeLogo = ({ size = 16, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill={color}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M8.293 6.293L2.586 12l5.707 5.707 1.414-1.414L5.414 12l4.293-4.293-1.414-1.414zm7.414 0l-1.414 1.414L18.586 12l-4.293 4.293 1.414 1.414L21.414 12l-5.707-5.707z" />
  </svg>
);

// Provider colors
const PROVIDER_COLORS = {
  claude: {
    default: "#D4A574",    // Warm tan/orange (Anthropic brand)
    waiting: "#D4A574",
  },
  codex: {
    default: "#10A37F",    // OpenAI green
    waiting: "#10A37F",
  },
  opencode: {
    default: "#4285F4",    // Google blue (Gemini)
    waiting: "#4285F4",
  },
};

const PROVIDER_LOGOS = {
  claude: ClaudeLogo,
  codex: CodexLogo,
  opencode: OpenCodeLogo,
};

const PROVIDER_NAMES = {
  claude: "Claude (Anthropic)",
  codex: "Codex (OpenAI)",
  opencode: "OpenCode",
};

// Map model providers to colors/icons for OpenCode
export const MODEL_PROVIDER_INFO: Record<string, { color: string; shortName: string }> = {
  anthropic: { color: "#D4A574", shortName: "Claude" },
  openai: { color: "#10A37F", shortName: "GPT" },
  google: { color: "#4285F4", shortName: "Gemini" },
  opencode: { color: "#4285F4", shortName: "Gemini" },  // default
};

// Helper to get friendly model display name
export function getModelDisplayName(modelId?: string | null, _modelProvider?: string | null): string {
  if (!modelId) return "";
  
  // Shorten common model names
  const shortNames: Record<string, string> = {
    "claude-3-5-sonnet-20241022": "Sonnet 3.5",
    "claude-3-5-sonnet": "Sonnet 3.5",
    "claude-3-opus": "Opus 3",
    "claude-3-haiku": "Haiku 3",
    "claude-sonnet-4-20250514": "Sonnet 4",
    "gpt-4o": "GPT-4o",
    "gpt-4o-mini": "GPT-4o Mini",
    "gpt-4-turbo": "GPT-4 Turbo",
    "gemini-2.0-flash": "Gemini 2 Flash",
    "gemini-2.0-flash-exp": "Gemini 2 Flash",
    "gemini-2.5-pro": "Gemini 2.5 Pro",
    "gemini-exp-1206": "Gemini Exp",
  };
  
  return shortNames[modelId] || modelId.split("-").slice(0, 3).join("-");
}

export function ProviderIcon({ provider, size = 16, waiting = false, className }: ProviderIconProps) {
  const colors = PROVIDER_COLORS[provider] || PROVIDER_COLORS.claude;
  const Logo = PROVIDER_LOGOS[provider] || ClaudeLogo;

  return (
    <>
      <style>{pulseKeyframes}</style>
      <span
        className={className}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          animation: waiting ? "pulse 1.5s ease-in-out infinite" : undefined,
        }}
        title={PROVIDER_NAMES[provider] || provider}
      >
        <Logo size={size} color={colors.default} />
      </span>
    </>
  );
}

// Compact version for session lists
export function ProviderBadge({ 
  provider, 
  waiting = false,
  modelId,
  modelProvider,
}: { 
  provider: Provider; 
  waiting?: boolean;
  modelId?: string | null;
  modelProvider?: string | null;
}) {
  // For OpenCode, show the actual model's provider icon if different
  const isOpenCode = provider === "opencode";
  const providerInfo = modelProvider ? MODEL_PROVIDER_INFO[modelProvider] : null;
  const modelName = isOpenCode ? getModelDisplayName(modelId, modelProvider) : null;
  
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
      }}
    >
      <ProviderIcon provider={provider} size={14} waiting={waiting} />
      {isOpenCode && modelName && (
        <span
          style={{
            fontSize: "10px",
            color: providerInfo?.color || "var(--text-tertiary)",
            fontWeight: 500,
            letterSpacing: "-0.02em",
          }}
          title={modelId || undefined}
        >
          {modelName}
        </span>
      )}
    </span>
  );
}

// With label for detailed views
export function ProviderLabel({ provider, waiting = false }: { provider: Provider; waiting?: boolean }) {
  const labels: Record<Provider, string> = {
    claude: "Claude",
    codex: "Codex",
    opencode: "OpenCode",
  };
  const label = labels[provider] || provider;
  
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "11px",
        color: "var(--text-tertiary)",
      }}
    >
      <ProviderIcon provider={provider} size={12} waiting={waiting} />
      {label}
    </span>
  );
}
