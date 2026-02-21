import crypto from "crypto";

const CAPTCHA_SECRET =
  process.env.CAPTCHA_SECRET?.trim() ||
  process.env.NEXTAUTH_SECRET?.trim() ||
  "change-this-captcha-secret";

const CAPTCHA_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CAPTCHA_LENGTH = 5;
const CAPTCHA_EXPIRES_MS = 5 * 60 * 1000;

type CaptchaPayload = {
  nonce: string;
  digest: string;
  exp: number;
};

function hmac(input: string) {
  return crypto.createHmac("sha256", CAPTCHA_SECRET).update(input).digest("base64url");
}

function safeEqualString(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function signPayload(payload: CaptchaPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = hmac(`captcha-token:${body}`);
  return `${body}.${signature}`;
}

function parseToken(token: string): CaptchaPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [body, signature] = parts;
  const expected = hmac(`captcha-token:${body}`);
  if (!safeEqualString(expected, signature)) return null;

  try {
    const raw = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (
      typeof raw?.nonce !== "string" ||
      typeof raw?.digest !== "string" ||
      typeof raw?.exp !== "number"
    ) {
      return null;
    }
    return {
      nonce: raw.nonce,
      digest: raw.digest,
      exp: raw.exp,
    };
  } catch {
    return null;
  }
}

function randomCode(length: number) {
  let output = "";
  for (let i = 0; i < length; i += 1) {
    const index = crypto.randomInt(0, CAPTCHA_CHARS.length);
    output += CAPTCHA_CHARS[index];
  }
  return output;
}

function randomColor(alpha = 0.75) {
  const r = crypto.randomInt(60, 200);
  const g = crypto.randomInt(60, 200);
  const b = crypto.randomInt(60, 200);
  return `rgba(${r},${g},${b},${alpha})`;
}

function createCaptchaSvg(code: string) {
  const width = 160;
  const height = 56;
  const lineCount = 6;
  const dotCount = 36;

  const lines = Array.from({ length: lineCount }, (_, index) => {
    const x1 = crypto.randomInt(0, width / 2);
    const y1 = crypto.randomInt(0, height);
    const x2 = crypto.randomInt(width / 2, width);
    const y2 = crypto.randomInt(0, height);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${randomColor(
      0.7,
    )}" stroke-width="${1 + (index % 2)}" />`;
  }).join("");

  const dots = Array.from({ length: dotCount }, () => {
    const cx = crypto.randomInt(0, width);
    const cy = crypto.randomInt(0, height);
    const r = Math.max(1, crypto.randomInt(1, 3));
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${randomColor(0.35)}" />`;
  }).join("");

  const chars = code
    .split("")
    .map((char, index) => {
      const x = 18 + index * 27 + crypto.randomInt(-2, 3);
      const y = 34 + crypto.randomInt(-5, 5);
      const rotate = crypto.randomInt(-35, 36);
      return `<text x="${x}" y="${y}" font-size="42" font-family="Arial, sans-serif" fill="${randomColor(
        0.95,
      )}" transform="rotate(${rotate} ${x} ${y})">${char}</text>`;
    })
    .join("");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="8" fill="#f8fafc" stroke="#d7dde8" />`,
    lines,
    dots,
    chars,
    "</svg>",
  ].join("");
}

export function createCaptchaChallenge() {
  const code = randomCode(CAPTCHA_LENGTH);
  const nonce = crypto.randomBytes(16).toString("hex");
  const exp = Date.now() + CAPTCHA_EXPIRES_MS;
  const digest = hmac(`captcha:${code}:${nonce}`);

  const token = signPayload({ nonce, digest, exp });
  const svg = createCaptchaSvg(code);
  const image = `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;

  return {
    token,
    image,
    expiresIn: Math.floor(CAPTCHA_EXPIRES_MS / 1000),
  };
}

export function verifyCaptchaChallenge(token: string, input: string) {
  const normalizedToken = typeof token === "string" ? token.trim() : "";
  const normalizedInput = typeof input === "string" ? input.trim().toUpperCase() : "";

  if (!normalizedToken || !normalizedInput) return false;

  const payload = parseToken(normalizedToken);
  if (!payload) return false;
  if (payload.exp < Date.now()) return false;

  const expectedDigest = hmac(`captcha:${normalizedInput}:${payload.nonce}`);
  return safeEqualString(payload.digest, expectedDigest);
}
