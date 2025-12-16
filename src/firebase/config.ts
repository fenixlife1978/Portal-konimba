// src/firebase/config.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  projectId: "studio-6426029066-6f953",
  appId: "1:370188159320:web:bae5c79c4f238c9911bd2d",
  storageBucket: "studio-6426029066-6f953.appspot.com",
  apiKey: "AIzaSyA_BD97RuTUVwuA5bMKt3eWTXPypoytuPg",
  authDomain: "studio-6426029066-6f953.firebaseapp.com",
  measurementId: "",
  messagingSenderId: "370188159320",
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// 👉 Exporta instancias para usar en tu proyecto
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
