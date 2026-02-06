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

const rate_limit_global = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: "Too many requests from this IP, please try again after 15 minutes"
});

const cors_configuration = cors({
    origin: ORIGINS,
    credentials: true
});

app.use(rate_limit_global);
app.use(cors_configuration);
app.use(express.json());

app.listen(PORT, () => {
    console.log("Server is running on port", chalk.yellow(PORT));
    MediaRoute.init("/media", app);
});