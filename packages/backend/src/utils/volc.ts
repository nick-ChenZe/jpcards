import { stringify } from 'querystring';
import { sign, getDateTimeNow, getBodySha, SignParams } from './auth.js';

interface VolcImageGenerationParams {
    req_key: string;
    prompt: string;
    task_id: string;
    width?: number;
    height?: number;
    seed?: number;
    use_pre_llm?: boolean;
    accessKeyId: string;
    secretAccessKey: string;
}

interface VolcImageGenerationResponse {
    code: number;
    message: string;
    data: {
        task_id: string;
    };
}

interface VolcImageResultResponse {
    code: number;
    message: string;
    data: {
        binary_data_base64: string[];
    };
}

export async function submitImageGenerationTask(params: VolcImageGenerationParams): Promise<string> {
    const { accessKeyId, secretAccessKey, ...requestData } = params;
    const queryString = JSON.stringify(requestData);

    const signParams: SignParams = {
        headers: {
            ["X-Date"]: getDateTimeNow(),
        },
        method: 'POST',
        query: {
            Version: '2022-08-31',
            Action: 'CVSync2AsyncSubmitTask',
        },
        accessKeyId,
        secretAccessKey,
        serviceName: 'cv',
        region: 'cn-north-1',
        bodySha: getBodySha(queryString)
    };

    const authorization = sign(signParams);

    const res = await fetch(`https://visual.volcengineapi.com/?${stringify(signParams.query)}`, {
        headers: {
            ...signParams.headers,
            'Authorization': authorization,
            'Content-Type': 'application/json'
        },
        method: signParams.method,
        body: queryString
    });

    if (!res.ok) {
        throw new Error(`Failed to submit task: ${res.status} ${res.statusText}`);
    }

    const response = await res.json() as VolcImageGenerationResponse;
    
    if (response.code !== 10000) {
        throw new Error(`API Error: ${response.message}`);
    }

    return response.data.task_id;
}

export async function getImageGenerationResult(params: { 
    task_id: string;
    req_key: string;
    accessKeyId: string;
    secretAccessKey: string;
}): Promise<Buffer> {
    const { accessKeyId, secretAccessKey, ...requestData } = params;
    const queryString = JSON.stringify(requestData);

    const signParams: SignParams = {
        headers: {
            ["X-Date"]: getDateTimeNow(),
        },
        method: 'POST',
        query: {
            Version: '2022-08-31',
            Action: 'CVSync2AsyncGetResult',
        },
        accessKeyId,
        secretAccessKey,
        serviceName: 'cv',
        region: 'cn-north-1',
        bodySha: getBodySha(queryString)
    };

    const authorization = sign(signParams);

    const res = await fetch(`https://visual.volcengineapi.com/?${stringify(signParams.query)}`, {
        headers: {
            ...signParams.headers,
            'Authorization': authorization,
            'Content-Type': 'application/json'
        },
        method: signParams.method,
        body: queryString
    });

    if (!res.ok) {
        throw new Error(`Failed to get result: ${res.status} ${res.statusText}`);
    }

    const response = await res.json() as VolcImageResultResponse;
    
    if (response.code !== 10000) {
        throw new Error(`API Error: ${response.message}`);
    }

    if (!response.data?.binary_data_base64?.[0]) {
        throw new Error('No image data received from the API');
    }

    return Buffer.from(response.data.binary_data_base64[0], 'base64');
}