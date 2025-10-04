import crypto from 'crypto';
import {URLSearchParams} from 'url';
import {debuglog} from 'util';

const debug = debuglog('signer');

// Types and Interfaces
export interface SignParams {
    headers?: Record<string, string>;
    query?: Record<string, string>;
    region?: string;
    serviceName?: string;
    method?: string;
    pathName?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    needSignHeaderKeys?: string[];
    bodySha?: string;
}

// Constants
export const HEADER_KEYS_TO_IGNORE: Set<string> = new Set([
    'authorization',
    'content-type',
    'content-length',
    'user-agent',
    'presigned-expires',
    'expect'
]);

// Signing function
export function sign (params: SignParams): string {
    const {
        headers = {},
        query = {},
        region = '',
        serviceName = '',
        method = '',
        pathName = '/',
        accessKeyId = '',
        secretAccessKey = '',
        needSignHeaderKeys = [],
        bodySha
    } = params;

    const datetime = headers['X-Date'] || '';
    const date = datetime.substring(0, 8); // YYYYMMDD

    const [signedHeaders, canonicalHeaders] = getSignHeaders(headers, needSignHeaderKeys);
    const canonicalRequest = [
        method.toUpperCase(),
        pathName,
        queryParamsToString(query) || '',
        `${canonicalHeaders}\n`,
        signedHeaders,
        bodySha || hash('')
    ].join('\n');

    const credentialScope = [date, region, serviceName, 'request'].join('/');
    const stringToSign = ['HMAC-SHA256', datetime, credentialScope, hash(canonicalRequest)].join(
        '\n'
    );

    const kDate = hmac(secretAccessKey, date);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, serviceName);
    const kSigning = hmac(kService, 'request');
    const signature = hmac(kSigning, stringToSign).toString('hex');

    debug('--------CanonicalString:\n%s\n--------SignString:\n%s', canonicalRequest, stringToSign);

    return [
        'HMAC-SHA256',
        `Credential=${accessKeyId}/${credentialScope},`,
        `SignedHeaders=${signedHeaders},`,
        `Signature=${signature}`
    ].join(' ');
}

// Utility functions
function hmac (secret: string | Buffer, s: string): Buffer {
    return crypto.createHmac('sha256', secret).update(s, 'utf8').digest();
}

function hash (s: string): string {
    return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function queryParamsToString (params: Record<string, string | undefined>): string {
    return Object.keys(params)
        .sort()
        .map((key) => {
            const val = params[key];
            if (typeof val === 'undefined' || val === null) {
                return undefined;
            }

            const escapedKey = uriEscape(key);
            if (!escapedKey) {
                return undefined;
            }

            if (Array.isArray(val)) {
                return `${escapedKey}=${val.map(uriEscape).sort().join(`&${escapedKey}=`)}`;
            }

            return `${escapedKey}=${uriEscape(val.toString())}`;
        })
        .filter((v): v is string => !!v)
        .join('&');
}

function getSignHeaders (
    originHeaders: Record<string, string>,
    needSignHeaders: string[]
): [string, string] {
    function trimHeaderValue (header: unknown): string {
        return (header?.toString?.() || '').trim().replace(/\s+/g, ' ');
    }

    let h = Object.keys(originHeaders);

    if (Array.isArray(needSignHeaders)) {
        const needSignSet = new Set(
            [...needSignHeaders, 'x-date', 'host'].map((k) => k.toLowerCase())
        );
        h = h.filter((k) => needSignSet.has(k.toLowerCase()));
    }

    h = h.filter((k) => !HEADER_KEYS_TO_IGNORE.has(k.toLowerCase()));

    const signedHeaderKeys = h
        .slice()
        .map((k) => k.toLowerCase())
        .sort()
        .join(';');

    const canonicalHeaders = h
        .sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1))
        .map((k) => `${k.toLowerCase()}:${trimHeaderValue(originHeaders[k])}`)
        .join('\n');

    return [signedHeaderKeys, canonicalHeaders];
}

function uriEscape (str: string): string {
    try {
        return encodeURIComponent(str)
            .replace(/[^A-Za-z0-9_.~\-%]+/g, escape)
            .replace(/[*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
    } catch (e) {
        return '';
    }
}

export function getDateTimeNow (): string {
    const now = new Date();
    return now.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

export function getBodySha (body: string | URLSearchParams | Buffer): string {
    const hash = crypto.createHash('sha256');

    if (typeof body === 'string') {
        hash.update(body);
    } else if (body instanceof URLSearchParams) {
        hash.update(body.toString());
    } else if (Buffer.isBuffer(body)) {
        hash.update(body);
    }

    return hash.digest('hex');
}
