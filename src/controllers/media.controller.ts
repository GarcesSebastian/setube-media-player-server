import type { Request, Response } from "express";
import yts from "yt-search";
import path from 'path';
import fs from 'fs';
import { promisify } from "util";
import { exec } from "child_process";

const execAsync = promisify(exec);

const searchCache = new Map<string, any>();
const infoCache = new Map<string, any>();

export class MediaController {
    public static async Query(req: Request, res: Response) {
        try {
            const { query } = req.query;
            if (!query) return res.status(400).json({ message: "Query missing" });

            const cacheKey = (query as string).toLowerCase().trim();
            if (searchCache.has(cacheKey)) {
                return res.status(200).json(searchCache.get(cacheKey));
            }

            const r = await yts(query as string);
            const result = r.videos.slice(0, 12).map(item => ({
                video_id: item.videoId,
                url: item.url,
                title: item.title,
                thumbnail: item.thumbnail,
                duration: item.seconds,
                author: { name: item.author.name }
            }));

            searchCache.set(cacheKey, result);
            return res.status(200).json(result);
        } catch (error) {
            return res.status(500).json({ message: "Error" });
        }
    }

    public static async GetInfo(req: Request, res: Response) {
        try {
            const { url } = req.query;
            if (!url) return res.status(400).json({ message: "URL missing" });

            if (infoCache.has(url as string)) {
                return res.status(200).json(infoCache.get(url as string));
            }

            const videoId = (url as string).split('v=')[1]?.split('&')[0];
            if (!videoId) {
                return res.status(400).json({ message: "Invalid YouTube URL" });
            }

            const info = await yts({ videoId: videoId });

            const formats = [
                { format_id: "high", ext: "m4a", resolution: "High (256kbps)" },
                { format_id: "medium", ext: "m4a", resolution: "Medium (128kbps)" },
                { format_id: "low", ext: "m4a", resolution: "Low (96kbps)" },
                { format_id: "1080", ext: "mp4", resolution: "1080p" },
                { format_id: "720", ext: "mp4", resolution: "720p" },
                { format_id: "480", ext: "mp4", resolution: "480p" }
            ];

            const result = {
                id: info.videoId,
                url: info.url,
                title: info.title,
                duration: info.seconds,
                thumbnail: info.thumbnail,
                author: { name: info.author.name },
                formats
            };

            infoCache.set(url as string, result);
            return res.status(200).json(result);
        } catch (error) {
            return res.status(500).json({ message: "Error" });
        }
    }

    public static async Download(req: Request, res: Response) {
        try {
            const { url, format = 'mp4', quality = 'high' } = req.body;
            const videoId = Date.now();

            const tempDir = path.join(process.env.TEMP || 'C:\\temp');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            let command: string;
            let outputPath: string;
            let contentType: string;
            let filename: string;

            if (format === 'mp3') {
                outputPath = path.join(tempDir, `${videoId}.m4a`);

                const audioFormats: Record<string, string> = {
                    'high': 'bestaudio[ext=m4a]',
                    'medium': 'bestaudio[ext=m4a][abr<=128]',
                    'low': 'bestaudio[ext=m4a][abr<=96]'
                };

                const selectedFormat = audioFormats[quality] || audioFormats['high'];
                command = `yt-dlp -f "${selectedFormat}" --no-playlist -o "${outputPath}" "${url}"`;

                contentType = 'audio/mp4';
                filename = 'audio.m4a';
            } else {
                outputPath = path.join(tempDir, `${videoId}.mp4`);

                const videoQualities: Record<string, string> = {
                    '1080': '1080',
                    '720': '720',
                    '480': '480',
                    '360': '360'
                };

                const selectedQuality = videoQualities[quality] || '1080';
                command = `yt-dlp -f "bestvideo[height<=${selectedQuality}][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]" --merge-output-format mp4 --no-playlist --concurrent-fragments 8 -o "${outputPath}" "${url}"`;

                contentType = 'video/mp4';
                filename = 'video.mp4';
            }

            await execAsync(command, {
                maxBuffer: 1024 * 1024 * 150
            });

            if (!fs.existsSync(outputPath)) {
                throw new Error('Download failed');
            }

            const stat = fs.statSync(outputPath);

            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Length', stat.size);
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            const stream = fs.createReadStream(outputPath);
            stream.pipe(res);

            stream.on('end', () => {
                try {
                    fs.unlinkSync(outputPath);
                } catch (err) {
                    console.error('Error deleting temp file:', err);
                }
            });

            stream.on('error', (err) => {
                console.error('Stream error:', err);
                if (fs.existsSync(outputPath)) {
                    try {
                        fs.unlinkSync(outputPath);
                    } catch (unlinkErr) {
                        console.error('Error deleting temp file:', unlinkErr);
                    }
                }
            });

        } catch (error) {
            console.error('Download error:', error);
            return res.status(500).json({ message: "Error downloading media" });
        }
    }
}