export type Locale = "zh" | "en";

export const localeStorageKey = "keyhub:locale";

export const zhMessages = {
  "common.close": "关闭",
  "common.processing": "处理中...",

  "language.switch": "界面语言",

  "theme.switchToLight": "切换到白天模式",
  "theme.switchToDark": "切换到黑夜模式",
  "theme.light": "白天模式",
  "theme.dark": "黑夜模式",

  "header.tagline": "适合保存各类大模型平台账号、密码、API Key、Secret 和备注信息。",

  "nav.dataSync": "数据同步",
  "nav.securitySettings": "安全设置",
  "nav.lockNow": "立即锁定",

  "loading.loadingVault": "正在加载本地保险库...",

  "createVault.title": "创建本地保险库",
  "createVault.masterPassword": "主密码",
  "createVault.confirmMasterPassword": "确认主密码",
  "createVault.placeholderPassword": "{n} 位任意字符组成的密码",
  "createVault.hintLabel": "主密码提示（可选）",
  "createVault.hintNote": "当你忘记主密码时，能够通过提示找回。",
  "createVault.hintPlaceholder": "例如：生日年月日，纪念日或其他有意义的提示",
  "createVault.remember3Days": "记住主密码 3 天",
  "createVault.submit": "创建并进入",

  "resetVault.title": "重置本地保险库",
  "resetVault.warning":
    "将删除本机上的加密保险库文件与所有已保存条目。若未提前导出备份，数据无法恢复。确认后需要重新创建主密码。",
  "resetVault.backUnlock": "返回解锁",
  "resetVault.confirm": "确认重置本地保险库",

  "unlock.title": "解锁本地保险库",
  "unlock.masterPasswordHint": "主密码提示",
  "unlock.placeholderPassword": "{n} 位主密码",
  "unlock.submit": "解锁",
  "unlock.remember3Days": "记住主密码 3 天",
  "unlock.forgotReset": "忘记主密码，重置本地保险库",

  "search.label": "搜索",
  "search.placeholder": "平台、类型、账号、标签",

  "entries.summary": "{shown} / {total} 条",
  "entries.new": "新建条目",

  "table.platform": "平台名",
  "table.kind": "类型",
  "table.account": "账号名",
  "table.secret": "密码 / Key",
  "table.actions": "操作",

  "copy.account": "账号",
  "copy.secret": "密码/密钥",

  "row.copyAccount": "复制账号",
  "row.copySecret": "复制密码",
  "row.edit": "编辑",

  "empty.entriesTitle": "还没有条目",
  "empty.entriesHint": "点击右上角“新建条目”开始保存平台账号和 API 凭据。",

  "editor.modalTitleNew": "新建条目",
  "editor.modalTitleEdit": "编辑 {name}",
  "editor.modalDescription":
    "只有点击编辑的条目才会展开详情，新建和编辑都以弹窗形式完成。",

  "settings.title": "安全设置",
  "settings.description": "统一管理本地安全体验和主密码。",
  "settings.desktop": "桌面体验",
  "settings.autoLockMinutes": "自动锁定（分钟）",
  "settings.clipboardClear": "复制密码后清空剪贴板（秒）",
  "settings.masterHintSection": "主密码提示",
  "settings.masterHintNote": "解锁页会在主密码输入框上方显示以下内容。留空表示不显示。",
  "settings.masterHintPlaceholder": "仅自己可辨别的提示……",
  "settings.saveHint": "保存提示",
  "settings.masterSection": "主密码",
  "settings.currentMasterPassword": "当前主密码",
  "settings.newMasterPassword": "新主密码",
  "settings.confirmNewMasterPassword": "确认新主密码",
  "settings.placeholderNChars": "{n} 位",
  "settings.updateMasterPassword": "更新主密码",

  "dataSync.title": "数据同步",
  "dataSync.description": "在本地设备之间通过导出和加载加密备份文件进行手动同步。",
  "dataSync.localData": "本地数据",
  "dataSync.bulletExportDialog": "导出时会打开系统保存对话框，可自定义保存目录和文件名。",
  "dataSync.bulletExportFormat":
    "导出格式为 `.json` 本地加密备份文件，可用于手动备份。",
  "dataSync.bulletReplace": "加载本地数据会直接替换当前保险库内容。",
  "dataSync.bulletReunlock": "加载后需要使用该数据对应的主密码重新解锁。",
  "dataSync.export": "导出本地数据",
  "dataSync.import": "加载本地数据",

  "secretKind.password": "密码",
  "secretKind.api-key": "API Key",
  "secretKind.secret": "Secret",
  "secretKind.token": "Token",

  "passwordToggle.hide": "隐藏{label}",
  "passwordToggle.show": "显示{label}",

  "editor.titleNew": "新建条目",
  "editor.titleEdit": "编辑条目",
  "editor.intro": "适合保存大模型平台账号、密码、API Key、Secret 和备注。",
  "editor.updatedBadge": "最近更新 {datetime}",
  "editor.platform": "平台",
  "editor.platformPlaceholder": "例如 OpenAI、Claude、通义千问",
  "editor.accountLabel": "账号 / Key 名称",
  "editor.accountPlaceholder": "例如 xiaokun@example.com 或 production-key",
  "editor.secretType": "类型",
  "editor.tags": "标签",
  "editor.tagsPlaceholder": "例如 生产环境, 计费, 团队共享",
  "editor.secretBody": "密钥 / 密码",
  "editor.secretBodyPlaceholder": "输入需要加密保存的敏感信息",
  "editor.note": "备注",
  "editor.notePlaceholder": "可记录申请入口、使用限制、到期时间等说明",
  "editor.save": "保存条目",
  "editor.saving": "保存中...",
  "editor.cancel": "取消",
  "editor.delete": "删除条目",
  "editor.confirmDelete": "确认删除条目",
  "editor.cancelDelete": "取消删除",

  "errors.requiredFields": "平台、账号和密钥不能为空。",
  "errors.saveEntry": "保存条目失败。",

  "banner.autoLoginExpired": "自动登录已过期，请重新输入主密码。",
  "banner.autoLoggedIn": "已自动登录 KeyHub。",
  "errors.autoLoginFailed": "自动登录失败，请重新输入主密码。",
  "errors.bootstrap": "初始化应用失败。",

  "errors.masterLength":
    "主密码必须为 {required} 位字符（当前 {current} 位）。",
  "errors.masterMismatch": "两次输入的主密码不一致。",
  "errors.enterMasterPassword": "请输入主密码。",
  "errors.unlockFailed": "解锁失败。",
  "errors.newMasterLength":
    "新主密码必须为 {required} 位字符（当前 {current} 位）。",
  "errors.newMasterMismatch": "两次输入的新主密码不一致。",

  "errors.createVault": "创建本地保险库失败。",
  "errors.lockVault": "锁定失败。",
  "errors.removeEntry": "删除条目失败。",
  "errors.copy": "复制失败。",
  "errors.saveHint": "保存主密码提示失败。",
  "errors.changeMaster": "修改主密码失败。",
  "errors.export": "导出本地数据失败。",
  "errors.import": "加载本地数据失败。",
  "errors.resetVault": "重置本地保险库失败。",

  "banner.vaultReady": "本地保险库已创建并解锁。",
  "banner.unlocked": "已解锁本地保险库。",
  "banner.lockedIdle": "长时间无操作，本地保险库已锁定。",
  "banner.locked": "本地保险库已锁定。",
  "banner.entrySaved": "已保存 {name} 条目。",
  "banner.entryRemoved": "条目已删除。",
  "banner.copiedClears":
    "{label}已复制，将在 {seconds} 秒后尝试清空剪贴板。",
  "banner.copiedPlain": "{label}已复制到剪贴板。",
  "banner.hintSaved": "主密码提示已保存。",
  "banner.masterUpdated": "主密码已更新。",
  "banner.exportCancelled": "已取消导出。",
  "banner.exportedTo": "本地数据已导出到：{path}",
  "banner.importLoaded": "本地数据已加载，请使用对应主密码解锁。",
  "banner.vaultReset": "本地保险库已重置。"
} as const;

