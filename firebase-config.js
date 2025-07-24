// ✅ Optimized Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBeQAXva6AgF24jo87iJZhY_JYE5mN0ip8",
  authDomain: "creative-souls-3d.firebaseapp.com",
  projectId: "creative-souls-3d",
  storageBucket: "creative-souls-3d.appspot.com",
  messagingSenderId: "909080221258",
  appId: "1:909080221258:web:72c688b7fed7b3a96bb8b3",
  measurementId: "G-VBGV15HC12"
};

// Initialize with error handling
try {
  firebase.initializeApp(firebaseConfig);
  console.log("Firebase initialized successfully");
} catch (err) {
  console.error("Firebase initialization error", err);
}

const db = firebase.firestore();
const auth = firebase.auth();

// Enable analytics if measurementId exists
if (firebaseConfig.measurementId) {
  firebase.analytics();
}