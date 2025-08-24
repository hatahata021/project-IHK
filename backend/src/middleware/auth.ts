import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * 認証エラーレスポンス
 */
interface AuthErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
  metadata: {
    timestamp: Date;
    version: string;
  };
}

/**
 * JWTペイロード
 */
interface JWTPayload {
  userId: string;
  email: string;
  username?: string;
  iat: number;
  exp: number;
}

/**
 * 拡張されたRequestオブジェクト
 */
export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    username?: string;
  };
}

/**
 * 認証ミドルウェア
 * JWTトークンを検証してユーザー情報をリクエストに追加
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    // Authorizationヘッダーからトークンを取得
    const authHeader = req.get('Authorization');
    
    if (!authHeader) {
      const response: AuthErrorResponse = {
        success: false,
        error: {
          code: 'MISSING_AUTH_HEADER',
          message: 'Authorizationヘッダーが必要です'
        },
        metadata: {
          timestamp: new Date(),
          version: '1.0.0'
        }
      };
      res.status(401).json(response);
      return;
    }

    // Bearer トークン形式をチェック
    const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/);
    if (!tokenMatch) {
      const response: AuthErrorResponse = {
        success: false,
        error: {
          code: 'INVALID_AUTH_FORMAT',
          message: 'Authorization形式が正しくありません（Bearer <token>）'
        },
        metadata: {
          timestamp: new Date(),
          version: '1.0.0'
        }
      };
      res.status(401).json(response);
      return;
    }

    const token = tokenMatch[1];

    // JWT署名キーを取得（本来はSecrets Managerから取得）
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
    
    // トークンを検証
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

    // ユーザー情報をリクエストに追加
    (req as AuthenticatedRequest).user = {
      id: decoded.userId,
      email: decoded.email,
      username: decoded.username
    };

    console.log(`認証成功: ユーザーID ${decoded.userId}, メール ${decoded.email}`);
    next();

  } catch (error) {
    console.error('認証エラー:', error);

    let errorCode = 'AUTH_ERROR';
    let errorMessage = '認証に失敗しました';

    if (error instanceof jwt.JsonWebTokenError) {
      if (error.name === 'TokenExpiredError') {
        errorCode = 'TOKEN_EXPIRED';
        errorMessage = 'トークンの有効期限が切れています';
      } else if (error.name === 'JsonWebTokenError') {
        errorCode = 'INVALID_TOKEN';
        errorMessage = 'トークンが無効です';
      }
    }

    const response: AuthErrorResponse = {
      success: false,
      error: {
        code: errorCode,
        message: errorMessage
      },
      metadata: {
        timestamp: new Date(),
        version: '1.0.0'
      }
    };

    res.status(401).json(response);
  }
}

/**
 * オプショナル認証ミドルウェア
 * トークンがある場合のみ認証を行い、ない場合はそのまま通す
 */
export function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.get('Authorization');
  
  if (!authHeader) {
    // 認証情報がない場合はそのまま通す
    next();
    return;
  }

  // 認証情報がある場合は通常の認証を実行
  authMiddleware(req, res, next);
}

/**
 * 管理者権限チェックミドルウェア
 * 認証ミドルウェアの後に使用
 */
export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  const user = (req as AuthenticatedRequest).user;
  
  if (!user) {
    const response: AuthErrorResponse = {
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: '認証が必要です'
      },
      metadata: {
        timestamp: new Date(),
        version: '1.0.0'
      }
    };
    res.status(401).json(response);
    return;
  }

  // 管理者権限チェック（実装は要件に応じて調整）
  // 現在は簡易実装として特定のメールドメインをチェック
  const isAdmin = user.email.endsWith('@admin.example.com') || 
                  user.email === 'admin@multilingual-community.com';

  if (!isAdmin) {
    const response: AuthErrorResponse = {
      success: false,
      error: {
        code: 'INSUFFICIENT_PERMISSIONS',
        message: '管理者権限が必要です'
      },
      metadata: {
        timestamp: new Date(),
        version: '1.0.0'
      }
    };
    res.status(403).json(response);
    return;
  }

  console.log(`管理者認証成功: ${user.email}`);
  next();
}

/**
 * JWTトークンを生成（ユーティリティ関数）
 */
export function generateToken(payload: Omit<JWTPayload, 'iat' | 'exp'>, expiresIn: string = '24h'): string {
  const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
  
  return jwt.sign(payload, jwtSecret, {
    expiresIn,
    issuer: 'multilingual-community',
    audience: 'multilingual-community-users'
  });
}

/**
 * JWTトークンを検証（ユーティリティ関数）
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret-key';
    return jwt.verify(token, jwtSecret) as JWTPayload;
  } catch (error) {
    console.error('トークン検証エラー:', error);
    return null;
  }
}