require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI not set in environment');
    process.exit(1);
  }
  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const collection = db.collection('invoices');

    const indexes = await collection.indexes();
    console.log('Existing indexes on invoices:', indexes.map(i => i.name));

    const toDrop = indexes.filter(idx => {
      const key = idx.key || {};
      const isEmail = Object.keys(key).length === 1 && key.customer_email === 1;
      const isPhone = Object.keys(key).length === 1 && key.customer_phone === 1;
      // Also guard if index name matches the default naming convention
      const nameIsEmail = idx.name === 'customer_email_1';
      const nameIsPhone = idx.name === 'customer_phone_1';
      return isEmail || isPhone || nameIsEmail || nameIsPhone;
    });

    if (toDrop.length === 0) {
      console.log('No unique indexes on customer_email or customer_phone found. Nothing to drop.');
    } else {
      for (const idx of toDrop) {
        try {
          console.log('Dropping index:', idx.name, idx.key);
          await collection.dropIndex(idx.name);
        } catch (err) {
          console.warn(`Failed to drop index ${idx.name}:`, err.message);
        }
      }
    }

    await mongoose.disconnect();
    console.log('Done.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

main();
