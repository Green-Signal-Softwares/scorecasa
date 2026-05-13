import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(cookieParser(process.env.SESSION_SECRET ?? "scorecasa_secret"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, _res, next) => {
  const sessionCookie = req.signedCookies?.session;
  if (sessionCookie) {
    try {
      (req as any).session = JSON.parse(sessionCookie);
    } catch {
      (req as any).session = {};
    }
  } else {
    (req as any).session = {};
  }

  const originalJson = _res.json.bind(_res);
  (req as any).session.destroy = () => {
    _res.clearCookie("session");
  };

  next();
});

app.use((req, res, next) => {
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const session = (req as any).session;
    if (session && Object.keys(session).filter((k) => k !== "destroy").length > 0) {
      const { destroy: _, ...data } = session;
      res.cookie("session", JSON.stringify(data), {
        signed: true,
        httpOnly: true,
        sameSite: "none",
        secure: true,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }
    return originalJson(body);
  };
  next();
});

app.use("/api", router);

export default app;
