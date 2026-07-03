#!/usr/bin/env node
/**
 * Reads this app's Firestore data and produces Supabase-ready JSON:
 *   - materials.json: the live materials table (carries forward, gets new IDs)
 *   - movements.json: IN/OUT/ADJUST history, flattened to one row per
 *     material line so it directly answers "who asked for X, when, where,
 *     how many" without unpacking a nested items array.
 *
 * Purchase requests (type PURCHASE) are NOT migrated — that history starts
 * fresh in the new system.
 *
 * Only material names are resolved to IDs (materials are live inventory data
 * that carries forward). project/subProject/contractor/requester are kept as
 * plain text on each row — those collections aren't being migrated, this is
 * just a read-only archive you can search later.
 *
 * Usage:
 *   node scripts/resolve-references.mjs --service-account=./serviceAccountKey.json --out=./migration-output
 *
 * Requires a Firebase service account key with Firestore read access
 * (Firebase Console → Project Settings → Service Accounts → Generate new private key).
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (const arg of argv) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) args[m[1]] = m[2];
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const serviceAccountPath = resolve(args['service-account'] || './serviceAccountKey.json');
const outDir = resolve(args['out'] || './migration-output');

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const normalize = (s) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

// ---- 1. Load materials (the only collection that carries forward) ---------

console.log('Loading materials...');
const materialsSnap = await db.collection('materials').get();
const materials = [];
const materialsByName = new Map(); // normalized name -> row
const duplicateMaterials = [];

for (const doc of materialsSnap.docs) {
  const data = doc.data();
  if (!data.name) continue;

  const row = { id: randomUUID(), firestore_id: doc.id, name: data.name, stock: data.stock ?? null, min: data.min ?? null };
  materials.push(row);

  const key = normalize(data.name);
  if (materialsByName.has(key)) {
    duplicateMaterials.push({ name: data.name, firestore_ids: [materialsByName.get(key).firestore_id, doc.id] });
  } else {
    materialsByName.set(key, row);
  }
}
console.log(`  materials=${materials.length}`);

// ---- 2. Load orders, keep only IN/OUT/ADJUST, flatten to one row per item -

console.log('Loading orders...');
const ordersSnap = await db.collection('orders').get();
console.log(`  orders=${ordersSnap.size}`);

const unresolvedMaterials = [];
const movements = []; // one row per material line, type IN / OUT / ADJUST only
let skippedPurchase = 0;

for (const doc of ordersSnap.docs) {
  const d = doc.data();
  const type = d.type || null;

  if (type === 'PURCHASE') {
    skippedPurchase++;
    continue;
  }

  const items = Array.isArray(d.items) ? d.items : [];
  for (const [idx, item] of items.entries()) {
    let materialId = null;
    if (item.name) {
      const hit = materialsByName.get(normalize(item.name));
      if (hit) {
        materialId = hit.id;
      } else {
        unresolvedMaterials.push({ doc_id: doc.id, doc_no: d.docNo || null, field: `items[${idx}].name`, value: item.name });
      }
    }

    movements.push({
      id: randomUUID(),
      firestore_id: doc.id,
      type,
      doc_no: d.docNo ?? null,
      date: d.date ?? null,
      timestamp: d.timestamp ?? null,
      material_id: materialId,
      material_name: item.name ?? null,
      qty: item.qty ?? null,
      prev_stock: item.prevStock ?? null,
      new_stock: item.newStock ?? null,
      project: d.project || null,
      sub_project: d.subProject || null,
      contractor: d.contractor || null,
      requester: d.requester || null,
      note: d.note || item.note || null,
    });
  }
}

// ---- 3. Write output --------------------------------------------------------

mkdirSync(outDir, { recursive: true });

const write = (name, data) => writeFileSync(resolve(outDir, name), JSON.stringify(data, null, 2));

write('materials.json', materials);
write('movements.json', movements);
write('unresolved.json', unresolvedMaterials);
write('duplicate-materials.json', duplicateMaterials);

// ---- 4. Summary --------------------------------------------------------

console.log(`\nWrote output to ${outDir}`);
console.log(`  materials: ${materials.length}`);
console.log(`  movements (one row per material line): ${movements.length}`);
console.log(`  purchase requests skipped (not migrated): ${skippedPurchase}`);
console.log(`  unresolved material references: ${unresolvedMaterials.length}`);
if (duplicateMaterials.length) {
  console.log(`  WARNING: ${duplicateMaterials.length} duplicate material name(s) — see duplicate-materials.json`);
}
