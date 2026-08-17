import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCW8DJTnEbhM4MIeyZ7KZt2SiUl7VMCUiM",
  authDomain: "controle-chaves-imv.firebaseapp.com",
  projectId: "controle-chaves-imv",
  storageBucket: "controle-chaves-imv.firebasestorage.app",
  messagingSenderId: "201397071822",
  appId: "1:201397071822:web:82302aab0d1c891807859f",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
