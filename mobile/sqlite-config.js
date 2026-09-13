// sqlite-config.js
import SQLite from 'react-native-sqlite-storage';

const db = SQLite.openDatabase(
  {
    name: 'DentalPortalDB.db',
    location: 'default',
  },
  () => {},
  error => {
    console.log('SQLite Database Error: ', error);
  }
);

export const createTables = () => {
  db.transaction(tx => {
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS offline_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clinic_id INTEGER,
        appointment_id INTEGER,
        patient_data TEXT,
        sync_status TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    );
  });
};