export type MessageKey = keyof typeof zhMessages;

export const enMessages: Record<MessageKey, string> = {
  "common.close": "Close",
  "common.processing": "Working…",

  "language.switch": "Language",

  "theme.switchToLight": "Switch to light mode",
  "theme.switchToDark": "Switch to dark mode",
  "theme.light": "Light",
  "theme.dark": "Dark",

  "header.tagline":
    "Store platform accounts, passwords, API keys, secrets and notes locally.",

  "nav.dataSync": "Sync data",
  "nav.securitySettings": "Security",
  "nav.lockNow": "Lock",

  "loading.loadingVault": "Loading vault…",

  "createVault.title": "Create local vault",
  "createVault.masterPassword": "Master password",
  "createVault.confirmMasterPassword": "Confirm master password",
  "createVault.placeholderPassword": "{n} characters (any script)",
  "createVault.hintLabel": "Password hint (optional)",
  "createVault.hintNote": "Shows on the unlock screen to jog your memory.",
  "createVault.hintPlaceholder": "e.g. a memorable date or nickname",
  "createVault.remember3Days": "Keep master password for 3 days",
  "createVault.submit": "Create and open",

  "resetVault.title": "Reset local vault",
  "resetVault.warning":
    "Deletes the encrypted vault file and every entry on this device. Without a backup nothing can be restored. Afterwards you’ll set a new master password.",
  "resetVault.backUnlock": "Back to unlock",
  "resetVault.confirm": "Erase vault",

  "unlock.title": "Unlock vault",
  "unlock.masterPasswordHint": "Password hint",
  "unlock.placeholderPassword": "{n}-character master password",
  "unlock.submit": "Unlock",
  "unlock.remember3Days": "Keep master password for 3 days",
  "unlock.forgotReset": "Forgot password — reset vault",

  "search.label": "Search",
  "search.placeholder": "Platform, kind, account, tags",

  "entries.summary": "{shown} / {total}",
  "entries.new": "New entry",

  "table.platform": "Platform",
  "table.kind": "Kind",
  "table.account": "Account / User",
  "table.secret": "Secret / Key",
  "table.actions": "Actions",

  "copy.account": "User",
  "copy.secret": "Key",

  "row.copyAccount": "Copy User",
  "row.copySecret": "Copy Key",
  "row.edit": "Edit",

  "empty.entriesTitle": "No entries yet",
  "empty.entriesHint": "Use “New entry” above to save accounts and credentials.",

  "editor.modalTitleNew": "New entry",
  "editor.modalTitleEdit": "Edit {name}",
  "editor.modalDescription":
    "Details load when you edit an entry; new and edits open in this dialog.",

  "settings.title": "Security settings",
  "settings.description": "Desktop safety preferences and master password.",
  "settings.desktop": "Desktop experience",
  "settings.autoLockMinutes": "Auto-lock after idle (minutes)",
  "settings.clipboardClear": "Clear clipboard after copying secret (seconds)",
  "settings.masterHintSection": "Master-password hint",
  "settings.masterHintNote":
    "Shown above the unlock field. Leave empty to hide.",
  "settings.masterHintPlaceholder": "Hint only you would recognize…",
  "settings.saveHint": "Save hint",
  "settings.masterSection": "Master password",
  "settings.currentMasterPassword": "Current master password",
  "settings.newMasterPassword": "New master password",
  "settings.confirmNewMasterPassword": "Confirm new password",
  "settings.placeholderNChars": "{n} chars",
  "settings.updateMasterPassword": "Change master password",

  "dataSync.title": "Data sync",
  "dataSync.description":
    "Manually sync devices by exporting and importing encrypted backup files.",
  "dataSync.localData": "Local data",
  "dataSync.bulletExportDialog":
    "Export opens a save dialog—you choose folder and filename.",
  "dataSync.bulletExportFormat":
    "Backups are encrypted `.json` files for offline backup.",
  "dataSync.bulletReplace": "Import replaces the current vault entirely.",
  "dataSync.bulletReunlock": "Unlock with the backup’s master password after import.",

  "dataSync.export": "Export vault",
  "dataSync.import": "Import vault",

  "secretKind.password": "Password",
  "secretKind.api-key": "API key",
  "secretKind.secret": "Secret",
  "secretKind.token": "Token",

  "passwordToggle.hide": "Hide {label}",
  "passwordToggle.show": "Show {label}",

  "editor.titleNew": "New entry",
  "editor.titleEdit": "Edit entry",
  "editor.intro":
    "For LLM platform accounts, passwords, API keys, secrets, and notes.",
  "editor.updatedBadge": "Updated {datetime}",
  "editor.platform": "Platform",
  "editor.platformPlaceholder": "e.g. OpenAI, Claude",
  "editor.accountLabel": "Account / key name",
  "editor.accountPlaceholder": "e.g. you@company.com or production-key",
  "editor.secretType": "Kind",
  "editor.tags": "Tags",
  "editor.tagsPlaceholder": "e.g. prod, billing, shared",
  "editor.secretBody": "Secret / password",
  "editor.secretBodyPlaceholder": "Sensitive value to encrypt",
  "editor.note": "Notes",
  "editor.notePlaceholder": "Renewal dates, quotas, URLs, etc.",

  "editor.save": "Save entry",
  "editor.saving": "Saving…",
  "editor.cancel": "Cancel",
  "editor.delete": "Delete entry",
  "editor.confirmDelete": "Delete — confirm",
  "editor.cancelDelete": "Undo delete",

  "errors.requiredFields": "Platform, account, and secret are required.",

  "errors.saveEntry": "Could not save entry.",

  "banner.autoLoginExpired":
    "Saved sign-in expired. Enter your master password again.",
  "banner.autoLoggedIn": "Signed in automatically.",
  "errors.autoLoginFailed": "Automatic sign-in failed. Enter your master password.",
  "errors.bootstrap": "Could not initialise the app.",

  "errors.masterLength":
    "Master password must be {required} characters (entered {current}).",
  "errors.masterMismatch": "The two passwords do not match.",

  "errors.enterMasterPassword": "Enter your master password.",
  "errors.unlockFailed": "Unlock failed.",

  "errors.newMasterLength":
    "New master password must be {required} characters (entered {current}).",

  "errors.newMasterMismatch": "The two new passwords do not match.",

  "errors.createVault": "Could not create vault.",
  "errors.lockVault": "Lock failed.",

  "errors.removeEntry": "Could not delete entry.",
  "errors.copy": "Copy failed.",
  "errors.saveHint": "Could not save hint.",
  "errors.changeMaster": "Could not change master password.",

  "errors.export": "Could not export data.",
  "errors.import": "Could not import data.",
  "errors.resetVault": "Could not reset vault.",

  "banner.vaultReady": "Vault created and unlocked.",
  "banner.unlocked": "Vault unlocked.",
  "banner.lockedIdle": "Vault locked after idle.",

  "banner.locked": "Vault locked.",
  "banner.entrySaved": "Saved entry “{name}”.",

  "banner.entryRemoved": "Entry deleted.",
  "banner.copiedClears": "{label} copied; clipboard clears in ~{seconds}s.",

  "banner.copiedPlain": "{label} copied to clipboard.",
  "banner.hintSaved": "Password hint saved.",
  "banner.masterUpdated": "Master password updated.",
  "banner.exportCancelled": "Export cancelled.",
  "banner.exportedTo": "Exported to:\n{path}",
  "banner.importLoaded": "Data imported — unlock with that backup’s password.",
  "banner.vaultReset": "Vault was reset."
};

export function getMessages(locale: Locale): Record<MessageKey, string> {
  return locale === "zh" ? zhMessages : enMessages;
}
