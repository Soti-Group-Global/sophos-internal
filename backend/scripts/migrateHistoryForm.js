/**
 * One-time migration: convert legacy historyForm string fields → object format.
 *
 * Old documents stored each historyForm field as a plain string (e.g. "").
 * The schema was later updated to expect:
 *   { value: String, isVerified: Boolean, verifiedBy: Mixed, verifiedAt: Date }
 *
 * Run once:
 *   cd backend
 *   node scripts/migrateHistoryForm.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");

const HISTORY_KEYS = [
  "complaints", "anamnesisMorbi", "anamnesisVitae",
  "physicalExam", "respiratory", "circulatory", "digestive", "urinary", "endocrine",
  "preliminaryDiagnosis", "examinationPlan", "examinationResults",
  "clinicalDiagnosis", "treatmentPlan",
];

async function run() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {  process.exit(1); }

  await mongoose.connect(uri);

  const col = mongoose.connection.collection("applications");

  // Find all docs where at least one historyForm field is still a string
  const orFilter = HISTORY_KEYS.map((k) => ({ [`historyForm.${k}`]: { $type: "string" } }));
  const cursor = col.find({ $or: orFilter });

  let total = 0, migrated = 0;
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    total++;

    const $set = {};
    for (const k of HISTORY_KEYS) {
      const f = doc.historyForm?.[k];
      if (typeof f === "string") {
        $set[`historyForm.${k}`] = {
          value: f,
          isVerified: false,
          verifiedBy: null,
          verifiedAt: null,
        };
      }
    }

    if (Object.keys($set).length > 0) {
      await col.updateOne({ _id: doc._id }, { $set });
      migrated++;
    }
  }

  await mongoose.disconnect();
}

run().catch((err) => {  process.exit(1); });
