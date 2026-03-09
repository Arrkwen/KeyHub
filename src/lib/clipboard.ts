export async function copySecret(value: string, clearAfterSeconds: number): Promise<void> {
  await navigator.clipboard.writeText(value);

  if (clearAfterSeconds <= 0) {
    return;
  }

  window.setTimeout(async () => {
    try {
      const current = await navigator.clipboard.readText();
      if (current === value) {
        await navigator.clipboard.writeText("");
      }
    } catch {
      // Some systems restrict reading or clearing clipboard state.
    }
  }, clearAfterSeconds * 1000);
}
