import express from "express";
import { toNodeHandler ,fromNodeHeaders } from "better-auth/node";
import { auth } from "./modules/authentication/auth";
import cors from "cors"; // Import the CORS middleware
import helmet from "helmet";
import uploadRouter from './modules/core/routers/upload.router'
const app = express();
const port = 8000;
// trust proxy for secure cookies behind Nginx/Cloudflare
app.set("trust proxy", 1);
// Configure CORS middleware
app.use(
  cors({
    origin: ["*","http://localhost:5173","http://localhost:3000"], // Replace with your frontend's origin
    methods: ["GET", "POST", "PUT", "DELETE"], // Specify allowed HTTP methods
    credentials: true, // Allow credentials (cookies, authorization headers, etc.)
  })
);
app.all("/api/auth/*splat", toNodeHandler(auth)); // For ExpressJS v4
app.use("/v1/uploads", uploadRouter); // For ExpressJS v4

// Body parsers for your own routes
app.use(express.json({ limit: "1mb" }));
app.use(helmet());


// Health checks
app.get("/healthz", (_req, res) => res.send("ok"));
app.get("/api/auth/ok", (_req, res) => res.send("ok"));

// Example: get current session/user from cookies
app.get("/api/me", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers)
    });
    res.json(session); // null if not authenticated
  } catch (err) {
    res.status(500).json({ error: "session_fetch_failed" });
  }
});


app.listen(port, () => {
    console.log(`Better Auth app listening on port ${port}`);
});