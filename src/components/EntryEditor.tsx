import { type FormEvent, useEffect, useMemo, useState } from "react";
import type { EntryInput, VaultEntry } from "../types";
import { useI18n } from "../i18n";
import { SECRET_KIND_MESSAGE_KEY, SECRET_KIND_ORDER } from "../i18n/secretKind";

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
  const { t, locale } = useI18n();
  const [draft, setDraft] = useState<EntryInput>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dateLocale = locale === "zh" ? "zh-CN" : "en-US";

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
      setError(t("errors.requiredFields"));
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
      setError(reason instanceof Error ? reason.message : t("errors.saveEntry"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="editor-card" onSubmit={handleSubmit}>
      <div className="section-header">
        <div>
          <h2>{entry ? t("editor.titleEdit") : t("editor.titleNew")}</h2>
          <p>{t("editor.intro")}</p>
        </div>
        {entry ? (
          <span className="badge">
            {t("editor.updatedBadge", {
              datetime: new Date(entry.updated_at).toLocaleString(dateLocale)
            })}
          </span>
        ) : null}
      </div>

      <label>
        {t("editor.platform")}
        <input
          value={draft.platform}
          onChange={(event) => setDraft((prev) => ({ ...prev, platform: event.target.value }))}
          placeholder={t("editor.platformPlaceholder")}
        />
      </label>

      <label>
        {t("editor.accountLabel")}
        <input
          value={draft.account}
          onChange={(event) => setDraft((prev) => ({ ...prev, account: event.target.value }))}
          placeholder={t("editor.accountPlaceholder")}
        />
      </label>

      <div className="grid-two">
        <label>
          {t("editor.secretType")}
          <select
            value={draft.secret_kind}
            onChange={(event) => setDraft((prev) => ({ ...prev, secret_kind: event.target.value }))}
          >
            {SECRET_KIND_ORDER.map((value) => (
              <option key={value} value={value}>
                {t(SECRET_KIND_MESSAGE_KEY[value])}
              </option>
            ))}
          </select>
        </label>

        <label>
          {t("editor.tags")}
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
            placeholder={t("editor.tagsPlaceholder")}
          />
        </label>
      </div>

      <label>
        {t("editor.secretBody")}
        <textarea
          rows={4}
          value={draft.secret}
          onChange={(event) => setDraft((prev) => ({ ...prev, secret: event.target.value }))}
          placeholder={t("editor.secretBodyPlaceholder")}
        />
      </label>

      <label>
        {t("editor.note")}
        <textarea
          rows={5}
          value={draft.note}
          onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))}
          placeholder={t("editor.notePlaceholder")}
        />
      </label>

      {error ? <p className="form-error">{error}</p> : null}

      <div className="editor-actions">
        <button className="primary" disabled={saving} type="submit">
          {saving ? t("editor.saving") : t("editor.save")}
        </button>
        <button className="secondary" type="button" onClick={onClose}>
          {t("editor.cancel")}
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
              {confirmDelete ? t("editor.confirmDelete") : t("editor.delete")}
            </button>
            {confirmDelete ? (
              <button className="secondary" type="button" onClick={() => setConfirmDelete(false)}>
                {t("editor.cancelDelete")}
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </form>
  );
}
