import { Strategy as JwtStrategy } from "passport-jwt";
import userService from "../../services/userService.js";
import { JWT_SECRET } from "../../env.js";

const accessExtractor = function (req) {
  var token = null;
  const cookieString = req.headers.cookie;
  console.log("헤더 토큰" + cookieString);
  console.log("쿠키 토큰" + req.cookies);
  const accessToken = cookieString
    .split("; ")
    .find((cookie) => cookie.startsWith("access-token="))
    .split("=")[1];

  if (req && accessToken) {
    token = accessToken;
  } else {
    token = req.headers.authorization;
  }
  // console.log("엑세스" + token);
  return token;
};

const refreshExtractor = function (req) {
  var token = null;
  const cookieString = req.headers.cookie;

  const refreshToken = cookieString
    .split("; ")
    .find((cookie) => cookie.startsWith("access-token="))
    .split("=")[1];
  if (req && refreshToken) {
    token = refreshToken;
  } else {
    token = req.headers.refreshtoken;
  }
  // console.log("리프레쉬" + token);
  return token;
};

const accessTokenOptions = {
  jwtFromRequest: accessExtractor,
  secretOrKey: JWT_SECRET,
};

const refreshTokenOptions = {
  jwtFromRequest: refreshExtractor,
  secretOrKey: JWT_SECRET,
};

async function jwtVerify(payload, done) {
  const { userId } = payload;
  try {
    const user = await userService.getUserById(userId);
    if (!user) {
      return done(null, false);
    }
    return done(null, user);
  } catch (error) {
    return done(error);
  }
}

//리퀘스트의 사용자 정보를 담아줌  -> req.user
export const accessTokenStrategy = new JwtStrategy(
  accessTokenOptions,
  jwtVerify
);
export const refreshTokenStrategy = new JwtStrategy(
  refreshTokenOptions,
  jwtVerify
);
