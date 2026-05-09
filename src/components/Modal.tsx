import type { ReactNode } from "react";
import { useI18n } from "../i18n";

interface ModalProps {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}

export function Modal({ title, description, children, onClose }: ModalProps) {
  const { t } = useI18n();

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <div>
            <h2>{title}</h2>
            {description ? <p>{description}</p> : null}
          </div>
          <button className="secondary" type="button" onClick={onClose}>
            {t("common.close")}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
