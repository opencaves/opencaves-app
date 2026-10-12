// The Firebase SDK functions the app calls through utils/loadFirebase.js -
// re-exported by config/firebase.js (and the server's ssr/firebase.server.js),
// so code that loads Firebase on demand gets them with it:
// `const { db, doc, getDoc } = await loadFirebase()`. A function such code
// newly calls is added here. Code already loaded on demand (the admin
// pages, the sign-in dialogs...) imports the SDK directly.
export { arrayRemove, arrayUnion, clearIndexedDbPersistence, collection, deleteDoc, deleteField, doc, documentId, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, terminate, updateDoc, where, writeBatch } from 'firebase/firestore'
export { onAuthStateChanged, onIdTokenChanged, signOut } from 'firebase/auth'
