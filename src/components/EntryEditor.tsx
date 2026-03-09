import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { EntryInput, VaultEntry } from "../types";

interface EntryEditorProps {
  entry: VaultEntry | null;
  onSave: (input: EntryInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}

const emptyDraft: EntryInput = {
  platform: "",
  account: "",
  secret: "",
  secret_kind: "password",
  note: "",
  tags: []
};

export function EntryEditor({ entry, onSave, onDelete, onClose }: EntryEditorProps) {
  const [draft, setDraft] = useState<EntryInput>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!entry) {
      setDraft(emptyDraft);
      setConfirmDelete(false);
      return;
    }

    setDraft({
      id: entry.id,
      platform: entry.platform,
      account: entry.account,
      secret: entry.secret,
      secret_kind: entry.secret_kind,
      note: entry.note,
      tags: entry.tags
    });
    setConfirmDelete(false);
  }, [entry]);

  const tagsText = useMemo(() => draft.tags.join(", "), [draft.tags]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!draft.platform.trim() || !draft.account.trim() || !draft.secret.trim()) {
      setError("平台、账号和密钥不能为空。");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...draft,
        platform: draft.platform.trim(),
        account: draft.account.trim(),
        note: draft.note.trim(),
        tags: draft.tags
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "保存条目失败。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="editor-card" onSubmit={handleSubmit}>
      <div className="section-header">
        <div>
          <h2>{entry ? "编辑条目" : "新建条目"}</h2>
          <p>适合保存大模型平台账号、密码、API Key、Secret 和备注。</p>
        </div>
        {entry ? (
          <span className="badge">最近更新 {new Date(entry.updated_at).toLocaleString()}</span>
        ) : null}
      </div>

      <label>
        平台
        <input
          value={draft.platform}
          onChange={(event) => setDraft((prev) => ({ ...prev, platform: event.target.value }))}
          placeholder="例如 OpenAI、Claude、通义千问"
        />
      </label>

      <label>
        账号 / Key 名称
        <input
          value={draft.account}
          onChange={(event) => setDraft((prev) => ({ ...prev, account: event.target.value }))}
          placeholder="例如 xiaokun@example.com 或 production-key"
        />
      </label>

      <div className="grid-two">
        <label>
          类型
          <select
            value={draft.secret_kind}
            onChange={(event) => setDraft((prev) => ({ ...prev, secret_kind: event.target.value }))}
          >
            <option value="password">密码</option>
            <option value="api-key">API Key</option>
            <option value="secret">Secret</option>
            <option value="token">Token</option>
          </select>
        </label>

        <label>
          标签
          <input
            value={tagsText}
            onChange={(event) =>
              setDraft((prev) => ({
                ...prev,
                tags: event.target.value
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean)
              }))
            }
            placeholder="例如 生产环境, 计费, 团队共享"
          />
        </label>
      </div>

      <label>
        密钥 / 密码
        <textarea
          rows={4}
          value={draft.secret}
          onChange={(event) => setDraft((prev) => ({ ...prev, secret: event.target.value }))}
          placeholder="输入需要加密保存的敏感信息"
        />
      </label>

      <label>
        备注
        <textarea
          rows={5}
          value={draft.note}
          onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))}
          placeholder="可记录申请入口、使用限制、到期时间等说明"
        />
      </label>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="editor-actions">
        <button className="primary" disabled={saving} type="submit">
          {saving ? "保存中..." : "保存条目"}
        </button>
        <button className="secondary" type="button" onClick={onClose}>
          取消
        </button>
        {entry ? (
          <>
            <button
              className="danger"
              type="button"
              onClick={() => {
                if (!confirmDelete) {
                  setConfirmDelete(true);
                  return;
                }

                void onDelete(entry.id);
              }}
            >
              {confirmDelete ? "确认删除条目" : "删除条目"}
            </button>
            {confirmDelete ? (
              <button className="secondary" type="button" onClick={() => setConfirmDelete(false)}>
                取消删除
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </form>
  );
}
