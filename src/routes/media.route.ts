import { Router } from "express";
import { MediaController } from "../controllers/media.controller.js";
import { LogUtils } from "../utils/log.utils.js";
import { RateLimitUtils } from "../utils/ratelimit.utils.js";

const SearchRateLimit = RateLimitUtils.createRateLimit({
    windowMs: 10 * 1000,
    max: 20,
    blockDurationMs: 1 * 60 * 1000,
    message: "Too many requests"
});

const InfoRateLimit = RateLimitUtils.createRateLimit({
    windowMs: 10 * 1000,
    max: 20,
    blockDurationMs: 1 * 60 * 1000,
    message: "Too many requests"
});

const DownloadRateLimit = RateLimitUtils.createRateLimit({
    windowMs: 10 * 1000,
    max: 20,
    blockDurationMs: 10 * 60 * 1000,
    message: "Too many requests"
});

export class MediaRoute {
    public static init(name: string, app: Router) {
        LogUtils.LogRoute(name);
        const router = Router();

        router.get("/search", SearchRateLimit, MediaController.Query);
        router.get("/info", InfoRateLimit, MediaController.GetInfo);
        router.get("/formats", InfoRateLimit, MediaController.GetFormats);
        router.post("/download", DownloadRateLimit, MediaController.Download);

        app.use(`${name}`, router);
    }
}