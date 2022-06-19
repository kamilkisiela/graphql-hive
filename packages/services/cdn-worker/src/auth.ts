const encoder = new TextEncoder();

export function byteStringToUint8Array(byteString: string) {
  const ui = new Uint8Array(byteString.length);

  for (let i = 0; i < byteString.length; ++i) {
    ui[i] = byteString.charCodeAt(i);
  }

  return ui;
}

export async function isKeyValid(targetId: string, headerKey: string): Promise<boolean> {
  const headerData = byteStringToUint8Array(atob(headerKey));
  const secretKeyData = encoder.encode(KEY_DATA);
  const secretKey = await crypto.subtle.importKey('raw', secretKeyData, { name: 'HMAC', hash: 'SHA-256' }, false, [
    'verify',
  ]);

  return await crypto.subtle.verify('HMAC', secretKey, headerData, encoder.encode(targetId));
}
