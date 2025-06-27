import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

// Use default values for development if environment variables are not set
const REPLIT_DOMAINS = process.env.REPLIT_DOMAINS || `${process.env.REPL_SLUG || 'examcraft'}.${process.env.REPL_OWNER || 'user'}.repl.co`;
const REPL_ID = process.env.REPL_ID || process.env.REPL_SLUG || 'examcraft';

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  const email = claims["email"] as string;
  const SUPER_ADMIN_EMAIL = "mehdawiadham@gmail.com";
  
  let role = "student"; // Default role
  
  if (email === SUPER_ADMIN_EMAIL) {
    role = "super_admin";
  } else {
    // Check invitation for role assignment
    const invitation = await storage.getUserInvitationByEmail(email);
    if (invitation && invitation.role) {
      role = invitation.role;
    }
  }
  
  await storage.upsertUser({
    id: claims["sub"] as string,
    email: claims["email"] as string,
    firstName: claims["first_name"] as string,
    lastName: claims["last_name"] as string,
    profileImageUrl: claims["profile_image_url"] as string,
    role: role,
    isActive: true,
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const claims = tokens.claims();
    const email = claims?.email;
    
    if (!email) {
      verified(new Error('Access denied: No email address provided'), false);
      return;
    }
    
    // Check if user is the designated super admin
    const SUPER_ADMIN_EMAIL = "mehdawiadham@gmail.com";
    
    if (email === SUPER_ADMIN_EMAIL) {
      // Super admin can always log in
      const user = {};
      updateUserSession(user, tokens);
      await upsertUser(claims);
      verified(null, user);
      return;
    }
    
    // Check if user has a valid invitation
    const invitation = await storage.getUserInvitationByEmail(email);
    if (!invitation) {
      // No invitation found - deny access
      verified(new Error('Access denied: No invitation found for this email address'), false);
      return;
    }
    
    if (invitation.inviteStatus !== 'pending') {
      // Invitation already used or expired
      verified(new Error('Access denied: Invitation has already been used or expired'), false);
      return;
    }
    
    // Check if invitation has expired
    if (invitation.expiresAt && new Date() > invitation.expiresAt) {
      verified(new Error('Access denied: Invitation has expired'), false);
      return;
    }
    
    // Valid invitation found - allow login and activate invitation
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(claims);
    
    // Mark invitation as accepted
    await storage.updateUserInvitationStatus(invitation.id, 'accepted', new Date());
    
    verified(null, user);
  };

  for (const domain of REPLIT_DOMAINS.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: REPL_ID,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};

// Role-based authorization middleware
export const requireRole = (allowedRoles: string[]): RequestHandler => {
  return async (req, res, next) => {
    try {
      const user = req.user as any;
      if (!user?.claims?.sub) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Get user from database to check role
      const dbUser = await storage.getUser(user.claims.sub);
      if (!dbUser || !dbUser.isActive) {
        return res.status(401).json({ message: "User not found or inactive" });
      }

      if (!allowedRoles.includes(dbUser.role)) {
        return res.status(403).json({ 
          message: "Insufficient permissions", 
          required: allowedRoles,
          current: dbUser.role 
        });
      }

      // Add user info to request
      (req as any).dbUser = dbUser;
      next();
    } catch (error) {
      console.error("Role check error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  };
};

// Super admin only access
export const requireSuperAdmin = requireRole(["super_admin"]);

// Admin and super admin access
export const requireAdmin = requireRole(["super_admin", "admin"]);

// Teacher supervisor, admin, and super admin access
export const requireSupervisor = requireRole(["super_admin", "admin", "teacher_supervisor"]);

// Teacher, supervisor, admin, and super admin access
export const requireTeacher = requireRole(["super_admin", "admin", "teacher_supervisor", "teacher"]);