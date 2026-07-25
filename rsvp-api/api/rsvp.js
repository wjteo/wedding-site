const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "wedding";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

const MAX_NAME_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_ADULTS = 10;
const MAX_CHILDREN = 9;

// Reuse the client connection across warm serverless invocations instead of
// opening a new connection on every request.
let clientPromise = null;
function getClient() {
  if (!clientPromise) {
    if (!MONGODB_URI) {
      throw new Error("MONGODB_URI environment variable is not set");
    }
    clientPromise = new MongoClient(MONGODB_URI).connect();
  }
  return clientPromise;
}

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function isNonEmptyString(value, maxLength) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function sanitizeNameList(value, maxCount) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v) => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0 && v.length <= MAX_NAME_LENGTH)
    .slice(0, maxCount);
}

module.exports = async (req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  const body = req.body || {};

  // Honeypot: real users never fill this hidden field. Bots that do get a
  // fake success response so they don't know to retry.
  if (typeof body.website === "string" && body.website.trim().length > 0) {
    res.status(200).json({ ok: true });
    return;
  }

  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const attending = body.attending === "yes" || body.attending === "no" ? body.attending : null;
  const adultCount = Number.isInteger(body.adultCount) ? body.adultCount : NaN;
  const childrenCount = Number.isInteger(body.childrenCount) ? body.childrenCount : NaN;
  const selfDriving = body.selfDriving === "yes" || body.selfDriving === "no" ? body.selfDriving : null;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const additionalGuestNames = sanitizeNameList(body.additionalGuestNames, MAX_ADULTS - 1);
  const childrenNames = sanitizeNameList(body.childrenNames, MAX_CHILDREN);

  if (!isNonEmptyString(fullName, MAX_NAME_LENGTH)) {
    res.status(400).json({ ok: false, error: "A valid full name is required" });
    return;
  }
  if (!attending) {
    res.status(400).json({ ok: false, error: "Attendance response is required" });
    return;
  }
  if (!(adultCount >= 1 && adultCount <= MAX_ADULTS)) {
    res.status(400).json({ ok: false, error: "Adult count must be between 1 and " + MAX_ADULTS });
    return;
  }
  if (!(childrenCount >= 0 && childrenCount <= MAX_CHILDREN)) {
    res.status(400).json({ ok: false, error: "Children count must be between 0 and " + MAX_CHILDREN });
    return;
  }
  // The self-driving question is only shown (and answerable) in the form when
  // attending, so only require it in that case.
  if (attending === "yes" && !selfDriving) {
    res.status(400).json({ ok: false, error: "Please let us know if you'll be self-driving" });
    return;
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    res.status(400).json({ ok: false, error: "Message is too long" });
    return;
  }

  try {
    const client = await getClient();
    const db = client.db(MONGODB_DB);
    await db.collection("rsvps").insertOne({
      fullName,
      attending,
      adultCount,
      additionalGuestNames,
      childrenCount,
      childrenNames,
      selfDriving,
      message: message || null,
      submittedAt: new Date(),
      userAgent: req.headers["user-agent"] || null
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("RSVP insert failed:", err);
    res.status(500).json({ ok: false, error: "Something went wrong. Please try again." });
  }
};
