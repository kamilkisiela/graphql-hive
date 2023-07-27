export type SignatureValidator = (receivedSignature: string) => boolean;

export function createSignatureValidator(expectedSignature: string): SignatureValidator {
  return (receivedSignature: string) => {
    return expectedSignature === receivedSignature;
  };
}
