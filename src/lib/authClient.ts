"use client";

import { twoFactorClient, usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Misma web que el servidor: sin baseURL, las llamadas van a /api/auth/*.
export const authClient = createAuthClient({ plugins: [usernameClient(), twoFactorClient()] });
