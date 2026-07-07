import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';

export interface PickedInvoice {
  base64: string;
  mimeType: string;
}

/** base64 编码(去掉 data URL 前缀);Node/RN 无 btoa 时退回 Buffer。 */
function toBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

/**
 * 选一张发票(图片或 PDF)并读成 base64。Web 与原生分别处理:
 * - Web:DocumentPicker 给到 File,用 FileReader 读 data URL
 * - 原生:给到本地 uri,用 expo-file-system 读 base64
 * 返回 null 表示用户取消。
 */
export async function pickInvoice(): Promise<PickedInvoice | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/*', 'application/pdf'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  const mimeType = asset.mimeType ?? 'application/octet-stream';

  if (Platform.OS === 'web') {
    const file = asset.file;
    if (!file) return null;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    return { base64: toBase64(dataUrl), mimeType };
  }

  const FileSystem = await import('expo-file-system');
  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return { base64, mimeType };
}
