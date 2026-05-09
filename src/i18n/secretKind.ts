import type { MessageKey } from "./messages";

/** 与后端 / 编辑器选项一致的 secret_kind，顺序固定供下拉使用 */
export const SECRET_KIND_ORDER = ["password", "api-key", "secret", "token"] as const;

export type SecretKindCode = (typeof SECRET_KIND_ORDER)[number];

export const SECRET_KIND_MESSAGE_KEY: Record<SecretKindCode, MessageKey> = {
  password: "secretKind.password",
  "api-key": "secretKind.api-key",
  secret: "secretKind.secret",
  token: "secretKind.token"
};

export function messageKeyForSecretKind(kind: string): MessageKey | undefined {
  if ((SECRET_KIND_ORDER as readonly string[]).includes(kind)) {
    return SECRET_KIND_MESSAGE_KEY[kind as SecretKindCode];
  }

  return undefined;
}
