// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBeQAXva6AgF24jo87iJZhY_JYE5mN0ip8",
  authDomain: "creative-souls-3d.firebaseapp.com",
  projectId: "creative-souls-3d",
  storageBucket: "creative-souls-3d.appspot.com",
  messagingSenderId: "909080221258",
  appId: "1:909080221258:web:72c688b7fed7b3a96bb8b3"
};

// Initialize Firebase (Prevent double initialization)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  console.log("Firebase initialized successfully");
}

// Initialize Services
const db = firebase.firestore();
const auth = firebase.auth();
