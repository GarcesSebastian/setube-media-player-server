import express from "express";
import { config } from "dotenv";
import chalk from "chalk";
import rateLimit from "express-rate-limit";
import { MediaRoute } from "./routes/media.route.js";
import cors from "cors";

config();

const PORT = process.env.PORT || 3000;
const ORIGINS = process.env.ORIGINS?.split(",") || "*";

const app = express();

const rateLimitGlobal = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests from this IP, please try again after 15 minutes"
});

const corsConfiguration = cors({
    origin: ORIGINS,
    credentials: true
});

app.use(rateLimitGlobal);
app.use(corsConfiguration);
app.use(express.json());

app.listen(PORT, () => {
    console.log("Server is running on port", chalk.yellow(PORT));
    MediaRoute.init("/media", app);
});