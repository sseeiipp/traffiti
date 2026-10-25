import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { api } from './client';

/** 사진첩 권한을 묻고, 고른 사진을 정사각형 512px JPEG로 줄여 서버에 올린다. 고르지 않으면 null */
export async function pickAndUploadPhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('사진을 고르려면 사진 접근을 허용해 주세요.');
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 });
  const asset = r.canceled ? null : r.assets?.[0];
  if (!asset) return null;
  const img = await ImageManipulator.manipulate(asset.uri).resize({ width: 512 }).renderAsync();
  const out = await img.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!out.base64) throw new Error('사진을 읽지 못했어요.');
  const { url } = await api<{ url: string }>('/images', { body: { mime: 'image/jpeg', base64: out.base64 } });
  return url;
}

/** 사진 고르기 버튼 상태. pick()이 끝나면 onPicked로 새 주소를 넘긴다 */
export function usePhotoPicker(onPicked: (url: string) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pick = async () => {
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const url = await pickAndUploadPhoto();
      if (url) onPicked(url);
    } catch (e) {
      setError((e as Error).message || '사진을 올리지 못했어요.');
    } finally {
      setBusy(false);
    }
  };
  return { pick, busy, error };
}
