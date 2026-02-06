import rateLimit from "express-rate-limit";

interface RateLimitProps {
    windowMs: number;
    max: number;
    blockDurationMs: number;
    message: string;
}

export class RateLimitUtils {
    public static createRateLimit(props: RateLimitProps) {
        return rateLimit({
            windowMs: props.windowMs,
            max: props.max,
            skipSuccessfulRequests: false,
            skipFailedRequests: false,
            standardHeaders: true,
            legacyHeaders: false,
            handler: (req, res) => {
                res.status(429).json({
                    error: "Too many requests",
                    message: props.message,
                    retryAfter: Math.ceil(props.blockDurationMs / 1000)
                });
            },
            store: new (class {
                private hits: Map<string, { count: number; resetTime: number; blockedUntil?: number }> = new Map();
                private readonly windowMs: number;
                private readonly max: number;
                private readonly blockDurationMs: number;

                constructor(windowMs: number, max: number, blockDurationMs: number) {
                    this.windowMs = windowMs;
                    this.max = max;
                    this.blockDurationMs = blockDurationMs;
                }

                async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
                    const now = Date.now();
                    const record = this.hits.get(key);

                    if (record?.blockedUntil && now < record.blockedUntil) {
                        return { totalHits: 999, resetTime: new Date(record.blockedUntil) };
                    }

                    if (record?.blockedUntil && now >= record.blockedUntil) {
                        this.hits.delete(key);
                    }

                    if (!record || now > record.resetTime) {
                        this.hits.set(key, {
                            count: 1,
                            resetTime: now + this.windowMs
                        });
                        return { totalHits: 1, resetTime: new Date(now + this.windowMs) };
                    }

                    record.count++;

                    if (record.count > this.max) {
                        record.blockedUntil = now + this.blockDurationMs;
                        return { totalHits: record.count, resetTime: new Date(record.blockedUntil) };
                    }

                    return { totalHits: record.count, resetTime: new Date(record.resetTime) };
                }

                async decrement(key: string): Promise<void> {
                    // No implementado
                }

                async resetKey(key: string): Promise<void> {
                    this.hits.delete(key);
                }
            })(props.windowMs, props.max, props.blockDurationMs)
        });
    }
}