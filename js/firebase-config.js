import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAQqcASvxmwswQCi2WCHZYGuXfEddQCHtc",
  authDomain: "institutosmp-c45c5.firebaseapp.com",
  databaseURL: "https://institutosmp-c45c5-default-rtdb.firebaseio.com",
  projectId: "institutosmp-c45c5",
  storageBucket: "institutosmp-c45c5.firebasestorage.app",
  messagingSenderId: "911685118285",
  appId: "1:911685118285:web:93fac84c745f6c91072f04",
  measurementId: "G-W02ZCC4DF9"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

export { app, auth, db };

