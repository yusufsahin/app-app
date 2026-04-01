export function getClipboardImageFiles(items: DataTransferItemList | null | undefined): File[] {
  if (!items?.length) return [];

  const files: File[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item || item.kind !== "file" || !item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file) files.push(file);
  }

  return files;
}
