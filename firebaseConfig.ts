import * as firebaseApp from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAfqCyDUj2jrwAeMEANsyBo8NxQjJC5Ass",
  authDomain: "fafabimbel-80a17.firebaseapp.com",
  databaseURL: "https://fafabimbel-80a17-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fafabimbel-80a17",
  storageBucket: "fafabimbel-80a17.firebasestorage.app",
  messagingSenderId: "886374492714",
  appId: "1:886374492714:web:7016ab856544f45dfaf153"
};

const app = firebaseApp.initializeApp(firebaseConfig);
export const db = getDatabase(app);