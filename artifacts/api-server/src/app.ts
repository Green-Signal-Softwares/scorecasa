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
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

app.use((req, res, next) => {
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

  (req as any)._sessionDestroyed = false;
  (req as any).session.destroy = () => {
    (req as any)._sessionDestroyed = true;
    for (const key of Object.keys((req as any).session)) {
      if (key !== "destroy") delete (req as any).session[key];
    }
    res.clearCookie("session", {
      httpOnly: true,
      sameSite: "none",
      secure: true,
    });
  };

  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const session = (req as any).session;
    if ((req as any)._sessionDestroyed) {
      return originalJson(body);
    }
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
