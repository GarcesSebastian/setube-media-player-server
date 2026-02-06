import type { Request, Response } from "express";

export class RootController {
    public static Root(req: Request, res: Response) {
        res.status(200).json({
            author: "Sebxstt",
            version: "1.0.0",
            description: "Setube Media Player Server"
        });
    }
}