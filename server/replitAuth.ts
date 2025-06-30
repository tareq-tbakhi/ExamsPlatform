import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

// Use default values for development if environment variables are not set
const REPLIT_DOMAINS = process.env.REPLIT_DOMAINS || 'localhost:5001';
const REPL_ID = process.env.REPL_ID || 'local-dev-examcraft';

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
  const isLocalDev = process.env.NODE_ENV === 'development' && !process.env.REPLIT_DEPLOYMENT;
  
  if (isLocalDev) {
    // Use memory store for local development
    return session({
      secret: process.env.SESSION_SECRET!,
      resave: false,
      saveUninitialized: true,
      cookie: {
        httpOnly: true,
        secure: false, // Allow cookies over HTTP in local dev
        sameSite: 'lax',
        maxAge: sessionTtl,
      },
    });
  }
  
  // Production: Use PostgreSQL store
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

// Helper function to create user account with proper role
async function createUserAccount(claims: any, role: string) {
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

  // Check if running locally
  const isLocalDev = process.env.NODE_ENV === 'development' && !process.env.REPLIT_DEPLOYMENT;
  
  if (isLocalDev) {
    console.log("🔐 Local development mode - using simplified authentication");
    
    // Setup local development routes
    app.get("/api/login", (req, res) => {
      // In local dev, automatically log in as super admin
      (req.session as any).userId = "local-dev-user";
      req.session.save(() => {
        res.redirect("/");
      });
    });
    
    app.get("/api/callback", (req, res) => {
      res.redirect("/");
    });
    
    app.get("/api/logout", (req, res) => {
      req.session.destroy(() => {
        res.redirect("/");
      });
    });
    
    return;
  }

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const claims = tokens.claims();
    const email = claims?.email;
    
    if (!email || typeof email !== 'string') {
      verified(null, false);
      return;
    }
    
    // Check if user is the designated super admin
    const SUPER_ADMIN_EMAIL = "mehdawiadham@gmail.com";
    
    if (email === SUPER_ADMIN_EMAIL) {
      // Super admin can always log in
      const user = {};
      updateUserSession(user, tokens);
      await createUserAccount(claims, "super_admin");
      verified(null, user);
      return;
    }
    
    // Check for platform invitation (admin/teacher access)
    const platformInvitation = await storage.getUserInvitationByEmail(email);
    
    // Check for exam invitation (student access)
    const examInvitations = await storage.getInvitationsByEmail(email);
    
    let userRole = "student";
    let hasValidAccess = false;
    
    // Check platform invitation first (for admin/teacher roles)
    if (platformInvitation && 
        platformInvitation.inviteStatus === 'pending' && 
        (!platformInvitation.expiresAt || new Date() <= platformInvitation.expiresAt)) {
      
      userRole = platformInvitation.role;
      hasValidAccess = true;
      
      // Mark platform invitation as accepted
      await storage.updateUserInvitationStatus(platformInvitation.id, 'accepted', new Date());
    }
    
    // Check exam invitations (for student access)
    else if (examInvitations && examInvitations.length > 0) {
      // Check if user has any valid exam invitations
      const validExamInvitation = examInvitations.find(inv => 
        inv.inviteStatus === 'pending' || inv.inviteStatus === 'sent'
      );
      
      if (validExamInvitation) {
        userRole = "student";
        hasValidAccess = true;
        
        // Mark first exam invitation as accessed (but not completed)
        await storage.updateInvitationStatus(validExamInvitation.id, 'accessed', new Date());
      }
    }
    
    if (!hasValidAccess) {
      // No valid invitation found - deny access
      verified(null, false);
      return;
    }
    
    // Valid invitation found - allow login with appropriate role
    const user = {};
    updateUserSession(user, tokens);
    
    // Create user account with the determined role
    await createUserAccount(claims, userRole);
    
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
      failureRedirect: "/access-denied",
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
  // Check if running locally
  const isLocalDev = process.env.NODE_ENV === 'development' && !process.env.REPLIT_DEPLOYMENT;
  
  if (isLocalDev) {
    // For local development, check if user is "logged in" via session
    if (req.session && (req.session as any).userId === "local-dev-user") {
      // Create mock user for local development WITHOUT database check
      (req as any).user = {
        claims: {
          sub: "local-dev-user",
          email: "dev@localhost",
          first_name: "Dev",
          last_name: "User"
        }
      };
      (req as any).dbUser = {
        id: "local-dev-user",
        email: "dev@localhost",
        firstName: "Dev",
        lastName: "User",
        role: "super_admin",
        isActive: true
      };
      req.isAuthenticated = () => true as any;
      
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  // Check if user is authenticated via session (email/password login)
  if (req.session && (req.session as any).userId) {
    const userId = (req.session as any).userId;
    const userEmail = (req.session as any).userEmail;
    const userRole = (req.session as any).userRole;
    
    // Get user from database
    const dbUser = await storage.getUser(userId);
    if (!dbUser || !dbUser.isActive) {
      return res.status(401).json({ message: "User not found or inactive" });
    }
    
    // Create user object for request
    (req as any).user = {
      claims: {
        sub: dbUser.id,
        email: dbUser.email,
        first_name: dbUser.firstName,
        last_name: dbUser.lastName
      }
    };
    (req as any).dbUser = dbUser;
    req.isAuthenticated = () => true as any;
    
    return next();
  }

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