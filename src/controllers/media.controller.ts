import type { Request, Response } from "express";
import yts from "yt-search";
import path from 'path';
import fs from 'fs';
import { spawn } from "child_process";
import crypto from "crypto";
import { promisify } from "util";
import { exec } from "child_process";

const execAsync = promisify(exec);

const searchCache = new Map<string, { data: any[]; timestamp: number }>();
const infoCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30 * 60 * 1000;

const STATIC_FORMATS = [
    { format_id: "high", ext: "m4a", resolution: "High (256kbps)" },
    { format_id: "medium", ext: "m4a", resolution: "Medium (128kbps)" },
    { format_id: "low", ext: "m4a", resolution: "Low (96kbps)" },
    { format_id: "1080", ext: "mp4", resolution: "1080p" },
    { format_id: "720", ext: "mp4", resolution: "720p" },
    { format_id: "480", ext: "mp4", resolution: "480p" }
];

setInterval(() => {
    const now = Date.now();
    for (const [key, value] of searchCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) searchCache.delete(key);
    }
    for (const [key, value] of infoCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) infoCache.delete(key);
    }
}, 10 * 60 * 1000);

export class MediaController {
    public static async Query(req: Request, res: Response) {
        try {
            const { query } = req.query;
            if (!query) return res.status(400).json({ message: "Query missing" });

            const cacheKey = (query as string).toLowerCase().trim();
            const cached = searchCache.get(cacheKey);

            if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
                return res.status(200).json(cached.data);
            }

            const r = await yts(query as string);
            const result = r.videos.map((item: any) => ({
                video_id: item.videoId,
                url: item.url,
                title: item.title,
                thumbnail: item.thumbnail,
                duration: item.seconds,
                author: { name: item.author.name }
            }));

            searchCache.set(cacheKey, { data: result, timestamp: Date.now() });
            return res.status(200).json(result);
        } catch (error) {
            console.error('Query error:', error);
            return res.status(500).json({ message: "Error" });
        }
    }

    public static async GetInfo(req: Request, res: Response) {
        try {
            const { url } = req.query;
            if (!url) return res.status(400).json({ message: "URL missing" });

            const urlStr = url as string;
            const videoId = urlStr.includes('v=')
                ? urlStr.split('v=')[1]?.split('&')[0]
                : urlStr.split('/').pop()?.split('?')[0];

            if (!videoId) return res.status(400).json({ message: "Invalid YouTube URL" });

            const cachedInfo = infoCache.get(videoId);
            if (cachedInfo && (Date.now() - cachedInfo.timestamp) < CACHE_TTL) {
                return res.status(200).json(cachedInfo.data);
            }

            for (const cacheItem of searchCache.values()) {
                const found = cacheItem.data.find(v => v.video_id === videoId);
                if (found) {
                    const result = {
                        id: found.video_id,
                        url: found.url,
                        title: found.title,
                        duration: found.duration,
                        thumbnail: found.thumbnail,
                        author: found.author,
                        formats: STATIC_FORMATS
                    };
                    infoCache.set(videoId, { data: result, timestamp: Date.now() });
                    return res.status(200).json(result);
                }
            }

            const info = await yts({ videoId: videoId });
            const result = {
                id: info.videoId,
                url: info.url,
                title: info.title,
                duration: info.seconds,
                thumbnail: info.thumbnail,
                author: { name: info.author.name },
                formats: STATIC_FORMATS
            };

            infoCache.set(videoId, { data: result, timestamp: Date.now() });
            return res.status(200).json(result);
        } catch (error) {
            console.error('GetInfo error:', error);
            return res.status(500).json({ message: "Error" });
        }
    }

    public static async Download(req: Request, res: Response) {
        let outputPath = "";
        const jobId = crypto.randomBytes(8).toString('hex');

        try {
            const { url, format = 'mp4', quality = 'high' } = req.body;

            const tempDir = path.join(process.env.TEMP || 'C:\\temp', 'setube_jobs');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            let args: string[] = [];
            let extension: string;
            let contentType: string;

            if (format === 'mp3') {
                const audioFormats: Record<string, string> = {
                    'high': 'bestaudio[ext=m4a]',
                    'medium': 'bestaudio[ext=m4a][abr<=128]',
                    'low': 'bestaudio[ext=m4a][abr<=96]'
                };
                const selectedFormat = audioFormats[quality] || audioFormats['high'];
                extension = 'm4a';
                contentType = 'audio/mp4';
                outputPath = path.join(tempDir, `${jobId}.${extension}`);
                args = ['-f', selectedFormat, '--no-playlist', '-o', outputPath, url];
            } else {
                const videoQualities: Record<string, string> = {
                    '1080': '1080',
                    '720': '720',
                    '480': '480',
                    '360': '360'
                };
                const selectedQuality = videoQualities[quality] || '1080';
                extension = 'mp4';
                contentType = 'video/mp4';
                outputPath = path.join(tempDir, `${jobId}.${extension}`);
                args = [
                    '-f', `bestvideo[height<=${selectedQuality}][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]`,
                    '--merge-output-format', 'mp4',
                    '--no-playlist',
                    '--concurrent-fragments', '8',
                    '-o', outputPath,
                    url
                ];
            }

            const downloadProcess = spawn('yt-dlp', args);

            downloadProcess.on('close', (code: number) => {
                if (code !== 0) {
                    console.error(`yt-dlp for ${jobId} exited with code ${code}`);
                    if (!res.headersSent) {
                        return res.status(500).json({ message: "Error en la conversión" });
                    }
                    return;
                }

                if (!fs.existsSync(outputPath)) {
                    if (!res.headersSent) {
                        return res.status(500).json({ message: "Archivo no generado" });
                    }
                    return;
                }

                const stat = fs.statSync(outputPath);
                res.setHeader('Content-Type', contentType);
                res.setHeader('Content-Length', stat.size);
                res.setHeader('Content-Disposition', `attachment; filename="setube_${jobId}.${extension}"`);

                const stream = fs.createReadStream(outputPath);
                stream.pipe(res);

                stream.on('end', () => {
                    try { fs.unlinkSync(outputPath); } catch (e) { }
                });

                stream.on('error', (err) => {
                    console.error('Stream error:', err);
                    try { fs.unlinkSync(outputPath); } catch (e) { }
                });
            });

            downloadProcess.on('error', (err: Error) => {
                console.error(`Failed to start yt-dlp for ${jobId}:`, err);
                if (!res.headersSent) {
                    res.status(500).json({ message: "Servidor saturado o error de inicio" });
                }
            });

        } catch (error) {
            console.error('Download setup error:', error);
            if (!res.headersSent) {
                return res.status(500).json({ message: "Error interno" });
            }
        }
    }
}