import { enablePromise, openDatabase } from 'react-native-sqlite-storage';

const tableName = 'cavesData';

enablePromise(true);

export const getDBConnection = async () => {
  return openDatabase({ name: 'caves-data.db', location: 'default' });
};

export const createTable = async (db) => {
  // create table if not exists
  const query = `CREATE TABLE IF NOT EXISTS ${tableName}(
        value TEXT NOT NULL
    );`;

  await db.executeSql(query);
};

export const getCavesItems = async (db) => {
  try {
    const cavesItems = [];
    const results = await db.executeSql(`SELECT rowid as id,value FROM ${tableName}`);
    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        cavesItems.push(result.rows.item(index))
      }
    });
    return cavesItems;
  } catch (error) {
    console.error(error);
    throw Error('Failed to get cavesItems !!!');
  }
};

export const saveCavesItems = async (db, cavesItems) => {
  const insertQuery =
    `INSERT OR REPLACE INTO ${tableName}(rowid, value) values` +
    cavesItems.map(i => `(${i.id}, '${i.value}')`).join(',');

  return db.executeSql(insertQuery);
};

export const deleteCavesItem = async (db, id) => {
  const deleteQuery = `DELETE from ${tableName} where rowid = ${id}`;
  await db.executeSql(deleteQuery);
};

export const deleteTable = async (db) => {
  const query = `drop table ${tableName}`;

  await db.executeSql(query);
};