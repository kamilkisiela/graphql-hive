import { useCallback } from 'react';
import { HistoryIcon, PlayIcon, SquareIcon, Trash2Icon, TriangleAlertIcon } from 'lucide-react';
import { cn, tokenizeUrls } from '../../lib/utils';
import { Button } from '../ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../ui/empty';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '../ui/resizable';
import { ScrollArea, ScrollBar } from '../ui/scroll-area';
import { useLaboratory } from './context';
import { Editor } from './editor';

export const Preflight = () => {
  const {
    preflight,
    preflightLogs,
    isPreflightRunning,
    testPreflight,
    abortPreflight,
    clearPreflightLogs,
    setLastTestResult,
    setPreflight,
    setEnv,
    checkPermissions,
    preflightNotice,
    plugins,
    pluginsState,
    setPluginsState,
  } = useLaboratory();

  const run = useCallback(async () => {
    if (!preflight?.script) {
      return;
    }

    const result = await testPreflight?.(plugins, pluginsState);

    setEnv(result?.env ?? { variables: {} });
    setPluginsState(result?.pluginsState ?? {});
    setLastTestResult(result ?? null);
  }, [preflight?.script, testPreflight, plugins, pluginsState, setEnv, setPluginsState]);

  const logs = preflightLogs ?? [];

  return (
    <ResizablePanelGroup orientation="horizontal" className="size-full">
      <ResizablePanel defaultSize="50%" className="bg-card">
        <div className="grid size-full grid-rows-[auto_auto_1fr] pb-0">
          <div className="flex w-full items-center gap-2 border-b border-border p-3">
            <span className="text-base font-medium">Preflight</span>
            <div className="ml-auto flex items-center gap-2">
              {isPreflightRunning ? (
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-6 rounded-sm"
                  onClick={abortPreflight}
                >
                  <SquareIcon className="size-4" />
                  <span>Stop</span>
                </Button>
              ) : (
                <Button variant="default" size="sm" className="h-6 rounded-sm" onClick={run}>
                  <PlayIcon className="size-4" />
                  <span>Test</span>
                </Button>
              )}
            </div>
          </div>
          {/*
            Shown to readers as well as authors: the script runs in the browser of whoever
            opens the lab, whether or not they can edit it. Only what holds for every host
            belongs here. Where a script is saved, and who else can read it, is the host's to
            say through `preflightNotice`.
          */}
          <div className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
            <TriangleAlertIcon className="mr-1.5 inline size-3.5 align-[-2px]" />
            Preflight scripts run in this browser as part of your requests. Prefer{' '}
            <code className="font-mono">lab.prompt()</code> over writing secrets into the script.
            {preflightNotice ? <span className="ml-1">{preflightNotice}</span> : null}
          </div>
          <div className="size-full">
            <Editor
              value={preflight?.script ?? ''}
              onChange={value => {
                setPreflight({
                  ...(preflight ?? { script: '', enabled: true }),
                  script: value ?? '',
                });
              }}
              language="typescript"
              extraLibs={[
                `
                  interface Lab {
                    environment: {
                      /** Stored as text. Anything else is dropped with a warning. */
                      set: (key: string, value: string | number | boolean | null) => void;
                      get: (key: string) => string;
                      delete: (key: string) => void;
                    };
                    request: {
                      /** Sent as-is and win over the operation's own headers. */
                      headers: Headers;
                    };
                    /**
                     * Asks the user for a value before the request runs. The title labels the
                     * input; placeholder and description are optional hints. Resolves null when
                     * the prompt is dismissed; an empty field cannot be submitted.
                     */
                    prompt: (
                      title: string,
                      defaultValue?: string,
                      options?: { placeholder?: string; description?: string },
                    ) => Promise<string | null>;
                    CryptoJS: typeof CryptoJS;
                    plugins: {
                      ${plugins
                        .filter(plugin => plugin.preflight?.lab?.definition)
                        .map(plugin => plugin.preflight?.lab?.definition)
                        .join('\n')}
                    }
                  }

                  declare namespace CryptoJS {
                    namespace lib {
                      interface WordArray {
                        words: number[];
                        sigBytes: number;
                        toString(encoder?: Encoder): string;
                        concat(wordArray: WordArray): WordArray;
                        clone(): WordArray;
                      }
                      interface CipherParams {
                        ciphertext: WordArray;
                        key: WordArray;
                        iv: WordArray;
                        salt: WordArray;
                        toString(formatter?: Format): string;
                      }
                    }
                    namespace enc {
                      interface Encoder {
                        stringify(wordArray: lib.WordArray): string;
                        parse(str: string): lib.WordArray;
                      }
                      const Hex: Encoder;
                      const Latin1: Encoder;
                      const Utf8: Encoder;
                      const Base64: Encoder;
                    }
                    namespace algo {
                      interface HasherStatic {
                        create(cfg?: object): Hasher;
                      }
                      interface Hasher {
                        update(messageUpdate: lib.WordArray | string): Hasher;
                        finalize(messageUpdate?: lib.WordArray | string): lib.WordArray;
                      }
                      const MD5: HasherStatic;
                      const SHA1: HasherStatic;
                      const SHA256: HasherStatic;
                      const SHA224: HasherStatic;
                      const SHA512: HasherStatic;
                      const SHA384: HasherStatic;
                      const SHA3: HasherStatic;
                      const RIPEMD160: HasherStatic;
                      interface CipherStatic {
                        createEncryptor(key: lib.WordArray, cfg?: CipherOption): Cipher;
                        createDecryptor(key: lib.WordArray, cfg?: CipherOption): Cipher;
                      }
                      interface Cipher {
                        process(dataUpdate: lib.WordArray | string): lib.WordArray;
                        finalize(dataUpdate?: lib.WordArray | string): lib.WordArray;
                      }
                      interface CipherHelper {
                        encrypt(message: lib.WordArray | string, key: lib.WordArray | string, cfg?: CipherOption): lib.CipherParams;
                        decrypt(ciphertext: lib.CipherParams | string, key: lib.WordArray | string, cfg?: CipherOption): lib.WordArray;
                      }
                      const AES: CipherStatic;
                      const DES: CipherStatic;
                      const TripleDES: CipherStatic;
                      const RC4: CipherStatic;
                    }
                    namespace mode {
                      interface BlockCipherMode {
                        createEncryptor(cipher: algo.Cipher, iv: number[]): Mode;
                        createDecryptor(cipher: algo.Cipher, iv: number[]): Mode;
                      }
                      const CBC: BlockCipherMode;
                      const CFB: BlockCipherMode;
                      const CTR: BlockCipherMode;
                      const OFB: BlockCipherMode;
                      const ECB: BlockCipherMode;
                    }
                    namespace pad {
                      interface Padding {
                        pad(data: lib.WordArray, blockSize: number): void;
                        unpad(data: lib.WordArray): void;
                      }
                      const Pkcs7: Padding;
                      const AnsiX923: Padding;
                      const Iso10126: Padding;
                      const Iso97971: Padding;
                      const ZeroPadding: Padding;
                      const NoPadding: Padding;
                    }
                    namespace format {
                      interface Format {
                        stringify(cipherParams: lib.CipherParams): string;
                        parse(str: string): lib.CipherParams;
                      }
                      const OpenSSL: Format;
                      const Hex: Format;
                    }
                    interface CipherOption {
                      iv?: lib.WordArray;
                      mode?: mode.BlockCipherMode;
                      padding?: pad.Padding;
                      format?: format.Format;
                      [key: string]: any;
                    }
                    interface Mode {
                      processBlock(words: number[], offset: number): void;
                    }
                    type HasherHelper = (message: lib.WordArray | string, cfg?: object) => lib.WordArray;
                    type HmacHasherHelper = (message: lib.WordArray | string, key: lib.WordArray | string) => lib.WordArray;
                    type CipherHelper = {
                      encrypt(message: lib.WordArray | string, key: lib.WordArray | string, cfg?: CipherOption): lib.CipherParams;
                      decrypt(ciphertext: lib.CipherParams | string, key: lib.WordArray | string, cfg?: CipherOption): lib.WordArray;
                    };
                    const MD5: HasherHelper;
                    const SHA1: HasherHelper;
                    const SHA256: HasherHelper;
                    const SHA224: HasherHelper;
                    const SHA512: HasherHelper;
                    const SHA384: HasherHelper;
                    const SHA3: HasherHelper;
                    const RIPEMD160: HasherHelper;
                    const HmacMD5: HmacHasherHelper;
                    const HmacSHA1: HmacHasherHelper;
                    const HmacSHA256: HmacHasherHelper;
                    const HmacSHA224: HmacHasherHelper;
                    const HmacSHA512: HmacHasherHelper;
                    const HmacSHA384: HmacHasherHelper;
                    const HmacSHA3: HmacHasherHelper;
                    const HmacRIPEMD160: HmacHasherHelper;
                    const AES: CipherHelper;
                    const DES: CipherHelper;
                    const TripleDES: CipherHelper;
                    const RC4: CipherHelper;
                    const RC4Drop: CipherHelper;
                    const Rabbit: CipherHelper;
                    const RabbitLegacy: CipherHelper;
                    function PBKDF2(password: lib.WordArray | string, salt: lib.WordArray | string, cfg?: { keySize?: number; hasher?: algo.HasherStatic; iterations?: number }): lib.WordArray;
                    function EvpKDF(password: lib.WordArray | string, salt: lib.WordArray | string, cfg?: { keySize: number; hasher?: algo.HasherStatic; iterations: number }): lib.WordArray;
                  }

                  declare var lab: Lab;
                  declare var CryptoJS: typeof CryptoJS;
                  `,
              ]}
              options={{
                readOnly: !checkPermissions?.('preflight:update'),
              }}
            />
          </div>
        </div>
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel minSize="10%" defaultSize="50%" className="bg-card">
        {logs.length > 0 ? (
          <div className="grid size-full grid-rows-[auto_1fr] pb-0">
            <div className="flex h-12 w-full items-center gap-2 border-b border-border p-3">
              <span className="text-base font-medium">Logs</span>
              <div className="ml-auto flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 rounded-sm"
                  onClick={clearPreflightLogs}
                >
                  <Trash2Icon className="size-4" />
                  <span>Clear</span>
                </Button>
              </div>
            </div>
            <ScrollArea className="h-full">
              <div
                role="log"
                aria-label="Preflight logs"
                className="flex flex-col gap-1.5 p-3 whitespace-pre-wrap"
              >
                {logs.map((log, i) => (
                  <div className="gap-2 font-mono" data-level={log.level} key={i}>
                    <span className="text-xs text-muted-foreground">{log.createdAt}</span>{' '}
                    <span
                      className={cn('text-xs font-medium', {
                        'text-blue-400': log.level === 'info',
                        'text-green-400': log.level === 'log',
                        'text-yellow-400': log.level === 'warn',
                        'text-red-400': log.level === 'error',
                        'text-gray-400': log.level === 'system',
                      })}
                    >
                      {log.level.toUpperCase()}
                    </span>{' '}
                    {log.line ? (
                      <span className="text-xs text-muted-foreground">
                        ({log.line}:{log.column}){' '}
                      </span>
                    ) : null}
                    <span className="text-xs">
                      {tokenizeUrls(log.message.join(' ')).map((tok, i) =>
                        tok.type === 'url' ? (
                          <a
                            key={i}
                            href={tok.value}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all text-blue-400 underline underline-offset-2 hover:opacity-80"
                          >
                            {tok.value}
                          </a>
                        ) : (
                          tok.value
                        ),
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <ScrollBar />
            </ScrollArea>
          </div>
        ) : (
          <Empty className="size-full">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HistoryIcon className="size-6 text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle>No logs yet</EmptyTitle>
              <EmptyDescription>
                No logs available yet. Run your preflight to see the logs here.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
};
