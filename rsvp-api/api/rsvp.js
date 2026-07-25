const { MongoClient } = require("mongodb");

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "wedding";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "*";

const MAX_NAME_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_GUESTS = 10;

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
  const guestCount = Number.isInteger(body.guestCount) ? body.guestCount : NaN;
  const transportation = isNonEmptyString(body.transportation, 60) ? body.transportation.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!isNonEmptyString(fullName, MAX_NAME_LENGTH)) {
    res.status(400).json({ ok: false, error: "A valid full name is required" });
    return;
  }
  if (!attending) {
    res.status(400).json({ ok: false, error: "Attendance response is required" });
    return;
  }
  if (!(guestCount >= 1 && guestCount <= MAX_GUESTS)) {
    res.status(400).json({ ok: false, error: "Guest count must be between 1 and " + MAX_GUESTS });
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
      guestCount,
      transportation: transportation || null,
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
