import { Router } from "express";
import { RootController } from "../controllers/root.controller.js";
import { RateLimitUtils } from "../utils/ratelimit.utils.js";
import cors from "cors";

export class RootRoute {
    public static init(name: string, app: Router) {
        const router = Router();

        router.use(RateLimitUtils.createRateLimit({
            windowMs: 10 * 1000,
            max: 5,
            blockDurationMs: 1 * 60 * 1000,
            message: "Too many requests"
        }));

        router.use(cors({
            origin: "*",
            credentials: true
        }))

        router.get("/", RootController.Root);

        app.use(`/${name}`, router);
    }
}