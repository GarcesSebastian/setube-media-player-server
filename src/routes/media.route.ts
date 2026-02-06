import { Router } from "express";
import { MediaController } from "../controllers/media.controller.js";
import { LogUtils } from "../utils/log.utils.js";

export class MediaRoute {
    public static init(name: string, app: Router) {
        LogUtils.LogRoute(name);
        const router = Router();

        router.get("/search", MediaController.Query);
        router.get("/info", MediaController.GetInfo);
        router.post("/download", MediaController.Download);

        app.use(`${name}`, router);
    }
}