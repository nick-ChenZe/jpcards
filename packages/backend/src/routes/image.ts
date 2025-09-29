import { Router, Request, Response } from 'express';
import { submitImageGenerationTask, getImageGenerationResult } from '../utils/volc';
import { config } from '../config';

const router = Router();

interface GenerateImageRequest {
    prompt: string;
    width?: number;
    height?: number;
    seed?: number;
    use_pre_llm?: boolean;
}

interface GetImageResultRequest {
    task_id: string;
}

// Submit image generation task
router.post('/generate', async (req: Request<{}, {}, GenerateImageRequest>, res: Response) => {
    try {
        const { prompt, width, height, seed, use_pre_llm } = req.body;

        if (!prompt) {
            res.status(400).json({ error: 'prompt is required' });
            return;
        }

        const task_id = await submitImageGenerationTask({
            req_key: 'jimeng_t2i_v31',
            prompt,
            task_id: Date.now().toString(),
            width,
            height,
            seed,
            use_pre_llm,
            accessKeyId: config.env.volcApiAk,
            secretAccessKey: config.env.volcApiSk,
        });

        res.json({
            task_id,
            message: 'Task submitted successfully'
        });
    } catch (error) {
        console.error('Failed to submit image generation task:', error);
        res.status(500).json({
            error: 'Failed to submit image generation task',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Get image generation result
router.post('/generate/result', async (req: Request<{}, {}, GetImageResultRequest>, res: Response) => {
    try {
        const { task_id } = req.body;

        if (!task_id) {
            res.status(400).json({ error: 'task_id is required' });
            return;
        }

        const imageBuffer = await getImageGenerationResult({
            req_key: 'jimeng_t2i_v31',
            task_id,
            accessKeyId: config.env.volcApiAk,
            secretAccessKey: config.env.volcApiSk,
        });

        // 设置响应头为图片类型
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', 'attachment; filename="generated-image.png"');
        
        // 直接发送图片数据
        res.send(imageBuffer);
    } catch (error) {
        console.error('Failed to get image result:', error);
        res.status(500).json({
            error: 'Failed to get image result',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export default router;
