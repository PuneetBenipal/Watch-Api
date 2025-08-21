const cookieParser = require("cookie-parser");
const geoip = require("geoip-lite");
const c2c = require("country-to-currency");

function currencyByIpMiddleware() {
    return [
        cookieParser(),
        (req, res, next) => {
            // Respect existing cookie (user might have switched manually)
            const existing = req.cookies?.currency;
            if (existing) {
                res.locals.currency = existing;
                return next();
            }

            // Get client IP (works behind proxies/CDN with trust proxy)
            const cf = req.headers["cf-connecting-ip"];
            const xff = req.headers["x-forwarded-for"];
            const ip =
                (cf && String(cf)) ||
                (xff && String(xff).split(",")[0].trim()) ||
                req.ip ||
                req.socket?.remoteAddress ||
                "";

            // Lookup country from IP → map to currency
            const country = geoip.lookup(ip)?.country; // e.g., "US", "JP", "DE"
            const currency = (country && c2c[country]) || "USD"; // default fallback

            res.locals.currency = currency;
            // cache for 30 days so we don’t geo-lookup every request
            res.cookie("currency", currency, {
                maxAge: 1000 * 60 * 60 * 24 * 30,
                sameSite: "Lax",
                path: "/",
            });
            next();
        },
    ];
}

module.exports = currencyByIpMiddleware;