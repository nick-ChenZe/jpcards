// @ts-nocheck
/**
 * Minimal XMLHttpRequest polyfill using fetch for Cloudflare Workers.
 * Workers lack XMLHttpRequest; kuromoji's BrowserDictionaryLoader requires it.
 */
function createXHRPolyfill (): typeof XMLHttpRequest {
    class XHRPolyfill {
        private _method = 'GET';
        private _url = '';
        private _responseType: XMLHttpRequestResponseType = '';
        private _status = 0;
        private _statusText = '';
        private _response: ArrayBuffer | null = null;
        onload: (() => void) | null = null;
        onerror: ((err: unknown) => void) | null = null;

        open (method: string, url: string, _async = true): void {
            this._method = method;
            this._url = url;
        }

        set responseType (value: XMLHttpRequestResponseType) {
            this._responseType = value;
        }

        get response (): ArrayBuffer | null {
            return this._response;
        }

        get status (): number {
            return this._status;
        }

        get statusText (): string {
            return this._statusText;
        }

        send (): void {
            fetch(this._url, {method: this._method})
                .then((res) => {
                    this._status = res.status;
                    this._statusText = res.statusText;
                    if (!res.ok) {
                        throw new Error(res.statusText);
                    }
                    return res.arrayBuffer();
                })
                .then((buf) => {
                    this._response = buf;
                    this.onload?.();
                })
                .catch((err) => {
                    this._status = 0;
                    this._statusText = String(err);
                    this.onerror?.(err);
                });
        }
    }

    return XHRPolyfill as unknown as typeof XMLHttpRequest;
}

export function installXHRPolyfill (): void {
    if (typeof globalThis.XMLHttpRequest === 'undefined') {
        (globalThis as {XMLHttpRequest?: typeof XMLHttpRequest}).XMLHttpRequest =
            createXHRPolyfill();
    }
}
