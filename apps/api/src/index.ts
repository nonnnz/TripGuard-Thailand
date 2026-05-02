// apps/api/src/index.ts
import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { jwt } from "@elysiajs/jwt";

import { recommendationsRoutes } from "./routes/recommendations";
import { packagesRoutes } from "./routes/packages";
import { destinationsRoutes } from "./routes/destinations";
import { partnerRoutes } from "./routes/partners";
import { adminRoutes } from "./routes/admin";
import { chatRoutes } from "./routes/chat";
import { authRoutes } from "./routes/auth";
import { v1Routes } from "./routes/v1";

const app = new Elysia()
  .use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:8080" }))
  .use(
    swagger({
      documentation: {
        info: { title: "AllWay API", version: "0.1.0" },
        tags: [
          {
            name: "recommendations",
            description: "Detour & AI recommendations",
          },
          { name: "packages", description: "Curated local packages" },
          { name: "destinations", description: "Destination data & graph" },
          { name: "partners", description: "Curated partner tools" },
          { name: "chat", description: "AI chatbot" },
          { name: "admin", description: "Admin & TAT dashboard" },
          { name: "auth", description: "Authentication" },
          { name: "v1", description: "Versioned API spec endpoints" },
        ],
      },
    }),
  )
  .use(
    jwt({
      name: "jwt",
      secret: process.env.JWT_SECRET || "change-me",
    }),
  )
  // Health check
  .get("/health", () => ({ status: "ok", ts: new Date().toISOString() }))
  // Routes
  .use(authRoutes)
  .use(recommendationsRoutes)
  .use(packagesRoutes)
  .use(destinationsRoutes)
  .use(partnerRoutes)
  .use(adminRoutes)
  .use(chatRoutes)
  .use(v1Routes)
  .listen(process.env.PORT || 3001);

console.log(`🛡️  AllWay API running at http://localhost:${app.server?.port}`);
console.log(`📖 Swagger docs at http://localhost:${app.server?.port}/swagger`);

export type App = typeof app;
