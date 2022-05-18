const encoder = new TextEncoder();
const SECRET_KEY_DATA = encoder.encode(KEY_DATA);

export function byteStringToUint8Array(byteString: string) {
  const ui = new Uint8Array(byteString.length);

  for (let i = 0; i < byteString.length; ++i) {
    ui[i] = byteString.charCodeAt(i);
  }

  return ui;
}

export async function isKeyValid(
  targetId: string,
  headerKey: string
): Promise<boolean> {
  const headerData = byteStringToUint8Array(atob(headerKey));
  const secretKey = await crypto.subtle.importKey(
    'raw',
    SECRET_KEY_DATA,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const verified = await crypto.subtle.verify(
    'HMAC',
    secretKey,
    headerData,
    encoder.encode(targetId)
  );

  return verified;
}
