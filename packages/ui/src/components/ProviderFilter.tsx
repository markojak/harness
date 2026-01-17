/**
 * ProviderFilter - Dropdown to filter search by provider
 * Shows in search bar when user starts typing
 */

import { useState } from "react";
import { Flex, Text, Box } from "@radix-ui/themes";
import { ProviderIcon, type Provider } from "./ProviderIcon";

export type ProviderFilterValue = "all" | Provider;

interface ProviderFilterProps {
  value: ProviderFilterValue;
  onChange: (value: ProviderFilterValue) => void;
}

const OPTIONS: { value: ProviderFilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "claude", label: "Claude" },
  { value: "codex", label: "Codex" },
  { value: "opencode", label: "OpenCode" },
  { value: "antigravity", label: "Antigravity" },
];

export function ProviderFilter({ value, onChange }: ProviderFilterProps) {
  const [open, setOpen] = useState(false);

  const currentLabel = OPTIONS.find((o) => o.value === value)?.label || "All";

  return (
    <Box style={{ position: "relative" }}>
      <Flex
        align="center"
        gap="1"
        px="2"
        py="1"
        style={{
          background: "transparent",
          borderRight: "1px solid var(--border-subtle)",
          cursor: "pointer",
          minWidth: "90px",
        }}
        onClick={() => setOpen(!open)}
      >
        {value !== "all" && (
          <ProviderIcon provider={value as Provider} size={12} />
        )}
        <Text size="1" style={{ color: "var(--text-secondary)" }}>
          {currentLabel}
        </Text>
        <Text
          size="1"
          style={{ color: "var(--text-tertiary)", marginLeft: "auto" }}
        >
          ▾
        </Text>
      </Flex>

      {open && (
        <>
          {/* Backdrop to close dropdown */}
          <Box
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 99,
            }}
            onClick={() => setOpen(false)}
          />

          {/* Dropdown menu */}
          <Flex
            direction="column"
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              minWidth: "120px",
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-default)",
              borderRadius: "3px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              zIndex: 100,
              overflow: "hidden",
            }}
          >
            {OPTIONS.map((option) => (
              <Flex
                key={option.value}
                align="center"
                gap="2"
                px="3"
                py="2"
                style={{
                  cursor: "pointer",
                  background:
                    value === option.value
                      ? "var(--bg-surface)"
                      : "transparent",
                }}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.value !== "all" ? (
                  <ProviderIcon provider={option.value as Provider} size={12} />
                ) : (
                  <Box style={{ width: 12 }} />
                )}
                <Text size="1" style={{ color: "var(--text-primary)" }}>
                  {option.label}
                </Text>
                {value === option.value && (
                  <Text
                    size="1"
                    style={{ color: "var(--accent-green)", marginLeft: "auto" }}
                  >
                    ✓
                  </Text>
                )}
              </Flex>
            ))}
          </Flex>
        </>
      )}
    </Box>
  );
}
